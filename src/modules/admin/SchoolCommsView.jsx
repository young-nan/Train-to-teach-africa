/**
 * src/modules/admin/SchoolCommsView.jsx
 *
 * /app/admin/comms
 *
 * Cross-school communications hub for school_admin and head_teacher.
 *
 * Three tabs:
 *   Comms     — all parent_comms entries for the school (CC'd or all)
 *   Attendance — all pupils' attendance across all classes, filterable by date
 *   Reports    — all published term report cards for the school
 *
 * This gives admin/head teacher oversight without needing to navigate
 * class-by-class through the teacher view.
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

export function SchoolCommsView() {
  const [tab, setTab] = useState('comms');

  return (
    <div className="max-w-[940px]">
      <div className="mb-s-6">
        <div className="font-mono text-eyebrow uppercase text-gold-400">School overview</div>
        <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
          Comms, attendance &amp; reports.
        </h2>
        <p className="mt-s-2 text-body text-ink-2 max-w-[56ch]">
          Cross-school visibility for all classes. Use the teacher comms view
          to log new notes.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-s-1 bg-surface-2 border border-line-2 rounded-r-2 p-[3px] w-fit mb-s-6">
        {[
          { id: 'comms',      label: 'All comms'       },
          { id: 'cc',          label: "CC'd to me"      },
          { id: 'attendance', label: 'Attendance'       },
          { id: 'reports',    label: 'Report cards'    },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-s-5 py-[6px] rounded-[6px] text-[13px] font-medium transition-all duration-150',
              tab === t.id
                ? 'bg-surface-4 text-ink-0 shadow-sm'
                : 'text-ink-3 hover:text-ink-1',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'comms'      && <CommsTab />}
      {tab === 'cc'         && <CommsTab ccOnly />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'reports'    && <ReportsTab />}
    </div>
  );
}

// ── Comms tab ─────────────────────────────────────────────────────────────────

function CommsTab({ ccOnly = false }) {
  const { schoolId } = useAuth();
  const [filter, setFilter] = useState(ccOnly ? 'cc' : 'all'); // 'all' | 'cc' | 'follow_up'

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'all-comms', schoolId, filter],
    queryFn: async () => {
      let q = supabase
        .from('parent_comms')
        .select(`
          id, contact_type, body, shared_with_parent, cc_head_teacher,
          follow_up_needed, follow_up_date, created_at,
          pupils(full_name, pupil_code, classes(name))
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter === 'cc')         q = q.eq('cc_head_teacher', true);
      if (filter === 'follow_up')  q = q.eq('follow_up_needed', true);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-s-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-s-2 mb-s-2">
        {[
          { id: 'all',       label: 'All notes' },
          { id: 'cc',        label: "CC'd to you" },
          { id: 'follow_up', label: 'Follow-up needed' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-s-3 py-[5px] rounded-full border text-[13px] transition-all',
              filter === f.id
                ? 'bg-surface-3 border-gold-400/50 text-gold-200'
                : 'bg-surface-2 border-line-2 text-ink-3 hover:text-ink-1',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingSkeleton rows={4} />}

      {!isLoading && data?.length === 0 && (
        <Card className="bg-surface-2 text-center py-s-8">
          <p className="text-ink-3">No communication records found.</p>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden divide-y divide-line-1">
          {data.map((c) => (
            <div key={c.id} className="px-s-5 py-s-4">
              <div className="flex items-start justify-between gap-s-4 flex-wrap mb-s-2">
                <div>
                  <span className="text-[14px] font-medium text-ink-0">
                    {c.pupils?.full_name ?? '—'}
                  </span>
                  <span className="text-ink-4 mx-s-2">·</span>
                  <span className="text-[12px] text-ink-3">{c.pupils?.classes?.name}</span>
                </div>
                <div className="flex items-center gap-s-2 flex-wrap">
                  {c.cc_head_teacher    && <Chip variant="gold"  size="sm">CC'd</Chip>}
                  {c.shared_with_parent && <Chip variant="green" size="sm">Parent shared</Chip>}
                  {c.follow_up_needed   && <Chip variant="amber" size="sm">Follow-up</Chip>}
                  <span className="font-mono text-[10px] text-ink-4">
                    {new Date(c.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
              <p className="text-[13.5px] text-ink-2 leading-relaxed line-clamp-3">{c.body}</p>
              {c.follow_up_date && (
                <p className="font-mono text-[11px] text-amber-400 mt-s-1">
                  Follow-up: {new Date(c.follow_up_date + 'T00:00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attendance tab ─────────────────────────────────────────────────────────────

function AttendanceTab() {
  const { schoolId } = useAuth();
  const today     = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'all-attendance', schoolId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id, status, note,
          pupils(full_name, pupil_code, classes(name))
        `)
        .eq('school_id', schoolId)
        .eq('date', date)
        .order('pupils(full_name)');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });

  const present = data?.filter((r) => r.status === 'present').length ?? 0;
  const absent  = data?.filter((r) => r.status === 'absent').length  ?? 0;
  const late    = data?.filter((r) => r.status === 'late').length    ?? 0;
  const total   = data?.length ?? 0;

  return (
    <div className="space-y-s-5">
      {/* Date picker */}
      <div className="flex items-center gap-s-4 flex-wrap">
        <label className="flex items-center gap-s-3">
          <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-ink-3">Date</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13px] text-ink-0 outline-none focus:border-gold-400"
          />
        </label>
        {total > 0 && (
          <div className="flex gap-s-4 font-mono text-[13px]">
            <span className="text-green-400">{present} present</span>
            <span className="text-red-400">{absent} absent</span>
            {late > 0 && <span className="text-amber-400">{late} late</span>}
            <span className="text-ink-4">/ {total} total</span>
          </div>
        )}
      </div>

      {isLoading && <LoadingSkeleton rows={6} />}

      {!isLoading && total === 0 && (
        <Card className="bg-surface-2 text-center py-s-8">
          <p className="text-ink-3">No attendance records for this date.</p>
        </Card>
      )}

      {!isLoading && total > 0 && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-2">
                {['Pupil', 'Class', 'Status', 'Note'].map((h) => (
                  <th key={h} className="text-left px-s-4 py-s-3 font-mono text-[11px] uppercase tracking-[0.10em] text-ink-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-line-1 last:border-0 hover:bg-surface-3/40">
                  <td className="px-s-4 py-s-3 text-ink-1 font-medium">{r.pupils?.full_name}</td>
                  <td className="px-s-4 py-s-3 text-ink-3">{r.pupils?.classes?.name ?? '—'}</td>
                  <td className="px-s-4 py-s-3">
                    <Chip
                      variant={r.status === 'present' ? 'green' : r.status === 'absent' ? 'red' : 'amber'}
                      size="sm"
                    >
                      {r.status}
                    </Chip>
                  </td>
                  <td className="px-s-4 py-s-3 text-ink-4 text-[12px]">{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────

function ReportsTab() {
  const { schoolId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'all-reports', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_envelopes')
        .select(`
          id, term, academic_year, status, published_at,
          pupils(full_name, pupil_code, classes(name))
        `)
        .eq('school_id', schoolId)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-s-4">
      {isLoading && <LoadingSkeleton rows={5} />}

      {!isLoading && (!data || data.length === 0) && (
        <Card className="bg-surface-2 text-center py-s-8">
          <p className="text-ink-3">No published report cards yet.</p>
          <Link to="/app/admin/terms" className="mt-s-4 inline-block">
            <Button intent="ghost" size="sm">Manage term locks →</Button>
          </Link>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-2">
                {['Pupil', 'Class', 'Term', 'Year', 'Published', ''].map((h) => (
                  <th key={h} className="text-left px-s-4 py-s-3 font-mono text-[11px] uppercase tracking-[0.10em] text-ink-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-line-1 last:border-0 hover:bg-surface-3/40">
                  <td className="px-s-4 py-s-3 text-ink-1 font-medium">{r.pupils?.full_name}</td>
                  <td className="px-s-4 py-s-3 text-ink-3">{r.pupils?.classes?.name ?? '—'}</td>
                  <td className="px-s-4 py-s-3 text-ink-3 capitalize">{String(r.term ?? '').replace('_', ' ')}</td>
                  <td className="px-s-4 py-s-3 text-ink-3">{r.academic_year}</td>
                  <td className="px-s-4 py-s-3 font-mono text-[11px] text-ink-4">
                    {r.published_at
                      ? new Date(r.published_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
                      : '—'}
                  </td>
                  <td className="px-s-4 py-s-3">
                    <Link
                      to={`/app/admin/reports/${r.pupils?.id ?? ''}/${r.term}/${r.academic_year}`}
                      className="text-[12px] text-gold-200 hover:text-gold-50"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LoadingSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-s-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[60px] bg-surface-2 border border-line-1 rounded-r-2 animate-pulse" />
      ))}
    </div>
  );
}
