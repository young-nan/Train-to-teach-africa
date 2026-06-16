/**
 * src/services/tutorLeadService.js
 *
 * The PUBLIC lead-capture endpoint. Anyone — anonymous visitors included —
 * can submit. The RLS policy on `tutor_leads` allows insert from `anon`.
 *
 * This is the ONLY tutor-related service module v1 ships with. Full tutor
 * marketplace services (search, booking, payment splits) come in v2.
 */

import { supabase } from '@/lib/supabase';

/**
 * Submit a tutor expression-of-interest lead.
 * @param {object} lead
 *   - fullName, email, phone (required)
 *   - city, state, subjects[], curriculum[], yearsExperience, availability, notes (optional)
 */
export async function submitTutorLead(lead) {
  const row = {
    full_name: lead.fullName?.trim(),
    email: lead.email?.trim().toLowerCase(),
    phone: lead.phone?.trim(),
    city: lead.city?.trim() || null,
    state: lead.state?.trim() || null,
    subjects: lead.subjects ?? [],
    curriculum: lead.curriculum ?? [],
    years_experience: lead.yearsExperience ?? null,
    availability: lead.availability?.trim() || null,
    notes: lead.notes?.trim() || null,
    source: lead.source ?? 'public_site',
  };

  if (!row.full_name || !row.email || !row.phone) {
    throw new Error('Name, email, and phone are required.');
  }

  const { data, error } = await supabase
    .from('tutor_leads')
    .insert(row)
    .select('id')
    .single();

  if (error) throw new Error(`Could not submit: ${error.message}`);
  return data;
}
