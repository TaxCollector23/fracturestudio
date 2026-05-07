import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  Search, 
  Plus, 
  Clock, 
  MoreVertical, 
  ArrowLeft, 
  Save, 
  Share2, 
  Zap,
  MessageSquare,
  Shield,
  Layers,
  Menu,
  X
} from 'lucide-react';

// --- COMPONENTS ---

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

const Methodology = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-24 px-8 md:px-12">
            <motion.h1 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="text-5xl md:text-7xl font-serif mb-12 italic"
            >
                The Adversarial Method
            </motion.h1>
            <div className="space-y-16 text-lg text-zinc-400 leading-relaxed font-light">
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <span className="w-8 h-px bg-zinc-800"></span> 01 / Structural Dismantling
                    </h2>
                    <p className="pl-11">
                        Fracture does not proofread; it deconstructs. Our engine identifies the 'fracture points' in your logic—those places where a premise lacks a sufficient warrant or where an impact is assumed rather than proven. By attacking your work before an opponent can, we ensure the final output is bulletproof.
                    </p>
                </section>
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <span className="w-8 h-px bg-zinc-800"></span> 02 / Node Mapping
                    </h2>
                    <p className="pl-11">
                        Every argument is a dependency tree. If a top-level claim is severed from its supporting evidence, the entire structure collapses. Our UI visualizes these dependencies in real-time, allowing you to see the architectural integrity of your speech at a glance.
                    </p>
                </section>
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <span className="w-8 h-px bg-zinc-800"></span> 03 / Semantic Sparring
                    </h2>
                    <p className="pl-11">
                        Using proprietary LLM layers, Fracture acts as an expert rebuttalist. It doesn't just offer suggestions; it provides counter-arguments that are statistically most likely to be leveled against you in a high-stakes environment.
                    </p>
                </section>
            </div>
            <div className="mt-24 pt-12 border-t border-zinc-900">
                <button onClick={() => navigate('auth')} className="group flex items-center gap-3 text-zinc-100 font-serif italic text-2xl">
                    Pressure test your first case <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    </div>
);

const Manifesto = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-32 px-8 md:px-12 text-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
                <h1 className="text-6xl md:text-8xl font-serif mb-16 tracking-tight leading-none">
                    Rigor is a <br/><span className="italic text-zinc-500">Choice.</span>
                </h1>
                <div className="space-y-10 text-xl md:text-2xl font-serif italic text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                    <p>"In an era of automated content, clarity has become a luxury. We believe that the tools of the future should not make writing easier—they should make thinking harder."</p>
                    <p>"We build for the rhetorician who values the weight of a word. For the litigator who knows that a single logical gap is a liability. For the debater who seeks the truth through the friction of disagreement."</p>
                    <p>"Fracture is not an assistant. It is an adversary. Welcome to the studio."</p>
                </div>
                <div className="mt-32 h-px bg-zinc-900 w-full relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-950 px-4">
                        <div className="w-2 h-2 bg-zinc-800 rotate-45"></div>
                    </div>
                </div>
                <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.4em] text-zinc-600">
                    ESTABLISHED 2024 — BUILT FOR THE RIGOROUS
                </p>
            </motion.div>
        </div>
    </div>
);

const Landing = ({ navigate }) => (
    <div className="min-h-screen flex flex-col">
        <Nav navigate={navigate} />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-20">
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-5xl"
            >
                <h1 className="text-[12vw] md:text-[9vw] font-serif leading-[0.85] tracking-tighter mb-12">
                    Construct logic <br/>
                    <span className="text-zinc-600 italic">that cannot break.</span>
                </h1>
                <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
                    The elite workspace for high-stakes discourse. Fracture Studio uses adversarial AI to dismantle your logic before your opponents can.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button 
                        onClick={() => navigate('auth')} 
                        className="w-full sm:w-auto px-10 py-5 bg-zinc-100 text-zinc-950 rounded-sm text-lg font-bold hover:bg-white transition-all shadow-xl shadow-white/5"
                    >
                        Start Drafting
                    </button>
                    <button 
                        onClick={() => navigate('methodology')}
                        className="w-full sm:w-auto px-10 py-5 bg-transparent text-zinc-100 border border-zinc-800 rounded-sm text-lg font-medium hover:bg-zinc-900 transition-all"
                    >
                        View Methodology
                    </button>
                </div>
            </motion.div>
            
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12 text-left max-w-6xl w-full border-t border-zinc-900 pt-16"
            >
                <div>
                    <Shield className="w-6 h-6 mb-4 text-zinc-500" />
                    <h3 className="font-serif italic text-xl mb-2 text-zinc-100">Adversarial Review</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">Real-time identification of logical fallacies and structural vulnerabilities.</p>
                </div>
                <div>
                    <Layers className="w-6 h-6 mb-4 text-zinc-500" />
                    <h3 className="font-serif italic text-xl mb-2 text-zinc-100">Claim Mapping</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">Visualizing the hierarchy of your arguments to ensure total warrant coverage.</p>
                </div>
                <div>
                    <Zap className="w-6 h-6 mb-4 text-zinc-500" />
                    <h3 className="font-serif italic text-xl mb-2 text-zinc-100">Semantic Sparring</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">AI-driven counter-rebuttals based on historical competitive data.</p>
                </div>
            </motion.div>
        </main>
    </div>
);

const Auth = ({ navigate }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 bg-zinc-900/30 p-10 border border-zinc-900 rounded-sm">
            <div className="text-center">
                <div 
                    className="w-12 h-12 bg-zinc-100 rounded-sm mx-auto mb-6 flex items-center justify-center text-zinc-950 font-serif text-3xl italic font-bold cursor-pointer"
                    onClick={() => navigate('landing')}
                >
                    f
                </div>
                <h2 className="text-3xl font-serif italic mb-2">Welcome to the Studio</h2>
                <p className="text-zinc-500 text-sm">Please identify yourself to continue.</p>
            </div>
            <div className="space-y-4">
                <button 
                    onClick={() => navigate('dashboard')}
                    className="w-full py-4 bg-zinc-100 text-zinc-950 font-bold rounded-sm flex items-center justify-center gap-3 hover:bg-white transition-all"
                >
                    Continue to Dashboard
                </button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-950 px-2 text-zinc-600">End of Session</span></div>
                </div>
                <button 
                    onClick={() => navigate('landing')}
                    className="w-full py-4 bg-transparent border border-zinc-800 text-zinc-400 font-medium rounded-sm hover:text-zinc-100 hover:bg-zinc-900 transition-all"
                >
                    Back to Landing
                </button>
            </div>
        </div>
    </div>
);

// --- APP WRAPPER ---

export default function App() {
    const [view, setView] = useState('landing');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [view]);

    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 font-sans selection:bg-zinc-800 selection:text-white">
            <AnimatePresence mode="wait">
                {view === 'landing' && (
                    <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Landing navigate={setView} />
                    </motion.div>
                )}
                {view === 'methodology' && (
                    <motion.div key="methodology" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Methodology navigate={setView} />
                    </motion.div>
                )}
                {view === 'manifesto' && (
                    <motion.div key="manifesto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Manifesto navigate={setView} />
                    </motion.div>
                )}
                {view === 'auth' && (
                    <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Auth navigate={setView} />
                    </motion.div>
                )}
                {view === 'dashboard' && (
                    <motion.div key="dashboard" className="p-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h1 className="text-4xl font-serif italic mb-8">Dashboard Placeholder</h1>
                        <p className="text-zinc-400 mb-8">This is where the user projects from your uploaded folder would live.</p>
                        <button onClick={() => setView('landing')} className="px-6 py-2 bg-zinc-100 text-zinc-950 font-bold rounded-sm">Back to Home</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
