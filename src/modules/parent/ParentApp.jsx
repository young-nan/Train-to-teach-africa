import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import ParentTonight   from './screens/ParentTonight';
import ParentProgress  from './screens/ParentProgress';
import ParentLessons   from './screens/ParentLessons';
import { ParentChild, ParentComms, ParentCalendar, ParentBilling, ParentWhatsApp, ParentTutors } from './screens/ParentStubs';
import LessonViewer from '@/components/lesson/LessonViewer';

const NAV = [
  { to: '/parent',             end: true, icon: 'home',            label: 'Tonight'     },
  { to: '/parent/progress',    icon: 'chart-line',      label: 'Progress'               },
  { to: '/parent/lessons',     icon: 'book-2',          label: 'Lessons'                },
  { to: '/parent/child',       icon: 'school',          label: 'My Child'               },
  { to: '/parent/comms',       icon: 'message-dots',    label: 'Messages', badge: 2     },
  { to: '/parent/calendar',    icon: 'calendar',        label: 'Calendar'               },
  { to: '/parent/tutors',      icon: 'user-star',       label: 'Find tutor'             },
  { to: '/parent/billing',     icon: 'credit-card',     label: 'Billing'                },
  { to: '/parent/whatsapp',    icon: 'brand-whatsapp',  label: 'WhatsApp'               },
];

export default function ParentApp() {
  return (
    <ProductTheme surface="parent">
      <Routes>
        {/* Lesson viewer — full screen, no sidebar */}
        <Route path="lesson/:lessonId" element={<LessonViewer />} />
        <Route path="*" element={
          <AppShell navItems={NAV} title="Parent">
            <Routes>
              <Route index               element={<ParentTonight />} />
              <Route path="progress"     element={<ParentProgress />} />
              <Route path="lessons"      element={<ParentLessons />} />
              <Route path="child"        element={<ParentChild />} />
              <Route path="comms"        element={<ParentComms />} />
              <Route path="calendar"     element={<ParentCalendar />} />
              <Route path="tutors"       element={<ParentTutors />} />
              <Route path="billing"      element={<ParentBilling />} />
              <Route path="whatsapp"     element={<ParentWhatsApp />} />
              <Route path="*"            element={<Navigate to="/parent" replace />} />
            </Routes>
          </AppShell>
        } />
      </Routes>
    </ProductTheme>
  );
}
