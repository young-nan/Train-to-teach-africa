/**
 * src/components/ui/index.js  (additions only — existing exports unchanged)
 *
 * Re-exports all v2 pilot mode UI primitives from a single import path.
 *
 * Usage:
 *   import { PilotBanner, PilotGate } from '@/components/ui';
 *
 * These are the only two components other modules need to know about.
 * Everything else (usePilotMode, pilotStore, PilotProvider) is imported
 * directly from their respective paths.
 */
export { PilotBanner } from './PilotBanner';
export { PilotGate }   from './PilotGate';
