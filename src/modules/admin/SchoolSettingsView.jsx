/**
 * src/modules/admin/SchoolSettingsView.jsx
 *
 * /app/admin/settings
 *
 * School-level configuration for school_admin and head_teacher.
 *
 * SECTIONS
 * ────────
 * 1. School identity   — name, city, state, logo upload
 * 2. Attendance risk   — configurable threshold (default 80%)
 *                        below which a pupil is flagged "at risk"
 * 3. Term config       — display only (links to Terms view for locks)
 *
 * Logo upload: browser-side canvas compress → Supabase Storage
 * bucket `school-logos/{school_id}.jpg` → writes logo_url onto schools row.
 *
 * Risk threshold: stored in localStorage with key `tta:risk:${schoolId}`
 * so it's per-school-per-device. A proper DB column can be added in v1.2
 * once the schema is stable; for now localStorage is the pragmatic choice
 * since only school admins/head teachers see these settings.
 */

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/utils/friendlyError';
import { cn } from '@/utils/cn';

const BUCKET = 'school-logos';
const MAX_DIM = 400;
const JPEG_Q  = 0.82;

// ── Image compression (same pattern as photoUploadService) ────────────────────

async function compressLogo(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/jpeg', JPEG_Q);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function SchoolSettingsView() {
  const { schoolId, schoolName } = useAuth();
  const qc = useQueryClient();

  // ── Fetch current school row ──────────────────────────────────────────────
  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, city, state, country, phone, logo_url, status')
        .eq('id', schoolId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  return (
    <div className="max-w-[760px] space-y-s-6">
      <div>
        <div className="font-mono text-eyebrow uppercase text-gold-400">School settings</div>
        <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
          {schoolName ?? 'Your school'}.
        </h2>
      </div>

      <SchoolIdentityCard school={school} schoolId={schoolId} qc={qc} />
      <RiskThresholdCard schoolId={schoolId} />
      <TermLinksCard />
    </div>
  );
}

// ── School identity card ──────────────────────────────────────────────────────

function SchoolIdentityCard({ school, schoolId, qc }) {
  const [form, setForm] = useState(null); // null = read mode
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const editing = form !== null;

  function startEdit() {
    setForm({
      name:    school?.name    ?? '',
      city:    school?.city    ?? '',
      state:   school?.state   ?? '',
      country: school?.country ?? 'Nigeria',
      phone:   school?.phone   ?? '',
    });
    setSaveError('');
  }

  function cancelEdit() {
    setForm(null);
    setLogoPreview(null);
    setLogoFile(null);
  }

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Logo must be under 5 MB.');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('School name is required.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      let logo_url = school?.logo_url;

      // Upload logo if changed
      if (logoFile) {
        setUploading(true);
        const blob = await compressLogo(logoFile);
        const path = `${schoolId}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
        if (upErr) throw new Error(`Logo upload failed: ${upErr.message}`);
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
        logo_url = publicUrl + `?v=${Date.now()}`; // bust CDN cache
        setUploading(false);
      }

      const { error } = await supabase
        .from('schools')
        .update({
          name:      form.name.trim(),
          city:      form.city.trim()    || null,
          state:     form.state.trim()   || null,
          country:   form.country.trim() || 'Nigeria',
          phone:     form.phone.trim()   || null,
          logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schoolId);

      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ['school', schoolId] });
      setForm(null);
      setLogoPreview(null);
      setLogoFile(null);
    } catch (err) {
      setSaveError(friendlyError(err));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  const logoSrc = logoPreview ?? school?.logo_url;

  return (
    <Card className="bg-surface-2">
      <div className="flex items-start justify-between mb-s-5">
        <div className="font-mono text-eyebrow uppercase text-gold-400">School identity</div>
        {!editing && (
          <Button intent="ghost" size="sm" onClick={startEdit}>Edit</Button>
        )}
      </div>

      {/* Logo */}
      <div className="flex items-center gap-s-5 mb-s-5">
        <div
          className={cn(
            'w-[72px] h-[72px] rounded-r-2 border-2 border-line-2 overflow-hidden',
            'bg-surface-3 grid place-items-center shrink-0',
            editing && 'cursor-pointer hover:border-gold-400/60 transition-colors',
          )}
          onClick={() => editing && fileRef.current?.click()}
          title={editing ? 'Click to change logo' : undefined}
        >
          {logoSrc
            ? <img src={logoSrc} alt="School logo" className="w-full h-full object-cover" />
            : <span className="font-display text-[28px] text-ink-3">
                {school?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
          }
        </div>
        {editing && (
          <div>
            <Button intent="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : (logoFile ? 'Change logo' : 'Upload logo')}
            </Button>
            <p className="font-mono text-[11px] text-ink-4 mt-s-1">
              JPG or PNG · max 5 MB · auto-compressed to 400×400
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onLogoChange}
            />
          </div>
        )}
      </div>

      {/* Fields */}
      {!editing ? (
        <div className="grid sm:grid-cols-2 gap-x-s-6 gap-y-s-3 text-[14px]">
          {[
            ['Name',    school?.name],
            ['City',    school?.city],
            ['State',   school?.state],
            ['Country', school?.country],
            ['Phone',   school?.phone],
          ].map(([label, val]) => val ? (
            <div key={label}>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 mb-[2px]">{label}</div>
              <div className="text-ink-1">{val}</div>
            </div>
          ) : null)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-s-4">
          {[
            ['Name *',   'name',    'text', 'Greenfield Academy'],
            ['City',     'city',    'text', 'Lagos'],
            ['State',    'state',   'text', 'Lagos State'],
            ['Country',  'country', 'text', 'Nigeria'],
            ['Phone',    'phone',   'tel',  '+234 1 234 5678'],
          ].map(([label, key, type, ph]) => (
            <label key={key} className="flex flex-col gap-s-1">
              <span className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3">{label}</span>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={ph}
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 transition-colors"
              />
            </label>
          ))}
        </div>
      )}

      {/* Actions */}
      {editing && (
        <div className="flex items-center justify-end gap-s-3 mt-s-5 pt-s-4 border-t border-line-1">
          {saveError && (
            <p className="text-[12px] text-red-400 mr-auto">{saveError}</p>
          )}
          <Button intent="ghost" onClick={cancelEdit} disabled={saving}>Cancel</Button>
          <Button intent="primary" onClick={handleSave} isLoading={saving}>
            Save changes
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Risk threshold card ────────────────────────────────────────────────────────

function RiskThresholdCard({ schoolId }) {
  const storageKey = `tta:risk:${schoolId}`;
  const stored = parseInt(localStorage.getItem(storageKey) ?? '80', 10);
  const [threshold, setThreshold] = useState(stored);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const v = Math.min(100, Math.max(1, threshold));
    setThreshold(v);
    localStorage.setItem(storageKey, String(v));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card className="bg-surface-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">
        Attendance risk threshold
      </div>
      <p className="text-[13px] text-ink-2 mb-s-5 max-w-[52ch]">
        Pupils with attendance below this percentage are flagged as "at risk" on the
        Overview dashboard and Interventions view. Default is 80%.
      </p>
      <div className="flex items-center gap-s-5 flex-wrap">
        <div className="flex items-center gap-s-3">
          <input
            type="range"
            min={50} max={95} step={5}
            value={threshold}
            onChange={(e) => { setThreshold(Number(e.target.value)); setSaved(false); }}
            className="w-[200px] accent-gold-400"
          />
          <div className="flex items-center gap-s-2">
            <input
              type="number"
              min={1} max={100}
              value={threshold}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) { setThreshold(v); setSaved(false); }
              }}
              className="w-[64px] bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[15px] font-mono text-ink-0 text-center outline-none focus:border-gold-400"
            />
            <span className="text-[15px] text-ink-2">%</span>
          </div>
        </div>
        <div className="flex items-center gap-s-3">
          <Button intent="primary" size="sm" onClick={handleSave}>
            Save threshold
          </Button>
          {saved && (
            <span className="font-mono text-[12px] text-green-400">✓ Saved</span>
          )}
        </div>
      </div>
      <p className="mt-s-4 font-mono text-[11px] text-ink-4">
        Stored locally in this browser. All staff on this device see the same threshold.
      </p>
    </Card>
  );
}

// ── Term links card ────────────────────────────────────────────────────────────

function TermLinksCard() {
  return (
    <Card className="bg-surface-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">
        Term configuration
      </div>
      <p className="text-[13px] text-ink-2 mb-s-4">
        Lock terms, approve reports, and manage the academic calendar.
      </p>
      <a
        href="/app/admin/terms"
        className="inline-flex items-center gap-s-2 text-[13px] text-gold-200 hover:text-gold-50"
      >
        Go to Terms &amp; locks →
      </a>
    </Card>
  );
}
