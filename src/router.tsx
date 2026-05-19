import { createBrowserRouter } from 'react-router-dom';
import { MarketingLayout } from './layouts/MarketingLayout';
import { AllPagesPage } from './pages/AllPagesPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { ChangelogPage } from './pages/ChangelogPage';
import { ContactPage } from './pages/ContactPage';
import { DebateFormatPage } from './pages/DebateFormatPage';
import { DocsPage } from './pages/DocsPage';
import { EmpireStaticPage } from './pages/EmpireStaticPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { LandingPage } from './pages/LandingPage';
import { ManifestoPage } from './pages/ManifestoPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { ModelsLibraryPage } from './pages/ModelsLibraryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PricingPage } from './pages/PricingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudioAccessPage } from './pages/StudioAccessPage';
import { StudioCasePage } from './pages/StudioCasePage';
import { StudioDashboardPage } from './pages/StudioDashboardPage';
import { ToolLabPage } from './pages/ToolLabPage';

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'features', element: <FeaturesPage /> },
      { path: 'manifesto', element: <ManifestoPage /> },
      { path: 'methodology', element: <MethodologyPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'all-pages', element: <AllPagesPage /> },
      { path: 'studio/access', element: <StudioAccessPage /> },
      { path: 'studio/dashboard', element: <StudioDashboardPage /> },
      { path: 'studio/case', element: <StudioCasePage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:projectId', element: <StudioCasePage /> },
      { path: 'analyze', element: <ToolLabPage labSlug="analyze" /> },
      { path: 'speech-lab', element: <ToolLabPage labSlug="speech-lab" /> },
      { path: 'audience-questions', element: <ToolLabPage labSlug="audience-questions" /> },
      { path: 'evidence-lab', element: <ToolLabPage labSlug="evidence-lab" /> },
      { path: 'citations', element: <ToolLabPage labSlug="citations" /> },
      { path: 'rubric-checker', element: <ToolLabPage labSlug="rubric-checker" /> },
      { path: 'search', element: <ToolLabPage labSlug="search" /> },
      { path: 'models', element: <ModelsLibraryPage /> },
      { path: 'models/toulmin', element: <EmpireStaticPage slug="models/toulmin" /> },
      { path: 'models/rogerian', element: <EmpireStaticPage slug="models/rogerian" /> },
      { path: 'models/monroe', element: <EmpireStaticPage slug="models/monroes-motivated-sequence" /> },
      { path: 'models/aristotle', element: <DebateFormatPage format="aristotle" /> },
      { path: 'models/policy', element: <DebateFormatPage format="policy" /> },
      { path: 'models/public-forum', element: <DebateFormatPage format="public-forum" /> },
      { path: 'models/lincoln-douglas', element: <DebateFormatPage format="lincoln-douglas" /> },
      { path: 'models/world-schools', element: <DebateFormatPage format="world-schools" /> },
      { path: 'models/british-parliamentary', element: <DebateFormatPage format="british-parliamentary" /> },
      { path: 'method', element: <EmpireStaticPage slug="method" /> },
      { path: 'how-it-works', element: <EmpireStaticPage slug="how-it-works" /> },
      { path: 'docs', element: <EmpireStaticPage slug="docs" /> },
      { path: 'docs/home', element: <DocsPage /> },
      { path: 'docs/scoring', element: <EmpireStaticPage slug="scoring" /> },
      { path: 'docs/api', element: <ApiDocsPage /> },
      { path: 'docs/limitations', element: <EmpireStaticPage slug="limitations" /> },
      { path: 'about', element: <EmpireStaticPage slug="about" /> },
      { path: 'how-we-made-this', element: <EmpireStaticPage slug="about" /> },
      { path: 'roadmap', element: <EmpireStaticPage slug="roadmap" /> },
      { path: 'examples', element: <EmpireStaticPage slug="examples" /> },
      { path: 'case-studies', element: <EmpireStaticPage slug="case-studies" /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'feedback', element: <FeedbackPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
