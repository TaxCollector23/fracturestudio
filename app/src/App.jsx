import { Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "./lib/useAuth.jsx";
import Nav from "./components/Nav.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import FeedbackModal from "./components/FeedbackModal.jsx";

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
