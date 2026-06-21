import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";

export default function Auth() {
  const { signInWithGoogle, signInWithEmail, createEmailAccount, sendReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const run = async (fn, key) => {
    setErr(null); setMsg(null); setBusy(key);
    try { await fn(); navigate("/studio"); }
    catch (e) { setErr(e?.message || "Something went wrong."); }
    finally { setBusy(""); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white dark:bg-zinc-950 px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(39,39,42,0.18)_0,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(39,39,42,0.4)_0,transparent_70%)]" />
      <div className="w-full max-w-md p-10 card relative z-10">
        <Link to="/" className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"><X size={20} /></Link>
        <div className="w-10 h-10 rounded-sm bg-zinc-950 dark:bg-zinc-100 flex items-center justify-center text-zinc-50 dark:text-zinc-950 font-serif italic font-bold text-2xl mb-7">f</div>
        <h2 className="font-serif text-4xl mb-2">Access Studio</h2>
        <p className="faint text-sm mb-7">Sign in to save your work and run audits.</p>

        {err && <div className="mb-4 text-sm text-red-500 border border-red-500/30 rounded-sm px-3 py-2">{err}</div>}
        {msg && <div className="mb-4 text-sm text-green-600 dark:text-green-400 border border-green-500/30 rounded-sm px-3 py-2">{msg}</div>}

        <button onClick={() => run(signInWithGoogle, "google")} disabled={!!busy} className="btn-ghost w-full mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
          {busy === "google" ? "Opening Google…" : "Continue with Google"}
        </button>

        <div className="relative py-3 flex items-center">
          <div className="flex-grow border-t hair" />
          <span className="flex-shrink-0 mx-4 text-xs font-mono text-zinc-500 uppercase">Or</span>
          <div className="flex-grow border-t hair" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="label-mono mb-2">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@institution.edu" className="field" />
          </div>
          <div>
            <label className="label-mono mb-2">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="field" />
          </div>
          <button onClick={() => run(() => signInWithEmail(email, password), "email")} disabled={!!busy} className="btn-solid w-full mt-1">
            {busy === "email" ? "Signing in…" : "Continue with Email"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button onClick={() => run(() => createEmailAccount(email, password), "create")} disabled={!!busy} className="faint hover:text-zinc-900 dark:hover:text-zinc-200">Create account</button>
            <button
              onClick={async () => { setErr(null); try { await sendReset(email); setMsg("Password reset email sent."); } catch (e) { setErr(e?.message || "Could not send reset."); } }}
              disabled={!!busy} className="faint hover:text-zinc-900 dark:hover:text-zinc-200">Forgot password?</button>
          </div>
        </div>
      </div>
    </div>
  );
}
