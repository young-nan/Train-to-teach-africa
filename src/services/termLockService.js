/**
 * src/services/termLockService.js
 *
 * Term lock management. Head teachers + school admins can lock a term
 * to freeze scores + comments. Unlocking requires a reason for audit.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

/**
 * Return the lock state for every (term, year) pair the school has
 * touched, plus the three current-year terms regardless of state. The
 * UI needs to show all three terms even if no lock row exists yet —
 * the absence of a row means "unlocked".
 */
export async function listTermLocks({ schoolId, year }) {
  const { data, error } = await supabase
    .from('term_locks')
    .select('*')
    .eq('school_id', schoolId)
    .eq('year', year);
  if (error) throw new Error(`Could not load term locks: ${error.message}`);

  // Build a complete 3-term picture; absent rows = unlocked.
  const byTerm = new Map((data ?? []).map((r) => [r.term, r]));
  return ['term_1', 'term_2', 'term_3'].map((term) => {
    const existing = byTerm.get(term);
    return existing ?? {
      school_id: schoolId,
      term,
      year,
      locked: false,
      locked_at: null,
      locked_by: null,
      unlocked_at: null,
      unlocked_by: null,
      unlock_reason: null,
    };
  });
}

/**
 * Lock a term. Upserts so a previously unlocked term can be re-locked.
 */
export async function lockTerm({ schoolId, term, year, userId }) {
  const { data, error } = await supabase
    .from('term_locks')
    .upsert({
      school_id: schoolId,
      term,
      year,
      locked: true,
      locked_at: new Date().toISOString(),
      locked_by: userId,
      // Clear any prior unlock metadata
      unlocked_at: null,
      unlocked_by: null,
      unlock_reason: null,
    }, { onConflict: 'school_id,term,year' })
    .select()
    .single();
  if (error) throw new Error(`Could not lock term: ${error.message}`);

  logAuditEvent({
    action: 'term.locked',
    targetSchoolId: schoolId,
    details: { term, year },
  });
  return data;
}

/**
 * Unlock a term. Requires a reason — captured for audit because
 * unlocking a closed term is unusual and should be traceable.
 */
export async function unlockTerm({ schoolId, term, year, userId, reason }) {
  if (!reason?.trim()) {
    throw new Error('A reason is required to unlock a closed term.');
  }
  const { data, error } = await supabase
    .from('term_locks')
    .upsert({
      school_id: schoolId,
      term,
      year,
      locked: false,
      unlocked_at: new Date().toISOString(),
      unlocked_by: userId,
      unlock_reason: reason.trim(),
    }, { onConflict: 'school_id,term,year' })
    .select()
    .single();
  if (error) throw new Error(`Could not unlock term: ${error.message}`);

  logAuditEvent({
    action: 'term.unlocked',
    targetSchoolId: schoolId,
    details: { term, year, reason: reason.trim() },
  });
  return data;
}
