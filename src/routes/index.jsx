/**
 * src/routes/index.jsx
 *
 * Updated routing table. Changes from the original:
 *
 * 1. super_admin → /app/super (new SuperAdminApp, fully separate from AdminApp)
 * 2. school_admin + head_teacher → /app/admin (rebuilt AdminApp with real data)
 * 3. head_teacher also lands at /app/teacher for class-level work
 * 4. teacher → /app/teacher (new TeacherApp replacing the old sims/TeacherApp stub)
 * 5. tutor → /app/tutor (TutorProfileView from marketplace sprint)
 * 6. /app/super route added for super_admin only
 * 7. /impact/:schoolSlug public page added (unauthenticated)
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RequireAuth, RequireRole } from './guards';
import { ROLES } from '@/config/roles';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';

// ── Public marketing ──────────────────────────────────────────────────────────
const HomePage              = lazy(() => import('@/pages/public/HomePage'));
const PricingPage           = lazy(() => import('@/pages/public/PricingPage'));
const AboutPage             = lazy(() => import('@/pages/public/AboutPage'));
const SolutionsSchoolsPage  = lazy(() => import('@/pages/public/SolutionsSchoolsPage'));
const SolutionsParentsPage  = lazy(() => import('@/pages/public/SolutionsParentsPage'));
const TutorsPage            = lazy(() => import('@/pages/public/TutorsPage'));
const PublicImpactPage      = lazy(() => import('@/pages/public/PublicImpactPage'));
const PrivacyPage           = lazy(() => import('@/pages/public/PrivacyPage'));
const TermsPage             = lazy(() => import('@/pages/public/TermsPage'));
const NotFoundPage          = lazy(() => import('@/pages/public/NotFoundPage'));

// ── Auth ──────────────────────────────────────────────────────────────────────
const SignInPage        = lazy(() => import('@/pages/auth/SignInPage'));
const SignUpPage        = lazy(() => import('@/pages/auth/SignUpPage'));
const StudentPinPage   = lazy(() => import('@/pages/auth/StudentPinPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

// ── Authenticated apps ────────────────────────────────────────────────────────
// SuperAdminApp  — platform-level, /app/super/*
const SuperAdminApp = lazy(() => import('@/modules/admin/SuperAdminApp'));

// AdminApp — school-level, /app/admin/* (school_admin + head_teacher)
const AdminApp = lazy(() => import('@/modules/admin/AdminApp'));

// TeacherApp — class-level, /app/teacher/* (teacher + head_teacher)
// NOTE: was previously imported from '@/modules/sims/TeacherApp' (stub).
// Now points to the rebuilt '@/modules/teacher/TeacherApp'.
const TeacherApp = lazy(() => import('@/modules/teacher/TeacherApp'));

// TutorProfileView — tutor marketplace dashboard, /app/tutor/*
const TutorApp = lazy(() => import('@/modules/marketplace/TutorProfileView'));

// Parent and student apps (unchanged)
const ParentApp    = lazy(() => import('@/modules/parent/ParentApp'));
const StudentApp   = lazy(() => import('@/modules/student/StudentApp'));

// Shared / billing
const BillingReturnPage  = lazy(() => import('@/modules/billing/BillingReturnPage'));
const CheckoutPage       = lazy(() => import('@/pages/billing/CheckoutPage'));
const AccountSettingsPage = lazy(() => import('@/pages/account/AccountSettingsPage'));

// ── Wrapper helper ────────────────────────────────────────────────────────────
function App({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

// ── Router ────────────────────────────────────────────────────────────────────
const router = createBrowserRouter([

  // ── Public routes ───────────────────────────────────────────────────────────
  { path: '/',                   element: <App><HomePage /></App> },
  { path: '/pricing',            element: <App><PricingPage /></App> },
  { path: '/about',              element: <App><AboutPage /></App> },
  { path: '/privacy',            element: <App><PrivacyPage /></App> },
  { path: '/terms',              element: <App><TermsPage /></App> },
  { path: '/solutions/schools',  element: <App><SolutionsSchoolsPage /></App> },
  { path: '/solutions/parents',  element: <App><SolutionsParentsPage /></App> },
  { path: '/tutors',             element: <App><TutorsPage /></App> },

  // Public school impact pages — no auth required
  { path: '/impact/:schoolSlug', element: <App><PublicImpactPage /></App> },

  // ── Auth routes ─────────────────────────────────────────────────────────────
  { path: '/sign-in',         element: <App><SignInPage /></App> },
  { path: '/sign-up',         element: <App><SignUpPage /></App> },
  { path: '/student-sign-in', element: <App><StudentPinPage /></App> },
  { path: '/auth/reset',      element: <App><ResetPasswordPage /></App> },

  // ── Billing return (role-agnostic, just needs auth) ─────────────────────────
  {
    path: '/billing/return',
    element: (
      <RequireAuth>
        <App><BillingReturnPage /></App>
      </RequireAuth>
    ),
  },

  // ── Checkout — /billing/checkout?plan=PLAN_CODE ──────────────────────────────
  // Public but shows a sign-in prompt when unauthenticated. Separate from
  // /billing/return — this is the pre-payment summary page; return is post.
  {
    path: '/billing/checkout',
    element: <App><CheckoutPage /></App>,
  },

  // ── Account settings — /account ─────────────────────────────────────────────
  // Available to every authenticated role. No role guard — any logged-in
  // user should be able to edit their name, phone, and password.
  {
    path: '/account',
    element: (
      <RequireAuth>
        <App><AccountSettingsPage /></App>
      </RequireAuth>
    ),
  },

  // ── Super admin — platform-level (/app/super/*) ─────────────────────────────
  {
    path: '/app/super/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.SUPER_ADMIN]}>
          <ProductTheme surface="admin">
            <App><SuperAdminApp /></App>
          </ProductTheme>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // ── School admin / head teacher — school-level (/app/admin/*) ───────────────
  {
    path: '/app/admin/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER]}>
          <ProductTheme surface="sims">
            <App><AdminApp /></App>
          </ProductTheme>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // ── Teacher / head teacher — class-level (/app/teacher/*) ───────────────────
  {
    path: '/app/teacher/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.TEACHER, ROLES.HEAD_TEACHER]}>
          <ProductTheme surface="sims">
            <App><TeacherApp /></App>
          </ProductTheme>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // ── Tutor — marketplace dashboard (/app/tutor/*) ────────────────────────────
  {
    path: '/app/tutor/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.TUTOR, ROLES.SUPER_ADMIN]}>
          <ProductTheme surface="tutor">
            <App><TutorApp /></App>
          </ProductTheme>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // ── Parent (/app/parent/*) ──────────────────────────────────────────────────
  {
    path: '/app/parent/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.PARENT]}>
          <ProductTheme surface="parent">
            <App><ParentApp /></App>
          </ProductTheme>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // ── Student (/app/student/*) ────────────────────────────────────────────────
  {
    path: '/app/student/*',
    element: (
      <RequireAuth>
        <RequireRole allow={[ROLES.STUDENT]}>
          <ProductTheme surface="student">
            <App><StudentApp /></App>
          </ProductTheme>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // ── 404 ─────────────────────────────────────────────────────────────────────
  { path: '*', element: <App><NotFoundPage /></App> },
]);

export function Routes() {
  return <RouterProvider router={router} />;
}
