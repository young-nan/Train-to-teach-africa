/**
 * SuperAdminApp.jsx — Full platform admin
 * Overview · Schools · Users · Content · Tutors · Impact · Revenue · Security · Settings
 */

import { useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import { Icon } from '@/components/ui/Icon';
import { supabase } from '@/lib/supabase';
import { extractEdgeFunctionErrorMessage } from '@/utils/edgeFunctionError';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Input, Select, FormGroup, Textarea, Alert,
  ProgressBar, Tabs, LoadingScreen, Empty, StatRow, Divider,
} from '@/components/ui';

const NAV = [
  { to:'/superadmin',           end:true, icon:'layout-dashboard',  label:'Platform overview' },
  { to:'/superadmin/schools',   icon:'building-school', label:'Schools'                       },
  { to:'/superadmin/users',     icon:'users',           label:'All users'                     },
  { to:'/superadmin/content',   icon:'book-2',          label:'Content'                       },
  { to:'/superadmin/tutors',    icon:'user-star',       label:'Tutors'                        },
  { to:'/superadmin/impact',    icon:'chart-area',      label:'Impact hub'                    },
  { to:'/superadmin/revenue',   icon:'receipt-2',       label:'Revenue'                       },
  { to:'/superadmin/security',  icon:'shield',          label:'Security'                      },
  { to:'/superadmin/settings',  icon:'settings',        label:'Platform settings'             },
];

// ── Onboard School — shared modal used by both SAOverview and SASchools ──────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)] sticky top-0 bg-[var(--c-surface-2)]">
          <h2 className="font-heading font-semibold text-[16px] text-[var(--c-ink-0)]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-3)] transition-colors">
            <Icon name="x" className="text-[18px]" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const NG_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
  'Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano',
  'Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun',
  'Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
];

// Calls supabase/functions/super-onboard-school — see that file for the
// full server-side logic (creates the school, invites the first
// school_admin, links them together). This hook just handles invoking it
// and surfacing the real error message, since supabase-js otherwise
// discards the response body on a non-2xx status (see edgeFunctionError.js).
function useOnboardSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.functions.invoke('super-onboard-school', { body: payload });
      if (error) throw new Error(await extractEdgeFunctionErrorMessage(error));
      if (data?.admin_invite_error) {
        // Partial success (HTTP 207): the school was created but the admin
        // invite failed — still a real result, just needs the caller to
        // know to retry the invite separately via AdminStaff-style flow.
        const partial = new Error(data.admin_invite_error);
        partial.partialSuccess = data;
        throw partial;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries(['superadmin-schools']);
    },
  });
}

function OnboardSchoolForm({ onDone, onCancel }) {
  const [form, setForm] = useState({
    school_name: '', school_city: '', school_state: '', school_email: '', school_phone: '',
    admin_email: '', admin_first_name: '', admin_last_name: '',
  });
  const onboard = useOnboardSchool();
  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onboard.mutate(form, { onSuccess: () => onDone?.() });
  };

  const partialResult = onboard.error?.partialSuccess;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {onboard.isError && (
        <Alert type={partialResult ? 'warning' : 'error'}>
          {partialResult
            ? `School "${partialResult.school?.name}" was created, but: ${onboard.error.message}`
            : onboard.error.message}
        </Alert>
      )}

      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--c-ink-4)] -mb-1">School details</div>
      <FormGroup label="School name *">
        <Input placeholder="e.g. Bright Future Academy" value={form.school_name} onChange={update('school_name')} required />
      </FormGroup>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="City">
          <Input placeholder="Lagos" value={form.school_city} onChange={update('school_city')} />
        </FormGroup>
        <FormGroup label="State">
          <Select value={form.school_state} onChange={update('school_state')}>
            <option value="">Select state…</option>
            {NG_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </FormGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="School email">
          <Input type="email" placeholder="info@school.edu.ng" value={form.school_email} onChange={update('school_email')} />
        </FormGroup>
        <FormGroup label="School phone">
          <Input type="tel" placeholder="+234 800 000 0000" value={form.school_phone} onChange={update('school_phone')} />
        </FormGroup>
      </div>

      <Divider className="my-2" />

      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--c-ink-4)] -mb-1">First school admin</div>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="First name">
          <Input placeholder="Jane" value={form.admin_first_name} onChange={update('admin_first_name')} />
        </FormGroup>
        <FormGroup label="Last name">
          <Input placeholder="Adeyemi" value={form.admin_last_name} onChange={update('admin_last_name')} />
        </FormGroup>
      </div>
      <FormGroup label="Admin email *" hint="They'll get an email invite to set their own password.">
        <Input type="email" placeholder="admin@school.edu.ng" value={form.admin_email} onChange={update('admin_email')} required />
      </FormGroup>

      <div className="flex gap-3 pt-2">
        <Button variant="primary" type="submit" isLoading={onboard.isPending} className="flex-1 justify-center">
          Onboard school
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// Real query, replacing the old MOCK_SCHOOLS array. Tested against live
// Postgres: super_admin's RLS policies (pupils_select_school_staff,
// attendance_select_school_staff, etc. in 0001_fresh_backend.sql) already
// grant cross-school visibility, so this aggregates real data platform-wide.
//
// Deliberately three separate queries + JS-side aggregation rather than one
// nested PostgREST embed — embedding pupils(...) and attendance_records(...)
// as siblings under the same schools row causes a join fan-out that
// silently inflates every count (the same bug found and fixed in
// HTOverview.jsx's useHTSummary — see that file's comments for the full
// explanation).
function useSuperAdminSchools() {
  return useQuery({
    queryKey: ['superadmin-schools'],
    queryFn: async () => {
      const [schoolsRes, pupilsRes, teachersRes, attRes] = await Promise.all([
        supabase.from('schools').select('id,name,city,plan,onboarding_status,created_at').order('name'),
        supabase.from('pupils').select('id,school_id'),
        supabase.from('profiles').select('user_id,school_id').eq('role', 'teacher'),
        supabase.from('attendance_records').select('school_id,status'),
      ]);

      const schools = schoolsRes.data ?? [];

      const studentsBySchool = {};
      (pupilsRes.data ?? []).forEach(p => {
        studentsBySchool[p.school_id] = (studentsBySchool[p.school_id] ?? 0) + 1;
      });

      const teachersBySchool = {};
      (teachersRes.data ?? []).forEach(t => {
        if (t.school_id) teachersBySchool[t.school_id] = (teachersBySchool[t.school_id] ?? 0) + 1;
      });

      const attBySchool = {};
      (attRes.data ?? []).forEach(a => {
        if (!attBySchool[a.school_id]) attBySchool[a.school_id] = { total: 0, present: 0 };
        attBySchool[a.school_id].total++;
        if (a.status === 'present') attBySchool[a.school_id].present++;
      });

      return schools.map(s => {
        const att = attBySchool[s.id];
        return {
          id: s.id,
          name: s.name,
          city: s.city ?? '—',
          plan: s.plan,
          status: s.onboarding_status, // kept as "status" here so existing filter/display code below doesn't need renaming
          students: studentsBySchool[s.id] ?? 0,
          teachers: teachersBySchool[s.id] ?? 0,
          att: att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null,
          joined: new Date(s.created_at).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }),
        };
      });
    },
    staleTime: 30_000,
  });
}

const MOCK_TUTORS = [
  { id:'1', name:'Mr Emeka Okafor',  subjects:['Mathematics','Basic Science'], rating:4.9, sessions:47, location:'Lagos',  status:'verified',  earnings:'₦726K' },
  { id:'2', name:'Mrs Chioma Eze',   subjects:['English Language'],             rating:4.7, sessions:32, location:'Lagos',  status:'verified',  earnings:'₦480K' },
  { id:'3', name:'Dr Bola Adeyemi',  subjects:['Mathematics','Physics'],        rating:5.0, sessions:28, location:'Lagos',  status:'verified',  earnings:'₦560K' },
  { id:'4', name:'Miss Ngozi Bello', subjects:['English Language','French'],    rating:4.6, sessions:18, location:'Abuja',  status:'pending',   earnings:'₦216K' },
  { id:'5', name:'Mr Ade Suleiman',  subjects:['Mathematics','Chemistry'],      rating:4.8, sessions:41, location:'PH',     status:'verified',  earnings:'₦615K' },
];

const STATUS_VARIANT = { active:'green', pilot:'gold', trial:'teal', pending:'amber', verified:'green', suspended:'red' };

// ── SA Overview ───────────────────────────────────────────────────────────────
function SAOverview() {
  const [showOnboard, setShowOnboard] = useState(false);
  const { data: schools = [], isLoading } = useSuperAdminSchools();

  const totalStudents = schools.reduce((a,s)=>a+s.students,0);
  const totalTeachers = schools.reduce((a,s)=>a+s.teachers,0);
  const schoolsWithAtt = schools.filter(s => s.att != null);
  const avgAtt = schoolsWithAtt.length
    ? Math.round(schoolsWithAtt.reduce((a,s)=>a+s.att,0) / schoolsWithAtt.length)
    : null;

  const health = [
    { label:'Supabase uptime',        value:'99.9%',       icon:'server',    color:'var(--c-green-400)'   },
    { label:'API avg response',        value:'142 ms',      icon:'bolt',      color:'var(--c-green-400)'   },
    { label:'Edge functions deployed', value:'10',          icon:'code',      color:'var(--c-teal-400)'    },
    { label:'Active sessions now',     value:'84',          icon:'users',     color:'var(--c-violet-400)'  },
    { label:'Lesson content coverage', value:'67%',         icon:'book-2',    color:'var(--product-accent)'},
    { label:'Storage used',            value:'12.4 GB',     icon:'database',  color:'var(--c-sky-400)'     },
    { label:'Error rate (24h)',        value:'0.02%',       icon:'alert',     color:'var(--c-green-400)'   },
    { label:'New signups today',       value:'14',          icon:'user-plus', color:'var(--c-emerald-400)' },
  ];

  return (
    <div>
      <PageHeader eyebrow="Super Admin · TTA Platform" title="Platform overview" subtitle={isLoading ? 'Loading…' : `Live across Nigeria · ${schools.filter(s=>s.status!=='pending').length} active school${schools.filter(s=>s.status!=='pending').length !== 1 ? 's' : ''}`} >
        <Button variant="primary" icon="plus" onClick={() => setShowOnboard(true)}>Onboard school</Button>
        <Button variant="ghost" icon="download">Platform report</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Total students"   value={isLoading ? '—' : totalStudents.toLocaleString()} deltaDir="flat" icon="users"          href="/superadmin/schools" />
        <KpiCard label="Schools"          value={isLoading ? '—' : schools.length}                  deltaDir="flat" icon="building-school" href="/superadmin/schools" />
        <KpiCard label="Teachers"         value={isLoading ? '—' : totalTeachers}                   deltaDir="flat" icon="chalkboard"      />
        <KpiCard label="Platform revenue" value="₦8.4M"                                              deltaDir="up"   delta="Not yet wired to billing" icon="receipt-2" />
        <KpiCard label="Avg attendance"   value={avgAtt != null ? `${avgAtt}%` : '—'}               deltaDir="flat" delta="Platform-wide" icon="calendar-stats" />
        <KpiCard label="Active tutors"    value={MOCK_TUTORS.filter(t=>t.status==='verified').length} deltaDir="flat" delta="Mock — not yet wired" icon="user-star" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* School table */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-[14px] text-[var(--c-ink-1)]">Schools</h3>
            <Link to="/superadmin/schools" className="text-[12px] font-medium text-[var(--product-accent)] hover:opacity-80">View all →</Link>
          </div>
          {isLoading ? (
            <div className="px-5 py-8"><LoadingScreen /></div>
          ) : schools.length === 0 ? (
            <div className="px-5 py-8"><Empty icon="building-school" message="No schools onboarded yet." /></div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--c-line-2)]">
                  {['School','Students','Att.','Status'].map(h=>(
                    <th key={h} className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schools.slice(0,6).map(s=>(
                  <tr key={s.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--c-ink-0)]">{s.name}</td>
                    <td className="px-5 py-3 text-[var(--c-ink-2)]">{s.students}</td>
                    <td className="px-5 py-3">
                      {s.att != null ? (
                        <div className="flex items-center gap-1.5">
                          <ProgressBar value={s.att} className="w-12" color={s.att>=90?'var(--c-green-400)':'var(--product-accent)'} />
                          <span className="text-[11px] text-[var(--c-ink-3)]">{s.att}%</span>
                        </div>
                      ) : <span className="text-[11px] text-[var(--c-ink-4)]">No data</span>}
                    </td>
                    <td className="px-5 py-3"><Chip variant={STATUS_VARIANT[s.status]??'default'} size="sm">{s.status}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>

        {/* Platform health */}
        <Card>
          <CardHeader title="Platform health" />
          <div className="grid grid-cols-2 gap-2">
            {health.map(m=>(
              <div key={m.label} className="flex items-center gap-2.5 p-2.5 bg-[var(--c-surface-3)] rounded-lg">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{background:`${m.color}20`,color:m.color}}>
                  <Icon name={m.icon} className="text-[14px]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold" style={{color:m.color}}>{m.value}</div>
                  <div className="text-[10px] text-[var(--c-ink-4)] truncate">{m.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {showOnboard && (
        <Modal title="Onboard a new school" onClose={() => setShowOnboard(false)}>
          <OnboardSchoolForm onDone={() => setShowOnboard(false)} onCancel={() => setShowOnboard(false)} />
        </Modal>
      )}
    </div>
  );
}

// ── SA Schools ────────────────────────────────────────────────────────────────
function SASchools() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('');
  const [showOnboard, setShowOnboard] = useState(false);
  const { data: schools = [], isLoading } = useSuperAdminSchools();
  const list = schools.filter(s=>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || s.status === statusFilter)
  );

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Schools" subtitle={`${schools.length} school${schools.length !== 1 ? 's' : ''} on platform`}>
        <Button variant="primary" icon="plus" onClick={() => setShowOnboard(true)}>Onboard school</Button>
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {['active','pilot','trial','pending'].map(st=>(
          <KpiCard key={st} label={st.charAt(0).toUpperCase()+st.slice(1)} value={isLoading ? '—' : schools.filter(s=>s.status===st).length} deltaDir="flat" />
        ))}
        <KpiCard label="Total schools" value={isLoading ? '—' : schools.length} deltaDir="flat" icon="building-school" />
      </div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <Input className="max-w-[260px]" placeholder="Search schools…" value={search} onChange={e=>setSearch(e.target.value)} />
        <Select className="max-w-[160px]" value={statusFilter} onChange={e=>setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['active','pilot','trial','pending'].map(s=><option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['School','City','Students','Teachers','Attendance','Plan','Joined','Status',''].map(h=>(
                  <th key={h} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8"><LoadingScreen /></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8"><Empty icon="building-school" message="No schools match your filters." /></td></tr>
              ) : list.map(s=>(
                <tr key={s.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[var(--c-ink-0)] whitespace-nowrap">{s.name}</td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)]">{s.city}</td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)]">{s.students}</td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)]">{s.teachers}</td>
                  <td className="px-4 py-3">
                    {s.att != null ? (
                      <div className="flex items-center gap-1.5">
                        <ProgressBar value={s.att} className="w-14" color={s.att>=90?'var(--c-green-400)':'var(--product-accent)'} />
                        <span className="text-[11px] text-[var(--c-ink-3)]">{s.att}%</span>
                      </div>
                    ) : <span className="text-[11px] text-[var(--c-ink-4)]">No data</span>}
                  </td>
                  <td className="px-4 py-3"><Chip variant={s.plan==='premium'?'violet':s.plan==='trial'?'teal':'default'} size="sm">{s.plan}</Chip></td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--c-ink-4)]">{s.joined}</td>
                  <td className="px-4 py-3"><Chip variant={STATUS_VARIANT[s.status]??'default'} size="sm">{s.status}</Chip></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon="eye">View</Button>
                      <Button variant="ghost" size="sm" icon="dots-vertical" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showOnboard && (
        <Modal title="Onboard a new school" onClose={() => setShowOnboard(false)}>
          <OnboardSchoolForm onDone={() => setShowOnboard(false)} onCancel={() => setShowOnboard(false)} />
        </Modal>
      )}
    </div>
  );
}

// ── SA Users ──────────────────────────────────────────────────────────────────
// Real query, replacing the old MOCK_USERS array. profiles has no "status"
// (active/inactive) column — that concept doesn't exist anywhere in the
// schema yet, so rather than fabricate one, the status column from the
// original mock UI is removed here. If a real "deactivate user" feature is
// wanted later, it needs an actual column (and an Edge Function for the
// auth.users-side ban, since deactivating a login isn't just a Postgres row
// flip) — flagging this rather than inventing fake data for it.
function useSuperAdminUsers() {
  return useQuery({
    queryKey: ['superadmin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,full_name,email,role,created_at,schools(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(p => ({
        id: p.user_id,
        name: p.full_name,
        email: p.email,
        role: p.role,
        school: p.schools?.name ?? '—',
        joined: new Date(p.created_at).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }),
      }));
    },
    staleTime: 30_000,
  });
}

function SAUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRole] = useState('');
  const { data: users = [], isLoading } = useSuperAdminUsers();

  const ROLE_VARIANT = { teacher:'teal', parent:'rose', tutor:'emerald', school_admin:'gold', super_admin:'violet', student:'coral', head_teacher:'sky' };

  const list = users.filter(u=>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter)
  );

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="All users" subtitle="Platform-wide user management.">
        <Button variant="ghost" icon="download">Export users</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          {label:'Teachers',    role:'teacher',      icon:'chalkboard'},
          {label:'Parents',     role:'parent',       icon:'users'},
          {label:'Students',    role:'student',      icon:'school'},
          {label:'Tutors',      role:'tutor',        icon:'user-star'},
          {label:'School admins',role:'school_admin',icon:'shield'},
        ].map(r=>(
          <KpiCard key={r.label} label={r.label} value={isLoading ? '—' : users.filter(u=>u.role===r.role).length} deltaDir="flat" icon={r.icon} />
        ))}
      </div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <Input className="max-w-[260px]" placeholder="Search users…" value={search} onChange={e=>setSearch(e.target.value)} />
        <Select className="max-w-[180px]" value={roleFilter} onChange={e=>setRole(e.target.value)}>
          <option value="">All roles</option>
          {['teacher','parent','student','tutor','school_admin'].map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}
        </Select>
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['User','Role','School','Email','Joined',''].map(h=>(
                  <th key={h} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8"><LoadingScreen /></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8"><Empty icon="users" message="No users match your filters." /></td></tr>
              ) : list.map((u)=>(
                <tr key={u.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size="sm" />
                      <span className="font-medium text-[var(--c-ink-0)] whitespace-nowrap">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Chip variant={ROLE_VARIANT[u.role]??'default'} size="sm">{u.role.replace('_',' ')}</Chip></td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)] whitespace-nowrap">{u.school}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{u.email}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--c-ink-4)]">{u.joined}</td>
                  <td className="px-4 py-3"><Button variant="ghost" size="sm" icon="dots-vertical" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SA Content ────────────────────────────────────────────────────────────────
// Real query, replacing the hardcoded `stats` array. There is no
// "completion" concept stored anywhere (lessons doesn't have a published/
// draft flag) — what IS real and queryable is how many lessons actually
// exist per class_level/subject. "Coverage" here means: real lesson count
// against a target of (13 weeks × however many distinct subjects this
// class level actually uses across the lessons that DO exist) — i.e. an
// honest denominator derived from real data, not an invented number. A
// class level with zero lessons shows 0%, not a fabricated placeholder.
const WEEKS_PER_TERM = 13;

function useSuperAdminContent() {
  return useQuery({
    queryKey: ['superadmin-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('class_level, subject')
        .not('class_level', 'is', null);
      if (error) throw error;

      const byLevel = {};
      (data ?? []).forEach(l => {
        if (!byLevel[l.class_level]) byLevel[l.class_level] = { lessonCount: 0, subjects: new Set() };
        byLevel[l.class_level].lessonCount++;
        byLevel[l.class_level].subjects.add(l.subject);
      });

      return Object.entries(byLevel).map(([level, info]) => {
        const subjectCount = info.subjects.size;
        const target = subjectCount * WEEKS_PER_TERM;
        return {
          level,
          lessons: info.lessonCount,
          subjects: subjectCount,
          target,
          completePct: target > 0 ? Math.min(100, Math.round((info.lessonCount / target) * 100)) : 0,
        };
      }).sort((a, b) => a.level.localeCompare(b.level));
    },
    staleTime: 60_000,
  });
}

function SAContent() {
  const { data: stats = [], isLoading } = useSuperAdminContent();
  const total     = stats.reduce((a,s)=>a+s.lessons,0);
  const targetTotal = stats.reduce((a,s)=>a+s.target,0);
  const overallPct = targetTotal > 0 ? Math.round((total / targetTotal) * 100) : 0;

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Content management" subtitle="NERDC/NAPPS lesson library and curriculum coverage.">
        <Button variant="primary" icon="plus">Upload lessons</Button>
        <Button variant="ghost" icon="download">Export catalogue</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total lessons"     value={isLoading ? '—' : total}                              deltaDir="flat" icon="book-2"      />
        <KpiCard label="Coverage vs. 13-wk term" value={isLoading ? '—' : `${overallPct}%`}             deltaDir="flat" icon="chart-bar"   />
        <KpiCard label="Class levels with content" value={isLoading ? '—' : stats.length}               deltaDir="flat" icon="layers"      />
        <KpiCard label="Subjects covered"  value={isLoading ? '—' : stats.reduce((a,s)=>a+s.subjects,0)} deltaDir="flat" icon="book-open" />
      </div>
      <Card>
        <CardHeader title="Lesson coverage by class level" />
        {isLoading ? (
          <LoadingScreen />
        ) : stats.length === 0 ? (
          <Empty icon="book-2" message="No lessons have been added yet. Coverage will appear here once lesson content is uploaded." />
        ) : stats.map(s=>(
          <div key={s.level} className="flex items-center gap-4 py-3 border-b border-[var(--c-line-1)] last:border-0">
            <div className="w-24 shrink-0 font-medium text-[var(--c-ink-1)] text-[13px]">{s.level}</div>
            <div className="text-[11px] text-[var(--c-ink-3)] w-16 shrink-0">{s.subjects} subject{s.subjects !== 1 ? 's' : ''}</div>
            <div className="flex-1">
              <ProgressBar value={s.completePct}
                color={s.completePct>=80?'var(--c-green-400)':s.completePct>=50?'var(--product-accent)':'var(--c-rose-400)'} />
            </div>
            <div className="text-[12px] font-semibold text-[var(--c-ink-0)] w-16 text-right">{s.lessons}/{s.target}</div>
            <Chip variant={s.completePct>=80?'green':s.completePct>=50?'amber':'red'} size="sm">{s.completePct}%</Chip>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── SA Tutors ─────────────────────────────────────────────────────────────────
function SATutors() {
  const [tab, setTab] = useState('all');
  const list = tab==='pending' ? MOCK_TUTORS.filter(t=>t.status==='pending') : MOCK_TUTORS;

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Tutor marketplace" subtitle="Verify tutors, track performance, manage the marketplace.">
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total tutors"    value={MOCK_TUTORS.length}                                deltaDir="flat" icon="user-star" />
        <KpiCard label="Verified"        value={MOCK_TUTORS.filter(t=>t.status==='verified').length} deltaDir="flat" icon="shield-check" />
        <KpiCard label="Pending review"  value={MOCK_TUTORS.filter(t=>t.status==='pending').length} deltaDir="flat" icon="clock" />
        <KpiCard label="Sessions (month)"value="124"                                               deltaDir="up" delta="+18%" icon="calendar-check" />
      </div>
      <Tabs tabs={[{key:'all',label:'All tutors'},{key:'pending',label:'Pending verification',count:MOCK_TUTORS.filter(t=>t.status==='pending').length}]} active={tab} onChange={setTab} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(t=>(
          <Card key={t.id}>
            <div className="flex items-start gap-3 mb-3">
              <Avatar name={t.name} size="lg" />
              <div className="flex-1">
                <div className="font-heading font-semibold text-[14px] text-[var(--c-ink-0)]">{t.name}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">📍 {t.location}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[12px] text-[var(--c-amber-400)]">★</span>
                  <span className="text-[11px] font-semibold text-[var(--c-ink-1)]">{t.rating}</span>
                  <span className="text-[10px] text-[var(--c-ink-3)]">· {t.sessions} sessions</span>
                </div>
              </div>
              <Chip variant={STATUS_VARIANT[t.status]??'default'} size="sm">{t.status}</Chip>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {t.subjects.map(s=><Chip key={s} variant="default" size="sm">{s}</Chip>)}
            </div>
            <div className="flex items-center justify-between text-[12px] mb-3">
              <span className="text-[var(--c-ink-3)]">Earnings (YTD)</span>
              <span className="font-bold text-[var(--c-emerald-400)]">{t.earnings}</span>
            </div>
            <div className="flex gap-2">
              {t.status==='pending' && <Button variant="primary" size="sm" icon="shield-check" className="flex-1 justify-center">Verify</Button>}
              {t.status==='verified' && <Button variant="ghost" size="sm" icon="eye" className="flex-1 justify-center">View profile</Button>}
              <Button variant="ghost" size="sm" icon="dots-vertical" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SA Impact ─────────────────────────────────────────────────────────────────
function SAImpact() {
  const metrics = [
    { label:'Students reached',    value:'2,847',  delta:'+124 this month',  icon:'users',        color:'var(--c-teal-400)'    },
    { label:'Lessons completed',   value:'48,291', delta:'+6,200 this month', icon:'book-2',       color:'var(--product-accent)'},
    { label:'Platform att. rate',  value:'91%',    delta:'+2% vs last term',  icon:'calendar-stats',color:'var(--c-green-400)'  },
    { label:'Parent engagement',   value:'74%',    delta:'+8% this term',     icon:'heart',        color:'var(--c-rose-400)'    },
    { label:'Schools with >90% att','value':'4',   delta:'Of 8 active',      icon:'building-school',color:'var(--c-emerald-400)'},
    { label:'Teacher lesson rate', value:'87%',    delta:'of planned',        icon:'chalkboard',   color:'var(--c-sky-400)'     },
  ];
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Impact hub" subtitle="Platform-wide learning outcomes and impact metrics.">
        <Button variant="ghost" icon="download">Donor report (PDF)</Button>
        <Button variant="ghost" icon="file-analytics">Government report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {metrics.map(m=>(
          <div key={m.label} className="bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{m.label}</div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:`${m.color}20`,color:m.color}}>
                <Icon name={m.icon} className="text-[16px]" />
              </div>
            </div>
            <div className="font-heading text-[28px] font-bold text-[var(--c-ink-0)]">{m.value}</div>
            <div className="text-[11px] text-[var(--c-green-400)] mt-1">↑ {m.delta}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title="Monthly lesson completions trend" />
        <div className="flex items-end gap-2 h-32">
          {[28400,31200,29800,33400,38100,41200,44800,48291].map((v,i)=>{
            const max=48291;
            const months=['Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{height:`${Math.round((v/max)*100)}%`,background:'var(--product-accent)',opacity:0.7,minHeight:'4px'}} />
                <div className="text-[9px] text-[var(--c-ink-4)]">{months[i]}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── SA Revenue ────────────────────────────────────────────────────────────────
function SARevenue() {
  const { data: schools = [] } = useSuperAdminSchools();
  const schoolsForRevenue = schools.filter(s => s.status !== 'pending');

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Revenue" subtitle="Platform earnings, school subscriptions, tutor commissions.">
        <Button variant="ghost" icon="download">Financial report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total revenue (YTD)" value="—"   deltaDir="flat" delta="Billing not yet wired" icon="trending-up"  />
        <KpiCard label="School subs (MRR)"   value="—"   deltaDir="flat" delta="Not tracked yet"       icon="building-school"/>
        <KpiCard label="Tutor commissions"   value="—"   deltaDir="flat" delta="Tutor marketplace not yet wired" icon="user-star" />
        <KpiCard label="Outstanding"         value="—"   deltaDir="flat" delta="Not tracked yet"       icon="alert-circle" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Monthly revenue breakdown" />
          <Empty icon="chart-bar" message="No billing system is connected yet. This chart will populate once subscriptions/invoicing are built — explicitly descoped for now." />
        </Card>
        <Card>
          <CardHeader title="Revenue by school" />
          <Alert type="info" className="mb-3">
            Billing isn't wired up yet (explicitly out of scope for now) — this section will show real per-school revenue once subscriptions/invoicing are built.
          </Alert>
          {schoolsForRevenue.length === 0 ? (
            <Empty icon="receipt-2" message="No schools onboarded yet." />
          ) : schoolsForRevenue.slice(0,6).map(s=>(
            <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
              <div className="text-[12px] text-[var(--c-ink-2)] w-36 shrink-0 truncate">{s.name}</div>
              <div className="text-[11px] text-[var(--c-ink-4)]">No billing data yet</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── SA Security ───────────────────────────────────────────────────────────────
function SASecurity() {
  const events = [
    { event:'Failed login attempt',     ip:'102.89.3.47',  user:'unknown@mail.com',    time:'14:23 today',   type:'warning'  },
    { event:'Admin settings changed',   ip:'197.210.84.12',user:'admin@tlflekki.ng',   time:'09:15 today',   type:'info'     },
    { event:'New device login',         ip:'41.58.22.100',  user:'t.okonkwo@tlf.ng',  time:'08:42 today',   type:'info'     },
    { event:'Password reset',           ip:'105.112.88.34', user:'parent@gmail.com',  time:'Yesterday',      type:'info'     },
    { event:'Suspicious activity (5x login)', ip:'197.255.12.4',user:'—',             time:'2 days ago',    type:'error'    },
  ];
  const typeVariant={warning:'amber',info:'teal',error:'red',success:'green'};
  const typeIcon={warning:'alert-triangle',info:'info-circle',error:'alert-circle',success:'circle-check'};

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Security" subtitle="Platform-wide security audit and access control.">
        <Button variant="ghost" icon="download">Export security log</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Active sessions"   value="84"  deltaDir="flat" icon="users"         />
        <KpiCard label="Failed logins (24h)" value="3" deltaDir="flat" icon="lock"          />
        <KpiCard label="Password resets (wk)" value="12" deltaDir="flat" icon="key"        />
        <KpiCard label="Blocked IPs"       value="2"   deltaDir="flat" icon="shield-x"     />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Security event log" />
          {events.map((e,i)=>(
            <div key={i} className="flex gap-3 p-3 rounded-lg mb-2 last:mb-0"
              style={{background:`var(--c-surface-3)`,borderLeft:`3px solid var(--c-${typeVariant[e.type]}-400,var(--c-teal-400))`}}>
              <Icon name={typeIcon[e.type]} className="text-[16px] mt-0.5 shrink-0"
                style={{color:`var(--c-${typeVariant[e.type]}-400,var(--c-teal-400))`}} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--c-ink-1)]">{e.event}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5 font-mono">{e.ip} · {e.user}</div>
              </div>
              <div className="text-[10px] font-mono text-[var(--c-ink-4)] shrink-0">{e.time}</div>
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Access control" />
          <Alert type="info" className="mb-4">Platform-wide 2FA is recommended for all school admin accounts.</Alert>
          <div className="space-y-3">
            {[
              {label:'Enforce 2FA — school admins',   enabled:false},
              {label:'Enforce 2FA — head teachers',   enabled:false},
              {label:'IP whitelist for super admins', enabled:true },
              {label:'Automatic session timeout',     enabled:true },
              {label:'Suspicious activity alerts',    enabled:true },
            ].map(opt=>(
              <div key={opt.label} className="flex items-center justify-between py-2 border-b border-[var(--c-line-1)] last:border-0">
                <span className="text-[13px] text-[var(--c-ink-1)]">{opt.label}</span>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${opt.enabled?'bg-[var(--product-accent)]':'bg-[var(--c-surface-5)]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${opt.enabled?'translate-x-5':'translate-x-0.5'}`} />
                </div>
              </div>
            ))}
          </div>
          <Button variant="primary" icon="device-floppy" className="mt-4">Save security settings</Button>
        </Card>
      </div>
    </div>
  );
}

// ── SA Platform Settings ──────────────────────────────────────────────────────
function SAPlatformSettings() {
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Platform settings" subtitle="Global TTA EOS configuration." />
      <div className="grid lg:grid-cols-2 gap-4">
        {[
          { icon:'building-school', label:'School onboarding',    desc:'Configure onboarding flow, required documents, trial period length.'  },
          { icon:'receipt-2',       label:'Subscription plans',   desc:'Manage pricing tiers: Standard, Premium, Government, Trial.'           },
          { icon:'user-star',       label:'Tutor marketplace',    desc:'Commission rates, verification requirements, payout schedule.'          },
          { icon:'book-2',          label:'Content pipeline',     desc:'Curriculum upload workflow, quality review process.'                    },
          { icon:'brand-whatsapp',  label:'WhatsApp platform',    desc:'Platform-wide WhatsApp Business API config and templates.'              },
          { icon:'chart-area',      label:'Impact reporting',     desc:'Donor report templates, government data formats, export schedules.'     },
          { icon:'shield',          label:'Security policy',      desc:'Platform-wide password and session policies.'                           },
          { icon:'globe',           label:'Localisation',         desc:'Language support, currency, date and time formats.'                     },
        ].map(s=>(
          <Card key={s.label} className="cursor-pointer hover:border-[var(--product-accent)] transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{background:'var(--product-accent)',color:'#1a1305',opacity:0.85}}>
                <Icon name={s.icon} className="text-[18px]" />
              </div>
              <div>
                <div className="font-semibold text-[var(--c-ink-0)] text-[14px]">{s.label}</div>
                <div className="text-[12px] text-[var(--c-ink-3)] mt-1 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SuperAdminApp root ────────────────────────────────────────────────────────
export function SuperAdminApp() {
  return (
    <ProductTheme surface="superadmin">
      <AppShell navItems={NAV} title="Super Admin">
        <Routes>
          <Route index            element={<SAOverview />}          />
          <Route path="schools"   element={<SASchools />}           />
          <Route path="users"     element={<SAUsers />}             />
          <Route path="content"   element={<SAContent />}           />
          <Route path="tutors"    element={<SATutors />}            />
          <Route path="impact"    element={<SAImpact />}            />
          <Route path="revenue"   element={<SARevenue />}           />
          <Route path="security"  element={<SASecurity />}         />
          <Route path="settings"  element={<SAPlatformSettings />} />
          <Route path="*"         element={<Navigate to="/superadmin" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}
