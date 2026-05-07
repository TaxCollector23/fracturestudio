import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Search, Plus, Clock, MoreVertical, 
  ArrowLeft, Save, Share2, Zap, MessageSquare, 
  Shield, Layers, Menu, X, Trash2, Edit3
} from 'lucide-react';

// --- SHARED COMPONENTS ---

const Nav = ({ navigate }) => (
    <nav className="h-20 border-b border-zinc-900 flex items-center justify-between px-6 md:px-12 shrink-0 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('landing')}>
            <div className="w-8 h-8 bg-zinc-100 rounded-sm flex items-center justify-center text-zinc-950 font-serif text-xl italic font-bold">f</div>
            <span className="font-serif italic text-xl tracking-wide hidden sm:block">Fracture Studio</span>
        </div>
        <div className="flex gap-4 md:gap-8 items-center text-sm font-medium">
            <button onClick={() => navigate('methodology')} className="text-zinc-400 hover:text-zinc-50 transition-colors">Methodology</button>
            <button onClick={() => navigate('manifesto')} className="text-zinc-400 hover:text-zinc-50 transition-colors">Manifesto</button>
            <button onClick={() => navigate('auth')} className="px-5 py-2 bg-zinc-100 text-zinc-950 rounded-sm hover:bg-white transition-colors font-semibold">Enter Studio</button>
        </div>
    </nav>
);

const PageTransition = ({ children }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
        {children}
    </motion.div>
);

// --- VIEWS ---

const Landing = ({ navigate }) => (
    <div className="min-h-screen flex flex-col">
        <Nav navigate={navigate} />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-20">
            <h1 className="text-[12vw] md:text-[9vw] font-serif leading-[0.85] tracking-tighter mb-12">
                Construct logic <br/>
                <span className="text-zinc-600 italic">that cannot break.</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
                The elite workspace for high-stakes discourse. Fracture Studio uses adversarial AI to dismantle your logic before your opponents can.
            </p>
            <div className="flex flex-col sm:row gap-4">
                <button onClick={() => navigate('auth')} className="px-10 py-5 bg-zinc-100 text-zinc-950 rounded-sm text-lg font-bold hover:bg-white transition-all">Start Drafting</button>
            </div>
        </main>
    </div>
);

const Methodology = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-24 px-8 md:px-12">
            <h1 className="text-5xl md:text-7xl font-serif mb-12 italic">The Adversarial Method</h1>
            <div className="space-y-16 text-lg text-zinc-400 leading-relaxed font-light">
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <span className="w-8 h-px bg-zinc-800"></span> 01 / Structural Dismantling
                    </h2>
                    <p className="pl-11">Fracture identifies 'fracture points' in your logic—those places where a premise lacks a sufficient warrant or where an impact is assumed rather than proven.</p>
                </section>
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <span className="w-8 h-px bg-zinc-800"></span> 02 / Node Mapping
                    </h2>
                    <p className="pl-11">Every argument is a dependency tree. If a top-level claim is severed from its supporting evidence, the entire structure collapses.</p>
                </section>
            </div>
        </div>
    </div>
);

const Manifesto = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-32 px-8 text-center">
            <h1 className="text-6xl md:text-8xl font-serif mb-16 tracking-tight leading-none">
                Rigor is a <br/><span className="italic text-zinc-500">Choice.</span>
            </h1>
            <div className="space-y-10 text-xl md:text-2xl font-serif italic text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                <p>"In an era of automated content, clarity has become a luxury. We believe that the tools of the future should not make writing easier—they should make thinking harder."</p>
                <p>"Fracture is not an assistant. It is an adversary."</p>
            </div>
        </div>
    </div>
);

const Dashboard = ({ navigate, cases, onNewCase, onOpenCase }) => (
    <div className="min-h-screen flex flex-col bg-zinc-950">
        <header className="h-20 border-b border-zinc-900 flex items-center justify-between px-12 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('landing')}>
                <div className="w-8 h-8 bg-zinc-100 rounded-sm flex items-center justify-center text-zinc-950 font-serif text-xl italic font-bold">f</div>
                <span className="font-serif italic text-xl tracking-wide">Fracture Studio</span>
            </div>
            <div className="flex items-center gap-6">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
                    <input type="text" placeholder="Search cases..." className="bg-zinc-900 border border-zinc-800 rounded-sm py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-zinc-700 w-64 transition-all" />
                </div>
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700"></div>
            </div>
        </header>
        <main className="flex-1 p-12 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-end mb-12">
                <div>
                    <h2 className="text-4xl font-serif italic mb-2">Workspace</h2>
                    <p className="text-zinc-500 text-sm">Welcome back. Your logic awaits pressure testing.</p>
                </div>
                <button onClick={onNewCase} className="flex items-center gap-2 bg-zinc-100 text-zinc-950 px-6 py-3 rounded-sm font-bold hover:bg-white transition-all">
                    <Plus className="w-4 h-4" /> New Case
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cases.map(c => (
                    <div key={c.id} onClick={() => onOpenCase(c)} className="group bg-zinc-900/50 border border-zinc-800 p-8 rounded-sm hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between aspect-video">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{c.topic}</span>
                                <MoreVertical className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <h3 className="text-xl font-serif italic mb-2 group-hover:text-white transition-colors">{c.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-600 text-xs">
                            <Clock className="w-3 h-3" />
                            <span>Modified {c.lastModified}</span>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    </div>
);

const Workspace = ({ currentCase, updateCase, navigate }) => {
  const [content, setContent] = useState(currentCase.content);
  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 shrink-0 bg-zinc-950">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('dashboard')} className="p-2 hover:bg-zinc-900 rounded-sm transition-colors">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <div className="h-4 w-px bg-zinc-800"></div>
          <span className="text-sm font-medium text-zinc-300">{currentCase.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors px-3 py-1.5 border border-zinc-800 rounded-sm">
            <Share2 className="w-3 h-3" /> Share
          </button>
          <button className="flex items-center gap-2 text-xs font-bold bg-zinc-100 text-zinc-950 hover:bg-white transition-colors px-4 py-1.5 rounded-sm">
            <Save className="w-3 h-3" /> Save
          </button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-12 md:p-24">
          <div className="max-w-2xl mx-auto">
            <input 
              value={currentCase.title} 
              onChange={(e) => updateCase(currentCase.id, { title: e.target.value })}
              className="w-full bg-transparent text-4xl font-serif italic mb-12 focus:outline-none border-b border-transparent focus:border-zinc-800 pb-4" 
            />
            <textarea 
              className="w-full bg-transparent text-lg text-zinc-300 leading-relaxed font-light min-h-[60vh] focus:outline-none resize-none"
              placeholder="Start drafting your logic..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                updateCase(currentCase.id, { content: e.target.value });
              }}
            />
          </div>
        </div>
        <aside className="w-80 border-l border-zinc-900 bg-zinc-900/20 p-6 overflow-y-auto">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-6">Adversarial Insights</h4>
          <div className="space-y-4">
            <div className="p-4 border border-zinc-800/50 bg-zinc-900/50 rounded-sm">
              <div className="flex items-center gap-2 text-yellow-500/80 mb-2">
                <Shield className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Warrant Missing</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">The claim regarding UBI fiscal stability lacks a primary economic warrant. Consider citing the Alaska Permanent Fund.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---

export default function App() {
    const [view, setView] = useState('landing');
    const [activeCaseId, setActiveCaseId] = useState(1);
    const [cases, setCases] = useState([
        { id: 1, title: "Universal Basic Income Feasibility", topic: "Economics", lastModified: "2h ago", content: "UBI is a stabilizer..." },
        { id: 2, title: "AI in Academic Discourse", topic: "Ethics", lastModified: "1d ago", content: "Logic dictates that..." }
    ]);

    const handleNewCase = () => {
        const newCase = { id: Date.now(), title: "Untitled Case", topic: "General", lastModified: "Just now", content: "" };
        setCases([newCase, ...cases]);
        setActiveCaseId(newCase.id);
        setView('workspace');
    };

    const updateCase = (id, updates) => {
        setCases(cases.map(c => c.id === id ? { ...c, ...updates, lastModified: "Just now" } : c));
    };

    const currentCase = cases.find(c => c.id === activeCaseId) || cases[0];

    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 font-sans selection:bg-zinc-800">
            <AnimatePresence mode="wait">
                {view === 'landing' && <PageTransition key="l"><Landing navigate={setView}/></PageTransition>}
                {view === 'methodology' && <PageTransition key="met"><Methodology navigate={setView}/></PageTransition>}
                {view === 'manifesto' && <PageTransition key="man"><Manifesto navigate={setView}/></PageTransition>}
                {view === 'auth' && <PageTransition key="a"><div className="flex items-center justify-center min-h-screen"><button onClick={() => setView('dashboard')} className="px-8 py-3 bg-white text-black font-bold rounded-sm">Log In</button></div></PageTransition>}
                {view === 'dashboard' && <PageTransition key="d"><Dashboard navigate={setView} cases={cases} onNewCase={handleNewCase} onOpenCase={(c) => { setActiveCaseId(c.id); setView('workspace'); }} /></PageTransition>}
                {view === 'workspace' && <PageTransition key="w"><Workspace currentCase={currentCase} updateCase={updateCase} navigate={setView} /></PageTransition>}
            </AnimatePresence>
        </div>
    );
}
