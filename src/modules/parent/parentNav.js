/**
 * src/modules/parent/parentNav.js
 *
 * Canonical nav items for the parent app shell.
 * Imported by all parent-app views that own their own AppShell.
 *
 * Single source of truth — add a new item here and every view
 * picks it up automatically on next render.
 */

export const PARENT_NAV = [
  { to: '/app/parent',                label: 'Tonight',       end: true },
  { to: '/app/parent/interventions',  label: 'Interventions'            },
  { to: '/app/parent/children',       label: 'Children'                 },
  { to: '/app/parent/lessons',        label: 'Lessons'                  },
  { to: '/app/parent/reports',        label: 'Reports'                  },
  { to: '/app/parent/messages',       label: 'Messages'                 },
  { to: '/app/parent/billing',        label: 'Fees'                     },
  { to: '/app/parent/whatsapp',       label: 'WhatsApp'                 },
  { to: '/app/parent/subscribe',      label: 'Subscribe'                },
];
