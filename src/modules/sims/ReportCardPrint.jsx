/**
 * src/modules/sims/ReportCardPrint.jsx
 *
 * The printable term report card.
 *
 * Architecture choice: this is a STANDALONE page, not inside AppShell.
 * Loads at /app/teacher/reports/:pupilId/:term/:year/print. The teacher
 * opens it in a new tab and uses Browser → Print → Save as PDF.
 *
 * Why not server-side PDF? Supabase Edge Functions run on Deno, which
 * doesn't have native Puppeteer. We could call out to a third-party
 * (Browserless, DocRaptor) but that's external dependency + $/page cost
 * for a v1 we're trying to ship. Browser print-to-PDF is free, works
 * offline once the page is loaded, and the resulting PDF is identical
 * to what a server would produce.
 *
 * Layout: A4 portrait. School branding at top, pupil bio strip, subject
 * grades grid, attendance + conduct sidebar, comments, signatures.
 *
 * Print stylesheet (@media print) hides the screen-only elements like
 * the "Print this report" button and the navigation breadcrumb.
 */

import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import * as reportsService from '@/services/reportsService';

const TERM_LABEL = {
  term_1: 'First Term',
  term_2: 'Second Term',
  term_3: 'Third Term',
};

const CONDUCT_LABELS = {
  punctuality: 'Punctuality',
  neatness: 'Neatness',
  effort: 'Effort',
  attentiveness: 'Attentiveness',
  cooperation: 'Cooperation',
};

export function ReportCardPrint() {
  const { pupilId, term, year } = useParams();
  const yearNum = parseInt(year, 10);

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-data', pupilId, term, yearNum],
    queryFn: () => reportsService.getReportData({ pupilId, term, year: yearNum }),
    enabled: !!(pupilId && term && yearNum),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Set document title to a meaningful name — default for "Save as PDF"
  useEffect(() => {
    if (data?.pupil) {
      const safe = data.pupil.full_name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      document.title = `${safe}_${TERM_LABEL[term]}_${yearNum}_Report`;
    }
    return () => { document.title = 'Train To Teach Africa'; };
  }, [data, term, yearNum]);

  if (isLoading) return <PrintLoading />;
  if (error) return <PrintError message={error.message} />;
  if (!data) return <PrintError message="No report data found." />;

  return (
    <div className="report-print-root bg-white text-black">
      <PrintStyles />
      <PrintControls />
      <ReportSheet data={data} term={term} year={yearNum} />
    </div>
  );
}

/**
 * Print stylesheet, scoped to this page only. Inline so the print rules
 * survive even when the rest of the app's CSS is hidden via @media print.
 *
 * TTA brand for paper:
 *   - Cream background (#fdfaf3) prints with warmth, doesn't waste toner
 *     vs pure white on coloured paper, and is close to school-stationery
 *     standard.
 *   - Deep navy (#1a2238) for primary text — readable, premium, reads
 *     dark on a colour printer or as B&W on a laser.
 *   - Restrained gold (#b8860b on paper, deeper than the screen gold) for
 *     the header rule, overall grade callout, and signature divider.
 *     Used sparingly so it stays meaningful.
 */
function PrintStyles() {
  return (
    <style>{`
      .report-print-root {
        font-family: 'Crimson Text', Georgia, 'Times New Roman', serif;
        color: #1a2238;
        background: #fdfaf3;
      }
      .report-print-root .ui-mono {
        font-family: 'Space Grotesk', 'Helvetica Neue', sans-serif;
        font-feature-settings: 'tnum';
      }
      .report-print-root .ui-display {
        font-family: 'Crimson Text', Georgia, serif;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .tta-gold { color: #b8860b; }
      .tta-gold-bg { background: #b8860b; }
      .tta-rule { border-color: #b8860b; }

      @page { size: A4; margin: 14mm 12mm; }

      @media print {
        .no-print { display: none !important; }
        .report-print-root {
          background: #fdfaf3 !important;
          color: #1a2238 !important;
          width: 210mm;
          margin: 0 auto;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body { background: #fdfaf3 !important; }
        .page-break { break-after: page; }
        .avoid-break { break-inside: avoid; }
      }

      @media screen {
        .report-print-root {
          width: 210mm;
          min-height: 297mm;
          margin: 24px auto;
          padding: 14mm 12mm;
          box-shadow: 0 0 24px rgba(0,0,0,0.12);
        }
      }
    `}</style>
  );
}

function PrintControls() {
  return (
    <div className="no-print mb-s-5 flex items-center gap-s-4 max-w-[210mm] mx-auto">
      <Link to=".." className="text-[13px] text-gray-600 hover:text-black">← Back</Link>
      <span className="ml-auto" />
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-black text-white rounded text-[13px] font-medium hover:bg-gray-800"
      >
        Print this report
      </button>
      <span className="text-[12px] text-gray-500">
        Use your browser's "Save as PDF" option in the print dialog.
      </span>
    </div>
  );
}

function ReportSheet({ data, term, year }) {
  const { pupil, school, classMeta, subjects, attendance, overall_comment, conduct } = {
    pupil: data.pupil,
    school: data.school,
    classMeta: data.class,
    subjects: data.subjects ?? [],
    attendance: data.attendance ?? { days_present: 0, days_late: 0, days_absent: 0, days_total: 0 },
    overall_comment: data.overall_comment?.comment ?? null,
    conduct: data.conduct ?? null,
  };

  // Compute overall percentage across all subjects
  const overall = computeOverall(subjects);

  return (
    <div className="text-[12pt] leading-[1.45]">
      <Header school={school} term={term} year={year} />
      <PupilStrip pupil={pupil} classMeta={classMeta} attendance={attendance} overall={overall} />
      <SubjectsTable subjects={subjects} />
      <BottomGrid conduct={conduct} attendance={attendance} />
      <Comments overall={overall_comment} />
      <Signatures school={school} />
    </div>
  );
}

// ---- Sections --------------------------------------------------------------

function Header({ school, term, year }) {
  return (
    <header className="avoid-break pb-3 mb-5">
      <div className="flex items-center gap-4">
        {school?.logo_url ? (
          <img src={school.logo_url} alt="" className="h-[64px] w-[64px] object-contain" />
        ) : (
          <CompassSunMark />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="ui-display text-[22pt] tracking-tight leading-tight" style={{ color: '#1a2238' }}>
            {school?.name ?? 'School Name'}
          </h1>
          {school?.motto && (
            <p className="text-[10pt] italic mt-0.5" style={{ color: '#5a6378' }}>
              {school.motto}
            </p>
          )}
          <p className="text-[8.5pt] ui-mono uppercase tracking-wide mt-1" style={{ color: '#5a6378' }}>
            {[school?.city, school?.state].filter(Boolean).join(' · ')}
            {school?.phone && <span> · {school.phone}</span>}
          </p>
        </div>
      </div>
      <div className="border-t-2 tta-rule mt-3 pt-2.5">
        <h2 className="ui-display text-[13pt] text-center uppercase tracking-[0.18em]" style={{ color: '#1a2238' }}>
          {TERM_LABEL[term]} Report &nbsp;·&nbsp; Academic Year {year}/{year + 1}
        </h2>
      </div>
    </header>
  );
}

/**
 * Inline Compass-Sun fallback for schools that haven't uploaded a logo.
 * Drawn in TTA gold so it's clearly a brand placeholder, not a missing asset.
 */
function CompassSunMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-[64px] w-[64px]" aria-hidden="true">
      {/* Half-circle horizon */}
      <path d="M 8 40 A 24 24 0 0 1 56 40" fill="none" stroke="#b8860b" strokeWidth="2" />
      {/* Sun rays */}
      {[0, 45, 90, 135, 180].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 32 - Math.cos(rad) * 18;
        const y1 = 40 - Math.sin(rad) * 18;
        const x2 = 32 - Math.cos(rad) * 26;
        const y2 = 40 - Math.sin(rad) * 26;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b8860b" strokeWidth="1.5" strokeLinecap="round" />;
      })}
      {/* TT monogram */}
      <text x="32" y="44" textAnchor="middle" fontSize="14" fontFamily="Crimson Text, serif" fontWeight="700" fill="#1a2238">TT</text>
    </svg>
  );
}

function PupilStrip({ pupil, classMeta, attendance, overall }) {
  const presentPct = attendance.days_total > 0
    ? Math.round((attendance.days_present / attendance.days_total) * 100)
    : 0;
  return (
    <section className="avoid-break grid grid-cols-[auto_1fr_auto] gap-5 mb-5 border border-black p-3">
      <div className="w-[80px] h-[100px] border border-gray-300 grid place-items-center text-[8pt] text-gray-400 bg-gray-50">
        {pupil.photo_url
          ? <img src={pupil.photo_url} alt="" className="w-full h-full object-cover" />
          : 'Photo'
        }
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 self-center">
        <DataRow label="Pupil Name" value={pupil.full_name} bold />
        <DataRow label="Pupil ID" value={pupil.pupil_code} />
        <DataRow label="Class" value={classMeta?.name} />
        <DataRow label="Class Size" value={classMeta?.pupil_count} />
        <DataRow label="Date of Birth" value={formatDate(pupil.date_of_birth)} />
        <DataRow label="Level" value={pupil.level?.replace('_', ' ').toUpperCase()} />
      </div>
      <div className="text-right self-center pl-4 border-l border-gray-300">
        <div className="text-[9pt] text-gray-600 uppercase tracking-wide ui-mono">Overall</div>
        <div className="text-[28pt] font-bold leading-none mt-1">{overall.percentage}%</div>
        <div className="text-[10pt] text-gray-700 mt-1">{overall.grade}</div>
        <div className="text-[8pt] text-gray-500 ui-mono mt-2">
          Attend. {presentPct}%
        </div>
      </div>
    </section>
  );
}

function SubjectsTable({ subjects }) {
  if (subjects.length === 0) {
    return (
      <section className="border border-black p-4 my-3 text-center text-gray-500 italic text-[10pt]">
        No subject scores have been entered for this term yet.
      </section>
    );
  }

  // Use the first subject's column headers for the table — assumes all
  // subjects share the same column structure in a given term, which is
  // the standard Nigerian primary configuration (CA1/CA2/Exam everywhere).
  const headers = subjects[0]?.columns?.map((c) => c.name) ?? [];

  return (
    <section className="mb-5">
      <h3 className="text-[11pt] font-semibold uppercase tracking-wide mb-2 ui-mono">
        Academic Performance
      </h3>
      <table className="w-full border-collapse text-[10pt]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-1.5 text-left font-semibold w-[40%]">Subject</th>
            {headers.map((h) => (
              <th key={h} className="border border-black p-1.5 text-center font-semibold">{h}</th>
            ))}
            <th className="border border-black p-1.5 text-center font-semibold">Total</th>
            <th className="border border-black p-1.5 text-center font-semibold">Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => {
            const total = computeSubjectTotal(s.columns);
            const grade = letterGrade(total.percentage);
            return (
              <tr key={s.subject} className="avoid-break">
                <td className="border border-black p-1.5">{s.subject}</td>
                {s.columns.map((c) => (
                  <td key={c.name} className="border border-black p-1.5 text-center ui-mono">
                    {c.score ?? '–'}
                    <span className="text-[7pt] text-gray-500"> / {c.max_score}</span>
                  </td>
                ))}
                <td className="border border-black p-1.5 text-center ui-mono font-semibold">
                  {total.weighted.toFixed(1)}%
                </td>
                <td className="border border-black p-1.5 text-center font-semibold">{grade}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function BottomGrid({ conduct, attendance }) {
  return (
    <section className="grid grid-cols-2 gap-4 mb-5 avoid-break">
      <div className="border border-black p-3">
        <h4 className="text-[10pt] font-semibold uppercase ui-mono mb-2">Attendance</h4>
        <div className="grid grid-cols-2 gap-y-1 text-[10pt]">
          <span>Days Present</span><span className="text-right ui-mono">{attendance.days_present}</span>
          <span>Days Late</span><span className="text-right ui-mono">{attendance.days_late}</span>
          <span>Days Absent</span><span className="text-right ui-mono">{attendance.days_absent}</span>
          <span className="border-t border-gray-300 pt-1 font-semibold">Total School Days</span>
          <span className="border-t border-gray-300 pt-1 text-right ui-mono font-semibold">{attendance.days_total}</span>
        </div>
      </div>
      <div className="border border-black p-3">
        <h4 className="text-[10pt] font-semibold uppercase ui-mono mb-2">Conduct (1–5 scale)</h4>
        {conduct ? (
          <div className="grid grid-cols-[1fr_auto] gap-y-1 text-[10pt]">
            {Object.entries(CONDUCT_LABELS).map(([key, label]) => (
              <FragmentLine key={key} label={label} value={conduct[key]} />
            ))}
          </div>
        ) : (
          <p className="text-[9pt] italic text-gray-500">Not yet rated.</p>
        )}
      </div>
    </section>
  );
}

function Comments({ overall }) {
  return (
    <section className="border border-black p-3 mb-5 avoid-break min-h-[100px]">
      <h4 className="text-[10pt] font-semibold uppercase ui-mono mb-2">Class Teacher's Comment</h4>
      {overall ? (
        <p className="text-[10pt] leading-relaxed">{overall}</p>
      ) : (
        <p className="text-[9pt] italic text-gray-400">No comment yet.</p>
      )}
    </section>
  );
}

function Signatures({ school }) {
  return (
    <footer className="mt-8 grid grid-cols-2 gap-8 avoid-break">
      <div>
        <div className="border-b border-black h-[40px]" />
        <div className="text-[9pt] uppercase tracking-wide ui-mono mt-1">Class Teacher</div>
      </div>
      <div>
        {school?.head_teacher_signature_url ? (
          <img src={school.head_teacher_signature_url} alt="" className="h-[40px] object-contain" />
        ) : (
          <div className="border-b border-black h-[40px]" />
        )}
        <div className="text-[9pt] uppercase tracking-wide ui-mono mt-1">
          {school?.head_teacher_name ?? 'Head Teacher'}
        </div>
      </div>
    </footer>
  );
}

// ---- Tiny components -----------------------------------------------------

function DataRow({ label, value, bold }) {
  return (
    <>
      <span className="text-[9pt] text-gray-600 uppercase ui-mono tracking-wide self-center">{label}</span>
      <span className={`text-[10pt] self-center ${bold ? 'font-semibold' : ''}`}>{value || '—'}</span>
    </>
  );
}

function FragmentLine({ label, value }) {
  return (
    <>
      <span>{label}</span>
      <span className="text-right ui-mono">{value ? '★'.repeat(value) + '☆'.repeat(5 - value) : '—'}</span>
    </>
  );
}

function PrintLoading() {
  return (
    <div className="min-h-screen grid place-items-center text-gray-500">
      Loading report…
    </div>
  );
}

function PrintError({ message }) {
  return (
    <div className="max-w-[600px] mx-auto p-8 text-red-700 bg-red-50 border border-red-300 rounded mt-12">
      <h2 className="text-[16pt] font-semibold mb-2">Could not load report</h2>
      <p className="text-[11pt]">{message}</p>
    </div>
  );
}

// ---- Pure helpers --------------------------------------------------------

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

function computeSubjectTotal(columns = []) {
  let raw = 0;
  let max = 0;
  let weighted = 0;
  for (const c of columns) {
    if (c.score !== null && c.score !== undefined) {
      raw += c.score;
      max += c.max_score;
      // Weighted: (score / max) * weight
      if (c.max_score > 0) {
        weighted += (c.score / c.max_score) * Number(c.weight ?? 0);
      }
    }
  }
  const percentage = max > 0 ? (raw / max) * 100 : 0;
  return { raw, max, percentage, weighted };
}

function computeOverall(subjects = []) {
  if (subjects.length === 0) return { percentage: 0, grade: '—' };
  let totalWeighted = 0;
  let count = 0;
  for (const s of subjects) {
    const t = computeSubjectTotal(s.columns);
    if (t.max > 0) {
      totalWeighted += t.weighted;
      count++;
    }
  }
  const avg = count > 0 ? totalWeighted / count : 0;
  return { percentage: Math.round(avg), grade: letterGrade(avg) };
}

function letterGrade(percent) {
  // Standard Nigerian primary grading; tunable per school later.
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 40) return 'E';
  return 'F';
}
