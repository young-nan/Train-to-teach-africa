/**
 * src/modules/sims/ScoresColumnSetup.jsx
 *
 * The "first time" screen. Shown when the gradebook for this class+subject+
 * term has zero columns configured. The teacher (or admin) sets up the
 * components: how many, what they're called, max marks, weights.
 *
 * Default preset: CA1 (20 marks, 20%), CA2 (20, 20%), Exam (60, 60%).
 * That covers ~95% of Nigerian Primary schools. Teachers can change to
 * suit their school's policy — schools that use 3 CAs + 1 exam, or
 * 50/50 CA-vs-exam splits, are free to do that here.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/utils/cn';

const DEFAULT_COMPONENTS = [
  { name: 'CA1', maxScore: 20, weight: 20 },
  { name: 'CA2', maxScore: 20, weight: 20 },
  { name: 'Exam', maxScore: 60, weight: 60 },
];

const ALT_PRESETS = {
  '3CA + Exam': [
    { name: 'CA1', maxScore: 10, weight: 10 },
    { name: 'CA2', maxScore: 10, weight: 10 },
    { name: 'CA3', maxScore: 20, weight: 20 },
    { name: 'Exam', maxScore: 60, weight: 60 },
  ],
  '50/50 CA & Exam': [
    { name: 'Continuous Assessment', maxScore: 50, weight: 50 },
    { name: 'Exam', maxScore: 50, weight: 50 },
  ],
  'Single test': [
    { name: 'Test', maxScore: 100, weight: 100 },
  ],
};

export function ScoresColumnSetup({ classMeta, subject, term, year, onSubmit, submitting, error }) {
  const [components, setComponents] = useState(DEFAULT_COMPONENTS);

  const totalWeight = components.reduce((s, c) => s + Number(c.weight || 0), 0);
  const weightOk = Math.abs(totalWeight - 100) < 0.01;

  const setField = (i, field, value) => {
    setComponents((cs) => cs.map((c, idx) =>
      idx === i ? { ...c, [field]: value } : c
    ));
  };
  const remove = (i) => setComponents((cs) => cs.filter((_, idx) => idx !== i));
  const add = () => setComponents((cs) => [...cs, { name: '', maxScore: 0, weight: 0 }]);
  const applyPreset = (preset) => setComponents(preset);

  const submit = () => {
    if (!weightOk) return;
    if (components.some((c) => !c.name.trim() || c.maxScore <= 0)) return;
    onSubmit(components);
  };

  const termLabel = ({ term_1: 'Term 1', term_2: 'Term 2', term_3: 'Term 3' }[term] ?? term);

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <Chip variant="gold" dot>First time setup</Chip>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Set up the gradebook.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[60ch]">
          Configure the components for <span className="text-ink-0">{classMeta?.name}</span> ·
          {' '}<span className="text-ink-0">{subject}</span> ·
          {' '}<span className="text-ink-0">{termLabel} {year}</span>.
          Once set, you (and any colleague teaching the same class) just enter
          scores against these columns for the whole term.
        </p>
      </div>

      <Card className="mb-s-5">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Quick presets</div>
        <div className="flex flex-wrap gap-s-3">
          <PresetButton label="2 CA + Exam (default)" onClick={() => applyPreset(DEFAULT_COMPONENTS)} />
          {Object.entries(ALT_PRESETS).map(([label, preset]) => (
            <PresetButton key={label} label={label} onClick={() => applyPreset(preset)} />
          ))}
        </div>
      </Card>

      <Card className="mb-s-5">
        <div className="flex items-center justify-between mb-s-4">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Components</div>
          <div className={cn(
            'font-mono text-meta',
            weightOk ? 'text-green-400' : 'text-amber-400',
          )}>
            Weights total: {totalWeight}{!weightOk && ' · should be 100'}
          </div>
        </div>

        <div className="space-y-s-3">
          {components.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_90px_40px] gap-s-3 items-center">
              <input
                type="text"
                value={c.name}
                onChange={(e) => setField(i, 'name', e.target.value)}
                placeholder="Name (e.g. CA1)"
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-1 outline-none focus:border-gold-400"
                maxLength={40}
              />
              <input
                type="number"
                value={c.maxScore}
                onChange={(e) => setField(i, 'maxScore', Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
                placeholder="Max"
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-1 outline-none focus:border-gold-400 text-center"
                min={1}
                max={1000}
              />
              <input
                type="number"
                value={c.weight}
                onChange={(e) => setField(i, 'weight', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                placeholder="%"
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-1 outline-none focus:border-gold-400 text-center"
                min={0}
                max={100}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={components.length === 1}
                className="w-[40px] h-[40px] grid place-items-center text-ink-3 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Remove component"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-s-4">
          <button
            type="button"
            onClick={add}
            disabled={components.length >= 8}
            className="text-[13.5px] text-gold-200 hover:text-gold-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            + Add another component
          </button>
        </div>

        <div className="mt-s-3 grid grid-cols-[1fr_90px_90px_40px] gap-s-3 font-mono text-[10px] text-ink-3 uppercase tracking-[0.14em]">
          <span>Name</span><span className="text-center">Max</span><span className="text-center">Weight %</span><span></span>
        </div>
      </Card>

      {error && (
        <div className="mb-s-5 text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">{error}</div>
      )}

      <div className="flex justify-end">
        <Button
          intent="primary"
          size="lg"
          onClick={submit}
          isLoading={submitting}
          disabled={!weightOk || components.some((c) => !c.name.trim() || c.maxScore <= 0)}
        >
          Save setup → Open gradebook
        </Button>
      </div>
    </div>
  );
}

function PresetButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-s-4 py-[7px] rounded-full text-[12.5px] font-medium bg-surface-3 text-ink-2 border border-line-2 hover:text-ink-0 hover:border-gold-400/40 transition-all"
    >
      {label}
    </button>
  );
}
