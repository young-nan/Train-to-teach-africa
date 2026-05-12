/**
 * src/modules/parent/LessonPrintView.jsx
 *
 * /app/parent/lessons/:lessonId/print
 *
 * Browser print-to-PDF version of a lesson, watermarked and personalised.
 * User flow: parent clicks "Print as PDF" → this opens in a new tab → they
 * hit Cmd/Ctrl+P → "Save as PDF" → done.
 *
 * Watermark: diagonal repeating text, low opacity, behind all content.
 *   Format: "PARENT NAME · NOT FOR REDISTRIBUTION"
 *   Purpose: deter casual photocopying / WhatsApp resharing of paid content.
 *
 * Personalisation: child name, parent name, valid-until date in the header.
 *   This makes it obvious that this PDF was issued to *this* parent, and
 *   strengthens the social pressure not to share it.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';
import * as lessonService from '@/services/lessonService';

export function LessonPrintView() {
  const { lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('child');
  const { profile } = useAuth();

  const { data: entitlement } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn: () => parentSubscriptionService.getEntitlement(),
    staleTime: 30_000,
  });

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => lessonService.getLesson(lessonId),
    enabled: !!lessonId && !!entitlement,
  });

  const { data: child } = useQuery({
    queryKey: ['parent', 'child', childId],
    queryFn: () => lessonService.getChildSummary(childId),
    enabled: !!childId && !!entitlement,
  });

  // Auto-trigger print dialog once content loaded.
  // Small delay so React commits before the dialog opens.
  useEffect(() => {
    if (lesson && entitlement) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [lesson, entitlement]);

  if (!entitlement) {
    return (
      <div style={{ padding: 40, fontFamily: 'serif' }}>
        <h1>Subscription needed to access this lesson.</h1>
        <p>Please return to your dashboard and subscribe.</p>
      </div>
    );
  }
  if (!lesson) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  const parentName = profile?.full_name ?? 'Parent';
  const childName = child?.full_name ?? 'Your child';
  const validUntilFormatted = formatDate(entitlement.valid_until);
  // Watermark text: parent name + a fixed warning, repeated diagonally
  const watermarkText = `${parentName.toUpperCase()} · NOT FOR REDISTRIBUTION`;

  return (
    <div className="lesson-print">
      <style>{`
        @page {
          size: A4;
          margin: 18mm 14mm 22mm;
        }
        html, body {
          background: white !important;
          color: #1a1a1a;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 11pt;
          line-height: 1.55;
        }
        .lesson-print {
          max-width: 180mm;
          margin: 0 auto;
          position: relative;
          color: #1a1a1a;
        }
        /* Watermark — diagonal, repeating, behind content */
        .watermark-layer {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .watermark-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-family: monospace;
          font-size: 14pt;
          color: rgba(170, 130, 30, 0.08);
          white-space: nowrap;
          letter-spacing: 4px;
        }
        /* Stack 5 lines of watermark for full-page coverage */
        .watermark-row {
          display: block;
          line-height: 60mm;
        }
        .print-content { position: relative; z-index: 1; }
        /* Header */
        .pdf-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 8mm;
          border-bottom: 1pt solid #999;
          margin-bottom: 10mm;
        }
        .brand {
          font-family: Georgia, serif;
          font-size: 11pt;
          font-style: italic;
          color: #555;
        }
        .brand strong {
          display: block;
          font-style: normal;
          font-size: 13pt;
          font-weight: 600;
          color: #1a1a1a;
        }
        .meta {
          text-align: right;
          font-size: 9pt;
          color: #555;
          line-height: 1.5;
        }
        .meta .meta-label {
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 8pt;
          color: #888;
        }
        /* Title block */
        .lesson-title {
          font-family: Georgia, serif;
          font-size: 24pt;
          font-weight: 600;
          line-height: 1.15;
          color: #1a1a1a;
          margin: 0 0 4mm;
        }
        .lesson-eyebrow {
          font-family: monospace;
          font-size: 9pt;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #aa821e;
          margin-bottom: 4mm;
        }
        .lesson-summary {
          font-size: 11.5pt;
          color: #444;
          margin-bottom: 10mm;
          font-style: italic;
        }
        /* Section headings */
        h2.print-section {
          font-family: Georgia, serif;
          font-size: 14pt;
          font-weight: 600;
          color: #1a1a1a;
          margin: 10mm 0 4mm;
          page-break-after: avoid;
        }
        .print-content p {
          margin: 0 0 4mm;
          orphans: 3;
          widows: 3;
        }
        ol.print-list {
          padding-left: 6mm;
          margin: 0 0 6mm;
        }
        ol.print-list li {
          margin-bottom: 3mm;
          padding-left: 2mm;
        }
        .hint {
          margin-top: 1.5mm;
          font-size: 10pt;
          color: #666;
          font-style: italic;
        }
        /* Footer that prints on every page (using running header technique).
           Browsers vary in support; the in-flow footer below is the
           reliable fallback. */
        .pdf-footer {
          margin-top: 15mm;
          padding-top: 5mm;
          border-top: 1pt solid #ccc;
          font-size: 8.5pt;
          color: #777;
          display: flex;
          justify-content: space-between;
        }
        /* Hide everything not in the print layout when actually printing */
        @media screen {
          html, body { background: #f5f3ed; padding: 20px 0; }
        }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Watermark — repeated lines for full coverage */}
      <div className="watermark-layer" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="watermark-text" style={{ top: `${15 + i * 20}%` }}>
            <span className="watermark-row">
              {watermarkText} · {watermarkText} · {watermarkText}
            </span>
          </span>
        ))}
      </div>

      <div className="print-content">
        {/* Personalised header */}
        <header className="pdf-header">
          <div className="brand">
            <strong>Train To Teach Africa</strong>
            Parent Learning · Home Edition
          </div>
          <div className="meta">
            <div className="meta-label">For</div>
            <div>{childName}</div>
            <div style={{ marginTop: '2mm' }} className="meta-label">Issued to</div>
            <div>{parentName}</div>
            <div style={{ marginTop: '2mm' }} className="meta-label">Valid until</div>
            <div>{validUntilFormatted}</div>
          </div>
        </header>

        {/* Lesson title */}
        <div className="lesson-eyebrow">
          {lesson.subject} · {formatLevel(lesson.level)}
        </div>
        <h1 className="lesson-title">{lesson.title}</h1>
        {lesson.topic && <p className="lesson-summary">{lesson.topic}</p>}

        {/* Parent-framed sections — pulled from lesson.layers */}
        {lesson.layers?.parentSummary && (
          <>
            <h2 className="print-section">What your child is learning</h2>
            <ProseBlock text={lesson.layers.parentSummary} />
          </>
        )}

        {lesson.layers?.parentKitchenActivity && (
          <>
            <h2 className="print-section">Tonight's activity</h2>
            <ProseBlock text={lesson.layers.parentKitchenActivity} />
          </>
        )}

        {lesson.layers?.parentDinnerQuestions?.length > 0 && (
          <>
            <h2 className="print-section">Questions to ask over dinner</h2>
            <ol className="print-list">
              {lesson.layers.parentDinnerQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </>
        )}

        {/* In-flow footer */}
        <footer className="pdf-footer">
          <span>Train To Teach Africa · traintoteachafrica.org</span>
          <span>Issued to {parentName} · Valid until {validUntilFormatted}</span>
        </footer>
      </div>

      <div className="no-print" style={{
        position: 'fixed', top: 12, right: 12, background: '#1a1305',
        color: '#fff', padding: '8px 14px', borderRadius: 6, fontSize: 13,
        fontFamily: 'system-ui', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        Print dialog should open automatically. If not, press Ctrl/Cmd + P.
      </div>
    </div>
  );
}

function ProseBlock({ text }) {
  return (text ?? '').split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>);
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
