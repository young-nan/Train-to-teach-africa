/**
 * AdminStudentProfile.jsx
 * Full individual student record — details, attendance, grades, interventions, notes.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  PageHeader, Card, CardHeader, Chip, Button, Avatar,
  Tabs, ProgressBar, LoadingScreen, Empty, StatRow, Divider,
} from '@/components/ui';

const TABS = [
  { key: 'overview',      label: 'Overview'     },
  { key: 'attendance',    label: 'Attendance'   },
  { key: 'grades',        label: 'Grades'       },
  { key: 'interventions', label: 'Interventions'},
  { key: 'notes',         label: 'Notes'        },
];

function useStudent(id) {
  return useQuery({
    queryKey: ['admin-student', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pupils')
        .select(`
          *,
          classes(id, name),
          parent:profiles!pupils_parent_id_fkey(id, first_name, last_name, phone, email),
          attendance_records(status, date, created_at),
          assessment_scores(score, max_score, assessment_type, subject, created_at)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export default function AdminStudentProfile() {
  const { id } = useParams();
  const [tab, setTab] = useState('overview');
  const { data: student, isLoading } = useStudent(id);

  if (isLoading) return <LoadingScreen />;
  if (!student) return <Empty icon="user-x" message="Student not found." action={<Link to="/admin/students" className="text-[var(--product-accent)]">← Back to students</Link>} />;

  const name = `${student.first_name} ${student.last_name}`;
  const attRecords = student.attendance_records ?? [];
  const present  = attRecords.filter(r => r.status === 'present').length;
  const absent   = attRecords.filter(r => r.status === 'absent').length;
  const late     = attRecords.filter(r => r.status === 'late').length;
  const attPct   = attRecords.length ? Math.round((present / attRecords.length) * 100) : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-[12px] text-[var(--c-ink-3)] mb-4">
        <Link to="/admin/students" className="hover:text-[var(--product-accent)]">Students</Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--c-ink-1)]">{name}</span>
      </div>

      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-5 mb-6 p-5 bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl">
        <Avatar name={name} size="lg" />
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-[20px] font-bold text-[var(--c-ink-0)]">{name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Chip variant="gold">{student.classes?.name ?? 'No class'}</Chip>
            {student.admission_number && (
              <span className="font-mono text-[11px] text-[var(--c-ink-4)]">{student.admission_number}</span>
            )}
            <Chip variant={student.status === 'active' ? 'green' : 'default'}>{student.status ?? 'active'}</Chip>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Gender',   value: student.gender === 'M' ? 'Male' : student.gender === 'F' ? 'Female' : '—' },
              { label: 'DOB',      value: student.date_of_birth ?? '—' },
              { label: 'Blood Grp',value: student.blood_group ?? '—' },
              { label: 'Enrolled', value: student.enrollment_date?.slice(0,10) ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--c-ink-4)]">{label}</div>
                <div className="text-[13px] text-[var(--c-ink-1)] font-medium mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button variant="primary" icon="edit">Edit</Button>
          <Button variant="ghost" icon="printer">Print card</Button>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Attendance summary" />
            <div className="text-center py-4">
              <div className="font-heading text-[40px] font-bold text-[var(--c-ink-0)]">{attPct}%</div>
              <div className="text-[12px] text-[var(--c-ink-3)] mt-1">Overall attendance rate</div>
              <ProgressBar
                value={attPct}
                color={attPct >= 90 ? 'var(--c-green-400)' : attPct >= 70 ? 'var(--product-accent)' : 'var(--c-rose-400)'}
                className="mt-3 mx-8"
              />
            </div>
            <Divider className="my-3" />
            <StatRow label="Present"  value={present}            color="var(--c-green-400)" />
            <StatRow label="Absent"   value={absent}             color="var(--c-rose-400)"  />
            <StatRow label="Late"     value={late}               color="var(--product-accent)" />
            <StatRow label="Total days recorded" value={attRecords.length} />
          </Card>

          <Card>
            <CardHeader title="Parent / Guardian" />
            {student.parent ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={`${student.parent.first_name} ${student.parent.last_name}`} />
                  <div>
                    <div className="font-semibold text-[var(--c-ink-0)]">
                      {student.parent.first_name} {student.parent.last_name}
                    </div>
                    <div className="text-[11px] text-[var(--c-ink-3)]">Parent / Guardian</div>
                  </div>
                </div>
                <StatRow label="Phone" value={student.parent.phone ?? '—'} />
                <StatRow label="Email" value={student.parent.email ?? '—'} />
                <div className="mt-4 flex gap-2">
                  <Button variant="ghost" size="sm" icon="phone">Call</Button>
                  <Button variant="ghost" size="sm" icon="message-dots">Message</Button>
                  <Button variant="ghost" size="sm" icon="brand-whatsapp">WhatsApp</Button>
                </div>
              </>
            ) : (
              <Empty icon="user-question" message="No parent linked." />
            )}
          </Card>

          {student.medical_notes && (
            <Card className="lg:col-span-2">
              <CardHeader title="Medical notes" />
              <p className="text-[13px] text-[var(--c-ink-2)] leading-relaxed">{student.medical_notes}</p>
            </Card>
          )}
        </div>
      )}

      {/* Attendance tab */}
      {tab === 'attendance' && (
        <Card>
          <CardHeader title="Attendance history" />
          {attRecords.length === 0 ? (
            <Empty icon="calendar-x" message="No attendance records yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--c-line-2)]">
                    {['Date','Status','Recorded by'].map(h => (
                      <th key={h} className="text-left pb-3 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...attRecords].sort((a,b) => new Date(b.date ?? b.created_at) - new Date(a.date ?? a.created_at)).map((r, i) => (
                    <tr key={i} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                      <td className="py-2.5 pr-4 text-[var(--c-ink-2)]">{(r.date ?? r.created_at)?.slice(0,10)}</td>
                      <td className="py-2.5 pr-4">
                        <Chip variant={r.status === 'present' ? 'green' : r.status === 'absent' ? 'red' : 'amber'}>
                          {r.status}
                        </Chip>
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--c-ink-3)]">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Grades tab */}
      {tab === 'grades' && (
        <Card>
          <CardHeader title="Assessment scores" />
          {!student.assessment_scores?.length ? (
            <Empty icon="clipboard-x" message="No scores recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--c-line-2)]">
                    {['Subject','Type','Score','%','Date'].map(h => (
                      <th key={h} className="text-left pb-3 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {student.assessment_scores.map((s, i) => {
                    const pct = s.max_score ? Math.round((s.score / s.max_score) * 100) : null;
                    return (
                      <tr key={i} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                        <td className="py-2.5 pr-4 text-[var(--c-ink-0)] font-medium">{s.subject ?? '—'}</td>
                        <td className="py-2.5 pr-4"><Chip variant="default">{s.assessment_type ?? '—'}</Chip></td>
                        <td className="py-2.5 pr-4 font-mono text-[var(--c-ink-1)]">{s.score}/{s.max_score}</td>
                        <td className="py-2.5 pr-4">
                          {pct != null && (
                            <Chip variant={pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red'}>{pct}%</Chip>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-[var(--c-ink-3)]">{s.created_at?.slice(0,10)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Interventions & Notes tabs — placeholder */}
      {(tab === 'interventions' || tab === 'notes') && (
        <Card>
          <Empty
            icon={tab === 'interventions' ? 'alert-triangle' : 'notes'}
            message={`No ${tab} recorded for this student yet.`}
            action={<Button variant="primary" size="sm" icon="plus">Add {tab === 'interventions' ? 'intervention' : 'note'}</Button>}
          />
        </Card>
      )}
    </div>
  );
}
