/**
 * src/services/consentService.js
 *
 * Read and write explicit consent decisions for users and schools.
 *
 * CONSENT TYPES
 * ─────────────
 * operational_processing   — required; always true; cannot be revoked
 *                            without closing the account
 * anonymized_research      — user/school opt-in; contribute anonymized trends
 * benchmarking             — school opt-in; compare vs network averages
 * marketing_publications   — school opt-in; named in TTA case studies
 * media_photos_videos      — school separate consent; photos/videos in materials
 * home_learning_research   — parent opt-in; dinner Q + kitchen activity data
 * whatsapp_digest          — parent opt-in; handled separately in WhatsAppOptInView
 *
 * DESIGN DECISIONS
 * ─────────────────
 * - Every consent type is a separate DB row — never bundled.
 * - Revocation is non-destructive: the row stays with revoked_at set.
 * - All changes are written to audit_log via the upsert_consent RPC.
 * - "operational_processing" is shown read-only in the UI — it cannot
 *   be toggled off without contacting support (closing account).
 *
 * CURRENT POLICY VERSION: 1
 * Update POLICY_VERSION when privacy policy material changes.
 */

import { supabase } from '@/lib/supabase';

export const POLICY_VERSION = 1;

// Human-readable metadata for each consent type.
export const CONSENT_META = {
  operational_processing: {
    label:    'Operational data processing',
    body:     'Required for attendance, grading, report cards, and platform functionality.',
    required: true,
  },
  anonymized_research: {
    label:    'Anonymised educational research',
    body:     'Your anonymised educational trends may contribute to national educational insights and impact research. No names or personal identifiers are ever included.',
    required: false,
  },
  benchmarking: {
    label:    'Network benchmarking',
    body:     'Allow your school\'s anonymised results to be compared against network averages. Helps identify where your school is excelling or needs support.',
    required: false,
  },
  marketing_publications: {
    label:    'TTA publications and case studies',
    body:     'Allow TTA to reference your school (by name) in impact reports, donor presentations, and published case studies.',
    required: false,
  },
  media_photos_videos: {
    label:    'Photos and videos in TTA materials',
    body:     'Allow TTA to use school photos or videos in reports, website content, or campaigns. We will always seek individual consent for images of pupils.',
    required: false,
  },
  home_learning_research: {
    label:    'Home learning engagement research',
    body:     'Your anonymised dinner question responses and kitchen activity engagement may contribute to research on parent-led home learning in Nigeria.',
    required: false,
  },
};

// Consent types shown in school settings
export const SCHOOL_CONSENT_TYPES = [
  'operational_processing',
  'anonymized_research',
  'benchmarking',
  'marketing_publications',
  'media_photos_videos',
];

// Consent types shown in parent/user settings
export const USER_CONSENT_TYPES = [
  'operational_processing',
  'anonymized_research',
  'home_learning_research',
];

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all consent records for the current user.
 * Returns a map of { [consent_type]: boolean }
 */
export async function getMyConsents() {
  const { data, error } = await supabase
    .from('consent_records')
    .select('consent_type, granted, granted_at, revoked_at, version')
    .not('user_id', 'is', null);

  if (error) throw new Error(`Could not load consents: ${error.message}`);

  return Object.fromEntries(
    (data ?? []).map((r) => [r.consent_type, r.granted]),
  );
}

/**
 * Fetch all consent records for a specific school.
 * Returns a map of { [consent_type]: boolean }
 */
export async function getSchoolConsents(schoolId) {
  if (!schoolId) return {};
  const { data, error } = await supabase
    .from('consent_records')
    .select('consent_type, granted, granted_at, revoked_at, version')
    .eq('school_id', schoolId);

  if (error) throw new Error(`Could not load school consents: ${error.message}`);

  return Object.fromEntries(
    (data ?? []).map((r) => [r.consent_type, r.granted]),
  );
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Grant or revoke a consent type for the current user.
 * Calls the upsert_consent RPC which also writes to audit_log.
 *
 * @param {string} consentType - one of the consent_type enum values
 * @param {boolean} granted
 */
export async function setMyConsent(consentType, granted) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { error } = await supabase.rpc('upsert_consent', {
    p_user_id:      user.id,
    p_school_id:    null,
    p_consent_type: consentType,
    p_granted:      granted,
    p_version:      POLICY_VERSION,
  });

  if (error) throw new Error(`Could not save consent: ${error.message}`);
}

/**
 * Grant or revoke a consent type for a school.
 * Must be called by a school_admin or head_teacher.
 *
 * @param {string} schoolId
 * @param {string} consentType
 * @param {boolean} granted
 */
export async function setSchoolConsent(schoolId, consentType, granted) {
  const { error } = await supabase.rpc('upsert_consent', {
    p_user_id:      null,
    p_school_id:    schoolId,
    p_consent_type: consentType,
    p_granted:      granted,
    p_version:      POLICY_VERSION,
  });

  if (error) throw new Error(`Could not save school consent: ${error.message}`);
}

/**
 * Quick check: is a specific consent type granted for a school?
 * Used by the impact/research pipeline to filter schools that opted in.
 */
export async function schoolHasConsent(schoolId, consentType) {
  const { data } = await supabase
    .from('consent_records')
    .select('granted')
    .eq('school_id', schoolId)
    .eq('consent_type', consentType)
    .maybeSingle();
  return data?.granted === true;
}

/**
 * Fetch all school_ids that have granted anonymized_research consent.
 * Used by the super_admin impact view to filter the network league table
 * and by the export pipeline to exclude non-consenting schools.
 * Returns a Set<string> of school_id UUIDs for O(1) lookup.
 */
export async function getResearchConsentedSchools() {
  const { data, error } = await supabase
    .from('consent_records')
    .select('school_id')
    .eq('consent_type', 'anonymized_research')
    .eq('granted', true)
    .not('school_id', 'is', null);

  if (error) throw new Error(`Could not load research consents: ${error.message}`);
  return new Set((data ?? []).map((r) => r.school_id));
}
