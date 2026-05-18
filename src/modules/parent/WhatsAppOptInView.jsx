/**
 * src/modules/parent/WhatsAppOptInView.jsx
 *
 * /app/parent/whatsapp  — accessible from Tonight view and Subscribe page
 *
 * Two states:
 *
 * NOT OPTED IN
 *   - Explains what the nightly lesson digest is
 *   - Phone number input (E.164 helper shown)
 *   - "Send me tonight's lesson on WhatsApp" checkbox (explicit consent)
 *   - Submit → writes to whatsapp_opt_ins
 *
 * OPTED IN
 *   - Shows current phone number + active status badge
 *   - Edit phone number inline
 *   - Pause / Resume toggle
 *   - Last 7 nights delivery history (sent / failed / skipped chips)
 *   - "Opt out completely" button (with confirm step)
 *
 * DESIGN NOTES
 * ─────────────
 * - Consent copy is visible and unambiguous (NDPA + WhatsApp ToS)
 * - Phone validation is permissive client-side (E.164 normalisation
 *   is the server's job); we just check it starts with + and has digits
 * - The delivery history reads from nightly_dispatch_log (parent can
 *   see their own rows via RLS)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/utils/friendlyError';
import { cn } from '@/utils/cn';

// ── Data helpers ──────────────────────────────────────────────────────────────

async function fetchOptIn() {
  const { data, error } = await supabase
    .from('whatsapp_opt_ins')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;  // null if not opted in
}

async function fetchDeliveryHistory() {
  const { data, error } = await supabase
    .from('nightly_dispatch_log')
    .select('dispatch_date, status, channel, error_detail, lessons(title, subject)')
    .order('dispatch_date', { ascending: false })
    .limit(7);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function normalisePhone(raw) {
  // Strip spaces and dashes; ensure leading +
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('0')) return '+234' + cleaned.slice(1);
  if (!cleaned.startsWith('+')) return '+' + cleaned;
  return cleaned;
}

function isValidPhone(phone) {
  return /^\+\d{9,15}$/.test(normalisePhone(phone));
}

// ── Main component ────────────────────────────────────────────────────────────

export function WhatsAppOptInView() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const optInQ = useQuery({
    queryKey: ['whatsapp', 'optin'],
    queryFn:  fetchOptIn,
    staleTime: 60_000,
  });

  const historyQ = useQuery({
    queryKey: ['whatsapp', 'history'],
    queryFn:  fetchDeliveryHistory,
    enabled:  !!optInQ.data,
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['whatsapp'] });
  };

  if (optInQ.isLoading) {
    return (
      <div className="space-y-s-4">
        {[1, 2].map((i) => <div key={i} className="h-28 rounded-r-2 bg-surface-2 animate-pulse"/>)}
      </div>
    );
  }

  if (optInQ.data) {
    return (
      <OptedInView
        optIn={optInQ.data}
        history={historyQ.data ?? []}
        onUpdate={invalidate}
      />
    );
  }

  return <OptInForm parentName={profile?.full_name} onSuccess={invalidate} />;
}

// ── Opt-in form ───────────────────────────────────────────────────────────────

function OptInForm({ parentName, onSuccess }) {
  const [phone,    setPhone]    = useState('');
  const [consent,  setConsent]  = useState(false);
  const [error,    setError]    = useState(null);

  const optInMut = useMutation({
    mutationFn: async () => {
      const e164 = normalisePhone(phone);
      if (!isValidPhone(e164)) throw new Error('Please enter a valid phone number including country code (e.g. +234 801 234 5678).');
      if (!consent) throw new Error('Please confirm your consent before opting in.');

      const { error } = await supabase
        .from('whatsapp_opt_ins')
        .insert({ phone_e164: e164, active: true });
      if (error) {
        if (/unique/i.test(error.message)) throw new Error('You are already opted in. Refresh the page.');
        throw new Error(error.message);
      }
    },
    onSuccess,
    onError: (e) => setError(friendlyError(e)),
  });

  const parentFirst = (parentName ?? 'there').split(' ')[0];

  return (
    <div className="space-y-s-5 max-w-[600px]">
      {/* What you get */}
      <Card className="bg-surface-2 border-line-2">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Tonight's lesson, on WhatsApp</div>
        <h3 className="font-display text-display-3 text-ink-0 mb-s-3">
          Get the nightly lesson activity sent to your phone.
        </h3>
        <p className="text-body text-ink-2 mb-s-5">
          Every evening at 7pm, we'll send a 5-minute activity tied to what
          your child learned that day — right to your WhatsApp. You don't
          need to open the app. Just read and do it with your child.
        </p>

        <div className="grid sm:grid-cols-3 gap-s-4 mb-s-6">
          {[
            { icon: '⏱️', label: '5 minutes', desc: 'That\'s all it takes' },
            { icon: '📱', label: 'On WhatsApp', desc: 'No extra app needed' },
            { icon: '📚', label: 'Curriculum-aligned', desc: 'Matches your child\'s class' },
          ].map((f) => (
            <div key={f.label} className="bg-surface-3 border border-line-2 rounded-r-2 p-s-4 text-center">
              <div className="text-[24px] mb-s-2">{f.icon}</div>
              <div className="text-[13.5px] font-medium text-ink-0">{f.label}</div>
              <div className="font-mono text-[11px] text-ink-3 mt-s-1">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Phone input */}
        <div className="space-y-s-4">
          <div>
            <label className="block font-mono text-meta text-ink-3 mb-s-2 uppercase tracking-[0.1em]">
              WhatsApp phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 801 234 5678"
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400 font-mono"
            />
            <p className="mt-s-2 font-mono text-[11px] text-ink-3">
              Include your country code. Nigerian numbers: +234 then drop the leading 0.
            </p>
          </div>

          {/* Explicit consent */}
          <label className="flex items-start gap-s-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="accent-gold-400 w-5 h-5 mt-[2px] shrink-0"
            />
            <span className="text-[13.5px] text-ink-2 leading-relaxed">
              I agree to receive nightly lesson activities from Train To Teach
              Africa on this WhatsApp number. I can opt out at any time by
              replying STOP or changing my settings here.
            </span>
          </label>

          {error && <div className="text-[13px] text-red-400">{error}</div>}

          <Button
            intent="primary" size="lg"
            onClick={() => { setError(null); optInMut.mutate(); }}
            isLoading={optInMut.isPending}
            disabled={!phone.trim() || !consent}
            className="w-full justify-center"
          >
            Send me tonight's lesson
          </Button>

          <p className="font-mono text-[11px] text-ink-4 text-center leading-relaxed">
            Your number is used only to send TTA lesson activities. We do not
            share it. You can opt out at any time.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ── Opted-in view ─────────────────────────────────────────────────────────────

function OptedInView({ optIn, history, onUpdate }) {
  const [editPhone, setEditPhone]       = useState(false);
  const [newPhone,  setNewPhone]        = useState(optIn.phone_e164);
  const [showOptOut, setShowOptOut]     = useState(false);
  const [error,     setError]           = useState(null);

  const updateMut = useMutation({
    mutationFn: async (patch) => {
      const { error } = await supabase
        .from('whatsapp_opt_ins')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('parent_user_id', optIn.parent_user_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { onUpdate(); setEditPhone(false); setShowOptOut(false); setError(null); },
    onError: (e) => setError(friendlyError(e)),
  });

  const sentLast7    = history.filter((h) => h.status === 'sent').length;
  const failedLast7  = history.filter((h) => h.status === 'failed').length;

  return (
    <div className="space-y-s-5 max-w-[600px]">
      {/* Status card */}
      <Card className="bg-surface-2 border-line-2">
        <div className="flex items-start justify-between gap-s-4 mb-s-5">
          <div>
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">Nightly lesson digest</div>
            <h3 className="font-display text-display-3 text-ink-0">WhatsApp delivery</h3>
          </div>
          <Chip variant={optIn.active ? 'green' : 'amber'} dot>
            {optIn.active ? 'Active' : 'Paused'}
          </Chip>
        </div>

        {/* Phone number */}
        <div className="p-s-4 bg-surface-3 border border-line-2 rounded-r-2 mb-s-5">
          <div className="font-mono text-meta text-ink-3 mb-s-1 uppercase">Phone</div>
          {editPhone
            ? (
              <div className="flex gap-s-3 items-center">
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="flex-1 bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] text-ink-0 outline-none focus:border-gold-400 font-mono"
                />
                <Button
                  intent="primary" size="sm"
                  onClick={() => {
                    const e164 = normalisePhone(newPhone);
                    if (!isValidPhone(e164)) { setError('Invalid phone number.'); return; }
                    updateMut.mutate({ phone_e164: e164 });
                  }}
                  isLoading={updateMut.isPending}
                >
                  Save
                </Button>
                <Button intent="ghost" size="sm" onClick={() => { setEditPhone(false); setNewPhone(optIn.phone_e164); }}>
                  Cancel
                </Button>
              </div>
            )
            : (
              <div className="flex items-center gap-s-4">
                <span className="font-mono text-[15px] text-ink-0">{optIn.phone_e164}</span>
                <button onClick={() => setEditPhone(true)} className="font-mono text-[12px] text-gold-400 hover:text-gold-200">
                  Edit
                </button>
              </div>
            )
          }
        </div>

        {/* Delivery stats */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-s-3 mb-s-5">
            <div className="bg-surface-3 border border-line-2 rounded-r-2 p-s-3 text-center">
              <div className="font-display text-[22px] text-green-400">{sentLast7}</div>
              <div className="font-mono text-[11px] text-ink-3">delivered</div>
            </div>
            <div className="bg-surface-3 border border-line-2 rounded-r-2 p-s-3 text-center">
              <div className="font-display text-[22px] text-red-400">{failedLast7}</div>
              <div className="font-mono text-[11px] text-ink-3">failed</div>
            </div>
            <div className="bg-surface-3 border border-line-2 rounded-r-2 p-s-3 text-center">
              <div className="font-display text-[22px] text-ink-2">{history.length}</div>
              <div className="font-mono text-[11px] text-ink-3">last 7 nights</div>
            </div>
          </div>
        )}

        {error && <div className="mb-s-4 text-[13px] text-red-400">{error}</div>}

        {/* Actions */}
        <div className="flex flex-wrap gap-s-3">
          {optIn.active
            ? (
              <Button
                intent="ghost" size="md"
                onClick={() => updateMut.mutate({ active: false })}
                isLoading={updateMut.isPending}
              >
                Pause delivery
              </Button>
            )
            : (
              <Button
                intent="primary" size="md"
                onClick={() => updateMut.mutate({ active: true, opted_out_at: undefined })}
                isLoading={updateMut.isPending}
              >
                Resume delivery
              </Button>
            )
          }
          <Button
            intent="text" size="md"
            onClick={() => setShowOptOut((v) => !v)}
          >
            Opt out completely
          </Button>
        </div>

        {showOptOut && (
          <div className="mt-s-5 p-s-4 bg-red-400/[0.06] border border-red-400/25 rounded-r-2">
            <p className="text-[13.5px] text-ink-2 mb-s-4">
              Are you sure? You'll stop receiving nightly lesson activities on WhatsApp.
              Your opt-in record will be kept for 90 days in case you change your mind.
            </p>
            <div className="flex gap-s-3">
              <Button
                intent="ghost" size="sm"
                onClick={() => updateMut.mutate({ active: false, opted_out_at: new Date().toISOString() })}
                isLoading={updateMut.isPending}
              >
                Yes, opt out
              </Button>
              <Button intent="text" size="sm" onClick={() => setShowOptOut(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delivery history */}
      {history.length > 0 && (
        <Card className="bg-surface-2 border-line-2">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Last 7 nights</div>
          <div className="space-y-s-2">
            {history.map((h) => {
              const statusColor = h.status === 'sent' ? 'green' : h.status === 'failed' ? 'red' : 'default';
              const channelLabel = h.channel === 'sms' ? ' · via SMS fallback' : '';
              const dateStr = new Date(h.dispatch_date).toLocaleDateString('en-NG', {
                weekday: 'short', day: 'numeric', month: 'short',
              });
              return (
                <div key={h.dispatch_date} className="flex items-center gap-s-4 py-s-2 border-b border-line-2 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-ink-1">
                      {h.lessons?.title ?? 'Lesson'}
                    </div>
                    <div className="font-mono text-[11px] text-ink-3">
                      {dateStr}{channelLabel}
                    </div>
                    {h.error_detail && h.status === 'failed' && (
                      <div className="font-mono text-[11px] text-red-400 mt-[2px]">{h.error_detail}</div>
                    )}
                  </div>
                  <Chip variant={statusColor} dot size="sm">{h.status}</Chip>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
