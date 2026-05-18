/**
 * src/modules/admin/PupilPinManager.jsx
 *
 * /app/admin/pupils/pins  — school_admin + head_teacher
 *
 * Two modes:
 *
 * CLASS VIEW
 *   - Class picker
 *   - Grid of all pupils in the class showing PIN status (set / not set)
 *   - Click a pupil → inline PIN setter
 *   - "Generate random PIN" button → 4-digit random number, one click to save
 *   - "Reset PIN" for a pupil with an existing PIN
 *
 * BULK MODE
 *   - Select a class → generate a unique 4-digit PIN for every pupil at once
 *   - Preview table: pupil name | generated PIN
 *   - Confirm → saves all PINs via set-student-pin for each pupil
 *   - Print list → browser print dialog for the teacher to hand out
 *
 * DESIGN DECISIONS
 * ─────────────────
 * - PINs are only visible immediately after generation / manual entry. We
 *   never show the stored hash or allow retrieving an existing PIN. If a
 *   pupil forgets their PIN, the teacher generates a new one.
 * - PIN column on the pupils table stores a bcrypt hash. The plain PIN is
 *   sent to the set-student-pin edge function and never stored in the client.
 * - Bulk generation uses crypto.getRandomValues for true randomness.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import * as classService from '@/services/classService';
import { friendlyError } from '@/utils/friendlyError';
import { cn } from '@/utils/cn';

const ADMIN_NAV = [
  { to: '/app/admin',             label: 'Overview',   end: true },
  { to: '/app/admin/enrollments', label: 'Enrolments' },
  { to: '/app/admin/staff',       label: 'Staff'       },
  { to: '/app/admin/connections', label: 'Connections' },
  { to: '/app/admin/curriculum',  label: 'Curriculum'  },
  { to: '/app/admin/terms',       label: 'Terms'       },
  { to: '/app/admin/alerts',      label: 'Alerts'      },
  { to: '/app/admin/impact',      label: 'Impact'      },
  { to: '/app/admin/billing',     label: 'Billing'     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomPin() {
  const arr = new Uint16Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 10000).padStart(4, '0');
}

async function callSetStudentPin(pupilId, pin) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const { data: { url: fnUrl } } = supabase.functions.url
    ? { data: { url: `${supabase.supabaseUrl}/functions/v1/set-student-pin` } }
    : await supabase.functions._getUrl('set-student-pin');

  // Use supabase.functions.invoke which handles the auth header automatically
  const { data, error } = await supabase.functions.invoke('set-student-pin', {
    body: { pupil_id: pupilId, pin },
  });

  if (error) throw new Error(error.message ?? 'Could not set PIN');
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PupilPinManager() {
  const { schoolId } = useAuth();
  const [classId, setClassId]   = useState(null);
  const [bulkMode, setBulkMode] = useState(false);

  const classesQ = useQuery({
    queryKey: ['classes', schoolId],
    queryFn:  () => classService.listClasses({ schoolId }),
    enabled:  !!schoolId,
    staleTime: 300_000,
  });

  const classes      = classesQ.data ?? [];
  const activeClass  = classId ?? classes[0]?.id ?? null;
  const selectedClass = classes.find((c) => c.id === activeClass);

  return (
    <AppShell title="Student PINs" navItems={ADMIN_NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Student login</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
            Set student PINs.
          </h2>
          <p className="mt-s-2 text-body text-ink-3 max-w-[58ch]">
            Students use a 4-digit PIN with their pupil code and school code
            to access TTA Learn. Set or reset PINs here. PINs are never
            stored in plain text — only a secure hash.
          </p>
        </div>

        {/* Class picker + mode toggle */}
        <div className="flex flex-wrap gap-s-4 items-center mb-s-7 p-s-4 bg-surface-2 border border-line-1 rounded-r-2">
          <div className="flex-1 min-w-[160px]">
            <label className="block font-mono text-meta text-ink-3 mb-s-2 uppercase">Class</label>
            <select
              value={activeClass ?? ''}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-2 text-[14px] text-ink-0 outline-none focus:border-gold-400"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-s-2 self-end">
            <Button
              intent={!bulkMode ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setBulkMode(false)}
            >
              Individual
            </Button>
            <Button
              intent={bulkMode ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setBulkMode(true)}
            >
              Bulk generate
            </Button>
          </div>
        </div>

        {/* School login info strip */}
        {selectedClass && (
          <div className="mb-s-6 p-s-4 bg-surface-2 border border-line-1 rounded-r-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">
              Student login details
            </div>
            <div className="grid sm:grid-cols-3 gap-s-4 text-[13.5px]">
              <div>
                <div className="font-mono text-meta text-ink-3">School code</div>
                <div className="font-mono text-[15px] text-ink-0 mt-s-1">
                  {/* School slug is the school code */}
                  <SchoolSlug schoolId={schoolId} />
                </div>
              </div>
              <div>
                <div className="font-mono text-meta text-ink-3">Login URL</div>
                <div className="font-mono text-[13px] text-ink-2 mt-s-1">
                  /student-sign-in
                </div>
              </div>
              <div>
                <div className="font-mono text-meta text-ink-3">PIN length</div>
                <div className="font-mono text-[15px] text-ink-0 mt-s-1">4 digits</div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!activeClass
          ? <Card className="bg-surface-2 border-line-2 text-center py-s-8">
              <p className="text-body text-ink-3">Select a class to manage student PINs.</p>
            </Card>
          : bulkMode
            ? <BulkPinView classId={activeClass} />
            : <IndividualPinView classId={activeClass} />
        }
      </div>
    </AppShell>
  );
}

// ── Individual PIN view ───────────────────────────────────────────────────────

function IndividualPinView({ classId }) {
  const { data: pupils, isLoading, refetch } = useQuery({
    queryKey: ['pupils', classId, 'withpin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pupils')
        .select('id, full_name, pupil_code, pin_hash')
        .eq('class_id', classId)
        .order('full_name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="space-y-s-2">{[1,2,3].map((i) => <div key={i} className="h-14 rounded-r-2 bg-surface-2 animate-pulse"/>)}</div>;
  }

  if (!pupils?.length) {
    return <Card className="bg-surface-2 border-line-2"><p className="text-body text-ink-3">No pupils in this class.</p></Card>;
  }

  return (
    <div className="space-y-s-2">
      {pupils.map((pupil) => (
        <PupilPinRow key={pupil.id} pupil={pupil} onSaved={refetch} />
      ))}
    </div>
  );
}

function PupilPinRow({ pupil, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [pin,     setPin]     = useState('');
  const [saved,   setSaved]   = useState(null);   // the plain PIN shown immediately after save
  const [error,   setError]   = useState(null);

  const hasPin = !!pupil.pin_hash;

  const saveMut = useMutation({
    mutationFn: (p) => callSetStudentPin(pupil.id, p),
    onSuccess: (_, usedPin) => {
      setSaved(usedPin);
      setEditing(false);
      setPin('');
      setError(null);
      onSaved();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const handleSave = () => {
    if (!/^\d{4}$/.test(pin)) { setError('PIN must be exactly 4 digits.'); return; }
    setError(null);
    saveMut.mutate(pin);
  };

  const handleRandom = () => {
    const p = randomPin();
    setPin(p);
    setEditing(true);
  };

  return (
    <Card className="bg-surface-2 border-line-2 !p-s-4">
      <div className="flex items-center gap-s-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <div className="text-[14px] font-medium text-ink-1">{pupil.full_name}</div>
          <div className="font-mono text-meta text-ink-3">{pupil.pupil_code}</div>
        </div>

        <div className="flex items-center gap-s-3 flex-wrap">
          {/* PIN status / result */}
          {saved
            ? (
              <div className="flex items-center gap-s-2">
                <Chip variant="green" dot>PIN set</Chip>
                <span className="font-mono text-[16px] text-ink-0 bg-surface-3 px-s-3 py-[4px] rounded-r-1 border border-line-2">
                  {saved}
                </span>
                <span className="font-mono text-[11px] text-ink-3">show once</span>
              </div>
            )
            : hasPin
              ? <Chip variant="green" dot>PIN set</Chip>
              : <Chip variant="amber" dot>No PIN</Chip>
          }

          {/* Actions */}
          {!editing
            ? (
              <>
                <Button intent="ghost" size="sm" onClick={() => { setEditing(true); setSaved(null); }}>
                  {hasPin ? 'Reset PIN' : 'Set PIN'}
                </Button>
                <Button intent="ghost" size="sm" onClick={() => { handleRandom(); setSaved(null); }}>
                  Random PIN
                </Button>
              </>
            )
            : (
              <div className="flex items-center gap-s-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  className="w-[72px] font-mono text-[16px] bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-[6px] text-ink-0 outline-none focus:border-gold-400 text-center tracking-[0.2em]"
                  autoFocus
                />
                <Button
                  intent="primary" size="sm"
                  onClick={handleSave}
                  isLoading={saveMut.isPending}
                  disabled={pin.length !== 4}
                >
                  Save
                </Button>
                <Button intent="ghost" size="sm" onClick={() => { setEditing(false); setPin(''); setError(null); }}>
                  Cancel
                </Button>
              </div>
            )
          }
        </div>
      </div>
      {error && <div className="mt-s-2 text-[12px] text-red-400">{error}</div>}
    </Card>
  );
}

// ── Bulk PIN view ─────────────────────────────────────────────────────────────

function BulkPinView({ classId }) {
  const [generated, setGenerated] = useState(null);  // [{ pupil, pin }]
  const [saving,    setSaving]    = useState(false);
  const [result,    setResult]    = useState(null);   // { saved, errors }
  const [error,     setError]     = useState(null);

  const { data: pupils, isLoading } = useQuery({
    queryKey: ['pupils', classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pupils')
        .select('id, full_name, pupil_code')
        .eq('class_id', classId)
        .order('full_name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const generateAll = () => {
    if (!pupils?.length) return;
    setGenerated(pupils.map((p) => ({ pupil: p, pin: randomPin() })));
    setResult(null);
    setError(null);
  };

  const saveAll = async () => {
    if (!generated?.length) return;
    setSaving(true);
    setError(null);

    let saved = 0;
    const errors = [];

    for (const { pupil, pin } of generated) {
      try {
        await callSetStudentPin(pupil.id, pin);
        saved++;
      } catch (e) {
        errors.push(`${pupil.full_name}: ${friendlyError(e)}`);
      }
    }

    setSaving(false);
    setResult({ saved, errors });
  };

  const handlePrint = () => {
    if (!generated?.length) return;
    const rows = generated.map(({ pupil, pin }) =>
      `<tr><td>${pupil.full_name}</td><td style="font-family:monospace">${pupil.pupil_code}</td><td style="font-family:monospace;font-size:18px;font-weight:bold;letter-spacing:4px">${pin}</td></tr>`
    ).join('');
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Student PINs</title>
      <style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:8px 12px;text-align:left}
      th{background:#f5f5f5}@media print{button{display:none}}</style></head>
      <body><h2>Student Login PINs</h2>
      <p>School code and pupil code needed at login. Keep this sheet secure.</p>
      <table><thead><tr><th>Name</th><th>Pupil Code</th><th>PIN</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <br><button onclick="window.print()">Print</button></body></html>
    `);
    w.document.close();
  };

  if (isLoading) return <div className="h-32 rounded-r-2 bg-surface-2 animate-pulse"/>;

  if (!pupils?.length) {
    return <Card className="bg-surface-2 border-line-2"><p className="text-body text-ink-3">No pupils in this class.</p></Card>;
  }

  return (
    <div className="space-y-s-5">
      <Card className="bg-surface-2 border-line-2">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Bulk generate PINs</div>
        <p className="text-body text-ink-2 mb-s-5">
          Generates a unique random 4-digit PIN for every pupil in the class.
          Review the list, then save and print the PIN sheet.
        </p>
        <div className="flex flex-wrap gap-s-3">
          <Button intent="primary" size="md" onClick={generateAll}>
            Generate {pupils.length} PINs
          </Button>
          {generated && (
            <>
              <Button
                intent="ghost" size="md"
                onClick={saveAll}
                isLoading={saving}
              >
                Save all PINs
              </Button>
              <Button intent="ghost" size="md" onClick={handlePrint}>
                Print sheet
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Result banner */}
      {result && (
        <div className={cn(
          'p-s-4 rounded-r-2 border',
          result.errors.length > 0
            ? 'bg-amber-400/[0.06] border-amber-400/25'
            : 'bg-green-400/[0.06] border-green-400/25',
        )}>
          <p className="text-[13.5px] text-ink-1">
            {result.saved} PIN{result.saved !== 1 ? 's' : ''} saved.
            {result.errors.length > 0 && ` ${result.errors.length} failed.`}
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-[12px] text-red-400 mt-s-1">{e}</p>
          ))}
        </div>
      )}

      {/* Preview table */}
      {generated && (
        <Card className="bg-surface-2 border-line-2 !p-0 overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-line-2 bg-surface-3">
                <th className="text-left px-s-5 py-s-3 font-mono text-meta text-ink-3 uppercase">Name</th>
                <th className="text-left px-s-3 py-s-3 font-mono text-meta text-ink-3 uppercase">Pupil Code</th>
                <th className="text-left px-s-3 py-s-3 font-mono text-meta text-ink-3 uppercase">PIN</th>
                <th className="px-s-3 py-s-3"></th>
              </tr>
            </thead>
            <tbody>
              {generated.map(({ pupil, pin }, i) => (
                <tr key={pupil.id} className="border-b border-line-2 last:border-0">
                  <td className="px-s-5 py-s-3 text-ink-1">{pupil.full_name}</td>
                  <td className="px-s-3 py-s-3 font-mono text-ink-2">{pupil.pupil_code}</td>
                  <td className="px-s-3 py-s-3">
                    <span className="font-mono text-[18px] text-ink-0 tracking-[0.2em]">{pin}</span>
                  </td>
                  <td className="px-s-3 py-s-3">
                    <button
                      onClick={() => {
                        const newPin = randomPin();
                        setGenerated((prev) =>
                          prev.map((item, idx) => idx === i ? { ...item, pin: newPin } : item)
                        );
                      }}
                      className="font-mono text-[11px] text-ink-3 hover:text-gold-400"
                    >
                      Regenerate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── School slug display ───────────────────────────────────────────────────────

function SchoolSlug({ schoolId }) {
  const { data } = useQuery({
    queryKey: ['school', schoolId, 'slug'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schools')
        .select('slug')
        .eq('id', schoolId)
        .single();
      return data?.slug?.toUpperCase() ?? '—';
    },
    enabled: !!schoolId,
    staleTime: Infinity,
  });
  return <span>{data ?? '—'}</span>;
}
