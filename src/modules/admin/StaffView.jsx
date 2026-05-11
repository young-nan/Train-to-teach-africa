/**
 * src/modules/admin/StaffView.jsx
 *
 * /app/admin/staff
 *
 * Two surfaces in one screen:
 *   1. List of current staff (teachers, head teachers, school admins)
 *   2. Invite form for adding new staff
 *
 * The invite form has two modes:
 *   - Send invite email (default): magic link via Supabase
 *   - Set temporary password: admin types a password, hands it offline
 *
 * Role assignment is gated server-side in the invite-user edge function,
 * but we also hide options the caller can't grant (e.g. a head teacher
 * doesn't see "school admin" in the role dropdown).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as staffService from '@/services/staffService';
import { cn } from '@/utils/cn';

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  head_teacher: 'Head Teacher',
  teacher: 'Teacher',
};

const ROLES_BY_CALLER = {
  super_admin: ['school_admin', 'head_teacher', 'teacher'],
  school_admin: ['head_teacher', 'teacher'],
  head_teacher: ['teacher'],
};

export function StaffView() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const callerRole = profile?.role;

  const allowedRoles = ROLES_BY_CALLER[callerRole] ?? [];
  const canInvite = allowedRoles.length > 0;

  const qc = useQueryClient();
  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['admin', 'staff', schoolId],
    queryFn: () => staffService.listStaff({ schoolId }),
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7 flex items-end justify-between gap-s-4 flex-wrap">
        <div>
          <div className="font-mono text-eyebrow uppercase text-gold-400">Staff</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Teachers and administrators.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Everyone with a staff account at your school. Invite new staff
            to give them access to attendance, gradebook, and reports.
          </p>
        </div>
        {canInvite && (
          <Button
            intent="primary"
            size="md"
            onClick={() => setInviteOpen((v) => !v)}
          >
            {inviteOpen ? 'Close' : '+ Invite staff'}
          </Button>
        )}
      </div>

      {inviteOpen && canInvite && (
        <InviteStaffCard
          allowedRoles={allowedRoles}
          schoolId={schoolId}
          onDone={() => {
            setInviteOpen(false);
            qc.invalidateQueries({ queryKey: ['admin', 'staff', schoolId] });
          }}
        />
      )}

      {isLoading && <Skeleton />}
      {error && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="text-red-400">{error.message}</div>
        </Card>
      )}
      {staff && staff.length === 0 && (
        <Card>
          <div className="font-display text-display-3 text-ink-0">No staff yet.</div>
          <p className="mt-s-3 text-body text-ink-2">
            Invite your first teacher to get started.
          </p>
        </Card>
      )}
      {staff && staff.length > 0 && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
          {staff.map((s) => (
            <StaffRow key={s.user_id} staff={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffRow({ staff }) {
  const initials = (staff.full_name ?? '?').split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
  return (
    <div className="border-b border-line-1 last:border-0 flex items-center gap-s-4 px-s-4 py-s-3 min-h-[64px]">
      <div className="w-[40px] h-[40px] rounded-full bg-gold-400/10 border border-gold-400/25 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] text-ink-1 truncate">{staff.full_name ?? '(no name)'}</div>
        <div className="font-mono text-[10px] text-ink-3 truncate">{staff.email}</div>
      </div>
      <Chip variant={staff.role === 'head_teacher' ? 'gold' : 'default'}>
        {ROLE_LABEL[staff.role] ?? staff.role}
      </Chip>
    </div>
  );
}

function InviteStaffCard({ allowedRoles, schoolId, onDone }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: allowedRoles[0],
    mode: 'invite',
    temporary_password: '',
  });
  const [result, setResult] = useState(null);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const inviteMutation = useMutation({
    mutationFn: () => staffService.inviteStaff({
      mode: form.mode,
      email: form.email,
      fullName: form.full_name,
      role: form.role,
      schoolId,
      temporaryPassword: form.mode === 'password' ? form.temporary_password : undefined,
    }),
    onSuccess: (data) => {
      setResult(data);
      setForm((f) => ({ ...f, full_name: '', email: '', temporary_password: '' }));
    },
  });

  if (result) {
    return (
      <Card className="mb-s-5 border-green-400/30 bg-green-400/[0.04]">
        <div className="flex items-center gap-s-3 mb-s-4">
          <Chip variant="green" dot>
            {result.was_existing ? 'Linked' : 'Invited'}
          </Chip>
          <span className="text-[13.5px] text-ink-1">
            {result.was_existing
              ? 'This email was already an account — they now have access to your school.'
              : form.mode === 'invite'
                ? 'An invitation email has been sent. The new staff member will set their password from the link.'
                : 'Account created. Share the temporary password with them privately.'}
          </span>
        </div>
        {result.temporary_password && (
          <div className="bg-surface-3 border border-line-2 rounded-r-2 p-s-4 mb-s-4">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">Temporary password</div>
            <div className="font-mono text-[14px] text-ink-0 select-all">{result.temporary_password}</div>
            <div className="text-[11.5px] text-ink-3 mt-s-2">
              Share this verbally or in person. It won't be shown again.
            </div>
          </div>
        )}
        <div className="flex gap-s-3">
          <Button intent="primary" size="md" onClick={() => setResult(null)}>Invite another</Button>
          <Button intent="ghost" size="md" onClick={onDone}>Done</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-s-5">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Invite staff</div>
      <form
        onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(); }}
        className="flex flex-col gap-s-4"
        noValidate
      >
        <div className="grid sm:grid-cols-2 gap-s-4">
          <Field label="Full name *">
            <input
              type="text" value={form.full_name} required autoFocus
              onChange={(e) => update('full_name', e.target.value)}
              autoComplete="off"
              className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
            />
          </Field>
          <Field label="Email *">
            <input
              type="email" value={form.email} required
              onChange={(e) => update('email', e.target.value)}
              autoComplete="off"
              className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
            />
          </Field>
        </div>

        <Field label="Role *">
          <select
            value={form.role}
            onChange={(e) => update('role', e.target.value)}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </Field>

        <Field label="How should they get access? *">
          <div className="flex flex-col gap-s-3 mt-s-1">
            <ModeRadio
              checked={form.mode === 'invite'}
              onChange={() => update('mode', 'invite')}
              title="Send invite email"
              hint="They get a magic-link email and set their own password. Best for remote onboarding."
            />
            <ModeRadio
              checked={form.mode === 'password'}
              onChange={() => update('mode', 'password')}
              title="Set a temporary password"
              hint="You type a password now. Best when staff are on-premises and you want immediate access."
            />
          </div>
        </Field>

        {form.mode === 'password' && (
          <Field label="Temporary password *" hint="At least 8 characters. They'll change it on first login.">
            <input
              type="text"
              value={form.temporary_password}
              onChange={(e) => update('temporary_password', e.target.value)}
              required={form.mode === 'password'}
              minLength={8}
              placeholder="At least 8 characters"
              className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-1 outline-none focus:border-gold-400"
            />
          </Field>
        )}

        {inviteMutation.error && (
          <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
            {inviteMutation.error.message}
          </div>
        )}

        <div className="flex justify-end gap-s-3 pt-s-2">
          <Button intent="ghost" size="md" type="button" onClick={onDone}>Cancel</Button>
          <Button intent="primary" size="md" type="submit" isLoading={inviteMutation.isPending}>
            {form.mode === 'invite' ? 'Send invite' : 'Create account'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ModeRadio({ checked, onChange, title, hint }) {
  return (
    <label className={cn(
      'flex gap-s-3 items-start px-s-4 py-s-3 rounded-r-2 cursor-pointer transition-all duration-150',
      checked
        ? 'bg-gold-400/[0.08] border border-gold-400/30'
        : 'bg-surface-3 border border-line-2 hover:border-line-3',
    )}>
      <input
        type="radio" checked={checked} onChange={onChange}
        className="mt-s-1 accent-gold-400"
      />
      <div>
        <div className={cn('text-[13.5px]', checked ? 'text-ink-0' : 'text-ink-1')}>{title}</div>
        <div className="text-[12px] text-ink-3 mt-s-1">{hint}</div>
      </div>
    </label>
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

function Skeleton() {
  return (
    <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[64px] border-b border-line-1 last:border-0 animate-pulse" />
      ))}
    </div>
  );
}
