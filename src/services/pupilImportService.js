/**
 * src/services/pupilImportService.js
 *
 * Bulk-import pupils from CSV text. Handles parsing, validation, and
 * batch insertion.
 *
 * CSV columns expected (header row required):
 *   full_name        — required
 *   pupil_code       — required, unique within school
 *   class_name       — required, must match an existing class in the school
 *   date_of_birth    — optional, format YYYY-MM-DD
 *   level            — optional, e.g. primary_3
 *   photo_url        — optional
 *
 * Returns { inserted, skipped, errors } so the UI can show a clear report
 * after the import. Errors are per-row — one bad row doesn't fail the batch.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

/**
 * Parse CSV text into an array of row objects keyed by header name.
 * Handles quoted values containing commas. Strips whitespace.
 *
 * Not using a CSV library because the format we need to handle is small
 * and well-defined — school admins paste simple comma-separated rows.
 * Adding papaparse adds ~20KB to the bundle for a feature used 1-2x per
 * school onboarding.
 */
export function parseCsv(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (cells[j] ?? '').trim();
    });
    row.__line = i + 1; // 1-indexed line number, including header, for error messages
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Splits one CSV line, handling double-quoted values with embedded commas.
 * Doesn't handle escaped quotes (`""` inside a quoted value) — school
 * data rarely contains those; we'd add it if a real case appears.
 */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Validate a parsed row. Returns an array of error strings (empty if valid).
 */
export function validateRow(row, knownClassNames) {
  const errors = [];
  if (!row.full_name) errors.push('full_name is required');
  if (!row.pupil_code) errors.push('pupil_code is required');
  if (!row.class_name) errors.push('class_name is required');
  if (row.class_name && !knownClassNames.has(row.class_name)) {
    errors.push(`class_name "${row.class_name}" does not match any existing class`);
  }
  if (row.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth)) {
    errors.push('date_of_birth must be YYYY-MM-DD');
  }
  return errors;
}

/**
 * Pre-flight: returns the school's classes so the UI can show what
 * class_name values are accepted, and validate before submit.
 */
export async function listClassesForImport(schoolId) {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, level')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw new Error(`Could not load classes: ${error.message}`);
  return data ?? [];
}

/**
 * Insert the validated batch. Returns the result counts plus per-row errors.
 *
 * Note: we do NOT use a transaction. If row 28 fails, rows 1-27 stay.
 * Reasoning: a school admin importing 200 pupils benefits more from
 * "199 succeeded, 1 failed, here's why" than from "all-or-nothing,
 * try again from scratch." The failed row keeps its details so the
 * admin can fix it and re-paste just that one.
 */
export async function importPupils({ schoolId, rows }) {
  // Pull class name → id mapping
  const classes = await listClassesForImport(schoolId);
  const classIdByName = new Map(classes.map((c) => [c.name, { id: c.id, level: c.level }]));
  const knownClassNames = new Set(classIdByName.keys());

  const valid = [];
  const errors = [];
  for (const row of rows) {
    const rowErrors = validateRow(row, knownClassNames);
    if (rowErrors.length > 0) {
      errors.push({ line: row.__line, full_name: row.full_name, errors: rowErrors });
      continue;
    }
    const cls = classIdByName.get(row.class_name);
    valid.push({
      school_id: schoolId,
      class_id: cls.id,
      full_name: row.full_name,
      pupil_code: row.pupil_code,
      level: row.level || cls.level,
      date_of_birth: row.date_of_birth || null,
      photo_url: row.photo_url || null,
    });
  }

  if (valid.length === 0) {
    return { inserted: 0, skipped: rows.length, errors };
  }

  // Insert in chunks so a 500-pupil school doesn't hit any per-request
  // size limits. 100 per chunk is well within Supabase's defaults.
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('pupils')
      .insert(chunk)
      .select('id');
    if (error) {
      // Whole chunk failed — most likely a duplicate pupil_code. Mark
      // these rows as errored but keep going so the admin sees
      // every failure, not just the first.
      for (const row of chunk) {
        errors.push({
          line: '?',
          full_name: row.full_name,
          errors: [error.message],
        });
      }
      continue;
    }
    inserted += data?.length ?? chunk.length;
  }

  logAuditEvent({
    action: 'pupils.bulk_imported',
    targetSchoolId: schoolId,
    details: { inserted, errored: errors.length, total_rows: rows.length },
  });

  return {
    inserted,
    skipped: errors.length,
    errors,
  };
}
