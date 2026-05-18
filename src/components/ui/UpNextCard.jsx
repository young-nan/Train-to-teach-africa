/**
 * src/components/ui/UpNextCard.jsx
 *
 * The hero "Up Next" card shown on parent and student dashboards.
 * Design system §09 · Surfaces — Parent platform mock.
 *
 * PURPOSE
 * ────────
 * A parent opens the app between cooking and bedtime. They have four minutes.
 * This card gives them ONE thing to do — the kitchen activity — and gets out
 * of the way. No charts, no admin, no overwhelm.
 *
 * WHAT IT SHOWS
 * ─────────────
 *   - "UP NEXT · 5 MIN" eyebrow (the timer chip from the design system)
 *   - Lesson title (italic gold on the key word, Crimson Text)
 *   - Subject + level meta line (JetBrains Mono, ink-3)
 *   - Context line (e.g. "While dinner cooks")
 *   - Activity body (the kitchen activity paragraph, truncated to 3 lines)
 *   - Two CTAs: primary "Start activity →" + ghost "Save for later"
 *
 * VARIANTS
 * ─────────
 *   'parent'  — rose accent border + "WHILE DINNER COOKS" framing
 *   'student' — coral accent border + "TODAY'S LESSON" framing
 *
 * LOADING STATE
 * ─────────────
 * Pass `isLoading={true}` to show the shimmer skeleton. Matches the card's
 * height so the page doesn't jump when data arrives.
 *
 * PROPS
 * ─────
 *   lesson        object    — { title, subject, level, estimatedMinutes,
 *                               kitchenActivity, topic, completionPct? }
 *   childName     string    — shown in "Adaeze is learning…" (optional)
 *   variant       'parent' | 'student'
 *   isLoading     bool
 *   onStart       function  — "Start activity" handler
 *   onSave        function  — "Save for later" handler (optional)
 *   className     string
 */

import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

export function UpNextCard({
  lesson,
  childName,
  variant = 'parent',
  isLoading = false,
  onStart,
  onSave,
  className,
}) {
  if (isLoading) return <UpNextSkeleton className={className} />;
  if (!lesson)   return null;

  const isParent   = variant === 'parent';
  const accentClass = isParent ? 'border-rose-400/30' : 'border-coral-400/30';
  const eyebrowColour = isParent ? 'text-rose-200' : 'text-coral-400';

  const contextLine = isParent
    ? (lesson.topic ? `${lesson.subject} · ${lesson.level} · While dinner cooks` : `${lesson.subject} · While dinner cooks`)
    : (lesson.topic ? `${lesson.subject} · ${lesson.topic}` : lesson.subject);

  const minutes = lesson.estimatedMinutes ?? lesson.estimated_minutes ?? 5;
  const activity = lesson.kitchenActivity ?? lesson.kitchen_activity ?? lesson.content?.layers?.parentKitchenActivity ?? '';

  // Build the headline. For parent: "Adaeze is learning fractions tonight."
  // For student: the lesson title.
  const headlineWords = isParent && childName
    ? buildParentHeadline(lesson.title, childName)
    : null;

  return (
    <div
      className={cn(
        'rounded-r-4 border p-s-6 lg:p-s-7',
        accentClass,
        className,
      )}
      style={{
        background: isParent
          ? 'linear-gradient(135deg, rgba(251,113,133,.08), rgba(229,166,42,.03))'
          : 'linear-gradient(135deg, rgba(249,112,102,.08), rgba(229,166,42,.03))',
      }}
    >
      {/* Eyebrow + timer chip */}
      <div className="flex items-center gap-s-3 mb-s-4">
        <div className={cn('font-mono text-[10px] uppercase tracking-[0.18em]', eyebrowColour)}>
          Up next
        </div>
        <TimerChip minutes={minutes} />
      </div>

      <div className="grid lg:grid-cols-[1fr_auto] gap-s-5 lg:gap-s-7 items-start">
        <div className="min-w-0">
          {/* Headline */}
          {headlineWords
            ? (
              <h3 className="font-display text-[26px] lg:text-[28px] leading-tight text-ink-0">
                {headlineWords.before}
                {headlineWords.keyword && (
                  <span className="ital-gold"> {headlineWords.keyword}</span>
                )}
                {headlineWords.after}
              </h3>
            )
            : (
              <h3 className="font-display text-[26px] lg:text-[28px] leading-tight text-ink-0">
                {lesson.title}
              </h3>
            )
          }

          {/* Meta line */}
          <div className="mt-s-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
            {contextLine}
          </div>

          {/* In-progress bar (student variant only) */}
          {!isParent && lesson.completionPct > 0 && (
            <div className="mt-s-3 flex items-center gap-s-3">
              <div className="flex-1 h-[5px] bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-coral-400 rounded-full transition-all duration-300"
                  style={{ width: `${lesson.completionPct}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-coral-400">{lesson.completionPct}%</span>
            </div>
          )}

          {/* Kitchen activity snippet (parent variant only) */}
          {isParent && activity && (
            <p className="mt-s-4 text-body text-ink-1 leading-relaxed line-clamp-3">
              {activity}
            </p>
          )}

          {/* CTAs */}
          <div className="mt-s-5 flex flex-wrap gap-s-3">
            <Button
              intent="primary"
              size="md"
              onClick={onStart}
            >
              {isParent
                ? (lesson.completionPct > 0 ? 'Continue activity →' : 'Start activity →')
                : (lesson.completionPct > 0 ? 'Continue lesson →'   : 'Start lesson →')
              }
            </Button>
            {onSave && (
              <Button intent="ghost" size="md" onClick={onSave}>
                Save for later
              </Button>
            )}
          </div>
        </div>

        {/* Right panel — streak or progress arc (parent shows streak, student shows nothing) */}
        {isParent && (
          <div className="hidden lg:block shrink-0">
            {/* Decorative time bubble */}
            <div
              className="w-[80px] h-[80px] rounded-full grid place-items-center"
              style={{ background: 'rgba(251,113,133,.12)', border: '1px solid rgba(251,113,133,.2)' }}
            >
              <div className="text-center">
                <div className="font-display text-[28px] leading-none text-ink-0">{minutes}</div>
                <div className="font-mono text-[10px] text-rose-200 uppercase tracking-[0.1em]">min</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Timer chip ────────────────────────────────────────────────────────────────

function TimerChip({ minutes }) {
  return (
    <div className="flex items-center gap-s-1 px-s-3 py-[4px] rounded-full bg-gold-400/10 border border-gold-400/25">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" className="text-gold-400" />
        <path d="M5.5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-gold-400" />
      </svg>
      <span className="font-mono text-[10px] text-gold-400 tracking-[0.06em]">{minutes} min</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function UpNextSkeleton({ className }) {
  return (
    <div className={cn('rounded-r-4 border border-line-1 p-s-7 bg-surface-2', className)}>
      <div className="flex gap-s-3 mb-s-5">
        <div className="h-[20px] w-[60px] rounded-full bg-surface-3 animate-pulse" />
        <div className="h-[20px] w-[80px] rounded-full bg-surface-3 animate-pulse" />
      </div>
      <div className="h-[32px] w-[80%] rounded bg-surface-3 animate-pulse mb-s-3" />
      <div className="h-[13px] w-[50%] rounded bg-surface-3 animate-pulse mb-s-5" />
      <div className="h-[14px] w-[100%] rounded bg-surface-3 animate-pulse mb-s-2" />
      <div className="h-[14px] w-[90%] rounded bg-surface-3 animate-pulse mb-s-2" />
      <div className="h-[14px] w-[70%] rounded bg-surface-3 animate-pulse mb-s-6" />
      <div className="flex gap-s-3">
        <div className="h-[40px] w-[140px] rounded-r-2 bg-surface-3 animate-pulse" />
        <div className="h-[40px] w-[120px] rounded-r-2 bg-surface-3 animate-pulse" />
      </div>
    </div>
  );
}

// ── Headline builder ──────────────────────────────────────────────────────────
// Tries to extract the topic keyword from the lesson title to apply ital-gold.
// e.g. title="Introduction to Fractions" → keyword="Fractions"
// Falls back to treating the last word as the keyword if parsing fails.

function buildParentHeadline(title, childName) {
  if (!title) {
    return { before: `${childName} is learning`, keyword: null, after: ' tonight.' };
  }

  // Strip leading filler words to find the topic keyword
  const stopWords = /^(introduction to|intro to|understanding|learning|all about|the basics of)\s+/i;
  const clean = title.replace(stopWords, '').trim();
  const words = clean.split(/\s+/);

  // Take last 1–2 words as the italic keyword
  const keyword = words.slice(-Math.min(2, words.length)).join(' ').toLowerCase();
  const before  = `${childName} is learning`;
  const after   = ' tonight.';

  return { before, keyword, after };
}
