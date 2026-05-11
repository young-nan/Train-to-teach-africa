/**
 * src/modules/admin/CurriculumView.jsx
 *
 * /app/admin/curriculum
 *
 * v1 scope: class management.
 *   - List existing classes for the school
 *   - Add a new class
 *   - Edit name, level, capacity
 *   - Assign / reassign teachers
 *   - Delete (if empty)
 *
 * Subject catalog and curriculum syllabi are v1.1 and v2 respectively.
 * The page header includes "Coming soon" cards for those so admins see
 * the roadmap without us shipping half-built UI.
 *
 * Layout: one table-style row per class, click to expand inline edit
 * panel — matches the pattern used by TiersView so the admin dashboard
 * feels consistent.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as classService from '@/services/classService';
import * as staffService from '@/services/staffService';
import { friendlyError } from '@/utils/friendlyError';
import { cn } from '@/utils/cn';

const LEVEL_OPTIONS = [
  { value: 'nursery_1', label: 'Nursery 1' },
  { value: 'nursery_2', label: 'Nursery 2' },
  { value: 'primary_1', label: 'Primary 1' },
  { value: 'primary_2', label: 'Primary 2' },
  { value: 'primary_3', label: 'Primary 3' },
  { value: 'primary_4', label: 'Primary 4' },
  { value: 'primary_5', label: 'Primary 5' },
  { value: 'primary_6', label: 'Primary 6' },
  { value: 'jss_1', label: 'JSS 1' },
  { value: 'jss_2', label: 'JSS 2' },
  { value: 'jss_3', label: 'JSS 3' },
  { value: 'ss_1', label: 'SS 1' },
  { value: 'ss_2', label: 'SS 2' },
  { value: 'ss_3', label: 'SS 3' },
];
const LEVEL_LABEL = Object.fromEntries(LEVEL_OPTIONS.map((l) => [l.value, l.label]));

export function CurriculumView() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const { data: classes, isLoading, error } = useQuery({
    queryKey: ['admin', 'classes-full', schoolId],
    queryFn: () => classService.listClasses({ schoolId }),
    enabled: !!schoolId,
    staleTime: 30_000,
  });

  const [adding, setAdding] = useState(false);

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7 flex items-end justify-between gap-s-4 flex-wrap">
        <div>
          <div className="font-mono text-eyebrow uppercase text-gold-400">Curriculum</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Classes, subjects, and syllabi.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Manage the classes your school offers. Subject catalog and
            curriculum syllabi are coming next.
          </p>
        </div>
        <Button
          intent="primary"
          size="md"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? 'Close' : '+ Add class'}
        </Button>
      </div>

      {adding && (
        <AddClassCard
          schoolId={schoolId}
          onDone={() => setAdding(false)}
        />
      )}

      {/* Classes section */}
      <section className="mb-s-9">
        <h3 className="font-display text-display-3 text-ink-0 mb-s-4">Classes</h3>

        {isLoading && <Skeleton />}
        {error && (
          <Card className="border-red-400/30 bg-red-400/[0.04]">
            <div className="text-red-400">{friendlyError(error)}</div>
          </Card>
        )}
        {classes && classes.length === 0 && (
          <Card>
            <div className="font-display text-display-3 text-ink-0">No classes yet.</div>
            <p className="mt-s-3 text-body text-ink-2">
              Add the first class for your school using the button above.
            </p>
          </Card>
        )}
        {classes && classes.length > 0 && (
          <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
            {classes.map((c) => (
              <ClassRow key={c.id} cls={c} schoolId={schoolId} />
            ))}
          </div>
        )}
      </section>

      {/* v1.1 / v2 surfaces — show the roadmap so admins know what's coming */}
      <section>
        <h3 className="font-display text-display-3 text-ink-0 mb-s-4">Coming next</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4">
          <div className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 opacity-60">
            <div className="font-mono text-eyebrow uppercase text-ink-3">Coming in v1.1</div>
            <h4 className="mt-s-2 font-display text-display-3 text-ink-0">Subject catalog</h4>
            <p className="mt-s-3 text-[13.5px] text-ink-3">
              A canonical list of subjects per level. Lets gradebook and reports
              stay consistent across teachers.
            </p>
          </div>
          <div className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 opacity-60">
            <div className="font-mono text-eyebrow uppercase text-ink-3">Coming in v2</div>
            <h4 className="mt-s-2 font-display text-display-3 text-ink-0">Curriculum syllabi</h4>
            <p className="mt-s-3 text-[13.5px] text-ink-3">
              NERDC and Cambridge topic lists per subject per term. For lesson
              planning and report-card alignment.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ----------------------------- Add class ------------------------------- */

function AddClassCard({ schoolId, onDone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    level: LEVEL_OPTIONS[2].value,  // default Primary 1
    capacity: '',
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => classService.createClass({
      schoolId,
      name: form.name,
      level: form.level,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'classes-full', schoolId] });
      qc.invalidateQueries({ queryKey: ['admin', 'classes-for-import', schoolId] });
      onDone();
    },
  });

  return (
    <Card className="mb-s-5">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Add a class</div>
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="grid sm:grid-cols-3 gap-s-4"
        noValidate
      >
        <Field label="Class name *">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            required autoFocus
            placeholder="e.g. Primary 3 Emerald"
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
        <Field label="Level *">
          <select
            value={form.level}
            onChange={(e) => update('level', e.target.value)}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Capacity" hint="Optional. Soft cap.">
          <input
            type="number"
            min="1"
            value={form.capacity}
            onChange={(e) => update('capacity', e.target.value)}
            placeholder="e.g. 30"
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>

        {create.error && (
          <div className="sm:col-span-3 text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
            {friendlyError(create.error)}
          </div>
        )}

        <div className="sm:col-span-3 flex justify-end gap-s-3 pt-s-2">
          <Button intent="ghost" size="md" type="button" onClick={onDone}>Cancel</Button>
          <Button intent="primary" size="md" type="submit" isLoading={create.isPending}>
            Add class
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ----------------------------- Class row ------------------------------- */

function ClassRow({ cls, schoolId }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="border-b border-line-1 last:border-0">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="w-full text-left flex items-center gap-s-4 px-s-4 py-s-3 min-h-[64px] hover:bg-surface-3 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] text-ink-1 truncate">{cls.name}</div>
          <div className="font-mono text-[10px] text-ink-3 uppercase tracking-wide">
            {LEVEL_LABEL[cls.level] ?? cls.level}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[14px] text-ink-0 tabular-nums">{cls.pupil_count} {cls.pupil_count === 1 ? 'pupil' : 'pupils'}</div>
          {cls.capacity && (
            <div className="font-mono text-[10px] text-ink-3">
              of {cls.capacity}
              {cls.pupil_count > cls.capacity && (
                <span className="text-amber-400"> · over</span>
              )}
            </div>
          )}
        </div>
        <span className="text-ink-3">→</span>
      </button>
      {editing && <ClassEditPanel cls={cls} schoolId={schoolId} onClose={() => setEditing(false)} />}
    </div>
  );
}

/* --------------------------- Edit panel -------------------------------- */

function ClassEditPanel({ cls, schoolId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: cls.name,
    level: cls.level,
    capacity: cls.capacity ?? '',
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Load assigned teachers + the school's full teacher list for the picker
  const { data: currentTeachers, isLoading: tLoading } = useQuery({
    queryKey: ['admin', 'class-teachers', cls.id],
    queryFn: () => classService.getClassTeachers(cls.id),
    staleTime: 30_000,
  });
  const { data: allTeachers } = useQuery({
    queryKey: ['admin', 'teachers', schoolId],
    queryFn: () => staffService.listStaff({ schoolId, role: 'teacher' }),
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  // Track selected teacher_ids locally so the user can toggle before saving
  const [selectedTeacherIds, setSelectedTeacherIds] = useState(null);
  // Initialise from currentTeachers once it loads
  const teacherIdsForDisplay = selectedTeacherIds
    ?? (currentTeachers ? currentTeachers.map((t) => t.teacher_id) : []);

  const toggleTeacher = (id) => {
    const current = teacherIdsForDisplay;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setSelectedTeacherIds(next);
  };

  const save = useMutation({
    mutationFn: async () => {
      const cap = form.capacity ? parseInt(form.capacity, 10) : null;
      await classService.updateClass({
        id: cls.id,
        patch: { name: form.name.trim(), level: form.level, capacity: cap },
      });
      // Only save teachers if the user touched the picker (selectedTeacherIds set)
      if (selectedTeacherIds !== null) {
        await classService.setClassTeachers({
          classId: cls.id,
          teacherIds: selectedTeacherIds,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'classes-full', schoolId] });
      qc.invalidateQueries({ queryKey: ['admin', 'class-teachers', cls.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'classes-for-import', schoolId] });
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => classService.deleteClass({ id: cls.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'classes-full', schoolId] });
      onClose();
    },
  });

  return (
    <div className="px-s-4 pb-s-5 pt-s-2 bg-surface-3/30 border-t border-line-1">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="grid sm:grid-cols-3 gap-s-4 mb-s-4"
      >
        <Field label="Class name *">
          <input
            type="text" value={form.name} required
            onChange={(e) => update('name', e.target.value)}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
        <Field label="Level *">
          <select
            value={form.level}
            onChange={(e) => update('level', e.target.value)}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] text-ink-1 outline-none focus:border-gold-400"
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Capacity">
          <input
            type="number" min="1" value={form.capacity}
            onChange={(e) => update('capacity', e.target.value)}
            placeholder="None"
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] font-mono text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
      </form>

      <Field label={`Teachers (${teacherIdsForDisplay.length} assigned)`} hint="Tap to toggle.">
        {tLoading && <div className="h-[40px] bg-surface-2 rounded animate-pulse" />}
        {!tLoading && (allTeachers ?? []).length === 0 && (
          <p className="text-[12.5px] text-ink-3 italic">
            No teachers in this school yet. Invite teachers via the Staff page first.
          </p>
        )}
        {!tLoading && (allTeachers ?? []).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-2">
            {allTeachers.map((t) => {
              const checked = teacherIdsForDisplay.includes(t.user_id);
              return (
                <button
                  key={t.user_id}
                  type="button"
                  onClick={() => toggleTeacher(t.user_id)}
                  className={cn(
                    'flex items-center gap-s-3 px-s-3 py-s-2 rounded-r-2 border text-left transition-all duration-150',
                    checked
                      ? 'bg-gold-400/[0.08] border-gold-400/40 text-ink-0'
                      : 'bg-surface-2 border-line-2 text-ink-1 hover:border-line-3',
                  )}
                >
                  <span className={cn(
                    'w-[18px] h-[18px] rounded-sm border-2 grid place-items-center shrink-0',
                    checked ? 'bg-gold-400 border-gold-400' : 'border-line-3',
                  )}>
                    {checked && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#1a1305" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[13.5px] truncate">{t.full_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {(save.error || remove.error) && (
        <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3 mt-s-4">
          {friendlyError(save.error || remove.error)}
        </div>
      )}

      <div className="flex justify-end gap-s-3 mt-s-4">
        <Button
          intent="ghost" size="md" type="button"
          onClick={() => remove.mutate()}
          disabled={remove.isPending || cls.pupil_count > 0}
          className={cls.pupil_count > 0 ? '' : 'text-red-400 hover:text-red-300'}
        >
          {cls.pupil_count > 0 ? 'Move pupils to delete' : 'Delete class'}
        </Button>
        <span className="flex-1" />
        <Button intent="ghost" size="md" type="button" onClick={onClose}>Cancel</Button>
        <Button intent="primary" size="md" onClick={() => save.mutate()} isLoading={save.isPending}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- Helpers --------------------------------- */

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-3 italic">{hint}</span>}
    </label>
  );
}

function Skeleton() {
  return (
    <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[64px] border-b border-line-1 last:border-0 animate-pulse" />
      ))}
    </div>
  );
}
