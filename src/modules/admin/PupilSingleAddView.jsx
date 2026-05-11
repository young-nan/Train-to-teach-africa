/**
 * src/modules/admin/PupilSingleAddView.jsx
 *
 * /app/admin/pupils/add
 *
 * Single-pupil enrolment form, with optional parent capture.
 *
 * Workflow:
 *   1. Admin enters pupil details (class, name, code, DOB, level)
 *   2. Optional toggle expands a Parent Details section
 *   3. On submit:
 *      a. Insert pupil row
 *      b. If parent details given:
 *         - Call invite-user edge function with role=parent + link_pupil_id
 *         - Function handles idempotency: existing parent → just link
 *         - Function returns whether the parent was created or linked
 *   4. Show result; offer "add another" with class selection sticky
 *
 * The class selection persists across submissions for fast roster entry.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as pupilImportService from '@/services/pupilImportService';
import * as staffService from '@/services/staffService';
import * as photoUploadService from '@/services/photoUploadService';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/services/auditService';
import { cn } from '@/utils/cn';

export function PupilSingleAddView() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [searchParams, setSearchParams] = useSearchParams();
  const presetClassId = searchParams.get('class_id') ?? '';

  const { data: classes } = useQuery({
    queryKey: ['admin', 'classes-for-import', schoolId],
    queryFn: () => pupilImportService.listClassesForImport(schoolId),
    enabled: !!schoolId,
    staleTime: 5 * 60_000,
  });

  // ---- Pupil form state ---------------------------------------------------
  const [form, setForm] = useState({
    full_name: '',
    pupil_code: '',
    class_id: presetClassId,
    date_of_birth: '',
    level: '',
  });

  // Passport photo: kept as File until submit; uploaded only after pupil row
  // is inserted (so the storage path can use the new pupil_id).
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // ---- Parent section state -----------------------------------------------
  const [parentOpen, setParentOpen] = useState(false);
  const [parent, setParent] = useState({
    full_name: '',
    email: '',
    phone: '',
    mode: 'invite', // 'invite' | 'password'
    temporary_password: '',
  });

  // ---- Result of the submission -------------------------------------------
  const [result, setResult] = useState(null);

  const updateForm = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateParent = (k, v) => setParent((p) => ({ ...p, [k]: v }));

  const submit = useMutation({
    mutationFn: async () => {
      const cls = (classes ?? []).find((c) => c.id === form.class_id);
      if (!cls) throw new Error('Pick a class first.');
      if (!form.full_name.trim()) throw new Error('Pupil full name is required.');
      if (!form.pupil_code.trim()) throw new Error('Pupil code is required.');
      if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth)) {
        throw new Error('Date of birth must be YYYY-MM-DD.');
      }
      if (parentOpen) {
        if (!parent.full_name.trim()) throw new Error('Parent full name is required (or remove parent details).');
        if (!parent.email.trim()) throw new Error('Parent email is required (or remove parent details).');
        if (parent.mode === 'password' && (parent.temporary_password ?? '').length < 8) {
          throw new Error('Parent temporary password must be at least 8 characters.');
        }
      }

      // ---- Step 1: insert the pupil ---------------------------------------
      const pupilRow = {
        school_id: schoolId,
        class_id: cls.id,
        full_name: form.full_name.trim(),
        pupil_code: form.pupil_code.trim(),
        level: (form.level || cls.level).trim(),
        date_of_birth: form.date_of_birth || null,
      };
      const { data: pupil, error: pupilErr } = await supabase
        .from('pupils')
        .insert(pupilRow)
        .select('id, full_name, pupil_code')
        .single();
      if (pupilErr) {
        if (pupilErr.message.includes('duplicate') || pupilErr.message.includes('unique')) {
          throw new Error(`Pupil code "${pupilRow.pupil_code}" already exists. Each pupil needs a unique code.`);
        }
        throw new Error(pupilErr.message);
      }

      logAuditEvent({
        action: 'pupils.added',
        targetPupilId: pupil.id,
        targetSchoolId: schoolId,
        details: { pupil_code: pupilRow.pupil_code, class_id: cls.id, parent_attached: parentOpen },
      });

      // ---- Step 1.5 (optional): upload passport photo --------------------
      // We need pupil.id before we can name the storage object, hence
      // this happens *after* the pupil insert. If upload fails, the pupil
      // stays — admin can re-upload later.
      if (photoFile) {
        try {
          const photoPath = await photoUploadService.uploadPupilPhoto({
            file: photoFile,
            schoolId,
            pupilId: pupil.id,
          });
          await supabase
            .from('pupils')
            .update({ photo_url: photoPath })
            .eq('id', pupil.id);
        } catch (photoErr) {
          // Non-fatal — return a warning alongside success
          console.warn('[pupil] photo upload failed:', photoErr.message);
          return {
            pupil,
            photoError: photoErr.message,
          };
        }
      }

      // ---- Step 2 (optional): invite/link parent --------------------------
      let parentResult = null;
      if (parentOpen) {
        try {
          parentResult = await staffService.inviteParentForPupil({
            mode: parent.mode,
            email: parent.email,
            fullName: parent.full_name,
            pupilId: pupil.id,
            schoolId,
            temporaryPassword: parent.mode === 'password' ? parent.temporary_password : undefined,
          });
        } catch (parentErr) {
          // Pupil is in; parent failed. Surface but don't roll back the pupil.
          return {
            pupil,
            parentError: parentErr.message,
          };
        }
      }

      return { pupil, parentResult };
    },
    onSuccess: (r) => {
      setResult(r);
      // Sticky class; clear pupil + parent fields.
      setForm((f) => ({
        ...f,
        full_name: '',
        pupil_code: '',
        date_of_birth: '',
      }));
      setPhotoFile(null);
      setPhotoPreview(null);
      setParent({ full_name: '', email: '', phone: '', mode: 'invite', temporary_password: '' });
      setParentOpen(false);
      if (form.class_id) setSearchParams({ class_id: form.class_id }, { replace: true });
    },
  });

  return (
    <div className="max-w-[680px]">
      <div className="mb-s-5">
        <Link to="/app/admin/enrollments" className="text-[13.5px] text-ink-3 hover:text-ink-1">← Enrolments</Link>
      </div>
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Add one pupil</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Enrol a new pupil.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          For one pupil at a time. For a full class roster, use the
          {' '}<Link to="/app/admin/pupils/import" className="text-gold-200 underline-offset-4 hover:underline">bulk CSV importer</Link>.
        </p>
      </div>

      {result && <ResultBanner result={result} onDismiss={() => setResult(null)} />}

      <Card className="mb-s-5">
        <form
          onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
          className="flex flex-col gap-s-5"
          noValidate
        >
          <Field label="Class *">
            <select
              value={form.class_id}
              onChange={(e) => updateForm('class_id', e.target.value)}
              required
              className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
            >
              <option value="">Select a class…</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Pupil's full name *">
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => updateForm('full_name', e.target.value)}
              required
              autoFocus
              autoComplete="off"
              placeholder="e.g. Adaeze Okafor"
              className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
            />
          </Field>

          <Field label="Pupil code *" hint="Unique within your school. Auto-generated if you click Generate.">
            <div className="flex gap-s-2">
              <input
                type="text"
                value={form.pupil_code}
                onChange={(e) => updateForm('pupil_code', e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                required
                autoComplete="off"
                placeholder="e.g. TLF-P145"
                className="flex-1 bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-1 outline-none focus:border-gold-400"
              />
              <button
                type="button"
                onClick={async () => {
                  const cls = (classes ?? []).find((c) => c.id === form.class_id);
                  if (!cls) {
                    alert('Pick a class first — code depends on the level.');
                    return;
                  }
                  try {
                    const code = await pupilImportService.nextPupilCode({
                      schoolId,
                      level: form.level || cls.level,
                    });
                    updateForm('pupil_code', code);
                  } catch (e) {
                    alert(e.message);
                  }
                }}
                disabled={!form.class_id}
                className="px-s-4 py-s-3 bg-surface-3 border border-line-2 rounded-r-2 text-[13px] text-gold-200 hover:border-gold-400/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Generate
              </button>
            </div>
          </Field>

          <div className="grid sm:grid-cols-2 gap-s-4">
            <Field label="Date of birth">
              <input
                type="text"
                value={form.date_of_birth}
                onChange={(e) => updateForm('date_of_birth', e.target.value)}
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-1 outline-none focus:border-gold-400"
              />
            </Field>
            <Field label="Level" hint="Defaults to class level if blank.">
              <input
                type="text"
                value={form.level}
                onChange={(e) => updateForm('level', e.target.value)}
                placeholder="e.g. primary_3"
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-1 outline-none focus:border-gold-400"
              />
            </Field>
          </div>

          {/* Passport photograph — optional. Compressed client-side before
              upload to keep the request small on Nigerian mobile networks. */}
          <Field label="Passport photograph" hint="JPEG, PNG, or HEIC. Compressed automatically.">
            <div className="flex items-center gap-s-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt=""
                  className="w-[72px] h-[72px] rounded-r-2 object-cover bg-surface-3 border border-line-2"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-r-2 bg-surface-3 border border-line-2 grid place-items-center text-ink-3 text-[10px] font-mono uppercase">
                  No photo
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setPhotoPreview(ev.target.result);
                      reader.readAsDataURL(file);
                    } else {
                      setPhotoPreview(null);
                    }
                  }}
                  className="block text-[13px] text-ink-2 file:mr-s-3 file:px-s-4 file:py-s-2 file:rounded-r-2 file:border-0 file:bg-surface-3 file:text-ink-1 file:text-[13px] file:cursor-pointer hover:file:bg-line-1"
                />
                {photoFile && (
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="text-[11.5px] text-ink-3 hover:text-red-400 mt-s-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Field>

          {/* Parent details section — collapsed by default so admins doing
              fast roster entry without parent info aren't slowed down. */}
          {!parentOpen ? (
            <button
              type="button"
              onClick={() => setParentOpen(true)}
              className="text-left text-[13.5px] text-gold-200 hover:text-gold-50 underline-offset-4 hover:underline pt-s-2"
            >
              + Add parent contact (optional)
            </button>
          ) : (
            <ParentSection
              parent={parent}
              update={updateParent}
              onRemove={() => setParentOpen(false)}
            />
          )}

          {submit.error && (
            <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
              {submit.error.message}
            </div>
          )}

          <div className="flex justify-end gap-s-3 pt-s-2">
            <Button
              intent="primary"
              size="lg"
              type="submit"
              isLoading={submit.isPending}
            >
              {parentOpen ? 'Add pupil & invite parent' : 'Add pupil'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ParentSection({ parent, update, onRemove }) {
  return (
    <div className="border border-line-2 rounded-r-2 p-s-5 bg-surface-3/40">
      <div className="flex items-center justify-between mb-s-4">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Parent details</div>
        <button
          type="button"
          onClick={onRemove}
          className="text-[12px] text-ink-3 hover:text-red-400"
        >
          Remove
        </button>
      </div>

      <div className="flex flex-col gap-s-4">
        <Field label="Parent's full name *">
          <input
            type="text" value={parent.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            autoComplete="off"
            placeholder="e.g. Mrs Okafor"
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-s-4">
          <Field label="Email *" hint="If they already have an account here, we'll just link.">
            <input
              type="email" value={parent.email}
              onChange={(e) => update('email', e.target.value.trim().toLowerCase())}
              autoComplete="off"
              className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
            />
          </Field>
          <Field label="Phone" hint="For WhatsApp engagement (v1.1).">
            <input
              type="tel" value={parent.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+234…"
              autoComplete="off"
              className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] text-ink-1 outline-none focus:border-gold-400"
            />
          </Field>
        </div>

        <Field label="How should they get access? *">
          <div className="flex flex-col gap-s-2 mt-s-1">
            <ModeRadio
              checked={parent.mode === 'invite'}
              onChange={() => update('mode', 'invite')}
              title="Send invite email"
              hint="They get a magic-link and set their own password."
            />
            <ModeRadio
              checked={parent.mode === 'password'}
              onChange={() => update('mode', 'password')}
              title="Set a temporary password"
              hint="You type a password; share with them in person."
            />
          </div>
        </Field>

        {parent.mode === 'password' && (
          <Field label="Temporary password *" hint="At least 8 characters.">
            <input
              type="text"
              value={parent.temporary_password}
              onChange={(e) => update('temporary_password', e.target.value)}
              minLength={8}
              placeholder="At least 8 characters"
              className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14.5px] font-mono text-ink-1 outline-none focus:border-gold-400"
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function ResultBanner({ result, onDismiss }) {
  const { pupil, parentResult, parentError } = result;
  return (
    <Card className="mb-s-5 border-green-400/30 bg-green-400/[0.04]">
      <div className="flex items-center gap-s-3 mb-s-3">
        <Chip variant="green" dot>Pupil added</Chip>
        <span className="text-[13.5px] text-ink-1">
          <span className="font-semibold">{pupil.full_name}</span>
          <span className="font-mono text-meta text-ink-3 ml-s-2">{pupil.pupil_code}</span>
        </span>
      </div>

      {parentResult && (
        <div className="text-[12.5px] text-ink-2 ml-s-1">
          {parentResult.was_existing
            ? '↳ Parent already had an account — linked to this pupil.'
            : '↳ Parent invited.'}
          {parentResult.temporary_password && (
            <div className="mt-s-3 bg-surface-3 border border-line-2 rounded-r-2 p-s-3 max-w-fit">
              <div className="font-mono text-eyebrow uppercase text-gold-400 text-[10px]">Parent's temp password</div>
              <div className="font-mono text-[13px] text-ink-0 select-all mt-s-1">{parentResult.temporary_password}</div>
              <div className="text-[11px] text-ink-3 mt-s-1">Won't be shown again.</div>
            </div>
          )}
        </div>
      )}

      {parentError && (
        <div className="text-[12.5px] text-amber-400 ml-s-1 mt-s-2">
          ⚠ Pupil saved, but parent invite failed: {parentError}. You can invite them later.
        </div>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="text-[12px] text-ink-3 hover:text-ink-1 mt-s-3"
      >
        Dismiss · ready for next pupil
      </button>
    </Card>
  );
}

function ModeRadio({ checked, onChange, title, hint }) {
  return (
    <label className={cn(
      'flex gap-s-3 items-start px-s-3 py-s-2 rounded-r-2 cursor-pointer transition-all duration-150',
      checked
        ? 'bg-gold-400/[0.08] border border-gold-400/30'
        : 'bg-surface-2 border border-line-2 hover:border-line-3',
    )}>
      <input
        type="radio" checked={checked} onChange={onChange}
        className="mt-s-1 accent-gold-400"
      />
      <div>
        <div className={cn('text-[13px]', checked ? 'text-ink-0' : 'text-ink-1')}>{title}</div>
        <div className="text-[11.5px] text-ink-3 mt-s-1">{hint}</div>
      </div>
    </label>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-3 italic">{hint}</span>}
    </label>
  );
}
