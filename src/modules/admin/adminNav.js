/**
 * src/modules/admin/adminNav.js
 *
 * Canonical nav for school admin / head teacher AppShell.
 * Import this in any file that owns its own AppShell within the admin module.
 * Single source of truth — matches AdminApp BASE_NAV exactly.
 */
export const ADMIN_NAV = [
  { to: '/app/admin',                label: 'Overview',       end: true },
  { to: '/app/admin/interventions',  label: 'Interventions'             },
  { to: '/app/admin/comms',          label: 'Comms'                     },
  { to: '/app/admin/wa-inbox',       label: 'WA inbox'                  },
  { to: '/app/admin/enrollments',    label: 'Enrolments'                },
  { to: '/app/admin/staff',          label: 'Staff'                     },
  { to: '/app/admin/connections',    label: 'Connections'               },
  { to: '/app/admin/curriculum',     label: 'Curriculum'                },
  { to: '/app/admin/terms',          label: 'Terms'                     },
  { to: '/app/admin/alerts',         label: 'Alerts'                    },
  { to: '/app/admin/impact',         label: 'Impact'                    },
  { to: '/app/admin/audit',          label: 'Audit log'                 },
  { to: '/app/admin/billing',        label: 'Billing'                   },
  { to: '/app/admin/settings',       label: 'Settings'                  },
];
