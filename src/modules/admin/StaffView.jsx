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
import * as pupilImportService from '@/services/pupilImportService';
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
  const isTeacher = staff.role === 'teacher';

  // Only load class assignments for teachers — saves a query per non-teacher row.
  const { data: assignments } = useQuery({
    queryKey: ['staff', 'classes', staff.user_id],
    queryFn: () => staffService.getTeacherClasses(staff.user_id),
    enabled: isTeacher,
    staleTime: 60_000,
  });

  return (
    <div className="border-b border-line-1 last:border-0 flex items-center gap-s-4 px-s-4 py-s-3 min-h-[64px]">
      <div className="w-[40px] h-[40px] rounded-full bg-gold-400/10 border border-gold-400/25 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] text-ink-1 truncate">{staff.full_name ?? '(no name)'}</div>
        <div className="font-mono text-[10px] text-ink-3 truncate">{staff.email}</div>
        {isTeacher && assignments && assignments.length > 0 && (
          <div className="text-[11px] text-ink-3 mt-s-1 truncate">
            Teaches: {assignments.map((a) => a.classes?.name).filter(Boolean).join(', ')}
          </div>
        )}
        {isTeacher && assignments && assignments.length === 0 && (
          <div className="text-[11px] text-amber-400 mt-s-1">No classes assigned</div>
        )}
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
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [result, setResult] = useState(null);

  // Load classes for assignment when role is teacher
  const { data: classes } = useQuery({
    queryKey: ['admin', 'classes', schoolId],
    queryFn: () => pupilImportService.listClassesForImport(schoolId),
    enabled: !!schoolId,
    staleTime: 5 * 60_000,
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleClass = (id) => setSelectedClassIds((arr) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
  );

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const invited = await staffService.inviteStaff({
        mode: form.mode,
        email: form.email,
        fullName: form.full_name,
        role: form.role,
        schoolId,
        temporaryPassword: form.mode === 'password' ? form.temporary_password : undefined,
      });
      // If teacher + classes selected, set assignments. Non-fatal if it fails
      // — the user exists; admin can re-assign from the staff list.
      if (form.role === 'teacher' && selectedClassIds.length > 0) {
        try {
          await staffService.setTeacherClasses({
            teacherId: invited.user_id,
            classIds: selectedClassIds,
          });
          invited.assigned_class_count = selectedClassIds.length;
        } catch (e) {
          invited.assignment_warning = e.message;
        }
      }
      return invited;
    },
    onSuccess: (data) => {
      setResult(data);
      setForm((f) => ({ ...f, full_name: '', email: '', temporary_password: '' }));
      setSelectedClassIds([]);
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
        {result.assigned_class_count > 0 && (
          <div className="text-[12.5px] text-ink-2 mb-s-3">
            ↳ Assigned to {result.assigned_class_count} {result.assigned_class_count === 1 ? 'class' : 'classes'}.
          </div>
        )}
        {result.assignment_warning && (
          <div className="text-[12.5px] text-amber-400 mb-s-3">
            ⚠ Account created but class assignment failed: {result.assignment_warning}. You can re-assign from the staff list.
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

        {/* Class assignments — only for teachers. A teacher can be assigned
            to any number of classes; tick all that apply. Picking zero
            classes is allowed (admin will assign later from the staff list). */}
        {form.role === 'teacher' && (
          <Field
            label={`Classes to teach (${selectedClassIds.length} selected)`}
            hint="Tap to toggle. You can leave blank and assign later."
          >
            {(classes ?? []).length === 0 ? (
              <p className="text-[12.5px] text-ink-3 italic">
                No classes exist yet. Create classes first, or invite the
                teacher and assign them later.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-2">
                {(classes ?? []).map((c) => {
                  const checked = selectedClassIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={cn(
                        'flex items-center gap-s-3 px-s-3 py-s-2 rounded-r-2 border text-left transition-all duration-150',
                        checked
                          ? 'bg-gold-400/[0.08] border-gold-400/40 text-ink-0'
                          : 'bg-surface-3 border-line-2 text-ink-1 hover:border-line-3',
                      )}
                    >
                      <span className={cn(
                        'w-[18px] h-[18px] rounded-sm border-2 grid place-items-center shrink-0',
                        checked ? 'bg-gold-400 border-gold-400' : 'border-line-3',
                      )}>
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#1a1305" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[13.5px] truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        )}

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
