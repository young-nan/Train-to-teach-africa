/**
 * src/pages/account/AccountSettingsPage.jsx
 *
 * /account  — available to every authenticated role
 *
 * THREE SECTIONS
 * ──────────────
 *   Profile    — full name + phone number
 *   Password   — change password (current not required — Supabase handles via session)
 *   Danger     — sign out from all devices (future: delete account)
 *
 * DESIGN DECISIONS
 * ─────────────────
 * - No AppShell. This is a standalone settings page outside the product
 *   shell — same clean layout as CheckoutPage and BillingReturnPage.
 *   Every role uses it; putting it inside one role's AppShell would break
 *   the others.
 * - Profile updates are optimistic: we call setProfile immediately with
 *   the new values so the name in the header updates without a reload,
 *   then the Supabase write confirms it.
 * - Phone is normalised client-side (leading 0 → +234) before save.
 *   Same logic as WhatsAppOptInView.
 * - Password change shows a simple success state — no spinner on the field
 *   itself; the whole form section gets a "Password updated" banner.
 * - The page reads current profile from useAuth() so it's always in sync
 *   with the store, not a separate fetch.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import * as profileService from '@/services/profileService';
import * as consentService from '@/services/consentService';
import { ROLE_HOME } from '@/config/roles';
import { friendlyError } from '@/utils/friendlyError';

// ── Phone normalisation (mirrors WhatsAppOptInView) ───────────────────────────

function normalisePhone(raw) {
  if (!raw?.trim()) return '';
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('0')) return '+234' + cleaned.slice(1);
  if (!cleaned.startsWith('+')) return '+' + cleaned;
  return cleaned;
}

function isValidPhone(phone) {
  if (!phone) return true; // phone is optional
  return /^\+\d{9,15}$/.test(normalisePhone(phone));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
  const { profile, role, signOut } = useAuth();
  const setProfile = useAuthStore((s) => s.setProfile);
  const navigate   = useNavigate();

  // Profile section state
  const [name,      setName]      = useState(profile?.full_name ?? '');
  const [phone,     setPhone]     = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState(null); // { ok, text }

  // Password section state
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw,  setSavingPw]  = useState(false);
  const [pwMsg,     setPwMsg]     = useState(null);

  // ── Save profile ──────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!name.trim()) { setProfileMsg({ ok: false, text: 'Name is required.' }); return; }
    if (!isValidPhone(phone)) {
      setProfileMsg({ ok: false, text: 'Phone number format looks wrong. Use +234XXXXXXXXXX or leave blank.' });
      return;
    }
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const normPhone = phone.trim() ? normalisePhone(phone) : '';
      const updated = await profileService.updateProfile({
        fullName: name,
        phone:    normPhone || null,
      });
      if (updated) setProfile(updated);
      setProfileMsg({ ok: true, text: 'Profile updated.' });
    } catch (e) {
      setProfileMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const changePassword = async () => {
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords don\'t match.' }); return; }
    setPwMsg(null);
    setSavingPw(true);
    try {
      await profileService.changePassword(newPw);
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ ok: true, text: 'Password updated.' });
    } catch (e) {
      setPwMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setSavingPw(false);
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const homeRoute = ROLE_HOME[role] ?? '/';

  return (
    <div className="min-h-dvh bg-surface-1 px-s-5 py-s-10">
      <div className="max-w-[580px] mx-auto">

        {/* Back nav */}
        <Link
          to={homeRoute}
          className="inline-flex items-center gap-s-2 mb-s-7 font-mono text-meta text-ink-3 hover:text-ink-1"
        >
          ← Dashboard
        </Link>

        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Account</div>
          <h1 className="mt-s-2 font-display text-display-2 text-ink-0">
            Settings.
          </h1>
          <p className="mt-s-2 font-mono text-meta text-ink-3">
            {profile?.email}
            <span className="ml-s-3 text-gold-400">
              {role?.replace(/_/g, ' ')}
            </span>
          </p>
        </div>

        <div className="space-y-s-5">

          {/* ── Profile ─────────────────────────────────────────────────── */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">
              Profile
            </div>

            <div className="space-y-s-4">
              {/* Email — read-only; Supabase requires OTP to change */}
              <div className="flex flex-col gap-s-2">
                <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">
                  Email address
                </span>
                <div className="flex items-center gap-s-3">
                  <div className="flex-1 bg-surface-3 border border-line-1 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-2 font-mono">
                    {profile?.email}
                  </div>
                  <Chip variant="default" size="sm">Read-only</Chip>
                </div>
                <p className="font-mono text-[11px] text-ink-3">
                  To change your email, sign in via the new address — Supabase
                  will send a confirmation link to both addresses.
                </p>
              </div>
              <Field
                label="Full name"
                type="text"
                value={name}
                onChange={setName}
                autoComplete="name"
                placeholder="Your full name"
              />
              <Field
                label="WhatsApp / phone number"
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
                placeholder="+234 801 234 5678 (optional)"
              />
              <p className="font-mono text-[11px] text-ink-3">
                Used for school comms and nightly lesson notifications.
                Nigerian numbers: +234 then drop the leading 0.
              </p>
            </div>

            {profileMsg && (
              <StatusMsg ok={profileMsg.ok} text={profileMsg.text} className="mt-s-4" />
            )}

            <div className="mt-s-5">
              <Button
                intent="primary"
                size="md"
                onClick={saveProfile}
                isLoading={savingProfile}
              >
                Save profile
              </Button>
            </div>
          </Card>

          {/* ── Password ────────────────────────────────────────────────── */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">
              Change password
            </div>

            <div className="space-y-s-4">
              <Field
                label="New password"
                type="password"
                value={newPw}
                onChange={setNewPw}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              <Field
                label="Confirm new password"
                type="password"
                value={confirmPw}
                onChange={setConfirmPw}
                autoComplete="new-password"
                placeholder="Repeat new password"
              />
            </div>

            {pwMsg && (
              <StatusMsg ok={pwMsg.ok} text={pwMsg.text} className="mt-s-4" />
            )}

            <div className="mt-s-5">
              <Button
                intent="primary"
                size="md"
                onClick={changePassword}
                isLoading={savingPw}
                disabled={!newPw}
              >
                Update password
              </Button>
            </div>
          </Card>

          {/* ── Session ─────────────────────────────────────────────────── */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
              Session
            </div>
            <p className="text-body text-ink-2 mb-s-5">
              Sign out of this device.
            </p>
            <Button intent="ghost" size="md" onClick={handleSignOut}>
              Sign out
            </Button>
          </Card>

          {/* ── Subscription (parents only) ─────────────────────────────── */}
          {role === 'parent' && (
            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
                Subscription
              </div>
              <p className="text-body text-ink-2 mb-s-5">
                Manage your TTA Learn subscription, view past payments, and
                change your plan.
              </p>
              <Link to="/app/parent/subscribe">
                <Button intent="ghost" size="md">Manage subscription →</Button>
              </Link>
            </Card>
          )}

          {/* ── Privacy & Consent ─────────────────────────────────────────── */}
          <section>
            <h2 className="font-display text-display-3 text-ink-0 mb-s-5">Privacy &amp; consent</h2>
            <PrivacyConsent />
          </section>

        </div>
      </div>
    </div>
  );
}

// ── Privacy consent panel ─────────────────────────────────────────────────────

function PrivacyConsent() {
  const qc = useQueryClient();

  const { data: consents, isLoading } = useQuery({
    queryKey: ['account', 'consents'],
    queryFn:  () => consentService.getMyConsents(),
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: ({ type, granted }) => consentService.setMyConsent(type, granted),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account', 'consents'] }),
  });

  if (isLoading) {
    return <div className="space-y-s-3">{[1,2,3].map(i=><div key={i} className="h-[64px] bg-surface-2 border border-line-1 rounded-r-2 animate-pulse"/>)}</div>;
  }

  return (
    <div className="space-y-s-3">
      {consentService.USER_CONSENT_TYPES.map((type) => {
        const meta    = consentService.CONSENT_META[type];
        const granted = consents?.[type] ?? false;
        return (
          <Card key={type} className="bg-surface-2 border-line-2">
            <div className="flex items-start gap-s-4">
              <div className="flex-1">
                <div className="flex items-center gap-s-2 mb-s-1">
                  <span className="text-[14px] font-medium text-ink-0">{meta.label}</span>
                  {meta.required && <Chip variant="gold" size="sm">Required</Chip>}
                </div>
                <p className="text-[13px] text-ink-3">{meta.body}</p>
              </div>
              <div className="shrink-0 mt-[2px]">
                {meta.required ? (
                  <span className="font-mono text-[12px] text-green-400">✓ Always on</span>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={granted}
                    onClick={() => toggle.mutate({ type, granted: !granted })}
                    disabled={toggle.isPending}
                    className={`relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-surface-2 disabled:opacity-50 ${
                      granted ? 'bg-gold-400' : 'bg-surface-4'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      granted ? 'translate-x-[20px]' : 'translate-x-0'
                    }`} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
      <p className="font-mono text-[11px] text-ink-4 mt-s-2">
        All consent changes are logged. Read our{' '}
        <a href="/privacy" className="text-gold-200 hover:text-gold-50">Privacy Policy</a>{' '}
        to understand how each type of data is used.
      </p>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Field({ label, type, value, onChange, placeholder, autoComplete }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400 transition-colors duration-150 placeholder-ink-4"
      />
    </label>
  );
}

function StatusMsg({ ok, text, className }) {
  return (
    <div className={`text-[13px] px-s-4 py-s-3 rounded-r-2 border ${
      ok
        ? 'text-green-400 bg-green-400/[0.06] border-green-400/25'
        : 'text-red-400 bg-red-400/[0.06] border-red-400/25'
    } ${className ?? ''}`}>
      {text}
    </div>
  );
}
