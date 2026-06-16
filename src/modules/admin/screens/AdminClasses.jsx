/**
 * AdminClasses.jsx — Full class management
 * List · Create · Edit · Assign teacher · View pupils per class
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Input, Select, FormGroup, Textarea,
  LoadingScreen, Empty, ProgressBar, Tabs, Alert,
} from '@/components/ui';

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[500px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)]">
          <h2 className="font-heading font-semibold text-[16px] text-[var(--c-ink-0)]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-3)] transition-colors">
            <i className="ti ti-x text-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Data hooks ────────────────────────────────────────────────────────────────
function useClasses(schoolId) {
  return useQuery({
    queryKey: ['admin-classes', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id, name, description, capacity, created_at,
          teacher:profiles!classes_teacher_id_fkey(id, first_name, last_name),
          pupils(id)
        `)
        .eq('school_id', schoolId)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });
}

function useTeachers(schoolId) {
  return useQuery({
    queryKey: ['admin-teachers', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('school_id', schoolId)
        .in('role', ['teacher', 'head_teacher'])
        .order('first_name');
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

function usePupilsInClass(classId) {
  return useQuery({
    queryKey: ['class-pupils', classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data } = await supabase
        .from('pupils')
        .select('id, first_name, last_name, gender, status, admission_number')
        .eq('class_id', classId)
        .order('first_name');
      return data ?? [];
    },
    enabled: !!classId,
  });
}

// ── Class form ────────────────────────────────────────────────────────────────
function ClassForm({ initial = {}, teachers = [], schoolId, onSave, onCancel, isLoading }) {
  const [form, setForm] = useState({
    name:        initial.name        ?? '',
    description: initial.description ?? '',
    teacher_id:  initial.teacher?.id ?? '',
    capacity:    initial.capacity    ?? 30,
  });
  const [error, setError] = useState('');

  const update = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Class name is required.'); return; }
    onSave({ ...form, school_id: schoolId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}

      <FormGroup label="Class name *">
        <Input placeholder="e.g. Primary 2A" value={form.name} onChange={update('name')} required />
      </FormGroup>

      <FormGroup label="Class teacher">
        <Select value={form.teacher_id} onChange={update('teacher_id')}>
          <option value="">Assign later…</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
          ))}
        </Select>
      </FormGroup>

      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Capacity">
          <Input type="number" min={1} max={200} value={form.capacity} onChange={update('capacity')} />
        </FormGroup>
      </div>

      <FormGroup label="Description">
        <Textarea rows={2} placeholder="Optional notes about this class…" value={form.description} onChange={update('description')} />
      </FormGroup>

      <div className="flex gap-3 pt-2">
        <Button variant="primary" type="submit" isLoading={isLoading} className="flex-1 justify-center">
          {initial.id ? 'Save changes' : 'Create class'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const TABS = [
  { key: 'classes',  label: 'All classes' },
  { key: 'detail',   label: 'Class detail' },
];

export default function AdminClasses() {
  const { profile, schoolId } = useAuth();
  const schoolId = schoolId;
  const qc = useQueryClient();

  const [tab,         setTab]         = useState('classes');
  const [selectedCls, setSelectedCls] = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [search,      setSearch]      = useState('');

  const { data: classes  = [], isLoading }  = useClasses(schoolId);
  const { data: teachers = [] }             = useTeachers(schoolId);
  const { data: classPupils = [] }          = usePupilsInClass(selectedCls?.id);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createClass = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('classes').insert({
        name:        payload.name,
        description: payload.description || null,
        teacher_id:  payload.teacher_id  || null,
        capacity:    Number(payload.capacity),
        school_id:   schoolId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['admin-classes', schoolId]);
      setShowCreate(false);
    },
  });

  const updateClass = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase
        .from('classes')
        .update({
          name:        payload.name,
          description: payload.description || null,
          teacher_id:  payload.teacher_id  || null,
          capacity:    Number(payload.capacity),
        })
        .eq('id', editTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['admin-classes', schoolId]);
      setEditTarget(null);
    },
  });

  const deleteClass = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['admin-classes', schoolId]);
      if (selectedCls && selectedCls.id === deleteClass.variables) setSelectedCls(null);
    },
  });

  const filtered = classes.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = (cls) => { setSelectedCls(cls); setTab('detail'); };

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Classes"
        subtitle={`${classes.length} class${classes.length !== 1 ? 'es' : ''} · ${classes.reduce((a, c) => a + (c.pupils?.length ?? 0), 0)} students total`}
      >
        <Button variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Add class</Button>
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total classes"  value={classes.length}                                                     icon="chalkboard"    deltaDir="flat" />
        <KpiCard label="Total students" value={classes.reduce((a,c) => a + (c.pupils?.length ?? 0), 0)}            icon="users"         deltaDir="flat" />
        <KpiCard label="Assigned teachers" value={classes.filter(c => c.teacher).length}                          icon="id-badge-2"    deltaDir="flat" />
        <KpiCard label="Unassigned"     value={classes.filter(c => !c.teacher).length}                             icon="alert-triangle" deltaDir="flat" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── All classes tab ── */}
      {tab === 'classes' && (
        <>
          <div className="mb-4">
            <Input
              className="max-w-[280px]"
              placeholder="Search classes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? <LoadingScreen /> : filtered.length === 0 ? (
            <Empty
              icon="chalkboard"
              message={search ? 'No classes match your search.' : 'No classes yet. Create your first class to get started.'}
              action={<Button variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Add class</Button>}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(cls => {
                const pupilCount  = cls.pupils?.length ?? 0;
                const capacity    = cls.capacity ?? 30;
                const fillPct     = Math.min(100, Math.round((pupilCount / capacity) * 100));
                const teacher     = cls.teacher;

                return (
                  <Card key={cls.id} className="cursor-pointer hover:border-[var(--product-accent)] transition-all group" padding>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-heading font-bold text-[16px] text-[var(--c-ink-0)]">{cls.name}</div>
                        {cls.description && (
                          <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5 line-clamp-1">{cls.description}</div>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditTarget(cls); }}
                          className="w-7 h-7 flex items-center justify-center rounded text-[var(--c-ink-3)] hover:text-[var(--c-ink-0)] hover:bg-[var(--c-surface-4)] transition-colors"
                        >
                          <i className="ti ti-pencil text-[14px]" aria-hidden="true" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if(window.confirm(`Delete ${cls.name}?`)) deleteClass.mutate(cls.id); }}
                          className="w-7 h-7 flex items-center justify-center rounded text-[var(--c-ink-3)] hover:text-[var(--c-rose-400)] hover:bg-[rgba(251,113,133,0.1)] transition-colors"
                        >
                          <i className="ti ti-trash text-[14px]" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Teacher */}
                    <div className="flex items-center gap-2 mb-4">
                      {teacher ? (
                        <>
                          <Avatar name={`${teacher.first_name} ${teacher.last_name}`} size="sm" />
                          <div>
                            <div className="text-[12px] font-medium text-[var(--c-ink-1)]">{teacher.first_name} {teacher.last_name}</div>
                            <div className="text-[10px] text-[var(--c-ink-4)]">Class teacher</div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-[12px] text-[var(--c-amber-400)]">
                          <i className="ti ti-alert-triangle text-[14px]" aria-hidden="true" />
                          No teacher assigned
                        </div>
                      )}
                    </div>

                    {/* Fill rate */}
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-[var(--c-ink-3)]">Students</span>
                      <span className="text-[var(--c-ink-2)] font-semibold">{pupilCount} / {capacity}</span>
                    </div>
                    <ProgressBar
                      value={fillPct}
                      color={fillPct >= 90 ? 'var(--c-rose-400)' : fillPct >= 70 ? 'var(--product-accent)' : 'var(--c-green-400)'}
                    />

                    <button
                      onClick={() => openDetail(cls)}
                      className="mt-4 w-full py-2 rounded-lg text-[12px] font-semibold text-[var(--product-accent)] bg-[var(--c-surface-3)] hover:bg-[var(--c-surface-4)] transition-colors"
                    >
                      View class →
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Class detail tab ── */}
      {tab === 'detail' && (
        <>
          {!selectedCls ? (
            <Empty icon="chalkboard" message="Select a class from the 'All classes' tab to view details." />
          ) : (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="font-heading text-[20px] font-bold text-[var(--c-ink-0)]">{selectedCls.name}</div>
                  <div className="text-[13px] text-[var(--c-ink-3)] mt-0.5">
                    {selectedCls.teacher
                      ? `${selectedCls.teacher.first_name} ${selectedCls.teacher.last_name}`
                      : 'No teacher assigned'} · {classPupils.length} students
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" icon="pencil" onClick={() => setEditTarget(selectedCls)}>Edit</Button>
                  <Button variant="ghost" size="sm" icon="download">Export list</Button>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                {/* Pupil list */}
                <Card className="lg:col-span-2" padding={false}>
                  <div className="px-5 pt-5 pb-3">
                    <h3 className="font-heading font-semibold text-[14px] text-[var(--c-ink-1)]">Students ({classPupils.length})</h3>
                  </div>
                  {classPupils.length === 0 ? (
                    <div className="px-5 pb-5">
                      <Empty icon="users" message="No students in this class yet." />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--c-line-2)]">
                            {['Student', 'Admission no.', 'Gender', 'Status'].map(h => (
                              <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {classPupils.map(p => (
                            <tr key={p.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                                  <span className="font-medium text-[var(--c-ink-0)]">{p.first_name} {p.last_name}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{p.admission_number ?? '—'}</td>
                              <td className="px-5 py-3 text-[var(--c-ink-2)]">{p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : '—'}</td>
                              <td className="px-5 py-3">
                                <Chip variant={p.status === 'active' ? 'green' : 'default'} size="sm">{p.status ?? 'active'}</Chip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* Side info */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader title="Class info" />
                    {[
                      { label: 'Capacity',   value: `${classPupils.length} / ${selectedCls.capacity ?? 30}` },
                      { label: 'Created',    value: selectedCls.created_at?.slice(0,10) ?? '—' },
                      { label: 'Description',value: selectedCls.description ?? '—' },
                    ].map(r => (
                      <div key={r.label} className="flex items-start justify-between py-2.5 border-b border-[var(--c-line-1)] last:border-0">
                        <span className="text-[12px] text-[var(--c-ink-3)]">{r.label}</span>
                        <span className="text-[12px] font-medium text-[var(--c-ink-1)] text-right max-w-[140px]">{r.value}</span>
                      </div>
                    ))}
                  </Card>

                  <Card>
                    <CardHeader title="Assign teacher" />
                    <Select
                      value={selectedCls.teacher?.id ?? ''}
                      onChange={async (e) => {
                        const teacher_id = e.target.value || null;
                        await supabase.from('classes').update({ teacher_id }).eq('id', selectedCls.id);
                        qc.invalidateQueries(['admin-classes', schoolId]);
                        setSelectedCls(prev => ({ ...prev, teacher: teachers.find(t => t.id === teacher_id) ?? null }));
                      }}
                    >
                      <option value="">No teacher</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                      ))}
                    </Select>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal title="Create new class" onClose={() => setShowCreate(false)}>
          <ClassForm
            teachers={teachers}
            schoolId={schoolId}
            onSave={(payload) => createClass.mutate(payload)}
            onCancel={() => setShowCreate(false)}
            isLoading={createClass.isPending}
          />
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <ClassForm
            initial={editTarget}
            teachers={teachers}
            schoolId={schoolId}
            onSave={(payload) => updateClass.mutate(payload)}
            onCancel={() => setEditTarget(null)}
            isLoading={updateClass.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
