/**
 * src/modules/marketplace/TutorProfileView.jsx
 *
 * Tutor's own dashboard. Tabs:
 *
 *   Profile     → bio, qualifications, hourly rate, photo
 *   Subjects    → subject/curriculum tags
 *   Availability → weekly schedule
 *   Guarantor   → offline-safety contact (required for in-person sessions)
 *   Bookings    → upcoming + past sessions, confirm action
 *   Earnings    → monthly payout summary
 *
 * Shown at /app/tutor/* — requires role = 'tutor' or 'super_admin'.
 * During the onboarding phase (approval_status = 'pending'), the
 * header shows a status banner instead of the full dashboard.
 */

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import * as tutorService from '@/services/tutorService';
import { formatPrice } from '@/services/tiersService';

const TUTOR_NAV = [
  { to: '/app/tutor',           label: 'Dashboard', end: true },
  { to: '/app/tutor/bookings',  label: 'Bookings'  },
  { to: '/app/tutor/earnings',  label: 'Earnings'  },
  { to: '/app/tutor/profile',   label: 'Profile'   },
];

const SUBJECTS_LIST = [
  'Mathematics', 'English Language', 'Basic Science', 'Social Studies',
  'Yoruba', 'Igbo', 'Hausa', 'French', 'Computer Studies',
  'Agricultural Science', 'Physics', 'Chemistry', 'Biology',
  'Economics', 'Government', 'Literature in English',
];
const CURRICULA_LIST = ['NERDC', 'Cambridge', 'IB', 'WAEC', 'NECO', 'Common Entrance'];
const LEVELS_LIST    = ['Pre-primary', 'Primary', 'JSS', 'SSS', 'A-Level'];
const DAYS           = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Root ──────────────────────────────────────────────────────────────────────

export function TutorProfileView() {
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('profile');

  useEffect(() => {
    tutorService.getMyTutorProfile()
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell title="Tutor Dashboard" navItems={TUTOR_NAV}>
        <div className="space-y-s-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-24 rounded-r-2 bg-surface-2 border border-line-2 animate-pulse" />
          ))}
        </div>
      </AppShell>
    );
  }

  // First-time setup — tutor hasn't created their profile yet.
  if (!profile) {
    return (
      <AppShell title="Tutor Dashboard" navItems={TUTOR_NAV}>
        <OnboardingPrompt onCreated={setProfile} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Tutor Dashboard" navItems={TUTOR_NAV}>
      <div className="max-w-[860px]">
        {/* Approval status banner */}
        <ApprovalBanner status={profile.approval_status} reason={profile.rejection_reason} />

        {/* Tab bar */}
        <div className="flex gap-s-1 mb-s-7 border-b border-line-2">
          {[
            { key: 'profile',      label: 'Profile'      },
            { key: 'subjects',     label: 'Subjects'     },
            { key: 'availability', label: 'Availability' },
            { key: 'guarantor',    label: 'Guarantor'    },
            { key: 'bookings',     label: 'Bookings'     },
            { key: 'earnings',     label: 'Earnings'     },
          ].map((t) => (
            <button
              key={t.key}
              className={`px-s-4 py-s-3 font-mono text-meta border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-gold-400 text-gold-400'
                  : 'border-transparent text-ink-3 hover:text-ink-1'
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile'      && <ProfileTab      profile={profile} onSaved={setProfile} />}
        {tab === 'subjects'     && <SubjectsTab     profile={profile} />}
        {tab === 'availability' && <AvailabilityTab profile={profile} />}
        {tab === 'guarantor'    && <GuarantorTab    profile={profile} />}
        {tab === 'bookings'     && <BookingsTab />}
        {tab === 'earnings'     && <EarningsTab />}
      </div>
    </AppShell>
  );
}

// ── Approval banner ───────────────────────────────────────────────────────────

function ApprovalBanner({ status, reason }) {
  if (status === 'approved') return null;

  const configs = {
    pending: {
      color: 'border-gold-400/40 bg-gold-400/5',
      text:  'Your profile is under review. You will be notified once approved.',
    },
    rejected: {
      color: 'border-red-500/40 bg-red-500/5',
      text:  `Your application was not approved: ${reason ?? 'Contact support for details.'}`,
    },
    suspended: {
      color: 'border-red-500/40 bg-red-500/5',
      text:  'Your profile has been suspended. Contact support.',
    },
  };

  const cfg = configs[status];
  if (!cfg) return null;

  return (
    <div className={`mb-s-6 p-s-4 rounded-r-2 border ${cfg.color}`}>
      <p className="text-body text-ink-1">{cfg.text}</p>
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab({ profile, onSaved }) {
  const [form, setForm] = useState({
    full_name:             profile.full_name ?? '',
    bio:                   profile.bio ?? '',
    city:                  profile.city ?? '',
    state:                 profile.state ?? '',
    highest_qualification: profile.highest_qualification ?? '',
    years_experience:      profile.years_experience ?? 0,
    ncce_registered:       profile.ncce_registered ?? false,
    teaches_online:        profile.teaches_online ?? true,
    teaches_offline:       profile.teaches_offline ?? false,
    hourly_rate_minor:     profile.hourly_rate_minor ?? 0,
    currency:              profile.currency ?? 'NGN',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState(null);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await tutorService.updateMyTutorProfile(form);
      onSaved(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="space-y-s-5">
        <Field label="Full name">
          <TextInput value={form.full_name} onChange={(v) => set('full_name', v)} />
        </Field>

        <div className="grid grid-cols-2 gap-s-4">
          <Field label="City">
            <TextInput value={form.city} onChange={(v) => set('city', v)} placeholder="Lagos" />
          </Field>
          <Field label="State">
            <TextInput value={form.state} onChange={(v) => set('state', v)} placeholder="Lagos State" />
          </Field>
        </div>

        <Field label="Bio">
          <textarea
            rows={4}
            className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none resize-none"
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="Tell parents about your teaching approach and experience."
          />
        </Field>

        <div className="grid grid-cols-2 gap-s-4">
          <Field label="Highest qualification">
            <TextInput
              value={form.highest_qualification}
              onChange={(v) => set('highest_qualification', v)}
              placeholder="B.Ed Mathematics"
            />
          </Field>
          <Field label="Years of experience">
            <input
              type="number"
              min={0}
              max={50}
              className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={form.years_experience}
              onChange={(e) => set('years_experience', Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-s-4">
          <Field label={`Hourly rate (${form.currency === 'NGN' ? '₦' : '$'})`}>
            <input
              type="number"
              min={0}
              step={form.currency === 'NGN' ? 100 : 1}
              className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={form.hourly_rate_minor / (form.currency === 'NGN' ? 100 : 100)}
              onChange={(e) => set('hourly_rate_minor', Math.round(Number(e.target.value) * 100))}
            />
          </Field>
          <Field label="Currency">
            <select
              className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              <option value="NGN">NGN (₦)</option>
              <option value="USD">USD ($)</option>
            </select>
          </Field>
        </div>

        <div className="space-y-s-3">
          <Toggle
            label="I can teach online"
            checked={form.teaches_online}
            onChange={(v) => set('teaches_online', v)}
          />
          <Toggle
            label="I can teach in-person"
            description="Requires a verified guarantor before going live."
            checked={form.teaches_offline}
            onChange={(v) => set('teaches_offline', v)}
          />
          <Toggle
            label="Registered with NCCE"
            checked={form.ncce_registered}
            onChange={(v) => set('ncce_registered', v)}
          />
        </div>

        {error && (
          <div className="p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
            <p className="text-body text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-s-4">
          <Button intent="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
          {saved && <span className="font-mono text-meta text-green-400">Saved ✓</span>}
        </div>
      </div>
    </Card>
  );
}

// ── Subjects tab ──────────────────────────────────────────────────────────────

function SubjectsTab({ profile }) {
  const [subjects, setSubjects] = useState(
    profile.tutor_subjects?.length > 0
      ? profile.tutor_subjects
      : [{ subject: '', curriculum: '', level: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState(null);

  function addRow() {
    setSubjects((prev) => [...prev, { subject: '', curriculum: '', level: '' }]);
  }

  function removeRow(i) {
    setSubjects((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i, key, value) {
    setSubjects((prev) => prev.map((row, idx) => idx === i ? { ...row, [key]: value } : row));
    setSaved(false);
  }

  async function handleSave() {
    const valid = subjects.filter((s) => s.subject && s.curriculum);
    if (valid.length === 0) return setError('Add at least one subject.');
    setSaving(true);
    setError(null);
    try {
      await tutorService.upsertSubjects(valid);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">Subjects you teach</div>

      <div className="space-y-s-3">
        {subjects.map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-s-3 items-center">
            <SelectInput
              value={row.subject}
              options={SUBJECTS_LIST}
              placeholder="Subject"
              onChange={(v) => updateRow(i, 'subject', v)}
            />
            <SelectInput
              value={row.curriculum}
              options={CURRICULA_LIST}
              placeholder="Curriculum"
              onChange={(v) => updateRow(i, 'curriculum', v)}
            />
            <div className="flex gap-s-2">
              <SelectInput
                value={row.level ?? ''}
                options={LEVELS_LIST}
                placeholder="Level (opt.)"
                onChange={(v) => updateRow(i, 'level', v)}
              />
              {subjects.length > 1 && (
                <button
                  className="text-ink-3 hover:text-red-400 transition-colors px-s-2"
                  onClick={() => removeRow(i)}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className="mt-s-4 font-mono text-meta text-gold-400 hover:underline"
        onClick={addRow}
      >
        + Add another subject
      </button>

      {error && (
        <div className="mt-s-4 p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
          <p className="text-body text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-s-5 flex items-center gap-s-4">
        <Button intent="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save subjects'}
        </Button>
        {saved && <span className="font-mono text-meta text-green-400">Saved ✓</span>}
      </div>
    </Card>
  );
}

// ── Availability tab ──────────────────────────────────────────────────────────

function AvailabilityTab({ profile }) {
  const [slots,  setSlots]  = useState(
    profile.tutor_availability?.length > 0
      ? profile.tutor_availability.map((s) => ({
          day_of_week: s.day_of_week,
          start_time:  s.start_time.slice(0, 5),
          end_time:    s.end_time.slice(0, 5),
          mode:        s.mode,
        }))
      : [],
  );
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState(null);

  function addSlot() {
    setSlots((prev) => [...prev, { day_of_week: 1, start_time: '09:00', end_time: '17:00', mode: 'both' }]);
    setSaved(false);
  }

  function removeSlot(i) {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function updateSlot(i, key, value) {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [key]: value } : s));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await tutorService.upsertAvailability(
        slots.map((s) => ({
          dayOfWeek:  s.day_of_week,
          startTime:  s.start_time,
          endTime:    s.end_time,
          mode:       s.mode,
        })),
      );
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">Weekly availability</div>
      <p className="text-body text-ink-2 mb-s-5">
        This shows parents when you're generally available. Bookings are for specific dates —
        this is a guide, not a hard schedule.
      </p>

      {slots.length === 0 && (
        <p className="text-body text-ink-3 mb-s-4">No availability set yet.</p>
      )}

      <div className="space-y-s-3">
        {slots.map((slot, i) => (
          <div key={i} className="grid grid-cols-4 gap-s-3 items-center">
            <select
              className="bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={slot.day_of_week}
              onChange={(e) => updateSlot(i, 'day_of_week', Number(e.target.value))}
            >
              {DAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
            </select>
            <input
              type="time"
              className="bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={slot.start_time}
              onChange={(e) => updateSlot(i, 'start_time', e.target.value)}
            />
            <input
              type="time"
              className="bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={slot.end_time}
              onChange={(e) => updateSlot(i, 'end_time', e.target.value)}
            />
            <div className="flex gap-s-2">
              <select
                className="flex-1 bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 focus:border-gold-400 outline-none"
                value={slot.mode}
                onChange={(e) => updateSlot(i, 'mode', e.target.value)}
              >
                <option value="both">Any</option>
                <option value="online">Online</option>
                <option value="offline">In-person</option>
              </select>
              <button
                className="text-ink-3 hover:text-red-400 transition-colors px-s-2"
                onClick={() => removeSlot(i)}
              >×</button>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-s-4 font-mono text-meta text-gold-400 hover:underline" onClick={addSlot}>
        + Add time slot
      </button>

      {error && (
        <div className="mt-s-4 p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
          <p className="text-body text-red-400">{error}</p>
        </div>
      )}
      <div className="mt-s-5 flex items-center gap-s-4">
        <Button intent="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save availability'}
        </Button>
        {saved && <span className="font-mono text-meta text-green-400">Saved ✓</span>}
      </div>
    </Card>
  );
}

// ── Guarantor tab ─────────────────────────────────────────────────────────────

function GuarantorTab({ profile }) {
  const existing = profile.guarantors?.[0];
  const [form, setForm] = useState({
    fullName:     existing?.full_name     ?? '',
    phone:        existing?.phone         ?? '',
    relationship: existing?.relationship  ?? '',
    address:      existing?.address       ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState(null);

  function set(key, value) { setForm((p) => ({ ...p, [key]: value })); setSaved(false); }

  async function handleSave() {
    if (!form.fullName || !form.phone || !form.relationship) {
      return setError('Name, phone, and relationship are required.');
    }
    setSaving(true); setError(null);
    try {
      await tutorService.submitGuarantor(form);
      setSaved(true);
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  }

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">Guarantor</div>
      <p className="text-body text-ink-2 mb-s-6 max-w-[60ch]">
        Required for in-person sessions. Our team will call your guarantor to verify the
        relationship before your profile goes live for offline bookings.
      </p>

      {existing?.verified && (
        <div className="mb-s-5 p-s-3 bg-green-500/10 border border-green-500/30 rounded-r-1">
          <p className="text-body text-green-400">✓ Guarantor verified by TTA</p>
          {existing.verification_note && (
            <p className="mt-s-1 font-mono text-meta text-ink-3">{existing.verification_note}</p>
          )}
        </div>
      )}

      <div className="space-y-s-4">
        <Field label="Full name">
          <TextInput value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="Chukwuemeka Obi" />
        </Field>
        <div className="grid grid-cols-2 gap-s-4">
          <Field label="Phone number">
            <TextInput value={form.phone} onChange={(v) => set('phone', v)} placeholder="+2348012345678" />
          </Field>
          <Field label="Relationship">
            <TextInput value={form.relationship} onChange={(v) => set('relationship', v)} placeholder="Spouse / Employer / Landlord" />
          </Field>
        </div>
        <Field label="Address (optional)">
          <TextInput value={form.address} onChange={(v) => set('address', v)} placeholder="12 Broad Street, Lagos Island" />
        </Field>
      </div>

      {error && (
        <div className="mt-s-4 p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
          <p className="text-body text-red-400">{error}</p>
        </div>
      )}
      <div className="mt-s-5 flex items-center gap-s-4">
        <Button intent="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Update guarantor' : 'Submit guarantor'}
        </Button>
        {saved && <span className="font-mono text-meta text-green-400">Submitted ✓ We'll be in touch.</span>}
      </div>
    </Card>
  );
}

// ── Bookings tab ──────────────────────────────────────────────────────────────

function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    tutorService.getMyUpcomingBookings()
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm(bookingId) {
    await tutorService.confirmBooking(bookingId);
    setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'confirmed' } : b));
  }

  if (loading) return <div className="h-24 rounded-r-2 bg-surface-2 animate-pulse" />;

  if (bookings.length === 0) {
    return (
      <Card className="bg-surface-2 border-line-2">
        <p className="text-body text-ink-2">No upcoming bookings.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-s-4">
      {bookings.map((b) => (
        <Card key={b.id} className="bg-surface-2 border-line-2">
          <div className="flex items-start justify-between gap-s-4">
            <div>
              <div className="font-display text-[18px] text-ink-0">{b.subject}</div>
              <div className="mt-s-1 font-mono text-meta text-ink-3">
                {new Date(b.session_date).toLocaleDateString('en-NG', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })} at {b.start_time?.slice(0, 5)} · {b.duration_minutes} min · {b.session_type}
              </div>
              {b.notes_for_tutor && (
                <p className="mt-s-2 text-body text-ink-2 italic">"{b.notes_for_tutor}"</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-s-2 flex-shrink-0">
              <StatusChip status={b.status} />
              {b.status === 'paid' && (
                <Button intent="primary" size="sm" onClick={() => handleConfirm(b.id)}>
                  Accept booking
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Earnings tab ──────────────────────────────────────────────────────────────

function EarningsTab() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tutorService.getEarningsSummary()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-48 rounded-r-2 bg-surface-2 animate-pulse" />;

  if (rows.length === 0) {
    return (
      <Card className="bg-surface-2 border-line-2">
        <p className="text-body text-ink-2">No earnings yet. Complete your first session to see payouts here.</p>
      </Card>
    );
  }

  const totalNet = rows.reduce((acc, r) => acc + Number(r.net_minor), 0);
  const currency = rows[0]?.currency ?? 'NGN';

  return (
    <div className="space-y-s-5">
      <Card className="bg-surface-2 border-gold-400/30">
        <div className="font-mono text-eyebrow uppercase text-gold-400">All-time earnings</div>
        <div className="mt-s-3 font-display text-display-2 text-ink-0">
          {currency === 'NGN' ? '₦' : '$'}{formatPrice(totalNet, currency)}
        </div>
        <div className="mt-s-1 font-mono text-meta text-ink-3">
          After TTA commission · {rows.reduce((a, r) => a + Number(r.session_count), 0)} sessions
        </div>
      </Card>

      <Card className="bg-surface-2 border-line-2">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Monthly breakdown</div>
        <div className="space-y-s-3">
          {rows.map((r) => (
            <div key={r.period} className="flex items-center justify-between border-b border-line-2 last:border-0 pb-s-3 last:pb-0">
              <div>
                <div className="text-body text-ink-0">
                  {new Date(r.period + '-01').toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
                </div>
                <div className="font-mono text-meta text-ink-3">{r.session_count} session{r.session_count !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-[18px] text-ink-0">
                  {currency === 'NGN' ? '₦' : '$'}{formatPrice(r.net_minor, currency)}
                </div>
                <div className="font-mono text-meta text-ink-3">
                  Gross: {currency === 'NGN' ? '₦' : '$'}{formatPrice(r.gross_minor, currency)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Onboarding prompt ─────────────────────────────────────────────────────────

function OnboardingPrompt({ onCreated }) {
  const [step,  setStep]  = useState(1); // 1 = basic info, 2 = rate
  const [form,  setForm]  = useState({
    fullName: '', bio: '', city: '', state: '',
    highestQualification: '', yearsExperience: 0,
    teachesOnline: true, teachesOffline: false,
    hourlyRateMinor: 500000, currency: 'NGN', // ₦5,000 default
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  function set(key, value) { setForm((p) => ({ ...p, [key]: value })); }

  async function handleCreate() {
    if (!form.fullName || !form.city || !form.state || !form.hourlyRateMinor) {
      return setError('Please fill in all required fields.');
    }
    setSaving(true); setError(null);
    try {
      const profile = await tutorService.createTutorProfile(form);
      onCreated(profile);
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  }

  return (
    <div className="max-w-[600px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Tutor Onboarding</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Create your <span className="ital-gold">tutor profile.</span>
        </h2>
        <p className="mt-s-3 text-body-l text-ink-2">
          Once submitted, our team reviews your application within 2 business days.
        </p>
      </div>

      <Card className="bg-surface-2 border-line-2">
        <div className="space-y-s-5">
          <Field label="Full name *">
            <TextInput value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="Adaeze Okafor" />
          </Field>
          <div className="grid grid-cols-2 gap-s-4">
            <Field label="City *">
              <TextInput value={form.city} onChange={(v) => set('city', v)} placeholder="Lagos" />
            </Field>
            <Field label="State *">
              <TextInput value={form.state} onChange={(v) => set('state', v)} placeholder="Lagos State" />
            </Field>
          </div>
          <Field label="Bio">
            <textarea rows={3} className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none resize-none"
              value={form.bio} onChange={(e) => set('bio', e.target.value)}
              placeholder="Your teaching philosophy, approach, and what makes you effective." />
          </Field>
          <div className="grid grid-cols-2 gap-s-4">
            <Field label="Hourly rate (₦) *">
              <input type="number" min={0} step={500}
                className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
                value={form.hourlyRateMinor / 100}
                onChange={(e) => set('hourlyRateMinor', Math.round(Number(e.target.value) * 100))} />
            </Field>
            <Field label="Years experience">
              <input type="number" min={0} max={50}
                className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
                value={form.yearsExperience}
                onChange={(e) => set('yearsExperience', Number(e.target.value))} />
            </Field>
          </div>
          <div className="space-y-s-3">
            <Toggle label="I can teach online" checked={form.teachesOnline} onChange={(v) => set('teachesOnline', v)} />
            <Toggle label="I can teach in-person" description="Requires a verified guarantor." checked={form.teachesOffline} onChange={(v) => set('teachesOffline', v)} />
          </div>
        </div>

        {error && (
          <div className="mt-s-4 p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
            <p className="text-body text-red-400">{error}</p>
          </div>
        )}

        <Button intent="primary" className="mt-s-6 w-full" onClick={handleCreate} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit application'}
        </Button>
      </Card>
    </div>
  );
}

// ── Small reusable primitives ─────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SelectInput({ value, options, placeholder, onChange }) {
  return (
    <select
      className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 focus:border-gold-400 outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-start gap-s-3">
      <button
        role="switch"
        aria-checked={checked}
        className={`mt-0.5 w-10 h-6 rounded-full border flex-shrink-0 transition-colors relative ${
          checked ? 'bg-gold-400 border-gold-400' : 'bg-surface-3 border-line-2'
        }`}
        onClick={() => onChange(!checked)}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
      <div>
        <div className="text-body text-ink-1">{label}</div>
        {description && <div className="font-mono text-meta text-ink-3 mt-s-1">{description}</div>}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    pending_payment: { label: 'Awaiting payment', variant: 'default' },
    paid:            { label: 'Needs acceptance',  variant: 'gold'    },
    confirmed:       { label: 'Confirmed',          variant: 'gold'    },
    completed:       { label: 'Completed',          variant: 'default' },
    cancelled:       { label: 'Cancelled',          variant: 'default' },
  };
  const cfg = map[status] ?? { label: status, variant: 'default' };
  return <Chip variant={cfg.variant} size="sm">{cfg.label}</Chip>;
}
