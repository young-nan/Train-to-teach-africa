/**
 * AdminStudents.jsx
 * Full student roster — search, filter by class/status, add, import, export.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, Chip, Button, Avatar,
  Input, Select, FormGroup, Alert, ProgressBar, LoadingScreen, Empty,
} from '@/components/ui';

const STATUS_CHIP = {
  active:   <Chip variant="green">Active</Chip>,
  inactive: <Chip variant="default">Inactive</Chip>,
  at_risk:  <Chip variant="amber">At risk</Chip>,
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)]">
          <h2 className="font-heading font-semibold text-[16px] text-[var(--c-ink-0)]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-3)] transition-colors">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function AddStudentForm({ schoolId, classes, onSave, onCancel, isLoading, errorMessage }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', class_id: '', gender: '',
    admission_number: '', date_of_birth: '',
  });
  const [localError, setLocalError] = useState('');
  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setLocalError('First and last name are required.');
      return;
    }
    setLocalError('');
    onSave({
      school_id: schoolId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      class_id: form.class_id || null,
      gender: form.gender || null,
      admission_number: form.admission_number.trim() || null,
      date_of_birth: form.date_of_birth || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(localError || errorMessage) && <Alert type="error">{localError || errorMessage}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="First name *">
          <Input placeholder="Chidi" value={form.first_name} onChange={update('first_name')} required />
        </FormGroup>
        <FormGroup label="Last name *">
          <Input placeholder="Obi" value={form.last_name} onChange={update('last_name')} required />
        </FormGroup>
      </div>
      <FormGroup label="Class">
        <Select value={form.class_id} onChange={update('class_id')}>
          <option value="">Assign later…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </FormGroup>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Gender">
          <Select value={form.gender} onChange={update('gender')}>
            <option value="">Not specified</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </Select>
        </FormGroup>
        <FormGroup label="Date of birth">
          <Input type="date" value={form.date_of_birth} onChange={update('date_of_birth')} />
        </FormGroup>
      </div>
      <FormGroup label="Admission number" hint="Leave blank to assign later.">
        <Input placeholder="e.g. TLF/2026/001" value={form.admission_number} onChange={update('admission_number')} />
      </FormGroup>
      <div className="flex gap-3 pt-2">
        <Button variant="primary" type="submit" isLoading={isLoading} className="flex-1 justify-center">
          Add student
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function useStudents(schoolId, search, classId) {
  return useQuery({
    queryKey: ['admin-students', schoolId, search, classId],
    queryFn: async () => {
      if (!schoolId) return [];
      let q = supabase
        .from('pupils')
        .select(`
          id, first_name, last_name, admission_number, gender, status, created_at,
          classes(id, name),
          parent:profiles!pupils_parent_id_fkey(first_name, last_name),
          attendance_records(status)
        `)
        .eq('school_id', schoolId)
        .order('first_name');

      if (search) q = q.ilike('first_name', `%${search}%`);
      if (classId) q = q.eq('class_id', classId);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });
}

function useClasses(schoolId) {
  return useQuery({
    queryKey: ['admin-classes-list', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data } = await supabase.from('classes').select('id,name').eq('school_id', schoolId).order('name');
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

export default function AdminStudents() {
  const { profile, schoolId } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch]   = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus]   = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const { data: students = [], isLoading } = useStudents(schoolId, search, classId || undefined);
  const { data: classes  = [] }            = useClasses(schoolId);

  const addStudent = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('pupils').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['admin-students', schoolId]);
      setShowAdd(false);
    },
  });

  const filtered = status
    ? students.filter(s => s.status === status)
    : students;

  const attPct = (student) => {
    const recs = student.attendance_records ?? [];
    if (!recs.length) return null;
    const present = recs.filter(r => r.status === 'present').length;
    return Math.round((present / recs.length) * 100);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Students"
        title="Student roster"
        subtitle={`${filtered.length} student${filtered.length !== 1 ? 's' : ''} · Term 3 2025/2026`}
      >
        <Button variant="primary" icon="user-plus" onClick={() => setShowAdd(true)}>
          Add student
        </Button>
        <Button variant="ghost" icon="upload">Import CSV</Button>
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Input
          className="max-w-[260px]"
          placeholder="Search by name or admission no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select
          className="max-w-[180px]"
          value={classId}
          onChange={e => setClassId(e.target.value)}
        >
          <option value="">All classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select
          className="max-w-[160px]"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="at_risk">At risk</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <Card padding={false}>
          {filtered.length === 0 ? (
            <Empty
              icon="users"
              message="No students match your filters."
              action={<Button variant="ghost" onClick={() => { setSearch(''); setClassId(''); setStatus(''); }}>Clear filters</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--c-line-2)]">
                    {['Student','Class','Admission no','Parent / Guardian','Attendance','Status',''].map(h => (
                      <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const att = attPct(s);
                    const parent = s.parent;
                    return (
                      <tr key={s.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={`${s.first_name} ${s.last_name}`} size="sm" />
                            <div>
                              <div className="font-semibold text-[var(--c-ink-0)]">{s.first_name} {s.last_name}</div>
                              <div className="text-[11px] text-[var(--c-ink-4)] font-mono">{s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[var(--c-ink-2)]">{s.classes?.name ?? '—'}</td>
                        <td className="px-5 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{s.admission_number ?? '—'}</td>
                        <td className="px-5 py-3 text-[var(--c-ink-2)]">
                          {parent ? `${parent.first_name} ${parent.last_name}` : '—'}
                        </td>
                        <td className="px-5 py-3 min-w-[120px]">
                          {att != null ? (
                            <div className="flex items-center gap-2">
                              <ProgressBar
                                value={att}
                                color={att >= 90 ? 'var(--c-green-400)' : att >= 70 ? 'var(--product-accent)' : 'var(--c-rose-400)'}
                                className="flex-1"
                              />
                              <span className="text-[11px] text-[var(--c-ink-3)] w-8 text-right">{att}%</span>
                            </div>
                          ) : <span className="text-[var(--c-ink-4)]">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          {STATUS_CHIP[s.status] ?? <Chip variant="default">{s.status}</Chip>}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            to={`/admin/students/${s.id}`}
                            className="text-[12px] text-[var(--product-accent)] hover:opacity-80 transition-opacity font-medium"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showAdd && (
        <Modal title="Add student" onClose={() => setShowAdd(false)}>
          <AddStudentForm
            schoolId={schoolId}
            classes={classes}
            onSave={payload => addStudent.mutate(payload)}
            onCancel={() => setShowAdd(false)}
            isLoading={addStudent.isPending}
            errorMessage={addStudent.error?.message}
          />
        </Modal>
      )}
    </div>
  );
}
