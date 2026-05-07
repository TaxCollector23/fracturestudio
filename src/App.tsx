import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Shield, Zap, Layers, Search, Save, Share2, Clock, MoreVertical } from 'lucide-react';

const Nav = ({ navigate }) => (
    <nav className="h-20 border-b border-zinc-900 flex items-center justify-between px-12 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('landing')}>
            <div className="w-8 h-8 bg-zinc-100 rounded-sm flex items-center justify-center text-zinc-950 font-serif text-xl italic font-bold">f</div>
            <span className="font-serif italic text-xl tracking-wide">Fracture Studio</span>
        </div>
        <div className="flex gap-8 items-center text-sm font-medium text-zinc-400">
            <button onClick={() => navigate('methodology')} className="hover:text-zinc-50">Methodology</button>
            <button onClick={() => navigate('manifesto')} className="hover:text-zinc-50">Manifesto</button>
            <button onClick={() => navigate('auth')} className="px-5 py-2 bg-zinc-100 text-zinc-950 rounded-sm hover:bg-white font-semibold transition-colors">Enter Studio</button>
        </div>
    </nav>
);

const Landing = ({ navigate }) => (
    <div className="min-h-screen">
        <Nav navigate={navigate} />
        <div className="flex flex-col items-center justify-center pt-40 px-6 text-center">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-[9vw] font-serif leading-none tracking-tighter mb-8">
                Construct logic <br/><span className="text-zinc-600 italic">that cannot break.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-xl text-zinc-400 max-w-2xl mb-12 font-light">
                The elite workspace for high-stakes discourse. Fracture Studio uses adversarial AI to dismantle your logic before your opponents can.
            </motion.p>
            <motion.button 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                onClick={() => navigate('auth')} 
                className="px-10 py-5 bg-zinc-100 text-zinc-950 rounded-sm text-lg font-bold hover:bg-white"
            >
                Start Drafting
            </motion.button>
        </div>
    </div>
);

const Methodology = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-24 px-12">
            <h1 className="text-7xl font-serif mb-12 italic">The Adversarial Method</h1>
            <div className="space-y-12 text-lg text-zinc-400 leading-relaxed font-light">
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-widest mb-4">01 / Structural Dismantling</h2>
                    <p>Fracture does not proofread; it deconstructs. Our engine identifies 'fracture points' where a premise lacks a sufficient warrant or an impact is assumed rather than proven.</p>
                </section>
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-widest mb-4">02 / Node Mapping</h2>
                    <p>Every argument is a dependency tree. If a top-level claim is severed from its supporting evidence, the entire structure collapses. We visualize these nodes in real-time.</p>
                </section>
            </div>
        </div>
    </div>
);

const Manifesto = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-32 px-12 text-center">
            <h1 className="text-8xl font-serif mb-16 tracking-tight italic">Rigor is a Choice.</h1>
            <div className="space-y-10 text-2xl font-serif italic text-zinc-400">
                <p>"Clarity has become a luxury. We believe tools should make thinking harder, not writing easier."</p>
                <p>"Fracture is not an assistant. It is an adversary. Welcome to the studio."</p>
            </div>
        </div>
    </div>
);

const Dashboard = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950">
        <header className="h-20 border-b border-zinc-900 flex items-center justify-between px-12 sticky top-0 bg-zinc-950/80 backdrop-blur-md">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('landing')}>
                <div className="w-8 h-8 bg-zinc-100 rounded-sm flex items-center justify-center text-zinc-950 font-serif text-xl italic font-bold">f</div>
                <span className="font-serif italic text-xl tracking-wide">Fracture Studio</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700"></div>
        </header>
        <main className="p-12 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-end mb-12">
                <div>
                    <h2 className="text-4xl font-serif italic mb-2">Workspace</h2>
                    <p className="text-zinc-500 text-sm">Select a case to pressure test.</p>
                </div>
                <button onClick={() => navigate('workspace')} className="flex items-center gap-2 bg-zinc-100 text-zinc-950 px-6 py-3 rounded-sm font-bold hover:bg-white">
                    <Plus className="w-4 h-4" /> New Case
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('workspace')} className="bg-zinc-900/50 border border-zinc-800 p-8 hover:border-zinc-500 cursor-pointer transition-all aspect-video flex flex-col justify-between">
                    <h3 className="text-xl font-serif italic">The Case for AI in Academic Discourse</h3>
                    <div className="flex items-center gap-2 text-zinc-600 text-xs"><Clock className="w-3 h-3" /> 2h ago</div>
                </div>
            </div>
        </main>
    </div>
);

const Workspace = ({ navigate }) => (
    <div className="h-screen flex flex-col bg-zinc-950">
        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 bg-zinc-950">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('dashboard')} className="p-2 hover:bg-zinc-900 rounded-sm text-zinc-400"><ArrowLeft/></button>
                <span className="text-sm font-medium text-zinc-300">Untitled Case</span>
            </div>
            <button className="bg-zinc-100 text-zinc-950 px-4 py-1.5 rounded-sm font-bold text-xs">Save</button>
        </header>
        <main className="flex-1 p-24 max-w-3xl mx-auto w-full">
            <textarea className="w-full h-full bg-transparent text-3xl font-serif italic focus:outline-none resize-none text-zinc-200" placeholder="Break your logic here..."></textarea>
        </main>
    </div>
);

export default function App() {
    const [view, setView] = useState('landing');
    useEffect(() => { window.scrollTo(0, 0); }, [view]);
    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 selection:bg-zinc-800">
            <AnimatePresence mode="wait">
                {view === 'landing' && <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Landing navigate={setView}/></motion.div>}
                {view === 'methodology' && <motion.div key="met" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Methodology navigate={setView}/></motion.div>}
                {view === 'manifesto' && <motion.div key="man" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Manifesto navigate={setView}/></motion.div>}
                {view === 'auth' && <motion.div key="a" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><div className="flex items-center justify-center h-screen"><button onClick={() => setView('dashboard')} className="px-12 py-4 bg-white text-black font-bold text-xl rounded-sm">Log In</button></div></motion.div>}
                {view === 'dashboard' && <motion.div key="d" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Dashboard navigate={setView}/></motion.div>}
                {view === 'workspace' && <motion.div key="w" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Workspace navigate={setView}/></motion.div>}
            </AnimatePresence>
        </div>
    );
}
