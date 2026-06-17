/**
 * HeadTeacherApp.jsx — Head Teacher root router
 * Route: /headteacher/*
 * Sees all classes, teacher performance, interventions, curriculum progress
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import HTOverview       from './screens/HTOverview';
import HTTeachers       from './screens/HTTeachers';
import HTStudents       from './screens/HTStudents';
import HTAttendance     from './screens/HTAttendance';
import HTPerformance    from './screens/HTPerformance';
import HTInterventions  from './screens/HTInterventions';
import HTCurriculum     from './screens/HTCurriculum';
import HTComms          from './screens/HTComms';
import HTReports        from './screens/HTReports';

const NAV = [
  { to:'/headteacher',                end:true, icon:'layout-dashboard', label:'Overview'         },
  { to:'/headteacher/teachers',       icon:'id-badge-2',    label:'Teachers'                      },
  { to:'/headteacher/students',       icon:'users',         label:'Students'                      },
  { to:'/headteacher/attendance',     icon:'calendar-stats',label:'Attendance'                    },
  { to:'/headteacher/performance',    icon:'chart-line',    label:'Performance'                   },
  { to:'/headteacher/interventions',  icon:'alert-triangle',label:'Interventions',  badge:4       },
  { to:'/headteacher/curriculum',     icon:'book-2',        label:'Curriculum'                    },
  { to:'/headteacher/comms',          icon:'message-dots',  label:'Comms',          badge:2       },
  { to:'/headteacher/reports',        icon:'file-analytics',label:'Reports'                       },
];

export default function HeadTeacherApp() {
  return (
    <ProductTheme surface="sims">
      <AppShell navItems={NAV} title="Head Teacher">
        <Routes>
          <Route index                       element={<HTOverview />}      />
          <Route path="teachers"             element={<HTTeachers />}      />
          <Route path="students"             element={<HTStudents />}      />
          <Route path="attendance"           element={<HTAttendance />}    />
          <Route path="performance"          element={<HTPerformance />}   />
          <Route path="interventions"        element={<HTInterventions />} />
          <Route path="curriculum"           element={<HTCurriculum />}    />
          <Route path="comms"                element={<HTComms />}         />
          <Route path="reports"              element={<HTReports />}       />
          <Route path="*"                    element={<Navigate to="/headteacher" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}
