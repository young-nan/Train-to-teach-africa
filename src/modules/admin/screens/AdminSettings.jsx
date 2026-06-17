/**
 * AdminSettings.jsx — Full settings screen
 * School info · Academic terms · Grading · WhatsApp · Security · Branding
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, Chip, Button,
  Input, Select, FormGroup, Textarea, Alert, Tabs,
} from '@/components/ui';

const TABS = [
  { key:'school',    label:'School info'   },
  { key:'academic',  label:'Academic'      },
  { key:'grading',   label:'Grading'       },
  { key:'comms',     label:'Integrations'  },
  { key:'security',  label:'Security'      },
];

function useSchool(schoolId) {
  return useQuery({
    queryKey: ['school-settings', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();
      return data;
    },
    enabled: !!schoolId,
  });
}

function SaveButton({ saving, saved, onClick }) {
  return (
    <Button variant="primary" isLoading={saving} onClick={onClick} icon={saved ? 'check' : 'device-floppy'}>
      {saved ? 'Saved!' : 'Save changes'}
    </Button>
  );
}

export default function AdminSettings() {
  const { profile, schoolId } = useAuth();
  const qc          = useQueryClient();

  const [tab,   setTab]   = useState('school');
  const [saved, setSaved] = useState(false);

  const { data: school } = useSchool(schoolId);

  const [schoolForm, setSchoolForm] = useState({
    name:    '', address: '', city: '', state: '',
    phone:   '', email: '', website: '',
  });

  // Populate form when data loads
  useState(() => {
    if (school) setSchoolForm({
      name:    school.name    ?? '',
      address: school.address ?? '',
      city:    school.city    ?? '',
      state:   school.state   ?? '',
      phone:   school.phone   ?? '',
      email:   school.email   ?? '',
      website: school.website ?? '',
    });
  }, [school]);

  const updateSchool = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('schools').update(payload).eq('id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries(['school-settings', schoolId]);
    },
  });

  const updateSF = k => e => setSchoolForm(p => ({ ...p, [k]: e.target.value }));

  const GRADE_BANDS = [
    { grade:'A', min:80, max:100, remark:'Excellent'           },
    { grade:'B', min:70, max:79,  remark:'Very Good'           },
    { grade:'C', min:60, max:69,  remark:'Good'                },
    { grade:'D', min:50, max:59,  remark:'Average'             },
    { grade:'F', min:0,  max:49,  remark:'Needs Improvement'   },
  ];

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Settings" subtitle="Configure your school, academic structure, and integrations." />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── School info ── */}
      {tab === 'school' && (
        <Card>
          <CardHeader title="School information" />
          <div className="grid lg:grid-cols-2 gap-4">
            <FormGroup label="School name *">
              <Input value={schoolForm.name} onChange={updateSF('name')} placeholder="e.g. TLF Lekki Academy" />
            </FormGroup>
            <FormGroup label="Email address">
              <Input type="email" value={schoolForm.email} onChange={updateSF('email')} placeholder="info@school.edu.ng" />
            </FormGroup>
            <FormGroup label="Phone number">
              <Input type="tel" value={schoolForm.phone} onChange={updateSF('phone')} placeholder="+234 800 000 0000" />
            </FormGroup>
            <FormGroup label="Website">
              <Input type="url" value={schoolForm.website} onChange={updateSF('website')} placeholder="https://school.edu.ng" />
            </FormGroup>
            <FormGroup label="Street address" className="lg:col-span-2">
              <Textarea rows={2} value={schoolForm.address} onChange={updateSF('address')} placeholder="Street address…" />
            </FormGroup>
            <FormGroup label="City / Town">
              <Input value={schoolForm.city} onChange={updateSF('city')} placeholder="Lagos" />
            </FormGroup>
            <FormGroup label="State">
              <Select value={schoolForm.state} onChange={updateSF('state')}>
                <option value="">Select state…</option>
                {['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
                  'Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano',
                  'Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun',
                  'Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FormGroup>
          </div>
          <div className="mt-5 pt-5 border-t border-[var(--c-line-1)] flex gap-3">
            <SaveButton saving={updateSchool.isPending} saved={saved} onClick={() => updateSchool.mutate(schoolForm)} />
          </div>
        </Card>
      )}

      {/* ── Academic ── */}
      {tab === 'academic' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Current academic session" />
            <div className="grid lg:grid-cols-3 gap-4">
              <FormGroup label="Session">
                <Select defaultValue="2025/2026">
                  <option>2025/2026</option>
                  <option>2026/2027</option>
                </Select>
              </FormGroup>
              <FormGroup label="Current term">
                <Select defaultValue="3">
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </Select>
              </FormGroup>
              <FormGroup label="Current week">
                <Input type="number" min={1} max={13} defaultValue={9} />
              </FormGroup>
            </div>
            <Alert type="info">Changing the current term will affect lesson scheduling and report card generation for all classes.</Alert>
          </Card>

          <Card>
            <CardHeader title="Term dates" />
            {[1,2,3].map(t => (
              <div key={t} className="grid grid-cols-3 gap-4 py-4 border-b border-[var(--c-line-1)] last:border-0 items-center">
                <div className="font-semibold text-[var(--c-ink-0)]">Term {t}</div>
                <FormGroup label="Start date" className="mb-0">
                  <Input type="date" defaultValue={t===1?'2025-09-01':t===2?'2026-01-06':'2026-04-14'} />
                </FormGroup>
                <FormGroup label="End date" className="mb-0">
                  <Input type="date" defaultValue={t===1?'2025-12-12':t===2?'2026-03-28':'2026-07-11'} />
                </FormGroup>
              </div>
            ))}
            <div className="mt-4">
              <Button variant="primary" icon="device-floppy">Save term dates</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Promotion rules" />
            <div className="grid lg:grid-cols-2 gap-4">
              <FormGroup label="Minimum pass mark (%)">
                <Input type="number" min={0} max={100} defaultValue={50} />
              </FormGroup>
              <FormGroup label="Minimum attendance to promote (%)">
                <Input type="number" min={0} max={100} defaultValue={75} />
              </FormGroup>
            </div>
            <Button variant="primary" icon="device-floppy">Save rules</Button>
          </Card>
        </div>
      )}

      {/* ── Grading ── */}
      {tab === 'grading' && (
        <Card>
          <CardHeader title="Grade bands" />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--c-line-2)]">
                  {['Grade','Min score (%)','Max score (%)','Remark'].map(h => (
                    <th key={h} className="text-left pb-3 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GRADE_BANDS.map(band => (
                  <tr key={band.grade} className="border-b border-[var(--c-line-1)] last:border-0">
                    <td className="py-3 pr-4">
                      <Chip variant={band.grade==='A'?'green':band.grade==='B'?'teal':band.grade==='C'?'amber':band.grade==='D'?'coral':'red'}>
                        {band.grade}
                      </Chip>
                    </td>
                    <td className="py-3 pr-4">
                      <Input type="number" className="w-20 py-1.5" defaultValue={band.min} />
                    </td>
                    <td className="py-3 pr-4">
                      <Input type="number" className="w-20 py-1.5" defaultValue={band.max} />
                    </td>
                    <td className="py-3 pr-4">
                      <Input className="max-w-[180px] py-1.5" defaultValue={band.remark} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 pt-5 border-t border-[var(--c-line-1)]">
            <Button variant="primary" icon="device-floppy">Save grade bands</Button>
          </div>
        </Card>
      )}

      {/* ── Integrations ── */}
      {tab === 'comms' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="WhatsApp Business" />
            <div className="flex items-center gap-3 p-4 rounded-xl mb-4"
              style={{ background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.2)' }}>
              <i className="ti ti-brand-whatsapp text-[24px]" style={{ color:'#25d366' }} aria-hidden="true" />
              <div className="flex-1">
                <div className="font-semibold text-[var(--c-ink-0)]">WhatsApp connected</div>
                <div className="text-[12px] text-[var(--c-ink-3)] mt-0.5">94 parents opted in · Business number: +234 800 TLF 001</div>
              </div>
              <Chip variant="green">Active</Chip>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <FormGroup label="Business phone number">
                <Input placeholder="+234 800 000 0000" defaultValue="+234 800 853 001" />
              </FormGroup>
              <FormGroup label="API Key">
                <Input type="password" placeholder="WhatsApp Business API key" defaultValue="sk_live_••••••••••••••" />
              </FormGroup>
            </div>
            <Button variant="ghost" icon="device-floppy">Update WhatsApp settings</Button>
          </Card>

          <Card>
            <CardHeader title="Email (SMTP)" />
            <div className="grid lg:grid-cols-2 gap-4">
              <FormGroup label="SMTP host">
                <Input placeholder="smtp.gmail.com" />
              </FormGroup>
              <FormGroup label="SMTP port">
                <Input type="number" placeholder="587" />
              </FormGroup>
              <FormGroup label="Email address">
                <Input type="email" placeholder="school@domain.com" />
              </FormGroup>
              <FormGroup label="Password">
                <Input type="password" placeholder="App password" />
              </FormGroup>
            </div>
            <Button variant="ghost" icon="device-floppy">Save email settings</Button>
          </Card>
        </div>
      )}

      {/* ── Security ── */}
      {tab === 'security' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Password policy" />
            <div className="grid lg:grid-cols-2 gap-4">
              <FormGroup label="Minimum password length">
                <Input type="number" min={6} max={32} defaultValue={8} />
              </FormGroup>
              <FormGroup label="Session timeout (minutes)">
                <Input type="number" min={15} max={1440} defaultValue={60} />
              </FormGroup>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { label:'Require uppercase letter', checked:true  },
                { label:'Require number',            checked:true  },
                { label:'Require special character', checked:false },
                { label:'Force password reset every 90 days', checked:false },
              ].map(opt => (
                <label key={opt.label} className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" defaultChecked={opt.checked} className="sr-only peer" />
                    <div className="w-9 h-5 rounded-full transition-colors peer-checked:bg-[var(--product-accent)] bg-[var(--c-surface-5)] peer-focus:ring-2 peer-focus:ring-[var(--product-accent)]" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                  </div>
                  <span className="text-[13px] text-[var(--c-ink-1)]">{opt.label}</span>
                </label>
              ))}
            </div>
            <Button variant="primary" icon="device-floppy">Save security settings</Button>
          </Card>

          <Card>
            <CardHeader title="Two-factor authentication" />
            <Alert type="info">
              2FA adds an extra layer of security. When enabled, users will be required to verify with a code on each login.
            </Alert>
            <div className="mt-4 flex gap-3">
              <Button variant="ghost" icon="shield-check">Enable 2FA for all staff</Button>
              <Button variant="ghost" icon="key">Reset all sessions</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
