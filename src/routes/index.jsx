/**
 * src/routes/index.jsx
 *
 * The router. All route components are lazy-loaded so we can hit the
 * 180 KB initial JS budget — see vite.config.js manualChunks.
 *
 * Public surface (marketing) gets shipped as separate chunk from the
 * authenticated surface — most visitors never load the dashboards.
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RequireAuth, RequireRole } from './guards';
import { ROLES } from '@/config/roles';

// Public marketing site
const HomePage = lazy(() => import('@/pages/public/HomePage'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const SolutionsSchoolsPage = lazy(() => import('@/pages/public/SolutionsSchoolsPage'));
const SolutionsParentsPage = lazy(() => import('@/pages/public/SolutionsParentsPage'));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'));

// Auth
const SignInPage = lazy(() => import('@/pages/auth/SignInPage'));
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage'));
const StudentPinPage = lazy(() => import('@/pages/auth/StudentPinPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

// Authenticated apps
const AdminApp = lazy(() => import('@/modules/admin/AdminApp'));
const TeacherApp = lazy(() => import('@/modules/sims/TeacherApp'));
const ParentApp = lazy(() => import('@/modules/parent/ParentApp'));
const StudentApp = lazy(() => import('@/modules/student/StudentApp'));
const BillingReturnPage = lazy(() => import('@/modules/billing/BillingReturnPage'));

const router = createBrowserRouter([
  // ---- Public routes ----
  { path: '/', element: <Suspense fallback={null}><HomePage /></Suspense> },
  { path: '/pricing', element: <Suspense fallback={null}><PricingPage /></Suspense> },
  { path: '/about', element: <Suspense fallback={null}><AboutPage /></Suspense> },
  { path: '/solutions/schools', element: <Suspense fallback={null}><SolutionsSchoolsPage /></Suspense> },
  { path: '/solutions/parents', element: <Suspense fallback={null}><SolutionsParentsPage /></Suspense> },

  // ---- Auth routes ----
  { path: '/sign-in', element: <Suspense fallback={null}><SignInPage /></Suspense> },
  { path: '/sign-up', element: <Suspense fallback={null}><SignUpPage /></Suspense> },
  { path: '/student-sign-in', element: <Suspense fallback={null}><StudentPinPage /></Suspense> },
  { path: '/auth/reset', element: <Suspense fallback={null}><ResetPasswordPage /></Suspense> },

  // ---- Billing return (authenticated, but role-agnostic) ----
  {
    path: '/billing/return',
    element: (
      <RequireAuth>
        <Suspense fallback={null}><BillingReturnPage /></Suspense>
      </RequireAuth>
    ),
  },

  // ---- Authenticated apps (role-gated) ----
  {
    path: '/app/admin/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN]}>
          <Suspense fallback={null}><AdminApp /></Suspense>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/app/teacher/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.HEAD_TEACHER, ROLES.TEACHER]}>
          <Suspense fallback={null}><TeacherApp /></Suspense>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/app/parent/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.PARENT]}>
          <Suspense fallback={null}><ParentApp /></Suspense>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/app/student/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.STUDENT]}>
          <Suspense fallback={null}><StudentApp /></Suspense>
        </RequireRole>
      </RequireAuth>
    ),
  },

  { path: '*', element: <Suspense fallback={null}><NotFoundPage /></Suspense> },
]);

export function Routes() {
  return <RouterProvider router={router} />;
}
