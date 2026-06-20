/**
 * TeacherAttendance.jsx — Teacher's class register
 * Mark present/absent/late/excused per pupil, export CSV, view history.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Select, LoadingScreen, Empty, ProgressBar, Tabs,
} from '@/components/ui';

const STATUS_META = {
  present: { label: 'P', chipVariant: 'green',   bg: 'rgba(63,185,80,0.15)',   text: 'var(--c-green-400)'   },
  absent:  { label: 'A', chipVariant: 'red',     bg: 'rgba(239,83,80,0.15)',   text: 'var(--c-red-400)'     },
  late:    { label: 'L', chipVariant: 'amber',   bg: 'rgba(245,165,36,0.15)', text: 'var(--c-amber-400)'  },
  excused: { label: 'E', chipVariant: 'default', bg: 'var(--c-surface-5)',     text: 'var(--c-ink-3)'       },
};

const TABS = [
  { key: 'register', label: "Today's register" },
  { key: 'history',  label: 'History'          },
  { key: 'summary',  label: 'Summary'          },
];

function usePupils(classId) {
  return useQuery({
    queryKey: ['teacher-pupils', classId],
    queryFn: async () => {
      if (!classId) return [];
      const today = new Date().toISOString().slice(0, 10);

      const { data: pupils } = await supabase
        .from('pupils')
        .select('id, first_name, last_name, gender')
        .eq('class_id', classId)
        .order('first_name');

      const { data: att } = await supabase
        .from('attendance_records')
        .select('pupil_id, status')
        .eq('class_id', classId)
        .eq('date', today);

      const attMap = Object.fromEntries((att ?? []).map(r => [r.pupil_id, r.status]));
      return (pupils ?? []).map(p => ({ ...p, todayStatus: attMap[p.id] ?? null }));
    },
    enabled: !!classId,
  });
}

function useTeacherClasses(teacherId) {
  return useQuery({
    queryKey: ['teacher-classes', teacherId],
    queryFn: async () => {
      if (!teacherId) return [];
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('teacher_id', teacherId)
        .order('name');
      return data ?? [];
    },
    enabled: !!teacherId,
  });
}

export default function TeacherAttendance() {
  const { profile, schoolId } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab]             = useState('register');
  const [localStatus, setLocal]   = useState({});
  const [saved, setSaved]         = useState({});

  const { data: classes = [] }              = useTeacherClasses(profile?.id);
  const [classId, setClassId]               = useState('');
  const { data: pupils = [], isLoading }    = usePupils(classId);

  const upsertAtt = useMutation({
    mutationFn: async ({ pupilId, status }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          pupil_id:  pupilId,
          class_id:  classId,
          school_id: schoolId,
          date:      today,
          status,
        }, { onConflict: 'pupil_id,date' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      setSaved(prev => ({ ...prev, [vars.pupilId]: true }));
      setTimeout(() => setSaved(prev => { const n = {...prev}; delete n[vars.pupilId]; return n; }), 1500);
      qc.invalidateQueries(['teacher-pupils', classId]);
    },
  });

  const setStatus = (pupilId, status) => {
    setLocal(prev => ({ ...prev, [pupilId]: status }));
    upsertAtt.mutate({ pupilId, status });
  };

  const markAll = (status) => {
    pupils.forEach(p => setStatus(p.id, status));
  };

  const effectiveStatus = (pupil) => localStatus[pupil.id] ?? pupil.todayStatus;

  // Computed totals
  const totals = pupils.reduce((acc, p) => {
    const s = effectiveStatus(p);
    if (s) acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const attRate = pupils.length
    ? Math.round(((totals.present || 0) / pupils.length) * 100)
    : 0;

  const todayStr = new Date().toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  return (
    <div>
      <PageHeader
        eyebrow="Teacher"
        title="Class register"
        subtitle={todayStr}
      >
        <Button variant="primary" icon="check" onClick={() => markAll('present')}>Mark all present</Button>
        <Button variant="ghost"   icon="download">Export CSV</Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Present"  value={totals.present  ?? 0} deltaDir="up"   delta={`${attRate}%`}  icon="user-check" />
        <KpiCard label="Absent"   value={totals.absent   ?? 0} deltaDir="down" delta="Today"          icon="user-x"     />
        <KpiCard label="Late"     value={totals.late     ?? 0} deltaDir="flat" delta="Today"          icon="clock"      />
        <KpiCard label="Excused"  value={totals.excused  ?? 0} deltaDir="flat" delta="Today"          icon="notes"      />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'register' && (
        <Card>
          <CardHeader title="Register">
            <div className="flex items-center gap-3">
              <Select
                className="max-w-[200px]"
                value={classId}
                onChange={e => { setClassId(e.target.value); setLocal({}); }}
              >
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </CardHeader>

          {!classId ? (
            <div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">
              Select a class above to begin taking register.
            </div>
          ) : isLoading ? (
            <LoadingScreen />
          ) : pupils.length === 0 ? (
            <Empty icon="users" message="No pupils found in this class." />
          ) : (
            <>
              {/* Attendance rate bar */}
              <div className="mb-5 p-4 bg-[var(--c-surface-3)] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-[var(--c-ink-3)]">Attendance rate today</span>
                  <span className="text-[14px] font-bold text-[var(--c-ink-0)]">{attRate}%</span>
                </div>
                <ProgressBar
                  value={attRate}
                  color={attRate >= 90 ? 'var(--c-green-400)' : attRate >= 70 ? 'var(--product-accent)' : 'var(--c-red-400)'}
                />
              </div>

              {/* Pupil rows */}
              <div className="space-y-1">
                {pupils.map((pupil, idx) => {
                  const current = effectiveStatus(pupil);
                  const isSaved = saved[pupil.id];
                  return (
                    <div
                      key={pupil.id}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[var(--c-surface-3)] transition-colors"
                    >
                      {/* Index */}
                      <div className="w-5 text-[11px] text-[var(--c-ink-4)] text-center shrink-0">{idx + 1}</div>

                      <Avatar name={`${pupil.first_name} ${pupil.last_name}`} size="sm" />

                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[var(--c-ink-1)] truncate">
                          {pupil.first_name} {pupil.last_name}
                        </div>
                        {current && (
                          <div className="text-[10px] mt-0.5" style={{ color: STATUS_META[current]?.text }}>
                            {isSaved ? 'Saved ✓' : STATUS_META[current]?.label === 'P' ? 'Present' :
                             STATUS_META[current]?.label === 'A' ? 'Absent' :
                             STATUS_META[current]?.label === 'L' ? 'Late' : 'Excused'}
                          </div>
                        )}
                      </div>

                      {/* Toggle buttons */}
                      <div className="flex gap-1 shrink-0">
                        {Object.entries(STATUS_META).map(([key, meta]) => (
                          <button
                            key={key}
                            onClick={() => setStatus(pupil.id, key)}
                            className="w-8 h-8 rounded-lg text-[11px] font-bold transition-all"
                            style={{
                              background: current === key ? meta.bg : 'var(--c-surface-4)',
                              color:      current === key ? meta.text : 'var(--c-ink-4)',
                              border:     `1px solid ${current === key ? meta.text + '40' : 'transparent'}`,
                            }}
                            title={key}
                          >
                            {meta.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader title="Attendance history" />
          <Empty icon="history" message="Select a date range to view historical attendance." />
        </Card>
      )}

      {tab === 'summary' && (
        <Card>
          <CardHeader title="Attendance summary" />
          <Empty icon="chart-bar" message="Weekly and monthly attendance summary for your class." />
        </Card>
      )}
    </div>
  );
}
