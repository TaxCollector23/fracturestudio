import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "./lib/useAuth.jsx";
import Nav from "./components/Nav.jsx";
import Landing from "./pages/Landing.jsx";
import Auth from "./pages/Auth.jsx";
import Studio from "./pages/Studio.jsx";
import Rebuttals from "./pages/Rebuttals.jsx";
import PastWork from "./pages/PastWork.jsx";
import Settings from "./pages/Settings.jsx";
import About from "./pages/About.jsx";
import Blog from "./pages/Blog.jsx";
import Admin from "./pages/Admin.jsx";

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

export default function App() {
  const location = useLocation();
  const bare = location.pathname === "/auth";

  return (
    <AuthProvider>
      {!bare && <Nav />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><Landing /></Page>} />
          <Route path="/auth" element={<Page bare><Auth /></Page>} />
          <Route path="/studio" element={<Page><Studio /></Page>} />
          <Route path="/rebuttals" element={<Page><Rebuttals /></Page>} />
          <Route path="/past-work" element={<Page><PastWork /></Page>} />
          <Route path="/settings" element={<Page><Settings /></Page>} />
          <Route path="/about" element={<Page><About /></Page>} />
          <Route path="/blog" element={<Page><Blog /></Page>} />
          <Route path="/admin" element={<Page><Admin /></Page>} />
          <Route path="*" element={<Page><Landing /></Page>} />
        </Routes>
      </AnimatePresence>
    </AuthProvider>
  );
}
