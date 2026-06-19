import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import TeacherToday       from './screens/TeacherToday';
import TeacherAttendance  from './screens/TeacherAttendance';
import TeacherGradebook   from './screens/TeacherGradebook';
import TeacherReports     from './screens/TeacherReports';
import { TeacherClass, TeacherLessons, TeacherInterventions, TeacherComms } from './screens/TeacherStubs';

const NAV = [
  { to: '/teacher',              end: true, icon: 'layout-dashboard', label: 'Today'          },
  { to: '/teacher/class',        icon: 'users',             label: 'My Class'                 },
  { to: '/teacher/attendance',   icon: 'calendar-stats',    label: 'Attendance'               },
  { to: '/teacher/gradebook',    icon: 'clipboard-list',    label: 'Gradebook'                },
  { to: '/teacher/lessons',      icon: 'book-2',            label: 'Lessons'                  },
  { to: '/teacher/interventions',icon: 'alert-triangle',    label: 'Interventions'            },
  { to: '/teacher/comms',        icon: 'message-dots',      label: 'Comms',     badge: 2      },
  { to: '/teacher/reports',      icon: 'file-analytics',    label: 'Reports'                  },
];

export default function TeacherApp() {
  return (
    <ProductTheme surface="sims">
      <AppShell navItems={NAV} title="Teacher">
        <Routes>
          <Route index                    element={<TeacherToday />}         />
          <Route path="class"             element={<TeacherClass />}         />
          <Route path="attendance"        element={<TeacherAttendance />}    />
          <Route path="gradebook"         element={<TeacherGradebook />}     />
          <Route path="lessons"           element={<TeacherLessons />}       />
          <Route path="interventions"     element={<TeacherInterventions />} />
          <Route path="comms"             element={<TeacherComms />}         />
          <Route path="reports"           element={<TeacherReports />}       />
          <Route path="*"                 element={<Navigate to="/teacher" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}
