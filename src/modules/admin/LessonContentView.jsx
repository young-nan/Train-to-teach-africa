/**
 * src/modules/admin/LessonContentView.jsx
 *
 * /app/super/content
 *
 * SuperAdmin lesson content management. Two tabs:
 *
 *   Importer  — Drag-drop or paste a JSON array of lessons. Each row is
 *               validated against LessonSchema before DB insert. Results
 *               show per-row success / failure so content authors can fix
 *               individual bad rows without re-running the whole batch.
 *
 *   Browser   — Search and filter the full lesson catalogue. Archive or
 *               restore individual lessons. Deep-link to curriculum_code
 *               for content team reference.
 *
 * Used by: TTA content team and super_admin only.
 * The route is behind <RequireRole allow={['super_admin']}> in SuperAdminApp.
 */

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { friendlyError } from '@/utils/friendlyError';
import * as lessonService from '@/services/lessonService';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS = [
  { value: '',           label: 'All levels' },
  { value: 'nursery_1',  label: 'Nursery 1'  },
  { value: 'nursery_2',  label: 'Nursery 2'  },
  { value: 'primary_1',  label: 'Primary 1'  },
  { value: 'primary_2',  label: 'Primary 2'  },
  { value: 'primary_3',  label: 'Primary 3'  },
  { value: 'primary_4',  label: 'Primary 4'  },
  { value: 'primary_5',  label: 'Primary 5'  },
  { value: 'primary_6',  label: 'Primary 6'  },
];

const STATUSES = [
  { value: '',         label: 'All statuses'  },
  { value: 'published',label: 'Published'     },
  { value: 'draft',    label: 'Draft'         },
  { value: 'archived', label: 'Archived'      },
];

// ── Root component ─────────────────────────────────────────────────────────────

export function LessonContentView() {
  const [tab, setTab] = useState('importer'); // 'importer' | 'browser'

  return (
    <div className="space-y-s-6">
      {/* Page header */}
      <div>
        <h1 className="font-display text-[26px] text-ink-0">Lesson Content</h1>
        <p className="text-[13px] text-ink-3 mt-s-1">
          Import lesson JSON files and manage the published curriculum catalogue.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-s-1 bg-surface-2 border border-line-2 rounded-r-2 p-[3px] w-fit">
        {[
          { id: 'importer', label: '↑ Import'  },
          { id: 'browser',  label: '⊞ Browse'  },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-s-5 py-[6px] rounded-[6px] text-[13px] font-medium transition-all duration-150',
              tab === t.id
                ? 'bg-surface-4 text-ink-0 shadow-sm'
                : 'text-ink-3 hover:text-ink-1',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'importer' ? <ImporterTab /> : <BrowserTab />}
    </div>
  );
}

// ── Importer tab ───────────────────────────────────────────────────────────────

function ImporterTab() {
  const [parseError, setParseError]   = useState(null);
  const [parsed, setParsed]           = useState(null); // Array<lesson>
  const [isDragging, setIsDragging]   = useState(false);
  const [importResult, setImportResult] = useState(null); // { imported, failed }
  const fileRef = useRef(null);
  const qc = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (lessons) => lessonService.bulkImportLessons(lessons),
    onSuccess: (result) => {
      setImportResult(result);
      // Bust the browser tab cache so newly imported lessons appear
      qc.invalidateQueries({ queryKey: ['lessons-admin'] });
    },
  });

  const parseCSV = useCallback((text) => {
    // Minimal RFC-4180 CSV parser — no external dependency.
    // Expects a header row. Quoted fields with commas are supported.
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { setParseError('CSV must have a header row and at least one data row.'); return; }

    // Parse a single CSV line into tokens (handles quoted fields)
    function parseLine(line) {
      const tokens = [];
      let cur = ''; let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i+1] === '"') { cur += '"'; i++; } // escaped quote
          else inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          tokens.push(cur.trim()); cur = '';
        } else {
          cur += ch;
        }
      }
      tokens.push(cur.trim());
      return tokens;
    }

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });
      // Normalise common CSV column names to lesson schema field names
      if (obj.curriculum_code === undefined && obj.code !== undefined) obj.curriculum_code = obj.code;
      if (obj.week_of_term   === undefined && obj.week !== undefined)  obj.week_of_term   = obj.week;
      if (obj.estimated_minutes === undefined && obj.minutes !== undefined) obj.estimated_minutes = obj.minutes;
      rows.push(obj);
    }

    if (rows.length === 0) { setParseError('No data rows found in CSV.'); return; }
    if (rows.length > 200) { setParseError('Maximum 200 lessons per batch. Split the file.'); return; }
    setParseError(null);
    setParsed(rows);
  }, []);

  const processText = useCallback((text, filename = '') => {
    setParseError(null);
    setParsed(null);
    setImportResult(null);
    const isCSV = filename.toLowerCase().endsWith('.csv') || text.trimStart().startsWith('"') && !text.trimStart().startsWith('"level":{');
    if (isCSV) {
      parseCSV(text);
      return;
    }
    try {
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : [json];
      if (arr.length === 0) { setParseError('JSON array is empty.'); return; }
      if (arr.length > 200) { setParseError('Maximum 200 lessons per batch. Split the file.'); return; }
      setParsed(arr);
    } catch {
      // Fallback: try CSV if JSON fails
      if (text.includes(',') && text.includes('\n')) {
        parseCSV(text);
      } else {
        setParseError('Invalid file. Paste a JSON array or drop a .csv file with a header row.');
      }
    }
  }, [parseCSV]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processText(ev.target.result, file.name);
    reader.readAsText(file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processText(ev.target.result, file.name);
    reader.readAsText(file);
  }, [processText]);

  const onPaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
      processText(text);
    }
  };

  const reset = () => {
    setParsed(null);
    setParseError(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Step 1: Drop zone ──────────────────────────────────────────────────────
  if (!parsed && !importResult) {
    return (
      <div className="space-y-s-5">
        {/* Drop / click zone — label wraps hidden input for trusted file-picker activation */}
        <label
          htmlFor="lesson-file-input"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onPaste={onPaste}
          tabIndex={0}
          className={cn(
            'border-2 border-dashed rounded-r-3 p-s-10 text-center cursor-pointer transition-all duration-150 block',
            'focus:outline-none focus:border-gold-400',
            isDragging
              ? 'border-gold-400 bg-gold-400/5'
              : 'border-line-3 hover:border-line-3 bg-surface-2',
          )}
        >
          <div className="text-[36px] mb-s-3">📂</div>
          <p className="text-[15px] text-ink-1 font-medium mb-s-2">
            Drop a <code className="font-mono text-gold-200">.json</code> or <code className="font-mono text-gold-200">.csv</code> file here
          </p>
          <p className="text-[13px] text-ink-3 mb-s-4">
            or click to browse · or paste JSON directly into this area
          </p>
          <Chip variant="default" size="sm">JSON array or CSV with header row · max 200 rows per batch</Chip>
          <input
            id="lesson-file-input"
            ref={fileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="sr-only"
            onChange={onFileChange}
          />
        </label>

        {parseError && (
          <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-r-2 px-s-4 py-s-3">
            ⚠ {parseError}
          </div>
        )}

        {/* Format reference */}
        <Card className="p-s-5">
          <p className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3 mb-s-3">Expected JSON shape</p>
          <pre className="text-[12px] text-ink-2 overflow-x-auto leading-relaxed">{`[
  {
    "id": "uuid-v4",
    "curriculumCode": "NERDC.PRI3.MATHS.NUM.05",
    "level": "primary_3",
    "subject": "Mathematics",
    "topic": "Place Value",
    "title": "Hundreds, Tens and Units",
    "weekOfTerm": 3,
    "sortIndex": 12,
    "layers": {
      "studentBody": "...",
      "studentActivities": [...],
      "teacherObjectives": [...],
      "teacherPacing": [...],
      "parentSummary": "...",
      "parentKitchenActivity": "...",
      "parentDinnerQuestions": ["...", "...", "..."]
    },
    "assessment": {
      "questions": [...],
      "passMark": 60
    },
    "metadata": {
      "createdAt": "2026-05-01T00:00:00Z",
      "updatedAt": "2026-05-01T00:00:00Z",
      "estimatedMinutes": 30,
      "version": 1
    }
  }
]`}</pre>
        </Card>
      </div>
    );
  }

  // ── Step 2: Preview & confirm ─────────────────────────────────────────────
  if (parsed && !importResult) {
    return (
      <div className="space-y-s-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] text-ink-0 font-medium">
              Ready to import {parsed.length} lesson{parsed.length !== 1 ? 's' : ''}
            </p>
            <p className="text-[13px] text-ink-3 mt-s-1">
              Each row will be validated before insert. Duplicates (same
              <code className="font-mono text-ink-2 mx-1">curriculum_code</code>) are upserted.
            </p>
          </div>
          <Button intent="ghost" size="sm" onClick={reset}>← Change file</Button>
        </div>

        {/* Lesson preview table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-2">
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em] w-[40px]">#</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Title</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Level</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Subject</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Code</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 20).map((l, i) => (
                  <tr key={i} className="border-b border-line-1 hover:bg-surface-2/50">
                    <td className="px-s-4 py-s-3 text-ink-4">{i + 1}</td>
                    <td className="px-s-4 py-s-3 text-ink-1">{l.title ?? <span className="text-red-400">missing</span>}</td>
                    <td className="px-s-4 py-s-3 text-ink-3">{l.level ?? '—'}</td>
                    <td className="px-s-4 py-s-3 text-ink-3">{l.subject ?? '—'}</td>
                    <td className="px-s-4 py-s-3 font-mono text-ink-4 text-[11px]">{l.curriculumCode ?? '—'}</td>
                  </tr>
                ))}
                {parsed.length > 20 && (
                  <tr>
                    <td colSpan={5} className="px-s-4 py-s-3 text-ink-4 text-center">
                      … and {parsed.length - 20} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {importMutation.error && (
          <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-r-2 px-s-4 py-s-3">
            ⚠ {friendlyError(importMutation.error)}
          </div>
        )}

        <div className="flex gap-s-3">
          <Button
            intent="primary"
            onClick={() => importMutation.mutate(parsed)}
            isLoading={importMutation.isPending}
          >
            Import {parsed.length} lesson{parsed.length !== 1 ? 's' : ''}
          </Button>
          <Button intent="ghost" onClick={reset} disabled={importMutation.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 3: Results ───────────────────────────────────────────────────────
  if (importResult) {
    const allGood = importResult.failed.length === 0;
    return (
      <div className="space-y-s-5">
        {/* Summary banner */}
        <div className={cn(
          'rounded-r-2 px-s-5 py-s-4 border',
          allGood
            ? 'bg-green-400/10 border-green-400/20 text-green-400'
            : 'bg-amber-400/10 border-amber-400/20 text-amber-400',
        )}>
          <p className="text-[15px] font-medium">
            {allGood ? '✓ ' : '⚠ '}
            {importResult.imported} lesson{importResult.imported !== 1 ? 's' : ''} imported successfully
            {importResult.failed.length > 0 && ` · ${importResult.failed.length} failed`}
          </p>
        </div>

        {/* Failures detail */}
        {importResult.failed.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-s-5 py-s-4 border-b border-line-2">
              <p className="text-[13px] font-medium text-ink-1">Failed rows — fix these and re-import</p>
            </div>
            <div className="divide-y divide-line-1">
              {importResult.failed.map((f) => (
                <div key={f.index} className="px-s-5 py-s-3 flex gap-s-4 items-start">
                  <span className="text-[11px] font-mono text-ink-4 mt-[2px] shrink-0">Row {f.index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink-1 truncate">{f.title}</p>
                    <p className="text-[12px] text-red-400 mt-[2px] break-words">{f.error}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Button intent="ghost" onClick={reset}>Import another batch</Button>
      </div>
    );
  }

  return null;
}

// ── Browser tab ────────────────────────────────────────────────────────────────

function BrowserTab() {
  const [level,   setLevel]   = useState('');
  const [subject, setSubject] = useState('');
  const [status,  setStatus]  = useState('published');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(0);
  const PAGE_SIZE = 50;
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['lessons-admin', { level, subject, status, search, page }],
    queryFn:  () => lessonService.listAllLessonsAdmin({ level, subject, status, search, page, pageSize: PAGE_SIZE }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const archiveMutation = useMutation({
    mutationFn: lessonService.archiveLesson,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lessons-admin'] }),
  });

  const restoreMutation = useMutation({
    mutationFn: lessonService.restoreLesson,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lessons-admin'] }),
  });

  const lessons = data?.lessons ?? [];
  const total   = data?.total   ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const statusChip = (s) => {
    if (s === 'published') return <Chip variant="green"  size="sm">Published</Chip>;
    if (s === 'draft')     return <Chip variant="amber"  size="sm">Draft</Chip>;
    if (s === 'archived')  return <Chip variant="default" size="sm">Archived</Chip>;
    return <Chip variant="default" size="sm">{s}</Chip>;
  };

  return (
    <div className="space-y-s-5">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-s-3 items-center">
        <input
          type="search"
          placeholder="Search title, topic, code…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-[7px] text-[13px] text-ink-0 placeholder-ink-4 outline-none focus:border-gold-400 w-[240px]"
        />
        <Select value={level}   onChange={(v) => { setLevel(v);   setPage(0); }} options={LEVELS}   />
        <Select value={status}  onChange={(v) => { setStatus(v);  setPage(0); }} options={STATUSES} />

        {total > 0 && (
          <span className="text-[12px] text-ink-4 ml-auto">
            {total} lesson{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading && (
          <div className="p-s-8 text-center text-ink-3 text-[13px]">Loading…</div>
        )}

        {isError && (
          <div className="p-s-5 text-[13px] text-red-400">
            ⚠ {friendlyError(error)}
          </div>
        )}

        {!isLoading && !isError && lessons.length === 0 && (
          <div className="p-s-8 text-center text-ink-3 text-[13px]">
            No lessons found. Try adjusting the filters or importing some content.
          </div>
        )}

        {!isLoading && lessons.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-2">
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Title</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Level</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Subject</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Wk</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Status</th>
                  <th className="text-left px-s-4 py-s-3 text-ink-3 font-mono text-meta uppercase tracking-[0.10em]">Code</th>
                  <th className="px-s-4 py-s-3"></th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.id} className="border-b border-line-1 hover:bg-surface-2/50 group">
                    <td className="px-s-4 py-[10px]">
                      <p className="text-ink-1 font-medium leading-snug">{String(l.title ?? '')}</p>
                      <p className="text-ink-4 text-[11px] mt-[1px]">{String(l.topic ?? '')}</p>
                    </td>
                    <td className="px-s-4 py-[10px] text-ink-3 whitespace-nowrap">
                      {String(l.level ?? '').replace('_', ' ')}
                    </td>
                    <td className="px-s-4 py-[10px] text-ink-3 whitespace-nowrap">
                      {String(l.subject ?? '')}
                    </td>
                    <td className="px-s-4 py-[10px] text-ink-4 text-center">{l.week_of_term ?? '—'}</td>
                    <td className="px-s-4 py-[10px]">{statusChip(l.status)}</td>
                    <td className="px-s-4 py-[10px] font-mono text-ink-4 text-[11px] whitespace-nowrap">
                      {l.curriculum_code}
                    </td>
                    <td className="px-s-4 py-[10px] text-right">
                      {l.status === 'archived' ? (
                        <button
                          onClick={() => restoreMutation.mutate(l.id)}
                          disabled={restoreMutation.isPending}
                          className="text-[12px] text-gold-200 hover:text-gold-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Restore
                        </button>
                      ) : (
                        <ArchiveButton
                          title={l.title}
                          onConfirm={() => archiveMutation.mutate(l.id)}
                          isPending={archiveMutation.isPending}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center gap-s-3 justify-center">
          <Button
            intent="ghost" size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Prev
          </Button>
          <span className="text-[12px] text-ink-3">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            intent="ghost" size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-[7px] text-[13px] text-ink-1 outline-none focus:border-gold-400 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ArchiveButton({ title, onConfirm, isPending }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span className="flex items-center gap-s-2 font-mono text-[11px]">
        <span className="text-red-400">Archive?</span>
        <button onClick={() => { onConfirm(); setConfirm(false); }} className="text-red-400 font-medium" disabled={isPending}>
          {isPending ? '…' : 'Yes'}
        </button>
        <button onClick={() => setConfirm(false)} className="text-ink-3">No</button>
      </span>
    );
  }
  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-[12px] text-ink-4 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      Archive
    </button>
  );
}
