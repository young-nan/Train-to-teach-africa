/**
 * src/modules/parent/ChildEnrolmentView.jsx
 *
 * /app/parent/children
 *
 * WHAT CHANGED
 * ────────────
 * The previous version had a known bug documented in its own comments:
 * "this is a known limitation we are fixing in the next release."
 * Parents could not enrol home-learner children because school_id = null
 * was not permitted by RLS. Migration 0010 fixes that.
 *
 * This version:
 * 1. Creates home-learner pupils with school_id = null (now allowed)
 * 2. Adds the school connection request flow inline (no separate page)
 * 3. Shows connection status per child (pending / approved / not connected)
 * 4. Respects the children_covered quota from the parent's subscription
 *
 * DATA SEPARATION
 * ────────────────
 * Children listed here are TTA children (parent owns them).
 * School data (attendance, reports, scores) appears only when:
 *   a. Parent has an approved parent_school_connection
 *   b. The school configured the relevant share_* flags
 * That data surfaces in ProgressView, not here.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';
import * as schoolConnectionService from '@/services/schoolConnectionService';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/services/auditService';
import { friendlyError } from '@/utils/friendlyError';

const LEVEL_OPTIONS = [
  { value: 'nursery_1',  label: 'Nursery 1'  },
  { value: 'nursery_2',  label: 'Nursery 2'  },
  { value: 'primary_1',  label: 'Primary 1'  },
  { value: 'primary_2',  label: 'Primary 2'  },
  { value: 'primary_3',  label: 'Primary 3'  },
  { value: 'primary_4',  label: 'Primary 4'  },
  { value: 'primary_5',  label: 'Primary 5'  },
  { value: 'primary_6',  label: 'Primary 6'  },
  { value: 'jss_1',      label: 'JSS 1'      },
  { value: 'jss_2',      label: 'JSS 2'      },
  { value: 'jss_3',      label: 'JSS 3'      },
  { value: 'sss_1',      label: 'SSS 1'      },
  { value: 'sss_2',      label: 'SSS 2'      },
  { value: 'sss_3',      label: 'SSS 3'      },
];

export function ChildEnrolmentView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding]           = useState(false);
  const [connectingId, setConnectingId] = useState(null);  // pupil_id being connected

  // Subscription entitlement (quota)
  const { data: entitlement } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn:  () => parentSubscriptionService.getEntitlement(),
    staleTime: 30_000,
  });

  // Children linked to this parent
  const { data: children, isLoading } = useQuery({
    queryKey: ['parent', 'my-children', user?.id],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('parent_pupil_links')
        .select('pupil_id, pupils(id, full_name, level, date_of_birth, school_id, schools(name))')
        .eq('parent_user_id', user.id);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.pupils).filter(Boolean);
    },
    enabled: !!user?.id,
  });

  // School connections (to show status per child)
  const { data: connections } = useQuery({
    queryKey: ['parent', 'connections'],
    queryFn:  () => schoolConnectionService.listMyConnections(),
    staleTime: 30_000,
  });

  const quota    = entitlement?.children_covered ?? 0;
  const enrolled = children?.length ?? 0;
  const canAddMore = enrolled < quota;

  function connectionForChild(child) {
    // Find the connection that was approved and linked to this pupil
    return connections?.find((c) =>
      c.pupils?.id === child.id ||
      (c.status === 'pending' && !c.pupils)  // pending connections not yet linked
    );
  }

  return (
    <div className="max-w-[680px]">
      {/* Header */}
      <div className="mb-s-7 flex items-end justify-between flex-wrap gap-s-4">
        <div>
          <div className="font-mono text-eyebrow uppercase text-gold-400">Children</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Your children.</h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Each child gets personalised lessons and activity packs matched
            to their level. Connect them to their school to share report cards.
          </p>
        </div>
        {entitlement && (
          <Chip variant={canAddMore ? 'gold' : 'default'}>
            {enrolled} of {quota} enrolled
          </Chip>
        )}
      </div>

      {/* Subscribe gate */}
      {!entitlement && (
        <Card className="mb-s-5 border-amber-400/30 bg-amber-400/[0.04]">
          <Chip variant="amber" dot>Subscribe first</Chip>
          <p className="mt-s-3 text-body text-ink-2">
            Subscribe to start enrolling your children and unlock lessons.
          </p>
          <Link to="/app/parent/subscribe">
            <Button intent="primary" size="md" className="mt-s-4">
              See subscription options →
            </Button>
          </Link>
        </Card>
      )}

      {/* Children list */}
      {isLoading && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 h-[80px] animate-pulse mb-s-4" />
      )}

      {(children ?? []).length > 0 && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden mb-s-5">
          {children.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              connection={connectionForChild(child)}
              onConnectToSchool={() => setConnectingId(child.id)}
            />
          ))}
        </div>
      )}

      {/* School connection form (inline, per child) */}
      {connectingId && (
        <SchoolConnectionCard
          pupilId={connectingId}
          pupilName={children?.find((c) => c.id === connectingId)?.full_name ?? ''}
          onDone={() => {
            setConnectingId(null);
            qc.invalidateQueries({ queryKey: ['parent', 'connections'] });
          }}
        />
      )}

      {/* Add child form */}
      {entitlement && canAddMore && !adding && (
        <Button intent="primary" size="md" onClick={() => setAdding(true)}>
          + Enrol {enrolled === 0 ? 'your first child' : 'another child'}
        </Button>
      )}

      {entitlement && canAddMore && adding && (
        <AddChildCard
          parentUserId={user.id}
          onDone={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ['parent', 'my-children', user?.id] });
          }}
        />
      )}

      {/* Quota reached */}
      {entitlement && !canAddMore && (
        <Card>
          <p className="text-[13.5px] text-ink-2">
            All {quota} {quota === 1 ? 'child' : 'children'} covered by your plan are enrolled.{' '}
            <Link to="/app/parent/subscribe" className="text-gold-200 hover:underline">
              Upgrade to cover more
            </Link>
            .
          </p>
        </Card>
      )}

      {/* Connection requests section */}
      {(connections ?? []).length > 0 && (
        <ConnectionStatusSection connections={connections} />
      )}
    </div>
  );
}

// ── Child row ─────────────────────────────────────────────────────────────────

function ChildRow({ child, connection, onConnectToSchool }) {
  const statusChip = {
    approved: <Chip variant="green" dot size="sm">School connected</Chip>,
    pending:  <Chip variant="amber" dot size="sm">Connection pending</Chip>,
    rejected: <Chip variant="default" size="sm">Connection declined</Chip>,
    revoked:  <Chip variant="default" size="sm">Connection revoked</Chip>,
  };

  return (
    <div className="flex items-center gap-s-4 px-s-4 py-s-4 border-b border-line-1 last:border-0">
      {/* Avatar */}
      <div className="w-[40px] h-[40px] rounded-full bg-gold-400/10 border border-gold-400/25 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0">
        {(child.full_name ?? '?').charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] text-ink-0 font-medium truncate">{child.full_name}</div>
        <div className="font-mono text-meta text-ink-3 mt-[2px]">
          {formatLevel(child.level)}
          {child.schools?.name && <> · {child.schools.name}</>}
        </div>
        {connection && (
          <div className="mt-s-2">
            {statusChip[connection.status]}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-s-1 shrink-0">
        <Link
          to={`/app/parent/lessons?child=${child.id}`}
          className="font-mono text-meta text-gold-200 hover:text-gold-50"
        >
          Lessons →
        </Link>
        {!connection && (
          <button
            onClick={onConnectToSchool}
            className="font-mono text-meta text-ink-3 hover:text-gold-200 transition-colors"
          >
            + Connect school
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add child card ────────────────────────────────────────────────────────────

function AddChildCard({ parentUserId, onDone }) {
  const [form, setForm] = useState({ full_name: '', level: 'primary_1', date_of_birth: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const add = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Child's name is required.");

      // Create home-learner pupil (school_id = null — allowed by migration 0010)
      const { data: pupil, error: pupilErr } = await supabase
        .from('pupils')
        .insert({
          full_name:     form.full_name.trim(),
          level:         form.level,
          date_of_birth: form.date_of_birth || null,
          school_id:     null,    // home learner — no school affiliation
          // Unique code used for student login PIN — generated from name + timestamp
          pupil_code:    `TTA-${form.full_name.trim().toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`,
        })
        .select()
        .single();

      if (pupilErr) throw new Error(pupilErr.message);

      // Link the pupil to the parent
      const { error: linkErr } = await supabase
        .from('parent_pupil_links')
        .insert({ parent_user_id: parentUserId, pupil_id: pupil.id });

      if (linkErr) throw new Error(linkErr.message);

      logAuditEvent({
        action:        'parent.child_enrolled',
        targetPupilId: pupil.id,
        details:       { full_name: pupil.full_name, level: pupil.level },
      });

      return pupil;
    },
    onSuccess: onDone,
  });

  return (
    <Card className="mb-s-5">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Enrol a child</div>
      <div className="flex flex-col gap-s-4">
        <Field label="Child's full name *">
          <input
            type="text" value={form.full_name} autoFocus
            onChange={(e) => set('full_name', e.target.value)}
            placeholder="Adaeze Okonkwo"
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-0 outline-none focus:border-gold-400"
          />
        </Field>

        <Field label="Current level *">
          <select
            value={form.level}
            onChange={(e) => set('level', e.target.value)}
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-0 outline-none focus:border-gold-400"
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Date of birth" hint="Optional — helps personalise lesson content.">
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => set('date_of_birth', e.target.value)}
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-0 outline-none focus:border-gold-400"
          />
        </Field>

        {add.error && (
          <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
            {friendlyError(add.error)}
          </div>
        )}

        <div className="flex justify-end gap-s-3 pt-s-2">
          <Button intent="ghost" size="md" onClick={onDone}>Cancel</Button>
          <Button
            intent="primary" size="md"
            onClick={() => add.mutate()}
            disabled={add.isPending || !form.full_name.trim()}
          >
            {add.isPending ? 'Enrolling…' : 'Enrol child'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── School connection card ────────────────────────────────────────────────────

function SchoolConnectionCard({ pupilId, pupilName, onDone }) {
  const [query,         setQuery]         = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [className,     setClassName]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      if (!selectedSchool) throw new Error('Please select a school.');
      return schoolConnectionService.requestConnection({
        schoolId:         selectedSchool.id,
        claimedChildName: pupilName,
        claimedClassName: className,
      });
    },
    onSuccess: onDone,
  });

  async function handleSearch(q) {
    setQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await schoolConnectionService.searchSchools(q);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card className="mb-s-5 border-gold-400/20">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">
        Connect {pupilName} to their school
      </div>
      <p className="text-[13px] text-ink-2 mb-s-5">
        The school will review your request and approve what information is shared
        with you. Your subscription remains active regardless of their decision.
      </p>

      <div className="flex flex-col gap-s-4">
        {/* School search */}
        <Field label="Search for the school *">
          <div className="relative">
            <input
              type="text"
              value={selectedSchool ? selectedSchool.name : query}
              onChange={(e) => { setSelectedSchool(null); handleSearch(e.target.value); }}
              placeholder="Start typing the school name…"
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-0 outline-none focus:border-gold-400"
            />
            {searching && (
              <div className="absolute right-s-3 top-1/2 -translate-y-1/2 font-mono text-meta text-ink-3">
                Searching…
              </div>
            )}
          </div>
          {searchResults.length > 0 && !selectedSchool && (
            <div className="mt-s-1 bg-surface-2 border border-line-2 rounded-r-2 overflow-hidden">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSchool(s); setSearchResults([]); }}
                  className="w-full text-left px-s-4 py-s-3 border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors"
                >
                  <div className="text-body text-ink-0">{s.name}</div>
                  <div className="font-mono text-meta text-ink-3">
                    {[s.city, s.state].filter(Boolean).join(', ')}
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedSchool && (
            <div className="mt-s-1 flex items-center gap-s-3">
              <Chip variant="green" dot>{selectedSchool.name}</Chip>
              <button
                onClick={() => { setSelectedSchool(null); setQuery(''); }}
                className="font-mono text-meta text-ink-3 hover:text-red-400"
              >
                Change
              </button>
            </div>
          )}
        </Field>

        <Field label="Child's class name" hint="Optional but helps the school identify your child faster.">
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Primary 3 Emerald"
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-0 outline-none focus:border-gold-400"
          />
        </Field>

        {submit.error && (
          <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
            {friendlyError(submit.error)}
          </div>
        )}

        <div className="flex justify-end gap-s-3 pt-s-2">
          <Button intent="ghost" size="md" onClick={onDone}>Cancel</Button>
          <Button
            intent="primary" size="md"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !selectedSchool}
          >
            {submit.isPending ? 'Sending request…' : 'Request connection'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Connection status section ─────────────────────────────────────────────────

function ConnectionStatusSection({ connections }) {
  const pending  = connections.filter((c) => c.status === 'pending');
  const approved = connections.filter((c) => c.status === 'approved');

  if (pending.length === 0 && approved.length === 0) return null;

  return (
    <div className="mt-s-7">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
        School connections
      </div>

      {pending.length > 0 && (
        <div className="mb-s-4">
          <div className="text-[12px] font-mono uppercase text-ink-3 mb-s-2">Awaiting review</div>
          {pending.map((c) => (
            <div key={c.id} className="flex items-center gap-s-3 bg-surface-2 border border-amber-400/20 rounded-r-2 px-s-4 py-s-3 mb-s-2">
              <Chip variant="amber" dot size="sm">Pending</Chip>
              <div className="flex-1 text-body text-ink-1">{c.schools?.name}</div>
              <div className="font-mono text-meta text-ink-3">for {c.claimed_child_name}</div>
            </div>
          ))}
        </div>
      )}

      {approved.map((c) => (
        <div key={c.id} className="bg-surface-2 border border-green-400/20 rounded-r-2 px-s-4 py-s-3 mb-s-2">
          <div className="flex items-center gap-s-3 mb-s-2">
            <Chip variant="green" dot size="sm">Connected</Chip>
            <div className="text-body text-ink-1">{c.schools?.name}</div>
            <div className="font-mono text-meta text-ink-3">for {c.pupils?.full_name ?? c.claimed_child_name}</div>
          </div>
          <div className="flex gap-s-3 flex-wrap">
            {c.share_attendance   && <Chip variant="default" size="sm">Attendance shared</Chip>}
            {c.share_term_reports && <Chip variant="default" size="sm">Reports shared</Chip>}
            {c.share_score_summary && <Chip variant="default" size="sm">Scores shared</Chip>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-3 italic">{hint}</span>}
    </div>
  );
}

function formatLevel(level) {
  if (!level) return '';
  return level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
