/**
 * src/modules/admin/SuperAdminApp.jsx
 *
 * /app/super — super admin only. Completely separate from AdminApp.jsx.
 *
 * Super admin sees the TTA PLATFORM, not any one school.
 *
 * SECTIONS
 * ────────
 * Overview     → platform KPIs: schools, parents, tutors, pupils, revenue
 * Schools      → onboard new schools, list all, deactivate
 * Users        → search all users, change roles, invite by role
 * Tutors       → approve / reject tutor applications
 * Tiers        → subscription pricing (moved here from school admin nav)
 * Revenue      → payment volume by plan type, monthly trend
 * Impact       → network-wide impact (reuses ImpactDashboardView)
 *
 * NOT included here (stays in school AdminApp.jsx for school_admin):
 *   - Attendance, gradebook, term locks, curriculum, staff by class
 *
 * ROLE GUARD: This component is rendered only when role === 'super_admin'.
 * The route in routes/index.jsx wraps it in <RequireRole allow={['super_admin']}>
 */

import { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, KpiCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as platformService from '@/services/platformService';
import * as tiersService from '@/services/tiersService';
import * as tutorService from '@/services/tutorService';
import { ImpactDashboardView } from './ImpactDashboardView';
import { LessonContentView }   from './LessonContentView';
import { TiersView }           from './TiersView';

const NAV = [
  { to: '/app/super',          label: 'Overview',  end: true },
  { to: '/app/super/schools',  label: 'Schools'  },
  { to: '/app/super/users',    label: 'Users'     },
  { to: '/app/super/tutors',   label: 'Tutors'    },
  { to: '/app/super/content',  label: 'Content'   },
  { to: '/app/super/tiers',    label: 'Pricing'   },
  { to: '/app/super/revenue',  label: 'Revenue'   },
  { to: '/app/super/impact',   label: 'Impact'    },
];

export default function SuperAdminApp() {
  return (
    <Routes>
      <Route index               element={<PlatformOverview />} />
      <Route path="schools"      element={<SchoolsView />} />
      <Route path="users"        element={<UsersView />} />
      <Route path="tutors"        element={<TutorsView />} />
      <Route path="content"      element={<ContentShell />} />
      <Route path="tiers"        element={<TiersShell />} />
      <Route path="revenue"      element={<RevenueView />} />
      <Route path="impact"       element={<ImpactShell />} />
    </Routes>
  );
}

// ── Platform overview ─────────────────────────────────────────────────────────

function PlatformOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super', 'platform-stats'],
    queryFn:  platformService.getPlatformStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const { data: pending } = useQuery({
    queryKey: ['super', 'pending'],
    queryFn:  platformService.getPendingApprovals,
    staleTime: 30_000,
  });

  const { data: trend } = useQuery({
    queryKey: ['super', 'signups'],
    queryFn:  platformService.getSignupTrend,
    staleTime: 5 * 60_000,
  });

  const ngnMajor  = stats ? Math.round(stats.revenue_30d_ngn / 100).toLocaleString('en-NG') : '—';
  const usdMajor  = stats ? (stats.revenue_30d_usd / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—';

  return (
    <AppShell title="TTA Platform" navItems={NAV}>
      <div className="max-w-[1080px]">
        {/* Header */}
        <div className="mb-s-8">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Super Admin</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Train To Teach Africa — platform overview.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[62ch]">
            Network-wide metrics. You're seeing data across all schools, parents,
            tutors, and students on the platform.
          </p>
        </div>

        {/* Hero KPI band — platform numbers, not school numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-8">
          <KpiCard label="Schools"        value={isLoading ? '…' : (stats?.school_count ?? 0).toLocaleString()} trendIntent="neutral" trend="active on platform" />
          <KpiCard label="Pupils"         value={isLoading ? '…' : (stats?.pupil_count ?? 0).toLocaleString()} trendIntent="neutral" trend="across all schools" />
          <KpiCard label="Parents"        value={isLoading ? '…' : (stats?.parent_count ?? 0).toLocaleString()} trendIntent="neutral" trend={`${stats?.active_parent_subs ?? 0} active subs`} />
          <KpiCard label="Approved tutors" value={isLoading ? '…' : (stats?.tutor_count ?? 0).toLocaleString()}
            trendIntent={stats?.tutor_pending_count > 0 ? 'amber' : 'neutral'}
            trend={stats?.tutor_pending_count > 0 ? `${stats.tutor_pending_count} awaiting review` : 'all reviewed'} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-8">
          <KpiCard label="Teachers"       value={isLoading ? '…' : (stats?.teacher_count ?? 0).toLocaleString()} trendIntent="neutral" trend="registered" />
          <KpiCard label="Active school subs" value={isLoading ? '…' : (stats?.active_school_subs ?? 0).toLocaleString()} trendIntent="green" trend="running" />
          <KpiCard label="Revenue · 30d (₦)" value={isLoading ? '…' : `₦${ngnMajor}`} trendIntent="green" trend="verified payments" />
          <KpiCard label="Revenue · 30d ($)" value={isLoading ? '…' : `$${usdMajor}`} trendIntent="green" trend="verified payments" />
        </div>

        <div className="grid lg:grid-cols-2 gap-s-6 mb-s-8">
          {/* Signup trend */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Signups · last 30 days</div>
            <SignupSparklines trend={trend ?? []} />
          </Card>

          {/* Action queue */}
          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-mono text-eyebrow uppercase text-gold-400">Needs action</div>
              {(pending?.length ?? 0) > 0 && (
                <Chip variant="amber" dot>{pending.length}</Chip>
              )}
            </div>
            {(pending ?? []).length === 0 ? (
              <p className="text-body text-ink-3">No pending approvals. All clear.</p>
            ) : (
              <div className="space-y-s-3">
                {(pending ?? []).slice(0, 6).map((item) => (
                  <PendingRow key={item.entity_id} item={item} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-s-4">
          {[
            { to: '/app/super/schools', label: 'Onboard a school',   desc: 'Add a new school to TTA' },
            { to: '/app/super/users',   label: 'Manage users',       desc: 'Search, invite, change roles' },
            { to: '/app/super/tutors',  label: 'Review tutors',      desc: `${stats?.tutor_pending_count ?? 0} pending` },
            { to: '/app/super/tiers',   label: 'Edit pricing',       desc: 'Prices update live on site' },
            { to: '/app/super/revenue', label: 'Revenue report',     desc: 'Payments by plan type' },
            { to: '/app/super/impact',  label: 'Impact & outcomes',  desc: 'Network-wide metrics' },
          ].map((q) => (
            <Link key={q.to} to={q.to}
              className="block bg-surface-2 border border-line-2 rounded-r-3 p-s-5 hover:border-gold-400/40 transition-colors group">
              <div className="font-display text-[16px] text-ink-0 group-hover:text-gold-400 transition-colors">{q.label}</div>
              <div className="mt-s-1 font-mono text-meta text-ink-3">{q.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Schools management ────────────────────────────────────────────────────────

function SchoolsView() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: schools, isLoading } = useQuery({
    queryKey: ['super', 'schools'],
    queryFn:  platformService.listAllSchools,
    staleTime: 60_000,
  });

  const deactivate = useMutation({
    mutationFn: platformService.deactivateSchool,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super', 'schools'] }),
  });

  return (
    <AppShell title="Schools" navItems={NAV}>
      <div className="max-w-[900px]">
        <div className="mb-s-7 flex items-end justify-between gap-s-4 flex-wrap">
          <div>
            <div className="font-mono text-eyebrow uppercase text-gold-400">Schools</div>
            <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
              All schools on TTA.
            </h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-[56ch]">
              Onboard new schools, view their status, and deactivate if needed.
              Each school gets its own admin account on creation.
            </p>
          </div>
          <Button intent="primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : '+ Onboard school'}
          </Button>
        </div>

        {showCreate && (
          <CreateSchoolCard onDone={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['super', 'schools'] });
          }} />
        )}

        {isLoading && <TableSkeleton rows={4} />}

        {!isLoading && (
          <Card className="bg-surface-2 border-line-2 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line-2">
                  {['School', 'Location', 'Joined', 'Status', ''].map((h) => (
                    <th key={h} className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(schools ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                    <td className="py-s-3 pr-s-5">
                      <div className="text-body text-ink-0">{s.name}</div>
                      {s.slug && <div className="font-mono text-meta text-ink-3">{s.slug}</div>}
                    </td>
                    <td className="py-s-3 pr-s-5 text-body text-ink-2">
                      {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-s-3 pr-s-5 font-mono text-meta text-ink-3">
                      {new Date(s.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-s-3 pr-s-5">
                      <Chip variant={s.active ? 'green' : 'default'} dot>
                        {s.active ? 'Active' : 'Deactivated'}
                      </Chip>
                    </td>
                    <td className="py-s-3">
                      {s.active && (
                        <button
                          className="font-mono text-meta text-ink-3 hover:text-red-400 transition-colors"
                          onClick={() => {
                            if (window.confirm(`Deactivate ${s.name}? Staff cannot log in until reactivated.`)) {
                              deactivate.mutate(s.id);
                            }
                          }}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function CreateSchoolCard({ onDone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', city: '', state: '', phone: '' });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const create = useMutation({
    mutationFn: () => platformService.createSchool(form),
    onSuccess: () => { onDone(); qc.invalidateQueries({ queryKey: ['super', 'platform-stats'] }); },
  });

  return (
    <Card className="bg-surface-2 border-gold-400/20 mb-s-6">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">New school</div>
      <div className="grid sm:grid-cols-2 gap-s-4">
        <FormField label="School name *">
          <TextInput value={form.name} onChange={(v) => set('name', v)} placeholder="Greenfield Academy" />
        </FormField>
        <FormField label="Phone">
          <TextInput value={form.phone} onChange={(v) => set('phone', v)} placeholder="+234 1 234 5678" />
        </FormField>
        <FormField label="City">
          <TextInput value={form.city} onChange={(v) => set('city', v)} placeholder="Lagos" />
        </FormField>
        <FormField label="State">
          <TextInput value={form.state} onChange={(v) => set('state', v)} placeholder="Lagos State" />
        </FormField>
      </div>
      {create.error && (
        <p className="mt-s-4 text-body text-red-400">{create.error.message}</p>
      )}
      <div className="mt-s-5 flex gap-s-3">
        <Button intent="primary" onClick={() => create.mutate()} disabled={create.isPending || !form.name}>
          {create.isPending ? 'Creating…' : 'Create school'}
        </Button>
        <Button intent="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

// ── Users management ──────────────────────────────────────────────────────────

function UsersView() {
  const qc = useQueryClient();
  const [query,    setQuery]    = useState('');
  const [role,     setRole]     = useState('');
  const [page,     setPage]     = useState(1);
  const [showInvite, setShowInvite] = useState(false);

  const { data: result, isLoading } = useQuery({
    queryKey: ['super', 'users', query, role, page],
    queryFn:  () => platformService.searchUsers({ query, role: role || null, page }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const changeRole = useMutation({
    mutationFn: platformService.changeUserRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super', 'users'] }),
  });

  const ROLES = ['parent', 'teacher', 'head_teacher', 'school_admin', 'tutor', 'super_admin'];
  const ROLE_LABEL = {
    parent: 'Parent', teacher: 'Teacher', head_teacher: 'Head Teacher',
    school_admin: 'School Admin', tutor: 'Tutor', super_admin: 'Super Admin',
  };

  return (
    <AppShell title="Users" navItems={NAV}>
      <div className="max-w-[1000px]">
        <div className="mb-s-7 flex items-end justify-between gap-s-4 flex-wrap">
          <div>
            <div className="font-mono text-eyebrow uppercase text-gold-400">Users</div>
            <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
              All platform users.
            </h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-[56ch]">
              Search, invite, and change roles for parents, teachers, tutors, and school admins.
            </p>
          </div>
          <Button intent="primary" onClick={() => setShowInvite((v) => !v)}>
            {showInvite ? 'Cancel' : '+ Invite user'}
          </Button>
        </div>

        {showInvite && (
          <InvitePlatformUserCard onDone={() => {
            setShowInvite(false);
            qc.invalidateQueries({ queryKey: ['super', 'users'] });
          }} />
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-s-3 mb-s-5">
          <input
            className="flex-1 min-w-[200px] bg-surface-2 border border-line-2 rounded-r-1 px-s-4 py-s-3 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
          <select
            className="bg-surface-2 border border-line-2 rounded-r-1 px-s-4 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>

        {isLoading && <TableSkeleton rows={6} />}

        {result && (
          <>
            <div className="mb-s-3 font-mono text-meta text-ink-3">
              {result.totalCount.toLocaleString()} user{result.totalCount !== 1 ? 's' : ''}
            </div>
            <Card className="bg-surface-2 border-line-2 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line-2">
                    {['User', 'Role', 'School', 'Joined', 'Change role'].map((h) => (
                      <th key={h} className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.users.map((u) => (
                    <tr key={u.user_id} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                      <td className="py-s-3 pr-s-5">
                        <div className="text-body text-ink-0">{u.full_name || '(no name)'}</div>
                        <div className="font-mono text-meta text-ink-3">{u.email}</div>
                      </td>
                      <td className="py-s-3 pr-s-5">
                        <Chip variant={u.role === 'super_admin' ? 'gold' : 'default'} size="sm">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Chip>
                      </td>
                      <td className="py-s-3 pr-s-5 text-body text-ink-2">
                        {u.schools?.name ?? '—'}
                      </td>
                      <td className="py-s-3 pr-s-5 font-mono text-meta text-ink-3">
                        {new Date(u.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-s-3">
                        <select
                          className="bg-surface-3 border border-line-2 rounded px-s-2 py-s-1 text-meta text-ink-1 focus:border-gold-400 outline-none"
                          value={u.role}
                          onChange={(e) => {
                            if (e.target.value !== u.role) {
                              changeRole.mutate({ userId: u.user_id, newRole: e.target.value });
                            }
                          }}
                        >
                          {ROLES.filter((r) => r !== 'super_admin' || u.role === 'super_admin').map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {result.totalPages > 1 && (
              <div className="mt-s-5 flex gap-s-2">
                {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p}
                    className={`w-9 h-9 rounded-full font-mono text-meta transition-colors ${
                      p === result.page ? 'bg-gold-400 text-ink-0' : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
                    }`}
                    onClick={() => setPage(p)}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function InvitePlatformUserCard({ onDone }) {
  const [form, setForm] = useState({ email: '', fullName: '', role: 'school_admin', schoolId: '' });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const [result, setResult] = useState(null);

  const { data: schools } = useQuery({
    queryKey: ['super', 'schools'],
    queryFn:  platformService.listAllSchools,
    staleTime: 60_000,
  });

  const invite = useMutation({
    mutationFn: () => platformService.invitePlatformUser({
      email:    form.email,
      fullName: form.fullName,
      role:     form.role,
      schoolId: form.schoolId || null,
    }),
    onSuccess: setResult,
  });

  const NEEDS_SCHOOL = ['school_admin', 'head_teacher', 'teacher'];

  if (result) {
    return (
      <Card className="mb-s-5 border-green-400/30 bg-green-400/[0.04]">
        <Chip variant="green" dot>Invited</Chip>
        <p className="mt-s-3 text-body text-ink-1">
          Invitation sent to <strong>{form.email}</strong> with role <strong>{form.role}</strong>.
        </p>
        <div className="mt-s-4 flex gap-s-3">
          <Button intent="primary" size="sm" onClick={() => setResult(null)}>Invite another</Button>
          <Button intent="ghost"   size="sm" onClick={onDone}>Done</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-2 border-gold-400/20 mb-s-6">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">Invite user</div>
      <div className="grid sm:grid-cols-2 gap-s-4">
        <FormField label="Full name *">
          <TextInput value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="Amaka Okonkwo" />
        </FormField>
        <FormField label="Email *">
          <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="amaka@school.ng" />
        </FormField>
        <FormField label="Role *">
          <select
            className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
          >
            {['parent', 'teacher', 'head_teacher', 'school_admin', 'tutor'].map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
        </FormField>
        {NEEDS_SCHOOL.includes(form.role) && (
          <FormField label="School *">
            <select
              className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={form.schoolId}
              onChange={(e) => set('schoolId', e.target.value)}
            >
              <option value="">Select school…</option>
              {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
        )}
      </div>
      {invite.error && <p className="mt-s-4 text-body text-red-400">{invite.error.message}</p>}
      <div className="mt-s-5 flex gap-s-3">
        <Button intent="primary" onClick={() => invite.mutate()} disabled={invite.isPending || !form.email}>
          {invite.isPending ? 'Sending…' : 'Send invite'}
        </Button>
        <Button intent="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

// ── Tutors management ─────────────────────────────────────────────────────────

function TutorsView() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');

  const { data: result, isLoading } = useQuery({
    queryKey: ['super', 'tutors', status],
    queryFn:  () => platformService.listTutors({ status: status || null }),
    staleTime: 30_000,
  });

  const approve = useMutation({
    mutationFn: ({ tutorId }) => tutorService.approveTutor({ tutorId }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['super', 'tutors'] }),
  });

  const reject = useMutation({
    mutationFn: ({ tutorId, reason }) => tutorService.rejectTutor({ tutorId, reason }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['super', 'tutors'] }),
  });

  const STATUS_TABS = [
    { value: 'pending',  label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: '',         label: 'All' },
  ];

  return (
    <AppShell title="Tutors" navItems={NAV}>
      <div className="max-w-[900px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Tutors</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Tutor applications and directory.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Review tutor applications. Once approved, tutors appear in parent search results.
          </p>
        </div>

        {/* Status tabs */}
        <div className="flex gap-s-1 mb-s-6 border-b border-line-2">
          {STATUS_TABS.map((t) => (
            <button key={t.value}
              className={`px-s-4 py-s-3 font-mono text-meta border-b-2 -mb-px transition-colors ${
                status === t.value ? 'border-gold-400 text-gold-400' : 'border-transparent text-ink-3 hover:text-ink-1'
              }`}
              onClick={() => setStatus(t.value)}>
              {t.label}
            </button>
          ))}
        </div>

        {isLoading && <TableSkeleton rows={4} />}

        <div className="space-y-s-4">
          {(result?.tutors ?? []).map((tutor) => (
            <Card key={tutor.id} className="bg-surface-2 border-line-2">
              <div className="flex items-start justify-between gap-s-4">
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[18px] text-ink-0">{tutor.full_name}</div>
                  <div className="mt-s-1 font-mono text-meta text-ink-3">
                    {tutor.city}, {tutor.state}
                    {tutor.hourly_rate_minor > 0 && ` · ₦${Math.round(tutor.hourly_rate_minor / 100).toLocaleString('en-NG')}/hr`}
                  </div>
                  <div className="mt-s-2 flex flex-wrap gap-s-2">
                    {(tutor.tutor_subjects ?? []).slice(0, 4).map((s, i) => (
                      <Chip key={i} variant="default" size="sm">{s.subject} · {s.curriculum}</Chip>
                    ))}
                    {tutor.teaches_online  && <Chip variant="gold"    size="sm">Online</Chip>}
                    {tutor.teaches_offline && <Chip variant="default" size="sm">In-person</Chip>}
                  </div>
                  <div className="mt-s-2 font-mono text-meta text-ink-3">
                    Applied {new Date(tutor.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-s-2 flex-shrink-0">
                  <Chip variant={
                    tutor.approval_status === 'approved' ? 'green' :
                    tutor.approval_status === 'rejected' ? 'default' : 'amber'
                  } dot>
                    {tutor.approval_status}
                  </Chip>
                  {tutor.approval_status === 'pending' && (
                    <div className="flex gap-s-2 mt-s-2">
                      <Button intent="primary" size="sm" onClick={() => approve.mutate({ tutorId: tutor.id })}>
                        Approve
                      </Button>
                      <Button intent="ghost" size="sm" onClick={() => {
                        const reason = window.prompt('Reason for rejection (required):');
                        if (reason?.trim()) reject.mutate({ tutorId: tutor.id, reason });
                      }}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {!isLoading && (result?.tutors ?? []).length === 0 && (
            <Card className="bg-surface-2 border-line-2">
              <p className="text-body text-ink-2">No tutors in this status.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ImpactShell() {
  return (
    <AppShell title="Impact" navItems={NAV}>
      <ImpactDashboardView />
    </AppShell>
  );
}

// ── Content (lesson authoring tool) ──────────────────────────────────────────

function ContentShell() {
  return (
    <AppShell title="Lesson Content" navItems={NAV}>
      <LessonContentView />
    </AppShell>
  );
}

// ── Tiers (pricing) — same TiersView, super-admin shell ───────────────────────

function TiersShell() {
  return (
    <AppShell title="Pricing" navItems={NAV}>
      <TiersView />
    </AppShell>
  );
}

// ── Revenue view ──────────────────────────────────────────────────────────────

function RevenueView() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['super', 'revenue'],
    queryFn:  () => platformService.getRevenueSummary({ months: 6 }),
    staleTime: 5 * 60_000,
  });

  const PLAN_LABEL = { parent: 'Parent subs', school: 'School subs', tutor_booking: 'Tutor bookings', teacher: 'Teacher subs' };

  // Group by currency
  const ngn = (rows ?? []).filter((r) => r.currency === 'NGN');
  const usd = (rows ?? []).filter((r) => r.currency === 'USD');

  function RevenueTable({ rows, currency, prefix }) {
    const months = [...new Set(rows.map((r) => r.month))].sort().reverse();
    const plans  = [...new Set(rows.map((r) => r.plan_type))];

    return (
      <Card className="bg-surface-2 border-line-2">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
          {currency} Revenue by Plan · Last 6 months
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line-2">
                <th className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 text-xs">Month</th>
                {plans.map((p) => (
                  <th key={p} className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 text-xs text-right">
                    {PLAN_LABEL[p] ?? p}
                  </th>
                ))}
                <th className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 text-xs text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const monthRows = rows.filter((r) => r.month === month);
                const total = monthRows.reduce((a, r) => a + Number(r.gross_minor), 0);
                return (
                  <tr key={month} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                    <td className="py-s-3 pr-s-5 font-mono text-meta text-ink-1">{month}</td>
                    {plans.map((p) => {
                      const row = monthRows.find((r) => r.plan_type === p);
                      const val = row ? Math.round(row.gross_minor / 100) : 0;
                      return (
                        <td key={p} className="py-s-3 pr-s-5 font-mono text-meta text-ink-1 text-right tabular-nums">
                          {val > 0 ? `${prefix}${val.toLocaleString('en-NG')}` : '—'}
                        </td>
                      );
                    })}
                    <td className="py-s-3 font-mono text-meta text-ink-0 text-right tabular-nums">
                      {prefix}{Math.round(total / 100).toLocaleString('en-NG')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <AppShell title="Revenue" navItems={NAV}>
      <div className="max-w-[1000px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Revenue</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Payment breakdown.</h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Verified payments by plan type for the last 6 months. Excludes pending and failed.
          </p>
        </div>
        {isLoading
          ? <TableSkeleton rows={6} />
          : <div className="space-y-s-6">
              {ngn.length > 0 && <RevenueTable rows={ngn} currency="NGN" prefix="₦" />}
              {usd.length > 0 && <RevenueTable rows={usd} currency="USD" prefix="$" />}
            </div>
        }
      </div>
    </AppShell>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SignupSparklines({ trend }) {
  const ROLES = ['parent', 'teacher', 'tutor', 'school_admin'];
  const COLORS = { parent: 'bg-gold-400', teacher: 'bg-blue-400', tutor: 'bg-green-400', school_admin: 'bg-purple-400' };
  const LABELS = { parent: 'Parents', teacher: 'Teachers', tutor: 'Tutors', school_admin: 'School admins' };

  const last7 = [...new Set(
    trend.map((r) => r.signup_date)
  )].sort().slice(-7);

  return (
    <div className="space-y-s-3">
      {ROLES.map((role) => {
        const values = last7.map((d) => {
          const row = trend.find((r) => r.signup_date === d && r.role === role);
          return row?.signups ?? 0;
        });
        const max = Math.max(...values, 1);
        return (
          <div key={role} className="flex items-center gap-s-3">
            <div className="font-mono text-meta text-ink-3 w-[90px] shrink-0">{LABELS[role]}</div>
            <div className="flex items-end gap-[3px] flex-1 h-[32px]">
              {values.map((v, i) => (
                <div key={i} className={`flex-1 rounded-t-sm ${COLORS[role]} opacity-80`}
                  style={{ height: `${Math.max(2, (v / max) * 32)}px` }}
                  title={`${last7[i]}: ${v}`} />
              ))}
            </div>
            <div className="font-mono text-meta text-ink-0 w-[30px] text-right shrink-0">
              {values[values.length - 1] ?? 0}
            </div>
          </div>
        );
      })}
      <p className="font-mono text-[10px] text-ink-3 mt-s-2">Last 7 days</p>
    </div>
  );
}

function PendingRow({ item }) {
  return (
    <div className="flex items-center justify-between gap-s-3 py-s-2 border-b border-line-2 last:border-0">
      <div>
        <div className="text-body text-ink-1">{item.display_name}</div>
        <div className="font-mono text-meta text-ink-3">{item.location} · {item.entity_type}</div>
      </div>
      <Link to={item.entity_type === 'tutor' ? '/app/super/tutors' : '/app/super/schools'}>
        <Chip variant="amber" size="sm">Review →</Chip>
      </Link>
    </div>
  );
}

function TableSkeleton({ rows = 4 }) {
  return (
    <div className="bg-surface-2 border border-line-2 rounded-r-3 overflow-hidden">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 border-b border-line-2 last:border-0 animate-pulse" />
      ))}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
