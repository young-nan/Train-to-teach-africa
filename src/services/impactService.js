/**
 * src/services/impactService.js
 *
 * All impact dashboard data operations.
 *
 * DATA SOURCES
 * ────────────
 * school_impact_v       — current metrics (materialized, refreshes every 5 min)
 * network_impact_v      — TTA-wide benchmarks (same refresh)
 * impact_snapshot       — weekly historical rows for trend charts
 * export-impact-report  — edge function that returns CSV or PDF
 *
 * WHO CALLS THIS
 * ──────────────
 * ImpactDashboardView   — /app/admin/impact (school admin sees own school)
 * SuperAdminImpactView  — /app/admin/impact (super_admin sees all schools)
 * PublicImpactPage      — /impact/:schoolSlug (unauthenticated, public-facing)
 */

import { supabase } from '@/lib/supabase';

// ── School impact metrics ─────────────────────────────────────────────────────

/**
 * Current metrics for a single school (from school_impact_v).
 * School admins call this with their own schoolId.
 * Super admin can pass any schoolId.
 */
export async function getSchoolImpact(schoolId) {
  const { data, error } = await supabase
    .from('school_impact_v')
    .select('*')
    .eq('school_id', schoolId)
    .single();

  if (error) throw new Error(`Could not load impact metrics: ${error.message}`);
  return data;
}

/**
 * All schools' current metrics. Super admin only (enforced by RLS).
 * Used by the network-level impact overview.
 */
export async function getAllSchoolsImpact() {
  const { data, error } = await supabase
    .from('school_impact_v')
    .select('*')
    .order('pupil_count', { ascending: false });

  if (error) throw new Error(`Could not load network metrics: ${error.message}`);
  return data ?? [];
}

/**
 * TTA-wide benchmark metrics (from network_impact_v).
 * Used to render "vs network average" indicators.
 */
export async function getNetworkBenchmarks() {
  const { data, error } = await supabase
    .from('network_impact_v')
    .select('*')
    .single();

  if (error) {
    // Non-fatal — dashboard degrades to showing absolute numbers only.
    console.warn('[impactService] network benchmarks unavailable:', error.message);
    return null;
  }
  return data;
}

/**
 * Public impact page data for a school (by slug, no auth required).
 * Only returns data if impact_page_enabled = true.
 * Limited columns — no internal metrics exposed publicly.
 */
export async function getPublicSchoolImpact(slug) {
  const { data, error } = await supabase
    .from('school_impact_v')
    .select(`
      school_name,
      slug,
      impact_page_tagline,
      pupil_count,
      linked_parent_count,
      attendance_14d_pct,
      attendance_trend_pts,
      avg_score_pct,
      parent_engagement_7d_pct,
      lesson_views_7d,
      whatsapp_sent_7d,
      pdf_downloads_7d
    `)
    .eq('slug', slug)
    .eq('impact_page_enabled', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found / not public
    throw new Error(`Could not load public impact data: ${error.message}`);
  }
  return data;
}

// ── Historical trend data ─────────────────────────────────────────────────────

/**
 * Weekly snapshots for trend charts (last N weeks).
 * Returns newest-first; the chart component reverses to oldest-first.
 */
export async function getImpactSnapshots(schoolId, weeks = 12) {
  const { data, error } = await supabase
    .from('impact_snapshot')
    .select('*')
    .eq('school_id', schoolId)
    .order('snapshot_date', { ascending: false })
    .limit(weeks);

  if (error) throw new Error(`Could not load trend data: ${error.message}`);
  return (data ?? []).reverse(); // oldest-first for chart rendering
}

// ── Lesson view tracking ──────────────────────────────────────────────────────

/**
 * Record a parent lesson view. Called by LessonReaderView on mount.
 * Fire-and-forget — failure does not block the lesson from loading.
 *
 * The DB unique constraint on (lesson_id, viewer_user_id, date) makes
 * this idempotent — duplicate calls on the same day are no-ops.
 */
export async function recordLessonView({ lessonId, pupilId, schoolId }) {
  const { error } = await supabase
    .from('lesson_views')
    .insert({
      lesson_id:      lessonId,
      viewer_user_id: (await supabase.auth.getUser()).data.user?.id,
      pupil_id:       pupilId  ?? null,
      school_id:      schoolId ?? null,
    });

  if (error && error.code !== '23505') {
    // 23505 = unique_violation (same parent, same lesson, same day) — expected, ignore.
    console.warn('[impactService] lesson view record failed:', error.message);
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Download the impact report as a CSV (grant reporting format).
 * Calls the export-impact-report edge function which queries
 * get_school_impact_csv RPC and returns the file.
 *
 * @param {{ schoolId: string, weeks?: number, schoolName: string }} params
 */
export async function downloadImpactCsv({ schoolId, weeks = 12, schoolName }) {
  const { data, error } = await supabase.functions.invoke('export-impact-report', {
    body: { school_id: schoolId, weeks, format: 'csv' },
  });

  if (error) throw new Error(`Export failed: ${error.message}`);

  // The edge function returns raw CSV bytes. Trigger browser download.
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `TTA-Impact-${slugify(schoolName)}-${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Download the impact report as a branded PDF.
 * Same edge function, format = 'pdf'.
 */
export async function downloadImpactPdf({ schoolId, weeks = 12, schoolName }) {
  const { data, error } = await supabase.functions.invoke('export-impact-report', {
    body: { school_id: schoolId, weeks, format: 'pdf' },
  });

  if (error) throw new Error(`PDF export failed: ${error.message}`);

  const blob = new Blob([data], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `TTA-Impact-Report-${slugify(schoolName)}-${today()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Admin: public page settings ───────────────────────────────────────────────

/**
 * Super admin: enable / disable a school's public impact page and set tagline.
 */
export async function updateImpactPageSettings({ schoolId, enabled, tagline }) {
  const { data, error } = await supabase
    .from('schools')
    .update({
      impact_page_enabled:  enabled,
      impact_page_tagline:  tagline ?? null,
    })
    .eq('id', schoolId)
    .select('id, impact_page_enabled, impact_page_tagline, slug')
    .single();

  if (error) throw new Error(`Could not update settings: ${error.message}`);
  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name) {
  return (name ?? 'school')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch per-day WhatsApp delivery stats from the whatsapp_delivery_stats view.
 * Returns the last `days` days ordered date ASC for chart rendering.
 * Used by ImpactDashboardView's WA Delivery chart.
 */
export async function getWhatsAppDeliveryStats(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('whatsapp_delivery_stats')
    .select('dispatch_date, total_dispatched, send_succeeded, send_failed, confirmed_delivered, delivery_rate_pct')
    .gte('dispatch_date', since)
    .order('dispatch_date', { ascending: true });
  if (error) throw new Error(`Could not load WA delivery stats: ${error.message}`);
  return data ?? [];
}
