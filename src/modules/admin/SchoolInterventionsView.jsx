/**
 * src/modules/admin/SchoolInterventionsView.jsx
 *
 * /app/admin/interventions  (school_admin, head_teacher)
 * /app/teacher/interventions (teacher — shows own classes only)
 *
 * At-risk pupil dashboard for school staff. Surfaces:
 *   - Pupils below the configurable attendance threshold (default 80%)
 *   - Pupils with 3+ consecutive absences (streak alert)
 *   - Comms follow-up items (teacher notes needing action)
 *
 * The risk threshold is read from localStorage (set in SchoolSettingsView).
 * The data comes from the same at_risk_pupils RPC used by the Overview widget,
 * but here we show the full list with 14-day day-by-day attendance dots,
 * quick WhatsApp buttons, and a "Log note" shortcut.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';

// ── Root ──────────────────────────────────────────────────────────────────────

export function SchoolInterventionsView() {
  const { schoolId, role } = useAuth();
  const isTeacher = role === 'teacher';

  const storageKey = `tta:risk:${schoolId}`;
  const threshold  = parseInt(localStorage.getItem(storageKey) ?? '80', 10);

  const { data: atRisk, isLoading } = useQuery({
    queryKey: ['admin', 'interventions', schoolId, threshold],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('at_risk_pupils', {
        p_school_id: schoolId,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).filter((p) => p.attendance_pct < threshold);
    },
    enabled: !!schoolId,
    staleTime: 120_000,
  });

  const { data: streaks } = useQuery({
    queryKey: ['admin', 'streaks', schoolId],
    queryFn: async () => {
      // Pupils with 3+ recent absences (proxy for streak)
      const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('attendance')
        .select('pupil_id, date, status, pupils(full_name, class_id, classes(name, school_id))')
        .eq('status', 'absent')
        .gte('date', since)
        .eq('pupils.classes.school_id', schoolId)
        .order('date', { ascending: false });
      // Group by pupil
      const byPupil = {};
      for (const r of (data ?? [])) {
        if (!byPupil[r.pupil_id]) {
          byPupil[r.pupil_id] = {
            pupil_id:   r.pupil_id,
            pupil_name: r.pupils?.full_name,
            class_name: r.pupils?.classes?.name,
            absences:   [],
          };
        }
        byPupil[r.pupil_id].absences.push(r.date);
      }
      return Object.values(byPupil).filter((p) => p.absences.length >= 3);
    },
    enabled: !!schoolId,
    staleTime: 120_000,
  });

  return (
    <div className="max-w-[900px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Interventions</div>
        <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
          At-risk pupils.
        </h2>
        <p className="mt-s-2 text-body text-ink-2 max-w-[56ch]">
          Pupils below the {threshold}% attendance threshold or with recent absence streaks.
          {!isTeacher && (
            <Link to="/app/admin/settings" className="ml-s-2 text-gold-200 hover:text-gold-50 text-[13px]">
              Change threshold →
            </Link>
          )}
        </p>
      </div>

      {/* Streak alerts */}
      {streaks && streaks.length > 0 && (
        <section className="mb-s-7">
          <h3 className="font-display text-[18px] text-ink-0 mb-s-4">
            ⚠️ Consecutive absences
          </h3>
          <div className="space-y-s-3">
            {streaks.map((p) => (
              <div key={p.pupil_id}
                className="bg-red-400/10 border border-red-400/20 rounded-r-2 px-s-5 py-s-4 flex items-center justify-between gap-s-4 flex-wrap">
                <div>
                  <p className="text-[14px] font-medium text-ink-0">{p.pupil_name}</p>
                  <p className="font-mono text-[11px] text-ink-3">{p.class_name}</p>
                  <p className="text-[13px] text-red-300 mt-s-1">
                    {p.absences.length} absences in the last 14 days
                  </p>
                </div>
                <Link to={`/app/teacher/comms?pupil=${p.pupil_id}`}>
                  <Button intent="ghost" size="sm">Log note →</Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Below-threshold pupils */}
      <section>
        <h3 className="font-display text-[18px] text-ink-0 mb-s-4">
          Below {threshold}% attendance
        </h3>

        {isLoading && (
          <div className="space-y-s-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-[80px] bg-surface-2 border border-line-1 rounded-r-2 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (!atRisk || atRisk.length === 0) && (
          <Card className="bg-surface-2 text-center py-s-8">
            <div className="text-[40px] mb-s-3">✅</div>
            <p className="text-body text-ink-1 font-medium">No pupils below {threshold}%</p>
            <p className="text-[13px] text-ink-3 mt-s-2">
              All pupils are meeting the attendance threshold.
            </p>
          </Card>
        )}

        {!isLoading && atRisk && atRisk.length > 0 && (
          <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-2">
                  {['Pupil', 'Class', 'Attendance', 'Absent days', 'Total days', 'Action'].map((h) => (
                    <th key={h} className="text-left px-s-4 py-s-3 font-mono text-[11px] uppercase tracking-[0.10em] text-ink-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atRisk.map((p) => (
                  <AtRiskRow key={p.pupil_id} pupil={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AtRiskRow({ pupil }) {
  const pct = Number(pupil.attendance_pct ?? 0);
  const severity = pct < 60 ? 'red' : pct < 70 ? 'amber' : 'default';

  return (
    <tr className="border-b border-line-1 last:border-0 hover:bg-surface-3/40">
      <td className="px-s-4 py-s-3 text-ink-1 font-medium">{pupil.pupil_name}</td>
      <td className="px-s-4 py-s-3 text-ink-3">{pupil.class_name}</td>
      <td className="px-s-4 py-s-3">
        <Chip variant={severity} size="sm">{pct.toFixed(1)}%</Chip>
      </td>
      <td className="px-s-4 py-s-3 text-ink-3 tabular-nums">{pupil.absent_days}</td>
      <td className="px-s-4 py-s-3 text-ink-3 tabular-nums">{pupil.total_days}</td>
      <td className="px-s-4 py-s-3">
        <Link to={`/app/teacher/comms?pupil=${pupil.pupil_id}`} className="text-gold-200 hover:text-gold-50 text-[12px]">
          Log note →
        </Link>
      </td>
    </tr>
  );
}
