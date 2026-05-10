/**
 * src/modules/admin/PupilImportView.jsx
 *
 * /app/admin/pupils/import
 *
 * School admins paste CSV text → preview parsed rows → see validation
 * results → click Import. After import, show a result panel with
 * per-row errors so the admin can fix and re-import the failed rows.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as pupilImportService from '@/services/pupilImportService';
import { cn } from '@/utils/cn';

const SAMPLE_CSV = `full_name,pupil_code,class_name,date_of_birth,level
Aisha Bello,AISHA-3E,Primary 3 Emerald,2018-04-12,primary_3
Chinedu Okeke,CHINEDU-3E,Primary 3 Emerald,2018-07-22,primary_3
Tomiwa Akande,TOMIWA-4S,Primary 4 Sapphire,2017-09-30,primary_4`;

export function PupilImportView() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const qc = useQueryClient();

  const [csv, setCsv] = useState('');
  const [result, setResult] = useState(null);

  // Load the school's classes so the user knows valid class_name values.
  const { data: classes } = useQuery({
    queryKey: ['admin', 'classes-for-import', schoolId],
    queryFn: () => pupilImportService.listClassesForImport(schoolId),
    enabled: !!schoolId,
    staleTime: 5 * 60_000,
  });

  // Parse + validate as the user types. Cheap; runs locally.
  const preview = useMemo(() => {
    if (!csv.trim()) return null;
    const parsed = pupilImportService.parseCsv(csv);
    const knownClassNames = new Set((classes ?? []).map((c) => c.name));
    const rowResults = parsed.rows.map((row) => ({
      row,
      errors: pupilImportService.validateRow(row, knownClassNames),
    }));
    return {
      headers: parsed.headers,
      rowResults,
      validCount: rowResults.filter((r) => r.errors.length === 0).length,
      errorCount: rowResults.filter((r) => r.errors.length > 0).length,
    };
  }, [csv, classes]);

  const importMutation = useMutation({
    mutationFn: () => pupilImportService.importPupils({
      schoolId,
      rows: preview.rowResults.map((r) => r.row),
    }),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  // After import, show result panel
  if (result) {
    return <ResultPanel result={result} onAgain={() => { setResult(null); setCsv(''); }} />;
  }

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-5">
        <Link to="/app/admin" className="text-[13.5px] text-ink-3 hover:text-ink-1">← Admin</Link>
      </div>
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Pupil import</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Bulk add pupils.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          Paste a CSV with one row per pupil. The first row must be the
          header. Required columns: <span className="text-ink-0">full_name, pupil_code, class_name</span>.
          Optional: date_of_birth (YYYY-MM-DD), level, photo_url.
        </p>
      </div>

      {classes && classes.length > 0 && (
        <Card className="mb-s-5">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Valid class names</div>
          <div className="flex flex-wrap gap-s-2">
            {classes.map((c) => (
              <Chip key={c.id} variant="default">{c.name}</Chip>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-s-5">
        <div className="flex items-center justify-between mb-s-3">
          <div className="font-mono text-eyebrow uppercase text-gold-400">CSV</div>
          <button
            type="button"
            onClick={() => setCsv(SAMPLE_CSV)}
            className="text-[12.5px] text-gold-200 hover:text-gold-50 underline-offset-4 hover:underline"
          >
            Load sample
          </button>
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder="Paste your CSV here…"
          className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[13px] font-mono text-ink-1 outline-none focus:border-gold-400 resize-y"
        />
      </Card>

      {preview && (
        <PreviewPanel preview={preview} />
      )}

      <div className="flex justify-end gap-s-3">
        <Button
          intent="primary"
          size="lg"
          onClick={() => importMutation.mutate()}
          isLoading={importMutation.isPending}
          disabled={!preview || preview.validCount === 0}
        >
          Import {preview?.validCount ?? 0} pupils
        </Button>
      </div>

      {importMutation.error && (
        <div className="mt-s-4 text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
          {importMutation.error.message}
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ preview }) {
  if (preview.rowResults.length === 0) {
    return (
      <Card className="mb-s-5 border-amber-400/30 bg-amber-400/[0.04]">
        <p className="text-[13.5px] text-amber-400">
          No data rows found. Make sure your first line is the header
          (e.g. <span className="font-mono">full_name,pupil_code,class_name</span>).
        </p>
      </Card>
    );
  }
  return (
    <Card className="mb-s-5">
      <div className="flex items-center gap-s-3 flex-wrap mb-s-4">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Preview</div>
        <Chip variant="green" dot>{preview.validCount} valid</Chip>
        {preview.errorCount > 0 && (
          <Chip variant="red" dot>{preview.errorCount} with errors</Chip>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-left">
              <th className="font-mono text-meta uppercase text-ink-3 pb-s-2 pr-s-3">Line</th>
              <th className="font-mono text-meta uppercase text-ink-3 pb-s-2 pr-s-3">Pupil</th>
              <th className="font-mono text-meta uppercase text-ink-3 pb-s-2 pr-s-3">Code</th>
              <th className="font-mono text-meta uppercase text-ink-3 pb-s-2 pr-s-3">Class</th>
              <th className="font-mono text-meta uppercase text-ink-3 pb-s-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.rowResults.slice(0, 50).map((r, i) => (
              <tr key={i} className={cn(
                'border-t border-line-1',
                r.errors.length > 0 && 'bg-red-400/[0.04]',
              )}>
                <td className="py-s-2 pr-s-3 font-mono text-ink-3 text-[11px]">{r.row.__line}</td>
                <td className="py-s-2 pr-s-3 text-ink-1 truncate max-w-[180px]">{r.row.full_name || <span className="text-red-400">missing</span>}</td>
                <td className="py-s-2 pr-s-3 font-mono text-[11px] text-ink-2">{r.row.pupil_code || <span className="text-red-400">missing</span>}</td>
                <td className="py-s-2 pr-s-3 text-ink-2">{r.row.class_name}</td>
                <td className="py-s-2">
                  {r.errors.length === 0 ? (
                    <span className="text-green-400 text-[12px]">OK</span>
                  ) : (
                    <span className="text-red-400 text-[12px]">{r.errors[0]}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.rowResults.length > 50 && (
          <p className="text-[11.5px] text-ink-3 mt-s-3 font-mono">
            Showing first 50 of {preview.rowResults.length} rows. All will be imported.
          </p>
        )}
      </div>
    </Card>
  );
}

function ResultPanel({ result, onAgain }) {
  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <Chip variant="green" dot>Done</Chip>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          {result.inserted} pupils added.
        </h2>
        {result.errors.length > 0 && (
          <p className="mt-s-3 text-body text-amber-400">
            {result.errors.length} {result.errors.length === 1 ? 'row' : 'rows'} couldn't be imported. See below.
          </p>
        )}
      </div>

      {result.errors.length > 0 && (
        <Card className="mb-s-5 border-red-400/30">
          <div className="font-mono text-eyebrow uppercase text-red-400 mb-s-3">Errors</div>
          <ul className="space-y-s-3 text-[13px]">
            {result.errors.map((e, i) => (
              <li key={i} className="border-l-2 border-red-400/50 pl-s-3">
                <div className="text-ink-1">
                  Line {e.line}: {e.full_name || <span className="text-ink-3 italic">no name</span>}
                </div>
                <ul className="mt-s-1 text-[12px] text-red-400 list-disc list-inside">
                  {e.errors.map((msg, j) => <li key={j}>{msg}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-s-3">
        <Button intent="primary" size="md" onClick={onAgain}>Import more</Button>
        <Link to="/app/admin"><Button intent="ghost" size="md">Done</Button></Link>
      </div>
    </div>
  );
}
