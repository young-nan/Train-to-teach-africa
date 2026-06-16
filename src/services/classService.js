/**
 * src/services/classService.js
 *
 * Class CRUD for school admins. Used by the curriculum / class-management
 * surface in the admin dashboard.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

/**
 * List classes for the current school. Returns full rows (name, level,
 * capacity, pupil_count, teacher_id) for the edit grid.
 */
export async function listClasses({ schoolId } = {}) {
  if (!schoolId) return []; // guard: called before profile hydrates
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, level, capacity, pupil_count, teacher_id, school_id, created_at')
    .eq('school_id', schoolId)
    .order('level')
    .order('name');
  if (error) throw new Error(`Could not load classes: ${error.message}`);
  return data ?? [];
}

/**
 * Create a new class. Capacity is optional. Auto-assigning a teacher at
 * creation time is supported via the optional teacherIds array — those
 * become rows in class_teachers.
 */
export async function createClass({ schoolId, name, level, capacity, teacherIds = [] }) {
  if (!schoolId) throw new Error('Missing schoolId');
  if (!name?.trim()) throw new Error('Class name is required');
  if (!level?.trim()) throw new Error('Class level is required');

  const { data: created, error } = await supabase
    .from('classes')
    .insert({
      school_id: schoolId,
      name: name.trim(),
      level: level.trim(),
      capacity: capacity || null,
      pupil_count: 0,
    })
    .select()
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error(`A class named "${name}" already exists in this school.`);
    }
    throw new Error(error.message);
  }

  // Optional initial teacher assignments
  if (teacherIds.length > 0) {
    const rows = teacherIds.map((tid) => ({
      class_id: created.id,
      teacher_id: tid,
      subject: null,
    }));
    await supabase.from('class_teachers').insert(rows);
  }

  logAuditEvent({
    action: 'class.created',
    targetSchoolId: schoolId,
    details: { class_id: created.id, name: created.name, level: created.level, teacher_count: teacherIds.length },
  });

  return created;
}

/**
 * Update class metadata. Whitelist editable fields; pupil_count is
 * trigger-maintained and shouldn't be set by callers.
 */
export async function updateClass({ id, patch }) {
  const allowed = {};
  for (const k of ['name', 'level', 'capacity']) {
    if (k in patch) allowed[k] = patch[k];
  }
  if (Object.keys(allowed).length === 0) return null;

  const { data, error } = await supabase
    .from('classes')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Could not update class: ${error.message}`);

  logAuditEvent({
    action: 'class.updated',
    details: { class_id: id, changes: Object.keys(allowed) },
  });
  return data;
}

/**
 * Delete a class. Refuses if pupils are still assigned — admin must
 * move them first. Done as a service-side guard (vs ON DELETE CASCADE)
 * so deletion is intentional, not accidental.
 */
export async function deleteClass({ id }) {
  // Pre-flight: check for pupils
  const { count, error: countErr } = await supabase
    .from('pupils')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', id);
  if (countErr) throw new Error(`Could not check pupils: ${countErr.message}`);
  if ((count ?? 0) > 0) {
    throw new Error(`This class still has ${count} pupil${count === 1 ? '' : 's'} assigned. Move them to another class first.`);
  }

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Could not delete class: ${error.message}`);

  logAuditEvent({
    action: 'class.deleted',
    details: { class_id: id },
  });
}

/**
 * Get teachers currently assigned to a class.
 */
export async function getClassTeachers(classId) {
  const { data, error } = await supabase
    .from('class_teachers')
    .select('teacher_id, subject, profiles:teacher_id(user_id, full_name, email)')
    .eq('class_id', classId);
  if (error) throw new Error(`Could not load teachers: ${error.message}`);
  return data ?? [];
}

/**
 * Replace the full set of teachers assigned to a class.
 * Mirror of staffService.setTeacherClasses but from the class perspective.
 */
export async function setClassTeachers({ classId, teacherIds }) {
  const { error: delErr } = await supabase
    .from('class_teachers')
    .delete()
    .eq('class_id', classId);
  if (delErr) throw new Error(`Could not clear teachers: ${delErr.message}`);

  if (teacherIds.length === 0) {
    logAuditEvent({
      action: 'class.teachers_updated',
      details: { class_id: classId, teacher_count: 0 },
    });
    return [];
  }

  const rows = teacherIds.map((tid) => ({
    class_id: classId,
    teacher_id: tid,
    subject: null,
  }));
  const { data, error } = await supabase
    .from('class_teachers')
    .insert(rows)
    .select();
  if (error) throw new Error(`Could not assign teachers: ${error.message}`);

  logAuditEvent({
    action: 'class.teachers_updated',
    details: { class_id: classId, teacher_count: teacherIds.length },
  });
  return data;
}
