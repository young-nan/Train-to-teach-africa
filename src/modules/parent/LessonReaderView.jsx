/**
 * src/modules/parent/LessonReaderView.jsx
 *
 * /app/parent/lessons/:lessonId
 *
 * Where parents actually consume lesson content. Three layers of gating:
 *   1. Auth — must be a parent (handled by AppShell)
 *   2. Entitlement — must have an active subscription (RPC check)
 *   3. Content filtering — parents see practical_guidance and home_activity
 *      sections, NOT teacher_notes or assessment_rubric
 *
 * Layout:
 *   Top: child name + parent name + validity badge (personalised)
 *   Middle: lesson content, parent-framed
 *   Bottom: "Print as PDF" button → opens /print variant with watermark
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';
import * as lessonService from '@/services/lessonService';
import { friendlyError } from '@/utils/friendlyError';

export function LessonReaderView() {
  const { lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('child');
  const navigate = useNavigate();
  const { profile } = useAuth();

  // ---- Entitlement gate ---------------------------------------------------
  const { data: entitlement, isLoading: entLoading } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn: () => parentSubscriptionService.getEntitlement(),
    staleTime: 30_000,
  });

  // ---- Lesson content ----------------------------------------------------
  const { data: lesson, isLoading: lessonLoading, error: lessonError } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => lessonService.getLesson(lessonId),
    enabled: !!lessonId && !!entitlement, // only fetch if entitled
    staleTime: 60_000,
  });

  // ---- Child (for personalisation) ---------------------------------------
  const { data: child } = useQuery({
    queryKey: ['parent', 'child', childId],
    queryFn: () => lessonService.getChildSummary(childId),
    enabled: !!childId && !!entitlement,
    staleTime: 60_000,
  });

  if (entLoading) return <Loading />;

  // Hard gate — no active sub, redirect to subscribe page
  if (!entitlement) {
    return (
      <div className="max-w-[680px]">
        <Card className="border-amber-400/30 bg-amber-400/[0.04]">
          <Chip variant="amber" dot>Subscription needed</Chip>
          <h2 className="mt-s-4 font-display text-display-2 text-ink-0">
            Subscribe to read this lesson.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            This lesson is part of TTA's parent learning programme.
            Subscribe to a term or annual plan to get nightly lessons,
            kitchen activities, and printable home practice for your children.
          </p>
          <Link to="/app/parent/subscribe" className="block mt-s-5">
            <Button intent="primary" size="lg">See subscription options →</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[720px]">
      <div className="mb-s-5">
        <Link to="/app/parent" className="text-[13.5px] text-ink-3 hover:text-ink-1">← Tonight</Link>
      </div>

      {/* Personalisation banner */}
      <PersonalisationBanner
        parentName={profile?.full_name}
        childName={child?.full_name}
        validUntil={entitlement.valid_until}
        daysRemaining={entitlement.days_remaining}
      />

      {lessonLoading && <Loading />}
      {lessonError && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="text-red-400">{friendlyError(lessonError)}</div>
        </Card>
      )}

      {lesson && (
        <article className="mt-s-6">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            {lesson.subject} · {formatLevel(lesson.level)}
          </div>
          <h1 className="mt-s-3 font-display text-display-1 text-ink-0">{lesson.title}</h1>
          {lesson.topic && (
            <p className="mt-s-4 text-body-lg text-ink-2 max-w-[58ch]">{lesson.topic}</p>
          )}

          {/* PARENT-FRAMED CONTENT ONLY — pulled from lesson.layers.parent*
              The teacher and student layers are deliberately not rendered;
              this is the parent's view of the lesson, not the source data. */}
          <div className="mt-s-9 space-y-s-9">
            {lesson.layers?.parentSummary && (
              <Section title="What your child is learning">
                <ProseContent text={lesson.layers.parentSummary} />
              </Section>
            )}

            {lesson.layers?.parentKitchenActivity && (
              <Section title="Tonight's activity" accent="gold">
                <ProseContent text={lesson.layers.parentKitchenActivity} />
              </Section>
            )}

            {lesson.layers?.parentDinnerQuestions?.length > 0 && (
              <Section title="Questions to ask over dinner">
                <ol className="list-decimal pl-s-5 space-y-s-3 text-body text-ink-1">
                  {lesson.layers.parentDinnerQuestions.map((q, i) => (
                    <li key={i} className="leading-relaxed">{q}</li>
                  ))}
                </ol>
              </Section>
            )}
          </div>

          {/* Print to PDF action */}
          <div className="mt-s-9 pt-s-6 border-t border-line-1 flex flex-wrap gap-s-3">
            <Button
              intent="primary"
              size="lg"
              onClick={() => {
                const url = `/app/parent/lessons/${lessonId}/print${childId ? `?child=${childId}` : ''}`;
                window.open(url, '_blank');
              }}
            >
              Print as PDF
            </Button>
            <Link to="/app/parent">
              <Button intent="ghost" size="lg">Back to Tonight</Button>
            </Link>
          </div>
        </article>
      )}
    </div>
  );
}

/* --------------------------- subcomponents ----------------------------- */

function PersonalisationBanner({ parentName, childName, validUntil, daysRemaining }) {
  return (
    <div className="bg-surface-2 border border-line-1 rounded-r-3 p-s-5 flex flex-wrap items-center gap-s-5">
      <div className="flex-1 min-w-[200px]">
        <div className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">For</div>
        <div className="text-[15px] text-ink-0 mt-s-1">
          {childName || 'Your child'}
        </div>
        <div className="text-[12px] text-ink-3 mt-s-1">
          Read by {parentName}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">Access until</div>
        <div className="text-[14px] text-ink-0 mt-s-1 tabular-nums">
          {formatDate(validUntil)}
        </div>
        <Chip variant={daysRemaining < 14 ? 'amber' : 'green'} className="mt-s-2">
          {daysRemaining} days left
        </Chip>
      </div>
    </div>
  );
}

function Section({ title, accent = 'default', children }) {
  return (
    <section>
      <h2 className={`font-display text-display-3 mb-s-4 ${
        accent === 'gold' ? 'text-gold-200' : 'text-ink-0'
      }`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProseContent({ text }) {
  // Plain prose — split paragraphs on double newline.
  const paragraphs = (text ?? '').split(/\n\n+/);
  return (
    <div className="space-y-s-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-body text-ink-1 leading-relaxed">{p}</p>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-s-5">
      <div className="bg-surface-2 border border-line-1 rounded-r-3 h-[100px] animate-pulse" />
      <div className="bg-surface-2 border border-line-1 rounded-r-3 h-[200px] animate-pulse" />
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function formatLevel(level) {
  if (!level) return '';
  return level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
