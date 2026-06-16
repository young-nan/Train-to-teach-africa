/**
 * AdminStudents.jsx
 * Full student roster — search, filter by class/status, add, import, export.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, Chip, Button, Avatar,
  Input, Select, ProgressBar, LoadingScreen, Empty,
} from '@/components/ui';

const STATUS_CHIP = {
  active:   <Chip variant="green">Active</Chip>,
  inactive: <Chip variant="default">Inactive</Chip>,
  at_risk:  <Chip variant="amber">At risk</Chip>,
};

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
  const schoolId = schoolId;

  const [search, setSearch]   = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus]   = useState('');

  const { data: students = [], isLoading } = useStudents(schoolId, search, classId || undefined);
  const { data: classes  = [] }            = useClasses(schoolId);

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
        <Button variant="primary" icon="user-plus">
          <Link to="/admin/students/new">Add student</Link>
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
    </div>
  );
}
