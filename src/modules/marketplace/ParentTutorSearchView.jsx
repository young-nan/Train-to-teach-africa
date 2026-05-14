/**
 * src/modules/marketplace/ParentTutorSearchView.jsx
 *
 * Parent-facing tutor search and booking flow. Three internal screens:
 *
 *   'search'  → filter panel + tutor cards
 *   'profile' → selected tutor detail + availability
 *   'book'    → session configuration form
 *
 * Matched to the existing design system:
 *   AppShell / Card / Button / Chip from the codebase.
 *   Tailwind tokens from the TTA design system (surface-2, ink-0, gold-400, etc.)
 */

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import { useTutorSearch, useBooking } from '@/hooks/useBooking';
import { formatPrice } from '@/services/tiersService';

const PARENT_NAV = [
  { to: '/app/parent',           label: 'Tonight',  end: true },
  { to: '/app/parent/children',  label: 'Children' },
  { to: '/app/parent/lessons',   label: 'Lessons' },
  { to: '/app/parent/reports',   label: 'Reports' },
  { to: '/app/parent/tutors',    label: 'Tutors' },
  { to: '/app/parent/subscribe', label: 'Subscribe' },
];

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science', 'Social Studies',
  'Yoruba', 'Igbo', 'Hausa', 'French', 'Computer Studies', 'Agricultural Science',
  'Physics', 'Chemistry', 'Biology', 'Economics', 'Government',
];

const CURRICULA = ['NERDC', 'Cambridge', 'IB', 'WAEC', 'NECO'];

const DURATIONS = [
  { label: '1 hour',       value: 60  },
  { label: '1.5 hours',    value: 90  },
  { label: '2 hours',      value: 120 },
];

// ── Root component ────────────────────────────────────────────────────────────

export function ParentTutorSearchView() {
  const [screen, setScreen]         = useState('search'); // 'search' | 'profile' | 'book'
  const [selectedTutor, setSelected] = useState(null);
  const { profile } = useAuth();

  function handleSelectTutor(tutor) {
    setSelected(tutor);
    setScreen('profile');
  }

  function handleBookNow() {
    setScreen('book');
  }

  function handleBack() {
    if (screen === 'book')    return setScreen('profile');
    if (screen === 'profile') return setScreen('search');
  }

  return (
    <AppShell title="Find a Tutor" navItems={PARENT_NAV}>
      <div className="max-w-[900px]">
        {screen === 'search'  && <SearchScreen onSelect={handleSelectTutor} />}
        {screen === 'profile' && (
          <TutorProfileScreen tutor={selectedTutor} onBack={handleBack} onBook={handleBookNow} />
        )}
        {screen === 'book' && (
          <BookingScreen
            tutor={selectedTutor}
            parentEmail={profile?.email}
            onBack={handleBack}
          />
        )}
      </div>
    </AppShell>
  );
}

// ── Search screen ─────────────────────────────────────────────────────────────

function SearchScreen({ onSelect }) {
  const { results, filters, loading, error, updateFilter, clearFilters, setPage } = useTutorSearch();

  return (
    <div>
      {/* Header */}
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Tutor Marketplace</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Find the right <span className="ital-gold">tutor.</span>
        </h2>
        <p className="mt-s-3 text-body-l text-ink-2 max-w-[55ch]">
          Every tutor is vetted by our team. For in-person sessions, a guarantor is
          verified before the tutor goes live.
        </p>
      </div>

      {/* Filter bar */}
      <Card className="bg-surface-2 border-line-2 mb-s-6 p-s-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-s-4">
          <FilterSelect
            label="Subject"
            value={filters.subject ?? ''}
            options={SUBJECTS}
            onChange={(v) => updateFilter('subject', v)}
          />
          <FilterSelect
            label="Curriculum"
            value={filters.curriculum ?? ''}
            options={CURRICULA}
            onChange={(v) => updateFilter('curriculum', v)}
          />
          <div>
            <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">Mode</label>
            <select
              className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 focus:border-gold-400 outline-none"
              value={filters.mode ?? ''}
              onChange={(e) => updateFilter('mode', e.target.value)}
            >
              <option value="">Any</option>
              <option value="online">Online only</option>
              <option value="offline">In-person only</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">City</label>
            <input
              className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none"
              placeholder="Lagos, Abuja…"
              value={filters.city ?? ''}
              onChange={(e) => updateFilter('city', e.target.value)}
            />
          </div>
        </div>
        {Object.values(filters).some(Boolean) && (
          <button
            className="mt-s-4 font-mono text-meta text-ink-3 hover:text-gold-400 transition-colors"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </Card>

      {/* Results */}
      {loading && <LoadingGrid />}

      {error && (
        <Card className="bg-surface-2 border-red-500/30">
          <p className="text-body text-red-400">{error}</p>
        </Card>
      )}

      {!loading && !error && results.tutors.length === 0 && (
        <Card className="bg-surface-2 border-line-2">
          <p className="text-body text-ink-2">
            No tutors found for your filters. Try broadening your search.
          </p>
        </Card>
      )}

      {!loading && results.tutors.length > 0 && (
        <>
          <div className="mb-s-4 font-mono text-meta text-ink-3">
            {results.totalCount} tutor{results.totalCount !== 1 ? 's' : ''} found
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4">
            {results.tutors.map((tutor) => (
              <TutorCard key={tutor.tutor_id} tutor={tutor} onClick={() => onSelect(tutor)} />
            ))}
          </div>

          {results.totalPages > 1 && (
            <div className="mt-s-7 flex gap-s-3">
              {Array.from({ length: results.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`w-9 h-9 rounded-full font-mono text-meta transition-colors ${
                    p === results.page
                      ? 'bg-gold-400 text-ink-0'
                      : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
                  }`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tutor card ────────────────────────────────────────────────────────────────

function TutorCard({ tutor, onClick }) {
  const subjects = (tutor.subjects ?? []).slice(0, 3);

  return (
    <Card
      className="bg-surface-2 border-line-2 hover:border-gold-400/40 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex gap-s-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-surface-3 border border-line-2 flex-shrink-0 overflow-hidden">
          {tutor.photo_url
            ? <img src={tutor.photo_url} alt={tutor.full_name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center font-display text-xl text-gold-400">
                {tutor.full_name?.charAt(0) ?? '?'}
              </div>
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-s-3">
            <h3 className="font-display text-[18px] text-ink-0 leading-tight truncate group-hover:text-gold-400 transition-colors">
              {tutor.full_name}
            </h3>
            {tutor.rating_avg && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-gold-400">★</span>
                <span className="font-mono text-meta text-ink-1">
                  {Number(tutor.rating_avg).toFixed(1)}
                </span>
                <span className="font-mono text-meta text-ink-3">({tutor.rating_count})</span>
              </div>
            )}
          </div>

          <div className="mt-s-1 font-mono text-meta text-ink-3">
            {tutor.city}, {tutor.state}
            {tutor.years_experience > 0 && ` · ${tutor.years_experience}y exp`}
          </div>

          <div className="mt-s-3 flex flex-wrap gap-s-2">
            {subjects.map((s) => (
              <Chip key={`${s.subject}-${s.curriculum}`} variant="default" size="sm">
                {s.subject}
              </Chip>
            ))}
            {(tutor.subjects?.length ?? 0) > 3 && (
              <Chip variant="default" size="sm">+{tutor.subjects.length - 3}</Chip>
            )}
          </div>
        </div>
      </div>

      <div className="mt-s-4 flex items-center justify-between">
        <div>
          <span className="font-display text-[20px] text-ink-0">
            {tutor.currency === 'NGN' ? '₦' : '$'}
            {formatPrice(tutor.hourly_rate_minor, tutor.currency)}
          </span>
          <span className="font-mono text-meta text-ink-3 ml-s-1">/hr</span>
        </div>
        <div className="flex gap-s-2">
          {tutor.teaches_online  && <Chip variant="gold"    size="sm">Online</Chip>}
          {tutor.teaches_offline && <Chip variant="default" size="sm">In-person</Chip>}
        </div>
      </div>
    </Card>
  );
}

// ── Tutor profile screen ──────────────────────────────────────────────────────

function TutorProfileScreen({ tutor, onBack, onBook }) {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <button
        className="mb-s-6 font-mono text-meta text-ink-3 hover:text-gold-400 transition-colors flex items-center gap-s-2"
        onClick={onBack}
      >
        ← Back to search
      </button>

      <div className="grid md:grid-cols-3 gap-s-6">
        {/* Main column */}
        <div className="md:col-span-2 space-y-s-5">
          {/* Identity */}
          <Card className="bg-surface-2 border-line-2">
            <div className="flex gap-s-5">
              <div className="w-20 h-20 rounded-full bg-surface-3 border border-line-2 flex-shrink-0 overflow-hidden">
                {tutor.photo_url
                  ? <img src={tutor.photo_url} alt={tutor.full_name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-display text-3xl text-gold-400">
                      {tutor.full_name?.charAt(0)}
                    </div>
                }
              </div>
              <div>
                <h2 className="font-display text-display-3 text-ink-0">{tutor.full_name}</h2>
                <div className="mt-s-1 font-mono text-meta text-ink-3">
                  {tutor.city}, {tutor.state}
                  {tutor.years_experience > 0 && ` · ${tutor.years_experience} years experience`}
                </div>
                {tutor.rating_avg && (
                  <div className="mt-s-2 flex items-center gap-s-2">
                    <span className="text-gold-400">{'★'.repeat(Math.round(tutor.rating_avg))}</span>
                    <span className="font-mono text-meta text-ink-2">
                      {Number(tutor.rating_avg).toFixed(1)} ({tutor.rating_count} review{tutor.rating_count !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}
              </div>
            </div>
            {tutor.bio && (
              <p className="mt-s-5 text-body text-ink-1 leading-relaxed">{tutor.bio}</p>
            )}
          </Card>

          {/* Subjects */}
          {tutor.tutor_subjects?.length > 0 && (
            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Subjects</div>
              <div className="space-y-s-2">
                {tutor.tutor_subjects.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-body text-ink-1">{s.subject}</span>
                    <div className="flex gap-s-2">
                      <Chip variant="default" size="sm">{s.curriculum}</Chip>
                      {s.level && <Chip variant="default" size="sm">{s.level}</Chip>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Reviews */}
          {tutor.booking_reviews?.length > 0 && (
            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Reviews</div>
              <div className="space-y-s-4">
                {tutor.booking_reviews.slice(0, 5).map((r, i) => (
                  <div key={i} className="border-b border-line-2 last:border-0 pb-s-4 last:pb-0">
                    <div className="flex items-center gap-s-2 mb-s-2">
                      <span className="text-gold-400">{'★'.repeat(r.rating)}</span>
                      <span className="font-mono text-meta text-ink-3">
                        {new Date(r.created_at).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {r.comment && <p className="text-body text-ink-1">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-s-5">
          {/* Booking CTA */}
          <Card className="bg-surface-2 border-gold-400/30">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Rate</div>
            <div className="font-display text-display-3 text-ink-0">
              {tutor.currency === 'NGN' ? '₦' : '$'}{formatPrice(tutor.hourly_rate_minor, tutor.currency)}
              <span className="font-mono text-body text-ink-3 ml-s-1">/hr</span>
            </div>
            <div className="mt-s-3 flex gap-s-2">
              {tutor.teaches_online  && <Chip variant="gold">Online</Chip>}
              {tutor.teaches_offline && <Chip variant="default">In-person</Chip>}
            </div>
            <Button intent="primary" className="mt-s-5 w-full" onClick={onBook}>
              Book a session
            </Button>
          </Card>

          {/* Availability */}
          {tutor.tutor_availability?.length > 0 && (
            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Availability</div>
              <div className="space-y-s-2">
                {tutor.tutor_availability
                  .sort((a, b) => a.day_of_week - b.day_of_week)
                  .map((slot, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="font-mono text-meta text-ink-2 w-10">{DAY_NAMES[slot.day_of_week]}</span>
                      <span className="text-body text-ink-1">{slot.start_time.slice(0,5)} – {slot.end_time.slice(0,5)}</span>
                      <Chip variant={slot.mode === 'online' ? 'gold' : 'default'} size="sm">
                        {slot.mode === 'both' ? 'Any' : slot.mode}
                      </Chip>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Booking screen ────────────────────────────────────────────────────────────

function BookingScreen({ tutor, parentEmail, onBack }) {
  const { createAndPay } = useBooking();

  const [subject,   setSubject]   = useState(tutor.tutor_subjects?.[0]?.subject ?? '');
  const [mode,      setMode]      = useState(tutor.teaches_online ? 'online' : 'offline');
  const [date,      setDate]      = useState('');
  const [time,      setTime]      = useState('');
  const [duration,  setDuration]  = useState(60);
  const [notes,     setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState(null);

  const total = Math.round(tutor.hourly_rate_minor * (duration / 60));

  async function handleSubmit() {
    if (!date || !time || !subject) {
      setError('Please fill in the date, time, and subject.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { authorization_url } = await createAndPay({
        tutor,
        subject,
        sessionType:      mode,
        sessionDate:      date,
        startTime:        time,
        durationMinutes:  duration,
        notesForTutor:    notes || null,
        customerEmail:    parentEmail,
      });
      // Redirect to Paystack.
      window.location.href = authorization_url;
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        className="mb-s-6 font-mono text-meta text-ink-3 hover:text-gold-400 transition-colors flex items-center gap-s-2"
        onClick={onBack}
      >
        ← Back to {tutor.full_name}
      </button>

      <div className="grid md:grid-cols-3 gap-s-6">
        <div className="md:col-span-2">
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-6">Configure session</div>

            <div className="space-y-s-5">
              {/* Subject */}
              <div>
                <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">Subject</label>
                <select
                  className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {tutor.tutor_subjects?.map((s) => (
                    <option key={`${s.subject}-${s.curriculum}`} value={s.subject}>
                      {s.subject} ({s.curriculum})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode */}
              {tutor.teaches_online && tutor.teaches_offline && (
                <div>
                  <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">Session type</label>
                  <div className="flex gap-s-3">
                    {['online', 'offline'].map((m) => (
                      <button
                        key={m}
                        className={`flex-1 py-s-3 rounded-r-1 border font-mono text-meta capitalize transition-colors ${
                          mode === m
                            ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                            : 'bg-surface-3 border-line-2 text-ink-2 hover:border-line-1'
                        }`}
                        onClick={() => setMode(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-s-4">
                <div>
                  <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">Start time</label>
                  <input
                    type="time"
                    className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">Duration</label>
                <div className="flex gap-s-3">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      className={`flex-1 py-s-3 rounded-r-1 border font-mono text-meta transition-colors ${
                        duration === d.value
                          ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                          : 'bg-surface-3 border-line-2 text-ink-2 hover:border-line-1'
                      }`}
                      onClick={() => setDuration(d.value)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">
                  Notes for tutor <span className="normal-case text-ink-3">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none resize-none"
                  placeholder="Topics to focus on, child's current level, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="mt-s-4 p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
                <p className="text-body text-red-400">{error}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Order summary */}
        <div>
          <Card className="bg-surface-2 border-gold-400/30">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">Order summary</div>

            <div className="space-y-s-3 text-body text-ink-1">
              <div className="flex justify-between">
                <span>Tutor</span>
                <span className="text-ink-0">{tutor.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Subject</span>
                <span className="text-ink-0">{subject || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="text-ink-0">{DURATIONS.find((d) => d.value === duration)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span>Rate</span>
                <span className="text-ink-0">
                  {tutor.currency === 'NGN' ? '₦' : '$'}{formatPrice(tutor.hourly_rate_minor, tutor.currency)}/hr
                </span>
              </div>
            </div>

            <div className="mt-s-5 pt-s-5 border-t border-line-2 flex justify-between">
              <span className="font-display text-[18px] text-ink-0">Total</span>
              <span className="font-display text-[22px] text-ink-0">
                {tutor.currency === 'NGN' ? '₦' : '$'}{formatPrice(total, tutor.currency)}
              </span>
            </div>

            <p className="mt-s-3 font-mono text-meta text-ink-3 leading-relaxed">
              Payment is held securely by TTA. Released to the tutor after session completion.
            </p>

            <Button
              intent="primary"
              className="mt-s-5 w-full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Redirecting to payment…' : 'Proceed to payment'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FilterSelect({ label, value, options, onChange }) {
  return (
    <div>
      <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">{label}</label>
      <select
        className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-body text-ink-0 focus:border-gold-400 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Any</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4">
      {[1,2,3,4].map((i) => (
        <div key={i} className="h-40 rounded-r-2 bg-surface-2 border border-line-2 animate-pulse" />
      ))}
    </div>
  );
}
