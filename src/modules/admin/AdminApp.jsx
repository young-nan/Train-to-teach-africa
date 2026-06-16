import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';

import AdminOverview        from './screens/AdminOverview';
import AdminStudents        from './screens/AdminStudents';
import AdminStudentProfile  from './screens/AdminStudentProfile';
import AdminAttendance      from './screens/AdminAttendance';
import AdminClasses         from './screens/AdminClasses';
import AdminStaff           from './screens/AdminStaff';
import AdminGradebook       from './screens/AdminGradebook';
import AdminReportCards     from './screens/AdminReportCards';
import AdminComms           from './screens/AdminComms';
import AdminCurriculum      from './screens/AdminCurriculum';
import AdminInterventions   from './screens/AdminInterventions';
import AdminSettings        from './screens/AdminSettings';
import { AdminCalendar, AdminFinance, AdminImpact, AdminAuditLog } from './screens/AdminStubs';

const NAV = [
  { to:'/admin',              end:true, icon:'layout-dashboard', label:'Overview'               },
  { to:'/admin/students',     icon:'users',             label:'Students'                        },
  { to:'/admin/classes',      icon:'chalkboard',        label:'Classes'                         },
  { to:'/admin/staff',        icon:'id-badge-2',        label:'Staff'                           },
  { to:'/admin/attendance',   icon:'calendar-stats',    label:'Attendance'                      },
  { to:'/admin/gradebook',    icon:'clipboard-list',    label:'Gradebook'                       },
  { to:'/admin/report-cards', icon:'file-certificate',  label:'Report Cards'                    },
  { to:'/admin/curriculum',   icon:'book-2',            label:'Curriculum'                      },
  { to:'/admin/comms',        icon:'message-dots',      label:'Comms',          badge:3         },
  { to:'/admin/interventions',icon:'alert-triangle',    label:'Interventions',  badge:5         },
  { to:'/admin/calendar',     icon:'calendar-event',    label:'Calendar'                        },
  { to:'/admin/finance',      icon:'receipt-2',         label:'Finance'                         },
  { to:'/admin/impact',       icon:'trophy',            label:'Impact'                          },
  { to:'/admin/settings',     icon:'settings',          label:'Settings'                        },
  { to:'/admin/audit',        icon:'shield-check',      label:'Audit Log'                       },
];

export default function AdminApp() {
  return (
    <ProductTheme surface="admin">
      <AppShell navItems={NAV} title="School Admin">
        <Routes>
          <Route index                    element={<AdminOverview />}       />
          <Route path="students"          element={<AdminStudents />}       />
          <Route path="students/:id"      element={<AdminStudentProfile />} />
          <Route path="classes"           element={<AdminClasses />}        />
          <Route path="staff"             element={<AdminStaff />}          />
          <Route path="attendance"        element={<AdminAttendance />}     />
          <Route path="gradebook"         element={<AdminGradebook />}      />
          <Route path="report-cards"      element={<AdminReportCards />}    />
          <Route path="curriculum"        element={<AdminCurriculum />}     />
          <Route path="comms"             element={<AdminComms />}          />
          <Route path="interventions"     element={<AdminInterventions />}  />
          <Route path="calendar"          element={<AdminCalendar />}       />
          <Route path="finance"           element={<AdminFinance />}        />
          <Route path="impact"            element={<AdminImpact />}         />
          <Route path="settings"          element={<AdminSettings />}       />
          <Route path="audit"             element={<AdminAuditLog />}       />
          <Route path="*"                 element={<Navigate to="/admin" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}
