/**
 * AdminStaff.jsx — Full staff management
 * List all teachers/head teachers · Invite new staff · View profiles
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Input, Select, FormGroup, Alert,
  LoadingScreen, Empty, Tabs,
} from '@/components/ui';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)]">
          <h2 className="font-heading font-semibold text-[16px] text-[var(--c-ink-0)]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-3)] transition-colors">
            <i className="ti ti-x text-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const ROLE_META = {
  head_teacher: { label: 'Head Teacher', variant: 'sky'    },
  teacher:      { label: 'Teacher',      variant: 'teal'   },
  school_admin: { label: 'Admin',        variant: 'gold'   },
};

function useStaff(schoolId) {
  return useQuery({
    queryKey: ['admin-staff', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, email, phone, role,
          created_at, avatar_url,
          classes(id, name)
        `)
        .eq('school_id', schoolId)
        .in('role', ['teacher', 'head_teacher', 'school_admin'])
        .order('first_name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });
}

function InviteForm({ schoolId, onSuccess, onCancel }) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', role:'teacher' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Call the staff invite Edge Function
      const { error: fnErr } = await supabase.functions.invoke('invite-staff', {
        body: { ...form, school_id: schoolId },
      });
      if (fnErr) throw fnErr;
      onSuccess();
    } catch (err) {
      setError(err.message ?? 'Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="First name *">
          <Input placeholder="Jane" value={form.first_name} onChange={update('first_name')} required />
        </FormGroup>
        <FormGroup label="Last name *">
          <Input placeholder="Adeyemi" value={form.last_name} onChange={update('last_name')} required />
        </FormGroup>
      </div>
      <FormGroup label="Email address *">
        <Input type="email" placeholder="teacher@school.edu.ng" value={form.email} onChange={update('email')} required />
      </FormGroup>
      <FormGroup label="Role *">
        <Select value={form.role} onChange={update('role')} required>
          <option value="teacher">Teacher</option>
          <option value="head_teacher">Head Teacher</option>
          <option value="school_admin">School Administrator</option>
        </Select>
      </FormGroup>
      <Alert type="info">
        An invitation email will be sent. The staff member sets their own password on first login.
      </Alert>
      <div className="flex gap-3 pt-2">
        <Button variant="primary" type="submit" isLoading={loading} className="flex-1 justify-center">
          Send invite
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function StaffCard({ member, onViewClass }) {
  const roleMeta = ROLE_META[member.role] ?? { label: member.role, variant: 'default' };
  const classes  = member.classes ?? [];

  return (
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <Avatar name={`${member.first_name} ${member.last_name}`} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="font-heading font-semibold text-[15px] text-[var(--c-ink-0)] truncate">
            {member.first_name} {member.last_name}
          </div>
          <div className="mt-1"><Chip variant={roleMeta.variant} size="sm">{roleMeta.label}</Chip></div>
        </div>
      </div>

      <div className="space-y-1.5 text-[12px] mb-4">
        {member.email && (
          <div className="flex items-center gap-2 text-[var(--c-ink-3)]">
            <i className="ti ti-mail text-[14px] text-[var(--c-ink-4)]" aria-hidden="true" />
            <span className="truncate">{member.email}</span>
          </div>
        )}
        {member.phone && (
          <div className="flex items-center gap-2 text-[var(--c-ink-3)]">
            <i className="ti ti-phone text-[14px] text-[var(--c-ink-4)]" aria-hidden="true" />
            {member.phone}
          </div>
        )}
        <div className="flex items-center gap-2 text-[var(--c-ink-3)]">
          <i className="ti ti-chalkboard text-[14px] text-[var(--c-ink-4)]" aria-hidden="true" />
          {classes.length > 0
            ? classes.map(c => c.name).join(', ')
            : <span className="text-[var(--c-ink-4)]">No class assigned</span>
          }
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" icon="message-dots">Message</Button>
        <Button variant="ghost" size="sm" icon="dots-vertical">More</Button>
      </div>
    </Card>
  );
}

const TABS = [
  { key: 'all',       label: 'All staff'    },
  { key: 'teachers',  label: 'Teachers'     },
  { key: 'admins',    label: 'Admins'       },
];

export default function AdminStaff() {
  const { profile, schoolId } = useAuth();
  const schoolId = schoolId;
  const qc = useQueryClient();

  const [tab, setTab]           = useState('all');
  const [search, setSearch]     = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const { data: staff = [], isLoading } = useStaff(schoolId);

  const tabFiltered = staff.filter(m => {
    if (tab === 'teachers') return ['teacher','head_teacher'].includes(m.role);
    if (tab === 'admins')   return m.role === 'school_admin';
    return true;
  });

  const filtered = tabFiltered.filter(m =>
    !search ||
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Staff"
        subtitle={`${staff.length} staff member${staff.length !== 1 ? 's' : ''} · ${staff.filter(s=>s.role==='teacher').length} teachers`}
      >
        <Button variant="primary" icon="user-plus" onClick={() => setShowInvite(true)}>Invite staff</Button>
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Head teachers"  value={staff.filter(s=>s.role==='head_teacher').length}  deltaDir="flat" icon="award"        />
        <KpiCard label="Class teachers" value={staff.filter(s=>s.role==='teacher').length}       deltaDir="flat" icon="chalkboard"   />
        <KpiCard label="Admins"         value={staff.filter(s=>s.role==='school_admin').length}  deltaDir="flat" icon="shield"       />
        <KpiCard label="Unassigned"     value={staff.filter(s=>(!s.classes||s.classes.length===0)&&['teacher','head_teacher'].includes(s.role)).length} deltaDir="flat" icon="alert-triangle" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mb-4">
        <Input className="max-w-[280px]" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : filtered.length === 0 ? (
        <Empty
          icon="id-badge-2"
          message={search ? 'No staff match your search.' : 'No staff members yet. Invite your first teacher.'}
          action={<Button variant="primary" icon="user-plus" onClick={() => setShowInvite(true)}>Invite staff</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => <StaffCard key={m.id} member={m} />)}
        </div>
      )}

      {showInvite && (
        <Modal title="Invite staff member" onClose={() => setShowInvite(false)}>
          <InviteForm
            schoolId={schoolId}
            onSuccess={() => { setShowInvite(false); qc.invalidateQueries(['admin-staff', schoolId]); }}
            onCancel={() => setShowInvite(false)}
          />
        </Modal>
      )}
    </div>
  );
}
