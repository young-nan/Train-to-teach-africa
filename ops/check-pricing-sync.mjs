#!/usr/bin/env node
/**
 * ops/check-pricing-sync.mjs
 *
 * CI guard. The Paystack edge function (Deno) duplicates the canonical
 * pricing from src/config/pricing.js. We can't import the JS module from
 * Deno, but we can statically check the two are aligned — and fail the
 * build if they aren't.
 *
 * Run: `node ops/check-pricing-sync.mjs`
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const PRICING_JS = readFileSync(join(root, 'src/config/pricing.js'), 'utf8');
const EDGE_TS    = readFileSync(join(root, 'supabase/functions/verify-payment/index.ts'), 'utf8');

const PLAN_RE_JS = /([A-Z_]+):\s*\{[^}]*amountMinor:\s*(\d+)/g;
const PLAN_RE_TS = /([A-Z_]+):\s*\{\s*amountMinor:\s*(\d+)/g;

function extract(source, re) {
  const out = {};
  let m;
  while ((m = re.exec(source)) !== null) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

const fromJs = extract(PRICING_JS, PLAN_RE_JS);
const fromTs = extract(EDGE_TS, PLAN_RE_TS);

const allCodes = new Set([...Object.keys(fromJs), ...Object.keys(fromTs)]);
const errors = [];
for (const code of allCodes) {
  const a = fromJs[code];
  const b = fromTs[code];
  if (a === undefined) errors.push(`Plan ${code} present in edge function but missing in src/config/pricing.js`);
  else if (b === undefined) errors.push(`Plan ${code} present in pricing.js but missing in edge function`);
  else if (a !== b) errors.push(`Plan ${code} amount differs: pricing.js=${a}, edge=${b}`);
}

if (errors.length) {
  console.error('Pricing config out of sync:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`OK · ${allCodes.size} plans aligned between pricing.js and verify-payment/index.ts`);
