/**
 * src/modules/sims/components/PupilRow.jsx
 *
 * One row in the attendance register.
 *
 * Layout:
 *   [Avatar]  [Name + code]                    [P] [L] [A]   [+ note]
 *
 * Touch targets are 44px tall minimum (Apple guideline; works on every
 * Android tested). The whole row is 56px to give the avatar+name room
 * to breathe without the buttons feeling cramped.
 *
 * The active state is colour-coded:
 *   present → green
 *   late    → amber
 *   absent  → red
 *
 * That mapping is intentional. Schools have a lifetime of muscle memory
 * around this colour scheme from paper registers; we don't override it
 * with a more "designy" choice.
 */

import { useState } from 'react';
import { ATTENDANCE_STATUS } from '@/hooks/useAttendance';
import { cn } from '@/utils/cn';

const STATUS_LABEL = {
  [ATTENDANCE_STATUS.PRESENT]: 'P',
  [ATTENDANCE_STATUS.LATE]: 'L',
  [ATTENDANCE_STATUS.ABSENT]: 'A',
};

const STATUS_FULL = {
  [ATTENDANCE_STATUS.PRESENT]: 'Present',
  [ATTENDANCE_STATUS.LATE]: 'Late',
  [ATTENDANCE_STATUS.ABSENT]: 'Absent',
};

export function PupilRow({ pupil, entry, onStatus, onNote }) {
  const [noteOpen, setNoteOpen] = useState(Boolean(entry.note));
  const status = entry.status;

  return (
    <div
      className={cn(
        'border-b border-line-1 last:border-0 transition-colors duration-150',
        // Subtle row-level tint that mirrors the active status. Helps
        // teachers scan a long register and spot exceptions visually.
        status === ATTENDANCE_STATUS.LATE && 'bg-amber-400/[0.04]',
        status === ATTENDANCE_STATUS.ABSENT && 'bg-red-400/[0.04]',
      )}
    >
      <div className="flex items-center gap-s-4 px-s-4 py-s-3 min-h-[56px]">
        <Avatar pupil={pupil} />

        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] text-ink-1 truncate">{pupil.full_name}</div>
          {pupil.pupil_code && (
            <div className="font-mono text-[10px] text-ink-3 tracking-[0.06em] truncate">
              {pupil.pupil_code}
            </div>
          )}
        </div>

        <StatusSelector status={status} onChange={(s) => onStatus(pupil.id, s)} />

        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className={cn(
            'w-[40px] h-[40px] grid place-items-center rounded-r-2 border transition-colors duration-150 shrink-0',
            entry.note
              ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
              : 'bg-transparent border-line-2 text-ink-3 hover:text-ink-1 hover:border-line-3',
          )}
          aria-label={entry.note ? 'Edit note' : 'Add note'}
          aria-expanded={noteOpen}
        >
          <NoteIcon />
        </button>
      </div>

      {noteOpen && (
        <div className="px-s-4 pb-s-4 -mt-s-1">
          <input
            type="text"
            value={entry.note ?? ''}
            onChange={(e) => onNote(pupil.id, e.target.value)}
            placeholder={`Note about ${pupil.full_name.split(' ')[0]} (optional)`}
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[13.5px] text-ink-1 outline-none focus:border-gold-400 transition-colors duration-150"
            maxLength={200}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Three-button segmented control. Each button is 44px square — works for
 * thumbs on phones and styluses on tablets equally well.
 */
function StatusSelector({ status, onChange }) {
  return (
    <div className="flex items-center gap-[2px] bg-surface-3 border border-line-2 rounded-r-2 p-[2px] shrink-0">
      <StatusButton
        intent="present"
        active={status === ATTENDANCE_STATUS.PRESENT}
        onClick={() => onChange(ATTENDANCE_STATUS.PRESENT)}
        label={STATUS_LABEL[ATTENDANCE_STATUS.PRESENT]}
        srLabel={STATUS_FULL[ATTENDANCE_STATUS.PRESENT]}
      />
      <StatusButton
        intent="late"
        active={status === ATTENDANCE_STATUS.LATE}
        onClick={() => onChange(ATTENDANCE_STATUS.LATE)}
        label={STATUS_LABEL[ATTENDANCE_STATUS.LATE]}
        srLabel={STATUS_FULL[ATTENDANCE_STATUS.LATE]}
      />
      <StatusButton
        intent="absent"
        active={status === ATTENDANCE_STATUS.ABSENT}
        onClick={() => onChange(ATTENDANCE_STATUS.ABSENT)}
        label={STATUS_LABEL[ATTENDANCE_STATUS.ABSENT]}
        srLabel={STATUS_FULL[ATTENDANCE_STATUS.ABSENT]}
      />
    </div>
  );
}

const INTENT_ACTIVE = {
  present: 'bg-green-400/20 text-green-400 border border-green-400/40',
  late: 'bg-amber-400/20 text-amber-400 border border-amber-400/40',
  absent: 'bg-red-400/20 text-red-400 border border-red-400/40',
};

function StatusButton({ intent, active, onClick, label, srLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={srLabel}
      className={cn(
        'w-[40px] h-[40px] rounded-[6px] font-mono text-[15px] font-medium tracking-wide transition-all duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-400',
        active ? INTENT_ACTIVE[intent] : 'text-ink-3 hover:text-ink-1 border border-transparent',
      )}
    >
      {label}
    </button>
  );
}

function Avatar({ pupil }) {
  if (pupil.photo_url) {
    return (
      <img
        src={pupil.photo_url}
        alt=""
        className="w-[36px] h-[36px] rounded-full object-cover bg-surface-3 shrink-0"
        loading="lazy"
      />
    );
  }
  const initials = pupil.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className="w-[36px] h-[36px] rounded-full bg-gold-400/10 border border-gold-400/25 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0"
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  );
}

function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
