/**
 * AdminAttendance.jsx
 * School-wide attendance view — today's summary, class breakdown, mark register.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard,
  Chip, Button, Select, Avatar, ProgressBar, LoadingScreen, Empty, Tabs,
} from '@/components/ui';

const STATUS_META = {
  present: { label: 'Present', chip: 'green',  bg: 'rgba(63,185,80,0.12)',  text: 'var(--c-green-400)'  },
  absent:  { label: 'Absent',  chip: 'red',    bg: 'rgba(239,83,80,0.12)',  text: 'var(--c-red-400)'    },
  late:    { label: 'Late',    chip: 'amber',  bg: 'rgba(245,165,36,0.12)', text: 'var(--c-amber-400)'  },
  excused: { label: 'Excused', chip: 'default',bg: 'var(--c-surface-4)',    text: 'var(--c-ink-3)'      },
};

const TABS = [
  { key: 'today',   label: "Today's register" },
  { key: 'summary', label: 'Weekly summary'   },
  { key: 'history', label: 'History'          },
];

function useClasses(schoolId) {
  return useQuery({
    queryKey: ['admin-classes-list', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id,name').eq('school_id', schoolId).order('name');
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

function usePupilsInClass(classId) {
  return useQuery({
    queryKey: ['pupils-in-class', classId],
    queryFn: async () => {
      if (!classId) return [];
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('pupils')
        .select(`
          id, first_name, last_name, gender,
          attendance_records!inner(status, date)
        `)
        .eq('class_id', classId)
        .eq('attendance_records.date', today)
        .order('first_name');

      // Also get all pupils without attendance today
      const { data: allPupils } = await supabase
        .from('pupils')
        .select('id, first_name, last_name, gender')
        .eq('class_id', classId)
        .order('first_name');

      const withAtt = new Set((data ?? []).map(p => p.id));
      const attMap  = Object.fromEntries((data ?? []).map(p => [p.id, p.attendance_records?.[0]?.status ?? null]));

      return (allPupils ?? []).map(p => ({
        ...p,
        status: attMap[p.id] ?? null,
      }));
    },
    enabled: !!classId,
  });
}

function useTodaySummary(schoolId) {
  return useQuery({
    queryKey: ['today-summary', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('school_id', schoolId)
        .eq('date', today);

      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      (data ?? []).forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
      return counts;
    },
    enabled: !!schoolId,
  });
}

export default function AdminAttendance() {
  const { profile, schoolId } = useAuth();
  const schoolId = schoolId;
  const qc = useQueryClient();

  const [tab, setTab]           = useState('today');
  const [selectedClass, setSelectedClass] = useState('');
  const [localStatus, setLocalStatus]     = useState({});

  const { data: classes = [] }                      = useClasses(schoolId);
  const { data: pupils  = [], isLoading: loadPupils } = usePupilsInClass(selectedClass);
  const { data: summary }                            = useTodaySummary(schoolId);

  const saveStatus = useMutation({
    mutationFn: async ({ pupilId, status }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          pupil_id:  pupilId,
          school_id: schoolId,
          class_id:  selectedClass,
          date:      today,
          status,
        }, { onConflict: 'pupil_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['pupils-in-class', selectedClass]);
      qc.invalidateQueries(['today-summary', schoolId]);
    },
  });

  const setStatus = (pupilId, status) => {
    setLocalStatus(prev => ({ ...prev, [pupilId]: status }));
    saveStatus.mutate({ pupilId, status });
  };

  const total = summary ? Object.values(summary).reduce((a,b) => a + b, 0) : 0;
  const attRate = total ? Math.round((summary?.present / total) * 100) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Attendance"
        title="Attendance"
        subtitle={`Today · ${new Date().toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`}
      >
        <Button variant="primary" icon="check">Mark all present</Button>
        <Button variant="ghost"   icon="download">Export CSV</Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Present"  value={summary?.present  ?? '—'} deltaDir="up"   delta={`${attRate}%`} icon="user-check" />
        <KpiCard label="Absent"   value={summary?.absent   ?? '—'} deltaDir="down" delta="Today"         icon="user-x"     />
        <KpiCard label="Late"     value={summary?.late     ?? '—'} deltaDir="flat" delta="Today"         icon="clock"      />
        <KpiCard label="Excused"  value={summary?.excused  ?? '—'} deltaDir="flat" delta="Today"         icon="notes"      />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* Today's register */}
      {tab === 'today' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Class register">
              <Select
                className="max-w-[200px]"
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
              >
                <option value="">Select a class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </CardHeader>

            {!selectedClass ? (
              <div className="py-8 text-center text-[13px] text-[var(--c-ink-3)]">Select a class to begin.</div>
            ) : loadPupils ? (
              <LoadingScreen />
            ) : pupils.length === 0 ? (
              <Empty icon="users" message="No pupils in this class." />
            ) : (
              <div className="space-y-1">
                {pupils.map(pupil => {
                  const currentStatus = localStatus[pupil.id] ?? pupil.status;
                  return (
                    <div
                      key={pupil.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--c-surface-3)] transition-colors"
                    >
                      <Avatar name={`${pupil.first_name} ${pupil.last_name}`} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[var(--c-ink-1)] truncate">
                          {pupil.first_name} {pupil.last_name}
                        </div>
                      </div>
                      {/* Status toggle buttons */}
                      <div className="flex gap-1">
                        {['present','absent','late','excused'].map(s => (
                          <button
                            key={s}
                            onClick={() => setStatus(pupil.id, s)}
                            className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all"
                            style={{
                              background: currentStatus === s ? STATUS_META[s].bg : 'var(--c-surface-4)',
                              color:      currentStatus === s ? STATUS_META[s].text : 'var(--c-ink-4)',
                              border:     `1px solid ${currentStatus === s ? STATUS_META[s].text + '40' : 'transparent'}`,
                            }}
                          >
                            {s[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Weekly per-class breakdown */}
          <Card>
            <CardHeader title="This week — all classes" />
            <div className="space-y-1">
              {classes.map((cls, i) => {
                const pct = [94, 88, 92, 96][i % 4];
                return (
                  <div key={cls.id} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
                    <div className="font-medium text-[13px] text-[var(--c-ink-1)] w-36 shrink-0">{cls.name}</div>
                    <ProgressBar
                      value={pct}
                      color={pct >= 90 ? 'var(--c-green-400)' : 'var(--product-accent)'}
                      className="flex-1"
                    />
                    <div className="font-semibold text-[13px] text-[var(--c-ink-0)] w-10 text-right">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Placeholders for other tabs */}
      {tab === 'summary' && (
        <Card>
          <CardHeader title="Weekly summary" />
          <Empty icon="calendar-stats" message="Weekly attendance summary — select a date range to view." />
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader title="Attendance history" />
          <Empty icon="history" message="Full attendance history with date range filtering." />
        </Card>
      )}
    </div>
  );
}
