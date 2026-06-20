/**
 * AdminInterventions.jsx — Full intervention management
 * Log · View · Resolve · Track patterns across students
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/Icon';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Input, Select, FormGroup, Textarea, Alert,
  LoadingScreen, Empty, Tabs,
} from '@/components/ui';

const TYPES     = ['Attendance','Academic','Behaviour','Health','Social-Emotional','Other'];
const SEVERITIES = ['low','medium','high','critical'];

const SEV_META = {
  low:      { variant:'default', color:'var(--c-ink-3)'      },
  medium:   { variant:'amber',   color:'var(--c-amber-400)'  },
  high:     { variant:'red',     color:'var(--c-red-400)'    },
  critical: { variant:'red',     color:'var(--c-rose-400)'   },
};

const TABS = [
  { key:'open',     label:'Open'     },
  { key:'resolved', label:'Resolved' },
  { key:'patterns', label:'Patterns' },
];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[500px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)]">
          <h2 className="font-heading font-semibold text-[16px] text-[var(--c-ink-0)]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-3)] transition-colors">
            <Icon name="x" className="text-[18px]" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function useInterventions(schoolId, resolved) {
  return useQuery({
    queryKey: ['interventions', schoolId, resolved],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interventions')
        .select(`
          id, type, severity, description, action_taken, resolved,
          created_at, resolved_at,
          pupil:pupils(id, first_name, last_name, classes(name)),
          logged_by:profiles!interventions_logged_by_fkey(first_name, last_name)
        `)
        .eq('school_id', schoolId)
        .eq('resolved', resolved)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });
}

function usePupils(schoolId) {
  return useQuery({
    queryKey: ['school-pupils-list', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pupils')
        .select('id,first_name,last_name,classes(name)')
        .eq('school_id', schoolId)
        .order('first_name');
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

function LogForm({ schoolId, pupils, onSave, onCancel, isLoading }) {
  const [form, setForm] = useState({
    pupil_id: '', type: 'Attendance', severity: 'medium',
    description: '', action_taken: '',
  });
  const [error, setError] = useState('');
  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.pupil_id) { setError('Please select a student.'); return; }
    if (!form.description.trim()) { setError('Please describe the concern.'); return; }
    onSave({ ...form, school_id: schoolId, resolved: false });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <FormGroup label="Student *">
        <Select value={form.pupil_id} onChange={update('pupil_id')} required>
          <option value="">Select student…</option>
          {pupils.map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.classes?.name ?? '—'})</option>
          ))}
        </Select>
      </FormGroup>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Type *">
          <Select value={form.type} onChange={update('type')}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormGroup>
        <FormGroup label="Severity *">
          <Select value={form.severity} onChange={update('severity')}>
            {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </FormGroup>
      </div>
      <FormGroup label="Description of concern *">
        <Textarea rows={3} placeholder="Describe the concern in detail…" value={form.description} onChange={update('description')} required />
      </FormGroup>
      <FormGroup label="Action taken (optional)">
        <Textarea rows={2} placeholder="What action has been or will be taken?" value={form.action_taken} onChange={update('action_taken')} />
      </FormGroup>
      <div className="flex gap-3 pt-1">
        <Button variant="primary" type="submit" isLoading={isLoading} icon="plus" className="flex-1 justify-center">Log intervention</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function InterventionCard({ item, onResolve, onView }) {
  const pupil   = item.pupil;
  const sevMeta = SEV_META[item.severity] ?? SEV_META.medium;

  return (
    <div className="p-4 bg-[var(--c-surface-2)] border rounded-xl transition-all hover:border-[var(--c-line-3)]"
      style={{ borderColor: item.severity === 'critical' || item.severity === 'high' ? 'rgba(239,83,80,0.25)' : 'var(--c-line-2)' }}>
      <div className="flex items-start gap-3">
        <Avatar name={pupil ? `${pupil.first_name} ${pupil.last_name}` : '?'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--c-ink-0)] text-[13px]">
              {pupil ? `${pupil.first_name} ${pupil.last_name}` : 'Unknown'}
            </span>
            <span className="text-[11px] text-[var(--c-ink-3)]">{pupil?.classes?.name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Chip variant="default" size="sm">{item.type}</Chip>
            <Chip variant={sevMeta.variant} size="sm">{item.severity}</Chip>
            <span className="text-[10px] font-mono text-[var(--c-ink-4)]">{item.created_at?.slice(0, 10)}</span>
          </div>
          <p className="text-[12px] text-[var(--c-ink-2)] mt-2 leading-relaxed line-clamp-2">{item.description}</p>
          {item.action_taken && (
            <div className="mt-2 text-[11px] text-[var(--c-ink-3)] italic">
              Action: {item.action_taken}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0 ml-2">
          {!item.resolved && (
            <Button variant="ghost" size="sm" icon="circle-check" onClick={() => onResolve(item.id)}>Resolve</Button>
          )}
          <Button variant="ghost" size="sm" icon="message-dots">Message parent</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminInterventions() {
  const { profile, schoolId } = useAuth();
  const qc          = useQueryClient();

  const [tab,      setTab]     = useState('open');
  const [showLog,  setShowLog] = useState(false);
  const [search,   setSearch]  = useState('');
  const [typeFilter, setType]  = useState('');

  const { data: openItems     = [], isLoading: loadOpen }     = useInterventions(schoolId, false);
  const { data: resolvedItems = [], isLoading: loadResolved } = useInterventions(schoolId, true);
  const { data: pupils        = [] }                          = usePupils(schoolId);

  const logIntervention = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('interventions').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['interventions', schoolId]);
      setShowLog(false);
    },
  });

  const resolveIntervention = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('interventions')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(['interventions', schoolId]),
  });

  const filterList = (list) => list.filter(i => {
    const matchSearch = !search || `${i.pupil?.first_name} ${i.pupil?.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchType   = !typeFilter || i.type === typeFilter;
    return matchSearch && matchType;
  });

  const activeList   = filterList(openItems);
  const resolvedList = filterList(resolvedItems);

  // Pattern analysis
  const byType     = {};
  const bySeverity = {};
  openItems.forEach(i => {
    byType[i.type]         = (byType[i.type] ?? 0) + 1;
    bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Interventions"
        subtitle="Flag, track, and resolve student concerns."
      >
        <Button variant="primary" icon="plus" onClick={() => setShowLog(true)}>Log intervention</Button>
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Open"           value={openItems.length}                                    deltaDir="flat" icon="alert-triangle"  />
        <KpiCard label="Critical / High" value={openItems.filter(i=>['critical','high'].includes(i.severity)).length} deltaDir="down" icon="alert-circle" />
        <KpiCard label="Resolved (month)" value={resolvedItems.length}                             deltaDir="up"   icon="circle-check"    />
        <KpiCard label="Students affected" value={new Set(openItems.map(i=>i.pupil?.id).filter(Boolean)).size} deltaDir="flat" icon="users" />
      </div>

      <Tabs
        tabs={[
          { key:'open',     label:'Open',     count: openItems.length     },
          { key:'resolved', label:'Resolved', count: resolvedItems.length },
          { key:'patterns', label:'Patterns'                               },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* Filter bar */}
      {tab !== 'patterns' && (
        <div className="flex flex-wrap gap-3 mb-5">
          <Input className="max-w-[240px]" placeholder="Search by student name…" value={search} onChange={e => setSearch(e.target.value)} />
          <Select className="max-w-[180px]" value={typeFilter} onChange={e => setType(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      )}

      {/* Open tab */}
      {tab === 'open' && (
        loadOpen ? <LoadingScreen /> : activeList.length === 0 ? (
          <Empty icon="circle-check" message="No open interventions. Great job!" />
        ) : (
          <div className="space-y-3">
            {activeList.map(item => (
              <InterventionCard
                key={item.id}
                item={item}
                onResolve={(id) => resolveIntervention.mutate(id)}
              />
            ))}
          </div>
        )
      )}

      {/* Resolved tab */}
      {tab === 'resolved' && (
        loadResolved ? <LoadingScreen /> : resolvedList.length === 0 ? (
          <Empty icon="history" message="No resolved interventions yet." />
        ) : (
          <div className="space-y-3">
            {resolvedList.map(item => (
              <InterventionCard key={item.id} item={item} onResolve={() => {}} />
            ))}
          </div>
        )
      )}

      {/* Patterns tab */}
      {tab === 'patterns' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="By type" />
            {Object.entries(byType).length === 0 ? (
              <Empty icon="chart-bar" message="No data yet." />
            ) : (
              Object.entries(byType).sort((a,b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
                  <Chip variant="default" size="sm">{type}</Chip>
                  <div className="flex-1 bg-[var(--c-surface-4)] rounded-full h-1.5">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((count/openItems.length)*100)}%`, background:'var(--product-accent)' }} />
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--c-ink-0)] w-6 text-right">{count}</span>
                </div>
              ))
            )}
          </Card>
          <Card>
            <CardHeader title="By severity" />
            {SEVERITIES.map(sev => {
              const count = bySeverity[sev] ?? 0;
              const meta  = SEV_META[sev];
              return (
                <div key={sev} className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
                  <Chip variant={meta.variant} size="sm">{sev}</Chip>
                  <div className="flex-1 bg-[var(--c-surface-4)] rounded-full h-1.5">
                    <div className="h-full rounded-full" style={{ width: openItems.length ? `${Math.round((count/openItems.length)*100)}%` : '0%', background: meta.color }} />
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--c-ink-0)] w-6 text-right">{count}</span>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Log modal */}
      {showLog && (
        <Modal title="Log intervention" onClose={() => setShowLog(false)}>
          <LogForm
            schoolId={schoolId}
            pupils={pupils}
            onSave={payload => logIntervention.mutate(payload)}
            onCancel={() => setShowLog(false)}
            isLoading={logIntervention.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
