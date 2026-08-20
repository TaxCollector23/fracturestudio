import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./lib/useAuth.jsx";
import Nav from "./components/Nav.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import FeedbackModal from "./components/FeedbackModal.jsx";
import { setPrepStore, makeLocalStore } from "./lib/prep.js";
import { setCompetitionStore, makeLocalCompetitionStore } from "./lib/competition.js";
import { firestorePrepStore, firebaseCompetitionStore } from "./lib/firebase.js";

// Routes the prep data layer at the right store: Firestore for signed-in
// users, localStorage for guests — the same content either way.
function PrepStoreSync() {
  const { user } = useAuth();
  useEffect(() => {
    setPrepStore(user ? firestorePrepStore(user.id) : makeLocalStore());
    setCompetitionStore(user ? firebaseCompetitionStore(user.id) : makeLocalCompetitionStore());
  }, [user]);
  return null;
}

// Route-level code splitting: each page loads on first visit instead of
// shipping the whole app (including framer-motion pages) in one bundle.
const Landing = lazy(() => import("./pages/Landing.jsx"));
const Auth = lazy(() => import("./pages/Auth.jsx"));
const Studio = lazy(() => import("./pages/Studio.jsx"));
const Rebuttals = lazy(() => import("./pages/Rebuttals.jsx"));
const PastWork = lazy(() => import("./pages/PastWork.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Blog = lazy(() => import("./pages/Blog.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Practice = lazy(() => import("./pages/Practice.jsx"));
const PrepHub = lazy(() => import("./pages/PrepHub.jsx"));
const PrepCases = lazy(() => import("./pages/PrepCases.jsx"));
const PrepLibrary = lazy(() => import("./pages/PrepLibrary.jsx"));
const PrepInbox = lazy(() => import("./pages/PrepInbox.jsx"));
const PrepRound = lazy(() => import("./pages/PrepRound.jsx"));
const PrepTopics = lazy(() => import("./pages/PrepTopics.jsx"));
const PrepFlashcards = lazy(() => import("./pages/PrepFlashcards.jsx"));
const PrepOutlines = lazy(() => import("./pages/PrepOutlines.jsx"));
const PrepStrategy = lazy(() => import("./pages/PrepStrategy.jsx"));
const Compete = lazy(() => import("./pages/Compete.jsx"));
const Tournament = lazy(() => import("./pages/Tournament.jsx"));
const RoundWorkspace = lazy(() => import("./pages/RoundWorkspace.jsx"));
const JudgeWorkspace = lazy(() => import("./pages/JudgeWorkspace.jsx"));
const TeamWorkspace = lazy(() => import("./pages/TeamWorkspace.jsx"));
const CoachDashboard = lazy(() => import("./pages/CoachDashboard.jsx"));
const Research = lazy(() => import("./pages/Research.jsx"));
const ResearchTopic = lazy(() => import("./pages/ResearchTopic.jsx"));
const SourceLibrary = lazy(() => import("./pages/SourceLibrary.jsx"));
const SourceWorkspace = lazy(() => import("./pages/SourceWorkspace.jsx"));
const Bibliography = lazy(() => import("./pages/Bibliography.jsx"));

function Page({ children, bare }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={bare ? "" : "pt-16"}
    >
      {children}
    </motion.div>
  );
}

function PageFallback() {
  return (
    <div className="pt-16">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
        <div className="card p-10 flex items-center gap-3 text-sm muted">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
          Loading…
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const bare = location.pathname === "/auth";

  return (
    <AuthProvider>
      <PrepStoreSync />
      <ErrorBoundary>
        {!bare && <Nav />}
        <AnimatePresence mode="wait">
          <Suspense fallback={<PageFallback />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Page><Landing /></Page>} />
              <Route path="/auth" element={<Page bare><Auth /></Page>} />
              <Route path="/dashboard" element={<Page><Dashboard /></Page>} />
              <Route path="/studio" element={<Page><Studio /></Page>} />
              <Route path="/practice" element={<Page><Practice /></Page>} />
              <Route path="/prep" element={<Page><PrepHub /></Page>} />
              <Route path="/prep/cases" element={<Page><PrepCases /></Page>} />
              <Route path="/prep/library" element={<Page><PrepLibrary /></Page>} />
              <Route path="/prep/inbox" element={<Page><PrepInbox /></Page>} />
              <Route path="/prep/round" element={<Page><PrepRound /></Page>} />
              <Route path="/prep/topics" element={<Page><PrepTopics /></Page>} />
              <Route path="/prep/flashcards" element={<Page><PrepFlashcards /></Page>} />
              <Route path="/prep/outlines" element={<Page><PrepOutlines /></Page>} />
              <Route path="/prep/strategy" element={<Page><PrepStrategy /></Page>} />
              <Route path="/compete" element={<Page><Compete /></Page>} />
              <Route path="/compete/judge" element={<Page><JudgeWorkspace /></Page>} />
              <Route path="/compete/tournament/:tid" element={<Page><Tournament /></Page>} />
              <Route path="/compete/tournament/:tid/round/:rid" element={<Page><RoundWorkspace /></Page>} />
              <Route path="/compete/team/:tid" element={<Page><TeamWorkspace /></Page>} />
              <Route path="/coach" element={<Page><CoachDashboard /></Page>} />
              <Route path="/research" element={<Page><Research /></Page>} />
              <Route path="/research/topic/:id" element={<Page><ResearchTopic /></Page>} />
              <Route path="/research/sources" element={<Page><SourceLibrary /></Page>} />
              <Route path="/research/source/:id" element={<Page><SourceWorkspace /></Page>} />
              <Route path="/research/bibliography" element={<Page><Bibliography /></Page>} />
              <Route path="/rebuttals" element={<Page><Rebuttals /></Page>} />
              <Route path="/past-work" element={<Page><PastWork /></Page>} />
              <Route path="/settings" element={<Page><Settings /></Page>} />
              <Route path="/about" element={<Page><About /></Page>} />
              <Route path="/blog" element={<Page><Blog /></Page>} />
              <Route path="/admin" element={<Page><Admin /></Page>} />
              <Route path="*" element={<Page><Landing /></Page>} />
            </Routes>
          </Suspense>
        </AnimatePresence>
        <CommandPalette />
        <FeedbackModal />
      </ErrorBoundary>
    </AuthProvider>
  );
}
