import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MarketingLayout } from './layouts/MarketingLayout';
import { ChangelogPage } from './pages/ChangelogPage';
import { DocsPage } from './pages/DocsPage';
import { LandingPage } from './pages/LandingPage';
import { ManifestoPage } from './pages/ManifestoPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { PricingPage } from './pages/PricingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { StudioAccessPage } from './pages/StudioAccessPage';
import { StudioCasePage } from './pages/StudioCasePage';
import { StudioDashboardPage } from './pages/StudioDashboardPage';

function appBasename(): string {
  const b = import.meta.env.BASE_URL ?? '/';
  if (b === '/' || b === './') {
    return '/';
  }
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

export const router = createBrowserRouter(
  [
    {
      path: '/studio',
      children: [
        { index: true, element: <Navigate replace to="access" /> },
        { path: 'access', element: <StudioAccessPage /> },
        { path: 'dashboard', element: <StudioDashboardPage /> },
        { path: 'case', element: <StudioCasePage /> },
      ],
    },
    {
      path: '/',
      element: <MarketingLayout />,
      children: [
        { index: true, element: <LandingPage /> },
        { path: 'methodology', element: <MethodologyPage /> },
        { path: 'manifesto', element: <ManifestoPage /> },
        { path: 'pricing', element: <PricingPage /> },
        { path: 'docs', element: <DocsPage /> },
        { path: 'changelog', element: <ChangelogPage /> },
        { path: 'privacy', element: <PrivacyPage /> },
      ],
    },
    { path: '*', element: <Navigate replace to="/" /> },
  ],
  { basename: appBasename() },
);
