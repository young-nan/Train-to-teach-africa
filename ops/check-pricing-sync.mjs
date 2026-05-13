#!/usr/bin/env node
/**
 * ops/check-pricing-sync.mjs
 *
 * CI guard. Ensures that amountMinor values are identical across:
 *   1. src/config/pricing.js              — the canonical JS source
 *   2. supabase/functions/verify-payment/index.ts
 *   3. supabase/functions/initialise-payment/index.ts   ← added in fix
 *
 * Previously only (1) and (2) were checked. The initialise-payment edge
 * function was added as a missing piece but also duplicates the plan
 * catalogue. Without this check, a price change in pricing.js would pass CI
 * while leaving initialise-payment stale — meaning Paystack transactions
 * would be initialised at the wrong amount.
 *
 * Run: node ops/check-pricing-sync.mjs
 * Exit 0 = all plans aligned. Exit 1 = mismatch found.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// ── Source files to compare ────────────────────────────────────────────────

const SOURCES = {
  'pricing.js':          readFileSync(join(root, 'src/config/pricing.js'), 'utf8'),
  'verify-payment':      readFileSync(join(root, 'supabase/functions/verify-payment/index.ts'), 'utf8'),
  'initialise-payment':  readFileSync(join(root, 'supabase/functions/initialise-payment/index.ts'), 'utf8'),
};

// ── Extraction ─────────────────────────────────────────────────────────────
// The regex matches:
//   AFR_PARENT_TERM: { amountMinor: 1084700, ... }
// in both JS and TS source styles.

const PLAN_RE = /([A-Z_]{3,}):\s*\{[^}]*amountMinor:\s*(\d+)/g;

function extract(source) {
  const out = {};
  let m;
  const re = new RegExp(PLAN_RE.source, PLAN_RE.flags); // fresh lastIndex per call
  while ((m = re.exec(source)) !== null) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

const parsed = Object.fromEntries(
  Object.entries(SOURCES).map(([name, src]) => [name, extract(src)])
);

// ── Comparison ─────────────────────────────────────────────────────────────

const canonical = parsed['pricing.js'];
const others    = Object.entries(parsed).filter(([name]) => name !== 'pricing.js');

const allCodes = new Set(Object.keys(canonical));
for (const [, plans] of others) {
  for (const code of Object.keys(plans)) allCodes.add(code);
}

const errors = [];

for (const code of allCodes) {
  const baseAmount = canonical[code];

  if (baseAmount === undefined) {
    errors.push(`Plan ${code} appears in an edge function but is missing from src/config/pricing.js`);
    continue;
  }

  for (const [fileName, plans] of others) {
    const edgeAmount = plans[code];
    if (edgeAmount === undefined) {
      errors.push(`Plan ${code} is in pricing.js but missing from ${fileName}`);
    } else if (edgeAmount !== baseAmount) {
      errors.push(
        `Plan ${code} amount mismatch: pricing.js=${baseAmount}, ${fileName}=${edgeAmount}`
      );
    }
  }
}

// ── Result ─────────────────────────────────────────────────────────────────

if (errors.length) {
  console.error('\n❌ Pricing config out of sync:\n');
  for (const e of errors) console.error(`   • ${e}`);
  console.error('\n   Fix: update all three files to the same amountMinor values.\n');
  process.exit(1);
}

const fileList = Object.keys(SOURCES).join(', ');
console.log(`\n✓ ${allCodes.size} plans aligned across ${fileList}\n`);
