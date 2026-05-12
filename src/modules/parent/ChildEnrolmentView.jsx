/**
 * src/modules/parent/ChildEnrolmentView.jsx
 *
 * /app/parent/children
 *
 * Parent's own children list. Subscribed parents can enrol up to
 * `children_covered` children. Each child:
 *   - Has a name + level
 *   - Is linked to a parent_pupil_links row (so RLS lets the parent see them)
 *   - Optionally linked to a school's pupil record (if the school is on TTA SIMS)
 *
 * If the parent subscribed for 3 children and has enrolled 1, the form
 * shows "1 of 3 enrolled" and an "Add another child" button. If they're
 * already at quota, the button disables.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/services/auditService';
import { friendlyError } from '@/utils/friendlyError';

const LEVEL_OPTIONS = [
  { value: 'nursery_1', label: 'Nursery 1' },
  { value: 'nursery_2', label: 'Nursery 2' },
  { value: 'primary_1', label: 'Primary 1' },
  { value: 'primary_2', label: 'Primary 2' },
  { value: 'primary_3', label: 'Primary 3' },
  { value: 'primary_4', label: 'Primary 4' },
  { value: 'primary_5', label: 'Primary 5' },
  { value: 'primary_6', label: 'Primary 6' },
  { value: 'jss_1', label: 'JSS 1' },
  { value: 'jss_2', label: 'JSS 2' },
  { value: 'jss_3', label: 'JSS 3' },
];

export function ChildEnrolmentView() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: entitlement } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn: () => parentSubscriptionService.getEntitlement(),
    staleTime: 30_000,
  });

  // List children already linked to this parent.
  const { data: children, isLoading } = useQuery({
    queryKey: ['parent', 'my-children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_pupil_links')
        .select('pupil_id, pupils(id, full_name, level, date_of_birth, school_id, schools(name))')
        .eq('parent_user_id', user.id);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.pupils).filter(Boolean);
    },
    enabled: !!user?.id,
  });

  const quota = entitlement?.children_covered ?? 0;
  const enrolled = children?.length ?? 0;
  const canAddMore = enrolled < quota;

  const [adding, setAdding] = useState(false);

  return (
    <div className="max-w-[680px]">
      <div className="mb-s-7 flex items-end justify-between flex-wrap gap-s-4">
        <div>
          <div className="font-mono text-eyebrow uppercase text-gold-400">Children</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Your children.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            The children covered by your subscription. Each child gets
            their own personalised lessons and PDFs.
          </p>
        </div>
        {entitlement && (
          <Chip variant={canAddMore ? 'gold' : 'default'}>
            {enrolled} of {quota} enrolled
          </Chip>
        )}
      </div>

      {!entitlement && (
        <Card className="mb-s-5 border-amber-400/30 bg-amber-400/[0.04]">
          <Chip variant="amber" dot>Subscribe first</Chip>
          <p className="mt-s-3 text-body text-ink-2">
            You'll be able to enrol children once you have an active subscription.
          </p>
          <Link to="/app/parent/subscribe">
            <Button intent="primary" size="md" className="mt-s-4">See subscription options →</Button>
          </Link>
        </Card>
      )}

      {/* Existing children */}
      {isLoading && <div className="bg-surface-2 border border-line-1 rounded-r-3 h-[80px] animate-pulse mb-s-4" />}
      {children?.length > 0 && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden mb-s-5">
          {children.map((c) => <ChildRow key={c.id} child={c} />)}
        </div>
      )}

      {/* Add another */}
      {entitlement && canAddMore && (
        <>
          {!adding ? (
            <Button intent="primary" size="md" onClick={() => setAdding(true)}>
              + Enrol {enrolled === 0 ? 'your first child' : 'another child'}
            </Button>
          ) : (
            <AddChildCard
              parentUserId={user.id}
              onDone={() => {
                setAdding(false);
                qc.invalidateQueries({ queryKey: ['parent', 'my-children', user?.id] });
              }}
            />
          )}
        </>
      )}

      {entitlement && !canAddMore && (
        <Card>
          <div className="text-[13.5px] text-ink-2">
            You've enrolled all {quota} {quota === 1 ? 'child' : 'children'} covered by your plan.
            {' '}
            <Link to="/app/parent/subscribe" className="text-gold-200 underline-offset-4 hover:underline">
              Upgrade to cover more
            </Link>.
          </div>
        </Card>
      )}
    </div>
  );
}

function ChildRow({ child }) {
  return (
    <div className="flex items-center gap-s-4 px-s-4 py-s-4 border-b border-line-1 last:border-0">
      <div className="w-[40px] h-[40px] rounded-full bg-gold-400/10 border border-gold-400/25 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0">
        {(child.full_name ?? '?').slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] text-ink-1 truncate">{child.full_name}</div>
        <div className="font-mono text-meta text-ink-3 truncate">
          {formatLevel(child.level)}
          {child.schools?.name && <> · {child.schools.name}</>}
        </div>
      </div>
      <Link
        to={`/app/parent/lessons?child=${child.id}`}
        className="text-[12.5px] text-gold-200 hover:text-gold-50"
      >
        Lessons →
      </Link>
    </div>
  );
}

function AddChildCard({ parentUserId, onDone }) {
  const [form, setForm] = useState({
    full_name: '',
    level: 'primary_1',
    date_of_birth: '',
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const add = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Child's name is required.");

      // Parents enrolling from their own dashboard don't have a school
      // context — these pupils aren't bound to a school's roster. They
      // exist as parent-only pupil records: useful for lesson delivery,
      // not for SIMS attendance or report cards.
      //
      // school_id = null is allowed for these "home learner" pupils, but
      // our current schema enforces NOT NULL. Workaround: we'll add a
      // sentinel "Home learning" school row in migration 0012 and use
      // its id here. For now, we set school_id to NULL and depend on
      // migration to permit it.
      //
      // Until that migration lands, we use the user's profile.school_id
      // if available, or fail with a clear message.
      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('user_id', parentUserId)
        .single();

      if (!profile?.school_id) {
        throw new Error(
          'We need to set up a home-learning school first. Please contact support — this is a known limitation we are fixing in the next release.'
        );
      }

      // Create pupil + link
      const { data: pupil, error: pupilErr } = await supabase
        .from('pupils')
        .insert({
          school_id: profile.school_id,
          full_name: form.full_name.trim(),
          level: form.level,
          date_of_birth: form.date_of_birth || null,
          pupil_code: `HOME-${Date.now()}`, // unique enough; we'll regenerate properly
        })
        .select()
        .single();
      if (pupilErr) throw new Error(pupilErr.message);

      const { error: linkErr } = await supabase
        .from('parent_pupil_links')
        .insert({ parent_user_id: parentUserId, pupil_id: pupil.id });
      if (linkErr) throw new Error(linkErr.message);

      logAuditEvent({
        action: 'parent.child_enrolled',
        targetPupilId: pupil.id,
        details: { full_name: pupil.full_name, level: pupil.level },
      });

      return pupil;
    },
    onSuccess: onDone,
  });

  return (
    <Card>
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Add a child</div>
      <form
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
        className="flex flex-col gap-s-4"
      >
        <Field label="Child's full name *">
          <input
            type="text" value={form.full_name} required autoFocus
            onChange={(e) => update('full_name', e.target.value)}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
        <Field label="Current level *">
          <select
            value={form.level}
            onChange={(e) => update('level', e.target.value)}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Date of birth" hint="Optional. Helps tailor lesson content.">
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => update('date_of_birth', e.target.value)}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>

        {add.error && (
          <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
            {friendlyError(add.error)}
          </div>
        )}

        <div className="flex justify-end gap-s-3 pt-s-2">
          <Button intent="ghost" size="md" type="button" onClick={onDone}>Cancel</Button>
          <Button intent="primary" size="md" type="submit" isLoading={add.isPending}>
            Add child
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-3 italic">{hint}</span>}
    </label>
  );
}

function formatLevel(level) {
  if (!level) return '';
  return level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
