/**
 * src/modules/sims/AttendanceClassPicker.jsx
 *
 * Lands on /app/teacher/attendance. Shows the teacher's classes with the
 * pupil count and an entry button. Tapping a class navigates to the
 * register screen for the selected date.
 *
 * Date selection sits HERE, not on the register itself. Reasoning: the
 * date is part of "which register am I opening" — making it part of the
 * picker means the teacher commits to a date before tapping in any data.
 * If we let them change date mid-register, an accidental tap on the date
 * widget could orphan their unsaved edits.
 *
 * Backdating is allowed up to 14 days. Future dates are NOT allowed —
 * there is no real workflow for marking attendance ahead of time, and
 * forward-dated rows look like data-quality bugs in the audit log.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import { cn } from '@/utils/cn';

const MAX_BACKDATE_DAYS = 14;

export function AttendanceClassPicker() {
  const { user } = useAuth();
  const todayIso = todayIsoString();
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const { data: classes, isLoading, error } = useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => simsService.getMyClasses(),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const isToday = selectedDate === todayIso;
  const isBackdated = selectedDate < todayIso;

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">
          {formatLong(selectedDate)}
          {isBackdated && <span className="ml-s-3 text-amber-400">· Backdated</span>}
        </div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Take attendance.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          {isToday
            ? "Pick a class to open today's register."
            : `Picking a class will open the register for ${formatLong(selectedDate)}. Existing entries for that date can be edited.`}
        </p>
      </div>

      <DatePicker
        value={selectedDate}
        onChange={setSelectedDate}
        maxDate={todayIso}
        minDate={isoDaysAgo(MAX_BACKDATE_DAYS)}
      />

      {isLoading && <SkeletonList />}

      {error && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="font-display text-display-3 text-red-400">Could not load classes</div>
          <p className="mt-s-3 text-body text-ink-2">{error.message}</p>
        </Card>
      )}

      {classes?.length === 0 && (
        <Card>
          <div className="font-display text-display-3 text-ink-0">No classes yet.</div>
          <p className="mt-s-3 text-body text-ink-2">
            Your school administrator hasn't assigned you to any classes.
            Once they do, your classes will appear here.
          </p>
        </Card>
      )}

      {classes?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4 mt-s-5">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} date={selectedDate} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Date picker: a row of last-N-days buttons (most recent first), plus a
 * native <input type="date"> for picking anything older within the cap.
 *
 * The button row covers ~95% of cases (the immediate "yesterday/today"
 * picks). The native picker is the escape hatch for older dates and gets
 * the device's accessibility / locale support for free.
 */
function DatePicker({ value, onChange, maxDate, minDate }) {
  // Build the most-recent 5 days (today, -1, -2, -3, -4) for quick taps.
  const quickDates = useMemo(() => {
    const out = [];
    for (let i = 0; i < 5; i++) out.push(isoDaysAgo(i));
    return out;
  }, []);

  return (
    <div className="mb-s-7">
      <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-3">Date</div>
      <div className="flex flex-wrap items-center gap-s-2">
        {quickDates.map((d) => (
          <DateButton
            key={d}
            iso={d}
            label={shortLabel(d)}
            active={value === d}
            onClick={() => onChange(d)}
          />
        ))}

        <label className="ml-s-2 inline-flex items-center gap-s-2 px-s-3 py-[7px] bg-surface-2 border border-line-2 rounded-full cursor-pointer hover:border-line-3 transition-colors">
          <CalendarIcon />
          <input
            type="date"
            value={value}
            min={minDate}
            max={maxDate}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              // Defensive: if the user types a future date by hand, snap back.
              if (v > maxDate) return onChange(maxDate);
              if (v < minDate) return onChange(minDate);
              onChange(v);
            }}
            className="bg-transparent text-[12.5px] font-mono text-ink-1 outline-none [color-scheme:dark]"
            aria-label="Pick another date"
          />
        </label>
      </div>
    </div>
  );
}

function DateButton({ iso, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-s-4 py-[7px] rounded-full text-[12.5px] font-medium transition-all duration-150',
        active
          ? 'bg-gold-400 text-[#1a1305] border border-gold-400'
          : 'bg-surface-2 text-ink-2 border border-line-2 hover:border-line-3 hover:text-ink-1',
      )}
    >
      {label}
    </button>
  );
}

function ClassCard({ cls, date }) {
  return (
    <Link
      to={`/app/teacher/attendance/${cls.id}?date=${date}`}
      className="group bg-surface-2 border border-line-1 rounded-r-3 p-s-6 hover:border-gold-400/40 hover:bg-surface-3 transition-all duration-150 flex flex-col gap-s-4"
    >
      <div className="flex items-start justify-between gap-s-4">
        <div className="min-w-0">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{cls.level}</div>
          <h3 className="mt-s-2 font-display text-display-3 text-ink-0 truncate">{cls.name}</h3>
        </div>
        <Chip variant="default">{cls.pupil_count} pupils</Chip>
      </div>
      <div className="mt-auto pt-s-3 border-t border-line-1 flex items-center justify-between">
        <span className="font-mono text-meta text-ink-3">Tap to open register</span>
        <span className="text-gold-200 group-hover:text-gold-50 transition-colors">→</span>
      </div>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4 mt-s-5">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 h-[140px] animate-pulse">
          <div className="h-[10px] w-[80px] bg-surface-3 rounded" />
          <div className="mt-s-4 h-[20px] w-[180px] bg-surface-3 rounded" />
          <div className="mt-s-7 h-[14px] w-[120px] bg-surface-3 rounded" />
        </div>
      ))}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10h16M9 4v4M15 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ---- Date helpers ----------------------------------------------------------

function todayIsoString() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatLong(iso) {
  return new Date(iso).toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function shortLabel(iso) {
  if (iso === todayIsoString()) return 'Today';
  if (iso === isoDaysAgo(1)) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' });
}
