import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { loadPrefs, savePrefs, FORMATS, DEPTHS } from "../lib/prefs.js";
import { savePreferences } from "../lib/firebase.js";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(loadPrefs());
  const [saved, setSaved] = useState(false);

  const setPref = (k, v) => { const next = { ...prefs, [k]: v }; setPrefs(next); savePrefs(next); setSaved(false); };

  async function persist() {
    savePrefs(prefs);
    if (user) { try { await savePreferences(user.id, prefs); } catch (_) {} }
    setSaved(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2">Account</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-8">Settings</h1>

      <section className="card p-6 mb-5">
        <h2 className="font-serif text-xl mb-4">Account</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="label-mono mb-1">Email</div><div>{user?.email || "Guest session"}</div></div>
          <div><div className="label-mono mb-1">Provider</div><div className="capitalize">{user?.provider || "—"}</div></div>
        </div>
        {user
          ? <button onClick={() => { signOut(); navigate("/"); }} className="btn-ghost mt-5 py-2 px-4"><LogOut size={14} /> Sign out</button>
          : <button onClick={() => navigate("/auth")} className="btn-solid mt-5 py-2 px-4">Sign in</button>}
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-xl mb-4">Defaults</h2>
        <div className="space-y-4">
          <div>
            <label className="label-mono mb-1.5">Analysis mode</label>
            <select value={prefs.analysisFormat} onChange={(e) => setPref("analysisFormat", e.target.value)} className="field">
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-mono mb-1.5">Feedback depth</label>
            <select value={prefs.depthLevel} onChange={(e) => setPref("depthLevel", e.target.value)} className="field">
              {DEPTHS.map((d) => <option key={d.id} value={d.id}>{d.label} — {d.hint}</option>)}
            </select>
          </div>
          <div>
            <label className="label-mono mb-1.5">Citation style</label>
            <select value={prefs.citationStyle} onChange={(e) => setPref("citationStyle", e.target.value)} className="field">
              <option value="mla">MLA</option>
              <option value="apa">APA</option>
            </select>
          </div>
          <button onClick={persist} className="btn-solid py-2.5 px-5">{saved ? "Saved" : "Save preferences"}</button>
        </div>
      </section>
    </div>
  );
}
