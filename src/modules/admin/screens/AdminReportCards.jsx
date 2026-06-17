/**
 * AdminReportCards.jsx
 * Generate · Preview · Publish · Print-to-PDF term report cards
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Select, ProgressBar, LoadingScreen, Empty, Tabs, Alert,
} from '@/components/ui';

const TABS = [
  { key:'generate', label:'Generate'  },
  { key:'preview',  label:'Preview'   },
  { key:'history',  label:'Published' },
];

function useClasses(schoolId) {
  return useQuery({
    queryKey: ['admin-classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id,name').eq('school_id', schoolId).order('name');
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

function usePupilsWithScores(classId) {
  return useQuery({
    queryKey: ['report-card-pupils', classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data: pupils } = await supabase
        .from('pupils')
        .select('id,first_name,last_name,admission_number,gender')
        .eq('class_id', classId)
        .order('first_name');

      const { data: scores } = await supabase
        .from('assessment_scores')
        .select('pupil_id,subject,assessment_type,score,max_score')
        .eq('class_id', classId);

      const { data: att } = await supabase
        .from('attendance_records')
        .select('pupil_id,status')
        .eq('class_id', classId);

      // Build per-pupil score map
      const scoresByPupil = {};
      (scores ?? []).forEach(s => {
        if (!scoresByPupil[s.pupil_id]) scoresByPupil[s.pupil_id] = [];
        scoresByPupil[s.pupil_id].push(s);
      });

      // Attendance per pupil
      const attByPupil = {};
      (att ?? []).forEach(r => {
        if (!attByPupil[r.pupil_id]) attByPupil[r.pupil_id] = { total:0, present:0 };
        attByPupil[r.pupil_id].total++;
        if (r.status === 'present') attByPupil[r.pupil_id].present++;
      });

      return (pupils ?? []).map(p => {
        const pupilScores = scoresByPupil[p.id] ?? [];
        const attData     = attByPupil[p.id];
        const attPct      = attData ? Math.round((attData.present / attData.total) * 100) : null;

        // Subject averages
        const bySubject = {};
        pupilScores.forEach(s => {
          if (!bySubject[s.subject]) bySubject[s.subject] = [];
          if (s.max_score) bySubject[s.subject].push((s.score / s.max_score) * 100);
        });

        const subjects = Object.entries(bySubject).map(([sub, pcts]) => ({
          subject: sub,
          avg: Math.round(pcts.reduce((a,b) => a+b,0) / pcts.length),
        }));

        const overall = subjects.length
          ? Math.round(subjects.reduce((a,s) => a + s.avg, 0) / subjects.length)
          : null;

        return { ...p, subjects, overall, attPct };
      });
    },
    enabled: !!classId,
    staleTime: 60_000,
  });
}

function gradeFromPct(pct) {
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

function gradeVariant(pct) {
  if (pct >= 80) return 'green';
  if (pct >= 70) return 'teal';
  if (pct >= 60) return 'amber';
  if (pct >= 50) return 'coral';
  return 'red';
}

// ── Single report card print view ─────────────────────────────────────────────
function ReportCardPreview({ pupil, className, schoolName, term }) {
  const handlePrint = () => {
    const printContent = document.getElementById(`report-${pupil.id}`);
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
      <head>
        <title>Report Card — ${pupil.first_name} ${pupil.last_name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 14px; color: #555; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
          th { background: #f5f5f5; font-weight: 600; }
          .grade-A { color: #16a34a; } .grade-B { color: #0891b2; }
          .grade-C { color: #d97706; } .grade-D { color: #ea580c; }
          .grade-F { color: #dc2626; }
          .info-row { display: flex; gap: 24px; margin-bottom: 12px; font-size: 13px; }
          .info-item { display: flex; flex-direction: column; }
          .info-label { font-size: 10px; text-transform: uppercase; color: #888; }
          .info-value { font-weight: 600; }
          .school-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="school-header">
          <h1>${schoolName ?? 'School Name'}</h1>
          <h2>TERM ${term ?? 3} REPORT CARD · 2025/2026 SESSION</h2>
        </div>
        <div class="info-row">
          <div class="info-item"><span class="info-label">Student</span><span class="info-value">${pupil.first_name} ${pupil.last_name}</span></div>
          <div class="info-item"><span class="info-label">Admission No.</span><span class="info-value">${pupil.admission_number ?? '—'}</span></div>
          <div class="info-item"><span class="info-label">Class</span><span class="info-value">${className ?? '—'}</span></div>
          <div class="info-item"><span class="info-label">Attendance</span><span class="info-value">${pupil.attPct ?? '—'}%</span></div>
        </div>
        <table>
          <thead><tr><th>Subject</th><th>Score (%)</th><th>Grade</th><th>Remark</th></tr></thead>
          <tbody>
            ${(pupil.subjects ?? []).map(s => `
              <tr>
                <td>${s.subject}</td>
                <td>${s.avg}%</td>
                <td class="grade-${gradeFromPct(s.avg)}">${gradeFromPct(s.avg)}</td>
                <td>${s.avg>=80?'Excellent':s.avg>=70?'Very Good':s.avg>=60?'Good':s.avg>=50?'Average':'Needs Improvement'}</td>
              </tr>`).join('')}
            <tr style="font-weight:600;background:#f9f9f9">
              <td>Overall Average</td>
              <td>${pupil.overall ?? '—'}%</td>
              <td class="grade-${gradeFromPct(pupil.overall)}">${gradeFromPct(pupil.overall)}</td>
              <td>${pupil.overall>=80?'Excellent':pupil.overall>=70?'Very Good':pupil.overall>=60?'Good':pupil.overall>=50?'Average':'Needs Improvement'}</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size:11px;color:#888;margin-top:24px;text-align:center">
          Generated by Train To Teach Africa (TTA) · ${new Date().toLocaleDateString()}
        </p>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Card id={`report-${pupil.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={`${pupil.first_name} ${pupil.last_name}`} size="lg" />
          <div>
            <div className="font-heading font-bold text-[16px] text-[var(--c-ink-0)]">{pupil.first_name} {pupil.last_name}</div>
            <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5 font-mono">{pupil.admission_number ?? '—'}</div>
            <div className="flex items-center gap-2 mt-1.5">
              {pupil.overall !== null && (
                <Chip variant={gradeVariant(pupil.overall)}>Overall: {pupil.overall}% · {gradeFromPct(pupil.overall)}</Chip>
              )}
              {pupil.attPct !== null && (
                <Chip variant={pupil.attPct >= 90 ? 'green' : pupil.attPct >= 70 ? 'amber' : 'red'} size="sm">
                  Attendance: {pupil.attPct}%
                </Chip>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="printer" onClick={handlePrint}>Print</Button>
      </div>

      {pupil.subjects.length === 0 ? (
        <div className="text-[12px] text-[var(--c-ink-3)] py-2">No scores recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['Subject','Score (%)','Grade','Remark'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pupil.subjects.map(s => {
                const remark = s.avg>=80?'Excellent':s.avg>=70?'Very Good':s.avg>=60?'Good':s.avg>=50?'Average':'Needs Improvement';
                return (
                  <tr key={s.subject} className="border-b border-[var(--c-line-1)] last:border-0">
                    <td className="py-2 pr-4 font-medium text-[var(--c-ink-1)]">{s.subject}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={s.avg} className="w-16"
                          color={s.avg>=70?'var(--c-green-400)':s.avg>=50?'var(--product-accent)':'var(--c-red-400)'} />
                        <span className="text-[var(--c-ink-1)] font-semibold">{s.avg}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4"><Chip variant={gradeVariant(s.avg)} size="sm">{gradeFromPct(s.avg)}</Chip></td>
                    <td className="py-2 text-[var(--c-ink-3)]">{remark}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminReportCards() {
  const { profile, schoolId, schoolName } = useAuth();

  const [tab,     setTab]     = useState('generate');
  const [classId, setClassId] = useState('');
  const [term,    setTerm]    = useState('3');
  const [preview, setPreview] = useState(null); // single pupil preview

  const { data: classes = [] }            = useClasses(schoolId);
  const { data: pupils  = [], isLoading } = usePupilsWithScores(classId);

  const cls = classes.find(c => c.id === classId);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Report Cards"
        subtitle="Generate and publish term report cards for all classes."
      >
        <Button variant="primary" icon="file-plus">Generate reports</Button>
        {classId && pupils.length > 0 && (
          <Button variant="ghost" icon="printer" onClick={handlePrintAll}>Print all</Button>
        )}
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Generated"   value={pupils.length}                                              deltaDir="flat" icon="file-check"    />
        <KpiCard label="With scores" value={pupils.filter(p=>p.subjects.length>0).length}              deltaDir="flat" icon="chart-bar"     />
        <KpiCard label="Published"   value="—"                                                          deltaDir="flat" icon="send"          />
        <KpiCard label="Term"        value={`Term ${term}`}                                             deltaDir="flat" icon="calendar"      />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select className="max-w-[200px]" value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select className="max-w-[140px]" value={term} onChange={e => setTerm(e.target.value)}>
          <option value="1">Term 1</option>
          <option value="2">Term 2</option>
          <option value="3">Term 3</option>
        </Select>
      </div>

      {/* ── Generate tab ── */}
      {tab === 'generate' && (
        !classId ? (
          <Card>
            <div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">Select a class to generate report cards.</div>
          </Card>
        ) : isLoading ? (
          <LoadingScreen />
        ) : (
          <>
            <Alert type="info" className="mb-4">
              Report cards are generated from assessment scores entered in the Gradebook. Ensure all scores are entered before printing.
            </Alert>
            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--c-line-2)]">
                      {['Student','Admission no.','Overall','Grade','Attendance','Action'].map(h => (
                        <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pupils.map(p => (
                      <tr key={p.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                            <span className="font-medium text-[var(--c-ink-0)]">{p.first_name} {p.last_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{p.admission_number ?? '—'}</td>
                        <td className="px-5 py-3">
                          {p.overall !== null ? (
                            <div className="flex items-center gap-2">
                              <ProgressBar value={p.overall} className="w-16"
                                color={p.overall>=70?'var(--c-green-400)':p.overall>=50?'var(--product-accent)':'var(--c-red-400)'} />
                              <span className="text-[var(--c-ink-1)] font-semibold">{p.overall}%</span>
                            </div>
                          ) : <span className="text-[var(--c-ink-4)]">No scores</span>}
                        </td>
                        <td className="px-5 py-3">
                          {p.overall !== null
                            ? <Chip variant={gradeVariant(p.overall)} size="sm">{gradeFromPct(p.overall)}</Chip>
                            : <Chip variant="default" size="sm">—</Chip>}
                        </td>
                        <td className="px-5 py-3">
                          {p.attPct !== null
                            ? <Chip variant={p.attPct>=90?'green':p.attPct>=70?'amber':'red'} size="sm">{p.attPct}%</Chip>
                            : <span className="text-[var(--c-ink-4)]">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" icon="eye" onClick={() => { setPreview(p); setTab('preview'); }}>Preview</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )
      )}

      {/* ── Preview tab ── */}
      {tab === 'preview' && (
        !classId ? (
          <Card><div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">Select a class first.</div></Card>
        ) : isLoading ? (
          <LoadingScreen />
        ) : preview ? (
          <div>
            <button onClick={() => setPreview(null)} className="flex items-center gap-2 text-[13px] text-[var(--product-accent)] mb-4 hover:opacity-80">
              <i className="ti ti-arrow-left text-[16px]" aria-hidden="true" /> All students
            </button>
            <ReportCardPreview
              pupil={preview}
              className={cls?.name}
              schoolName={schoolName}
              term={term}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pupils.map(p => (
              <ReportCardPreview
                key={p.id}
                pupil={p}
                className={cls?.name}
                schoolName={schoolName}
                term={term}
              />
            ))}
          </div>
        )
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <Card>
          <Empty icon="history" message="Published report card history will appear here." />
        </Card>
      )}
    </div>
  );
}
