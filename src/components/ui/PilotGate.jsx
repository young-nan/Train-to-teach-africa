/**
 * src/components/ui/PilotGate.jsx
 *
 * Subscription access gate that respects pilot mode.
 *
 * USAGE
 * ─────
 * Replace every subscription check like this:
 *
 *   // Before
 *   {subscription?.active ? <LessonContent /> : <UpgradePrompt />}
 *
 *   // After
 *   <PilotGate fallback={<UpgradePrompt />}>
 *     <LessonContent />
 *   </PilotGate>
 *
 * The `hasAccess` prop lets you pass the real subscription check result.
 * PilotGate grants access when EITHER pilotMode=true OR hasAccess=true.
 *
 * When no `fallback` is provided and access is denied, the gate renders
 * nothing (null). This prevents layout jumps during auth loading.
 */

import { usePilotMode } from '@/hooks/usePilotMode';
import { checkAccess } from '@/config/pilotMode';

/**
 * @param {object}  props
 * @param {boolean} [props.hasAccess=false]  — subscription check result
 * @param {React.ReactNode} [props.fallback] — shown when access denied
 * @param {React.ReactNode} props.children   — shown when access granted
 */
export function PilotGate({ hasAccess = false, fallback = null, children }) {
  const { pilotMode } = usePilotMode();
  const allowed = checkAccess(pilotMode, hasAccess);

  if (!allowed) return fallback;
  return children;
}
