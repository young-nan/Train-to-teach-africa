// supabase/functions/export-impact-report/index.ts
//
// Generates a downloadable CSV or PDF impact report for a school.
// Called by impactService.downloadImpactCsv() and downloadImpactPdf().
//
// SECURITY
// ────────
// Caller must be authenticated AND (school_admin for their own school
// OR super_admin). The get_school_impact_csv RPC enforces this at the
// database level via the same check — double layer.
//
// CSV FORMAT (grant reporting)
// ─────────────────────────────
// Header row + one row per week. Fully anonymised — no pupil or parent
// names, no emails, no identifiers. Aggregate metrics only.
//
// PDF FORMAT
// ──────────
// 2-page branded summary using the same Puppeteer infrastructure as
// generate-lesson-pdf. Page 1: executive summary KPIs. Page 2: trend
// chart (ASCII sparklines — no chart library needed server-side).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CSV_HEADERS = [
  'Week ending',
  'Attendance % (14d)',
  'Attendance trend (pts)',
  'Avg score %',
  'Parent engagement %',
  'Lesson views',
  'PDF downloads',
  'WhatsApp delivery %',
  'Pupil count',
  'Linked parents',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { school_id?: string; weeks?: number; format?: string };
  try { body = await req.json(); }
  catch { return errJson('Invalid JSON'); }

  const { school_id, weeks = 12, format = 'csv' } = body;
  if (!school_id) return errJson('school_id is required');
  if (!['csv', 'pdf'].includes(format)) return errJson('format must be csv or pdf');

  // ── Fetch school name for the report header ───────────────────────────────
  const { data: school } = await serviceClient
    .from('schools')
    .select('name, slug, impact_page_tagline')
    .eq('id', school_id)
    .single();

  // ── Fetch CSV rows via RPC (enforces auth) ────────────────────────────────
  const { data: rows, error: csvErr } = await anonClient.rpc('get_school_impact_csv', {
    p_school_id: school_id,
    p_weeks:     weeks,
  });

  if (csvErr) return errJson(`Data fetch failed: ${csvErr.message}`, 403);
  if (!rows || rows.length === 0) return errJson('No snapshot data available yet.', 404);

  // ── Also fetch current metrics for the PDF executive summary ─────────────
  const { data: current } = await anonClient
    .from('school_impact_v')
    .select('*')
    .eq('school_id', school_id)
    .single();

  const { data: network } = await anonClient
    .from('network_impact_v')
    .select('*')
    .single();

  // ── Build CSV ─────────────────────────────────────────────────────────────
  const csvLines = [
    CSV_HEADERS.join(','),
    ...rows.map((r: Record<string, string>) =>
      [
        r.snapshot_date,
        r.attendance_pct,
        r.attendance_trend_pts,
        r.avg_score_pct,
        r.parent_engagement_pct,
        r.lesson_views,
        r.pdf_downloads,
        r.whatsapp_delivery_pct,
        r.pupil_count,
        r.linked_parent_count,
      ].join(',')
    ),
  ];
  const csvContent = csvLines.join('\r\n');

  if (format === 'csv') {
    return new Response(csvContent, {
      headers: {
        ...CORS,
        'Content-Type':        'text/csv;charset=utf-8;',
        'Content-Disposition': `attachment; filename="TTA-Impact-${school?.slug ?? school_id}.csv"`,
      },
    });
  }

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const html = buildImpactReportHTML({
    school:  school ?? { name: 'School', slug: '' },
    current: current ?? {},
    network: network ?? {},
    rows,
    weeks,
  });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await htmlToPdf(html);
  } catch (e) {
    console.error('[export-impact-report] Puppeteer error:', e);
    // Fallback: return the CSV instead with a note.
    return new Response(csvContent, {
      headers: {
        ...CORS,
        'Content-Type':        'text/csv;charset=utf-8;',
        'Content-Disposition': `attachment; filename="TTA-Impact-${school?.slug ?? 'report'}.csv"`,
        'X-Fallback-Reason':   'pdf-generation-unavailable',
      },
    });
  }

  return new Response(pdfBytes, {
    headers: {
      ...CORS,
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="TTA-Impact-Report-${school?.slug ?? school_id}.pdf"`,
    },
  });
});

// ── Puppeteer (same pattern as generate-lesson-pdf) ───────────────────────────

async function htmlToPdf(html: string): Promise<Uint8Array> {
  const puppeteer = await import('npm:puppeteer-core@21.11.0');
  const chromium  = await import('npm:@sparticuz/chromium-min@121.0.0');

  const browser = await puppeteer.default.launch({
    args:            chromium.default.args,
    defaultViewport: chromium.default.defaultViewport,
    executablePath:  await chromium.default.executablePath(
      Deno.env.get('CHROMIUM_BINARY_URL') ??
      'https://cdn.tta.dev/chromium/chromium-121-pack.tar',
    ),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '18mm', right: '16mm', bottom: '22mm', left: '16mm' },
    });
    return new Uint8Array(pdf as ArrayBuffer);
  } finally {
    await browser.close();
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

function buildImpactReportHTML({
  school, current, network, rows, weeks,
}: {
  school:  any;
  current: any;
  network: any;
  rows:    any[];
  weeks:   number;
}) {
  const generatedOn = new Date().toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Sparkline: ASCII bar chart for attendance trend (last N weeks)
  const attendanceValues = rows.map((r: any) => parseFloat(r.attendance_pct) || 0);
  const sparkline = buildSparkline(attendanceValues);

  // Delta indicators
  const attendanceDelta = current.attendance_trend_pts;
  const attendanceSign  = attendanceDelta > 0 ? '+' : '';

  function vs(value: number | null, benchmark: number | null) {
    if (value == null || benchmark == null) return '';
    const diff = value - benchmark;
    return diff >= 0
      ? `<span class="above">▲ ${diff.toFixed(1)} pts above network avg</span>`
      : `<span class="below">▼ ${Math.abs(diff).toFixed(1)} pts below network avg</span>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>TTA Impact Report — ${esc(school.name)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 22mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Georgia, serif; font-size: 11pt; color: #1a1a1a; background: #fff; }

  /* Layout */
  .page-break { page-break-after: always; }

  /* Header */
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8mm; border-bottom: 2pt solid #aa821e; margin-bottom: 10mm; }
  .brand { font-size: 13pt; font-weight: bold; }
  .brand-sub { font-size: 10pt; color: #555; margin-top: 1mm; }
  .meta { text-align: right; font-size: 9pt; color: #555; line-height: 1.7; }

  /* Eyebrow */
  .eyebrow { font-family: monospace; font-size: 9pt; letter-spacing: .14em; text-transform: uppercase; color: #aa821e; margin-bottom: 3mm; }

  /* Title */
  h1 { font-size: 22pt; line-height: 1.15; margin-bottom: 2mm; }
  .tagline { font-size: 11pt; color: #555; font-style: italic; margin-bottom: 10mm; }

  /* KPI grid */
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5mm; margin-bottom: 10mm; }
  .kpi-box { border: 1pt solid #ddd; border-radius: 3pt; padding: 5mm; }
  .kpi-label { font-family: monospace; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #888; margin-bottom: 2mm; }
  .kpi-value { font-size: 22pt; font-weight: bold; color: #1a1a1a; line-height: 1; }
  .kpi-sub { font-size: 9pt; color: #666; margin-top: 2mm; line-height: 1.4; }
  .above { color: #2a7a2a; }
  .below { color: #aa2a2a; }

  /* Sparkline section */
  h2 { font-size: 14pt; margin: 8mm 0 4mm; page-break-after: avoid; }
  .spark-container { font-family: monospace; font-size: 10pt; line-height: 1.6; background: #f8f6f2; border: 1pt solid #e8e0d0; border-radius: 3pt; padding: 5mm; }
  .spark-row { display: flex; align-items: center; gap: 3mm; }
  .spark-label { color: #888; font-size: 8.5pt; width: 18mm; flex-shrink: 0; }
  .spark-bar { color: #aa821e; letter-spacing: -1px; }
  .spark-pct { color: #555; font-size: 8.5pt; }

  /* Table */
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 5mm; }
  th { font-family: monospace; font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: #888; text-align: right; padding: 2mm 3mm; border-bottom: 1pt solid #ccc; }
  th:first-child { text-align: left; }
  td { padding: 2mm 3mm; border-bottom: 1pt solid #eee; text-align: right; vertical-align: top; }
  td:first-child { text-align: left; color: #555; }
  tr:last-child td { border-bottom: none; }

  /* Footer */
  .report-footer { margin-top: 12mm; padding-top: 4mm; border-top: 1pt solid #ccc; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }

  /* Disclaimer */
  .disclaimer { margin-top: 8mm; padding: 4mm; background: #f8f8f8; border: 1pt solid #ddd; border-radius: 3pt; font-size: 9pt; color: #666; }
</style>
</head>
<body>

<!-- PAGE 1: Executive summary -->
<header class="report-header">
  <div>
    <div class="brand">Train To Teach Africa</div>
    <div class="brand-sub">Impact &amp; Outcomes Report</div>
  </div>
  <div class="meta">
    <div>Generated: ${esc(generatedOn)}</div>
    <div>Period: Last ${weeks} weeks</div>
    <div>Confidential</div>
  </div>
</header>

<div class="eyebrow">School impact summary</div>
<h1>${esc(school.name)}</h1>
${school.impact_page_tagline ? `<div class="tagline">${esc(school.impact_page_tagline)}</div>` : ''}

<div class="kpi-grid">
  <div class="kpi-box">
    <div class="kpi-label">Pupils enrolled</div>
    <div class="kpi-value">${fmt(current.pupil_count)}</div>
    <div class="kpi-sub">${fmt(current.linked_parent_count)} parents linked</div>
  </div>
  <div class="kpi-box">
    <div class="kpi-label">Attendance · 14 days</div>
    <div class="kpi-value">${fmt(current.attendance_14d_pct)}%</div>
    <div class="kpi-sub">
      ${attendanceSign}${fmt(attendanceDelta)} pts vs prior 14 days<br>
      ${vs(current.attendance_14d_pct, network.network_attendance_pct)}
    </div>
  </div>
  <div class="kpi-box">
    <div class="kpi-label">Avg grade score</div>
    <div class="kpi-value">${fmt(current.avg_score_pct)}%</div>
    <div class="kpi-sub">${vs(current.avg_score_pct, network.network_avg_score_pct)}</div>
  </div>
  <div class="kpi-box">
    <div class="kpi-label">Parent engagement · 7d</div>
    <div class="kpi-value">${fmt(current.parent_engagement_7d_pct)}%</div>
    <div class="kpi-sub">
      ${fmt(current.active_parents_7d)} of ${fmt(current.linked_parent_count)} parents active<br>
      ${vs(current.parent_engagement_7d_pct, network.network_parent_engagement_pct)}
    </div>
  </div>
  <div class="kpi-box">
    <div class="kpi-label">WhatsApp delivery · 7d</div>
    <div class="kpi-value">${fmt(current.whatsapp_delivery_pct)}%</div>
    <div class="kpi-sub">
      ${fmt(current.whatsapp_sent_7d)} of ${fmt(current.whatsapp_attempted_7d)} sent<br>
      ${vs(current.whatsapp_delivery_pct, network.network_whatsapp_delivery_pct)}
    </div>
  </div>
  <div class="kpi-box">
    <div class="kpi-label">Lesson PDFs · 7d</div>
    <div class="kpi-value">${fmt(current.pdf_downloads_7d)}</div>
    <div class="kpi-sub">downloads by parents this week</div>
  </div>
</div>

<h2>Attendance trend · ${weeks} weeks</h2>
<div class="spark-container">
  ${sparkline.map(({ label, bar, pct }) => `
  <div class="spark-row">
    <span class="spark-label">${esc(label)}</span>
    <span class="spark-bar">${bar}</span>
    <span class="spark-pct">${pct}%</span>
  </div>`).join('')}
</div>

<div class="report-footer">
  <span>Train To Teach Africa · traintoteachafrica.org</span>
  <span>${esc(school.name)} · ${esc(generatedOn)}</span>
</div>

<!-- PAGE 2: Weekly data table -->
<div class="page-break"></div>

<header class="report-header">
  <div>
    <div class="brand">Train To Teach Africa</div>
    <div class="brand-sub">Weekly Data — ${esc(school.name)}</div>
  </div>
  <div class="meta"><div>Page 2 of 2</div></div>
</header>

<div class="eyebrow">Weekly breakdown · last ${weeks} weeks</div>
<h2 style="margin-top:4mm">Full weekly metrics</h2>

<table>
  <thead>
    <tr>
      <th>Week ending</th>
      <th>Attend %</th>
      <th>Δ pts</th>
      <th>Avg score</th>
      <th>Parent eng %</th>
      <th>Views</th>
      <th>PDFs</th>
      <th>WA del %</th>
      <th>Pupils</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r: any) => `
    <tr>
      <td>${esc(r.snapshot_date)}</td>
      <td>${esc(r.attendance_pct || '—')}</td>
      <td>${esc(r.attendance_trend_pts || '—')}</td>
      <td>${esc(r.avg_score_pct || '—')}</td>
      <td>${esc(r.parent_engagement_pct || '—')}</td>
      <td>${esc(r.lesson_views || '—')}</td>
      <td>${esc(r.pdf_downloads || '—')}</td>
      <td>${esc(r.whatsapp_delivery_pct || '—')}</td>
      <td>${esc(r.pupil_count || '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="disclaimer">
  <strong>Data note:</strong> All metrics are aggregated. No individual pupil
  or parent information is included in this report. Attendance calculated from
  daily class registers. Grade scores calculated from recorded assessments only
  — unrecorded assessments are excluded. Parent engagement based on lesson
  views and PDF downloads by linked parents. WhatsApp delivery rate based on
  Meta Cloud API acknowledgements.
</div>

<div class="report-footer">
  <span>Train To Teach Africa · traintoteachafrica.org · confidential</span>
  <span>${esc(school.name)} · generated ${esc(generatedOn)}</span>
</div>

</body>
</html>`;
}

// ── Sparkline builder ─────────────────────────────────────────────────────────

function buildSparkline(values: number[]): Array<{ label: string; bar: string; pct: string }> {
  const max    = Math.max(...values, 1);
  const width  = 28; // character width of bars

  return values.map((v, i) => {
    const barLen = Math.round((v / 100) * width);
    const bar    = '█'.repeat(barLen) + '░'.repeat(width - barLen);
    // Label: "Wk N" where N counts back from current
    const weeksAgo = values.length - 1 - i;
    const label    = weeksAgo === 0 ? 'This wk' : `${weeksAgo}w ago`;
    return { label, bar, pct: v.toFixed(1) };
  });
}

// ── Micro helpers ─────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '—')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0 && typeof n !== 'number') return '—';
  return n.toLocaleString('en-NG');
}

function errJson(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
