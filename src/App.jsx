/**
 * App.jsx — TTA EOS v3 root router
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth, useAuthBootstrap } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/ui';

import AdminApp       from '@/modules/admin/AdminApp';
import TeacherApp     from '@/modules/teacher/TeacherApp';
import ParentApp      from '@/modules/parent/ParentApp';
import HeadTeacherApp from '@/modules/headteacher/HeadTeacherApp';
import { TutorApp }   from '@/modules/tutor/TutorApp';
import { StudentApp } from '@/modules/student/StudentApp';
import { SuperAdminApp } from '@/modules/superadmin/SuperAdminApp';

import SignIn from '@/pages/auth/SignIn';
import SignUp from '@/pages/auth/SignUp';

const qc = new QueryClient({
  defaultOptions: { queries: { retry:1, refetchOnWindowFocus:false } },
});

const ROLE_REDIRECTS = {
  school_admin: '/admin',
  head_teacher: '/headteacher',
  teacher:      '/teacher',
  parent:       '/parent',
  student:      '/student',
  tutor:        '/tutor',
  super_admin:  '/superadmin',
};

function AuthBootstrap({ children }) {
  useAuthBootstrap();
  return children;
}

function RoleGate() {
  const { isLoading, isAuthenticated, profile } = useAuth();
  if (isLoading)        return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/sign-in" replace />;
  if (!profile)         return <LoadingScreen />;
  const target = ROLE_REDIRECTS[profile.role];
  if (!target) return (
    <div className="flex items-center justify-center min-h-screen text-[var(--c-ink-3)] text-[14px]">
      Unknown role: <code className="ml-2 bg-[var(--c-surface-3)] px-2 py-1 rounded font-mono">{profile.role}</code>
    </div>
  );
  return <Navigate to={target} replace />;
}

function RequireAuth({ children }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading)        return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/sign-in" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthBootstrap>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/" element={<RoleGate />} />
            <Route path="/admin/*"       element={<RequireAuth><AdminApp /></RequireAuth>} />
            <Route path="/headteacher/*" element={<RequireAuth><HeadTeacherApp /></RequireAuth>} />
            <Route path="/teacher/*"     element={<RequireAuth><TeacherApp /></RequireAuth>} />
            <Route path="/parent/*"      element={<RequireAuth><ParentApp /></RequireAuth>} />
            <Route path="/student/*"     element={<RequireAuth><StudentApp /></RequireAuth>} />
            <Route path="/tutor/*"       element={<RequireAuth><TutorApp /></RequireAuth>} />
            <Route path="/superadmin/*"  element={<RequireAuth><SuperAdminApp /></RequireAuth>} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
