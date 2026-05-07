import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Shield, Layers, Zap, Search, Plus, Clock, MoreVertical, ArrowLeft, Share2, Save } from 'lucide-react';

const Nav = ({ navigate }) => (
    <nav className="h-20 border-b border-zinc-900 flex items-center justify-between px-6 md:px-12 shrink-0 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('landing')}>
            <div className="w-8 h-8 bg-zinc-100 rounded-sm flex items-center justify-center text-zinc-950 font-serif text-xl italic font-bold">f</div>
            <span className="font-serif italic text-xl tracking-wide">Fracture Studio</span>
        </div>
        <div className="flex gap-8 items-center text-sm font-medium">
            <button onClick={() => navigate('methodology')} className="text-zinc-400 hover:text-zinc-50 transition-colors">Methodology</button>
            <button onClick={() => navigate('manifesto')} className="text-zinc-400 hover:text-zinc-50 transition-colors">Manifesto</button>
            <button onClick={() => navigate('auth')} className="px-5 py-2 bg-zinc-100 text-zinc-950 rounded-sm hover:bg-white transition-colors font-semibold">Enter Studio</button>
        </div>
    </nav>
);

const Landing = ({ navigate }) => (
    <div className="min-h-screen flex flex-col">
        <Nav navigate={navigate} />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-[9vw] font-serif leading-[0.85] tracking-tighter mb-12">Construct logic <br/><span className="text-zinc-600 italic">that cannot break.</span></h1>
            <p className="text-xl text-zinc-400 max-w-2xl mb-12">The elite workspace for debaters. Fracture Studio uses adversarial AI to dismantle your logic before your opponents can.</p>
            <button onClick={() => navigate('auth')} className="px-10 py-5 bg-zinc-100 text-zinc-950 rounded-sm text-lg font-bold hover:bg-white transition-all">Start Drafting</button>
        </main>
    </div>
);

const Methodology = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-24 px-12">
            <h1 className="text-7xl font-serif mb-12 italic">The Adversarial Method</h1>
            <div className="space-y-12 text-lg text-zinc-400 leading-relaxed font-light">
                <section>
                    <h2 className="text-zinc-100 font-mono text-xs uppercase tracking-widest mb-4">01 / Structural Dismantling</h2>
                    <p>Fracture does not proofread; it deconstructs. Our engine identifies the 'fracture points' in your logic.</p>
                </section>
            </div>
        </div>
    </div>
);

const Manifesto = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-24 px-12 text-center">
            <h1 className="text-7xl font-serif mb-16 tracking-tight">Rigor is a <span className="italic text-zinc-500">Choice.</span></h1>
            <p className="text-xl font-serif italic text-zinc-400">"Fracture is not an assistant. It is an adversary."</p>
        </div>
    </div>
);

const Dashboard = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950 p-12">
        <header className="flex justify-between items-center mb-12">
            <h1 className="text-4xl font-serif italic">Workspace</h1>
            <button onClick={() => navigate('workspace')} className="px-6 py-2 bg-white text-black font-bold">New Case</button>
        </header>
        <div className="grid grid-cols-3 gap-6">
            <div className="bg-zinc-900 p-8 border border-zinc-800 hover:border-zinc-500 cursor-pointer" onClick={() => navigate('workspace')}>
                <h3 className="text-xl font-serif italic">The Case for AI Ethics</h3>
                <p className="text-zinc-500 text-sm mt-4">Last modified 2h ago</p>
            </div>
        </div>
    </div>
);

const Workspace = ({ navigate }) => (
    <div className="h-screen flex flex-col bg-zinc-950">
        <header className="h-16 border-b border-zinc-900 flex items-center px-6 gap-4">
            <button onClick={() => navigate('dashboard')}><ArrowLeft className="w-5 h-5"/></button>
            <span className="font-serif italic">The Case for AI Ethics</span>
        </header>
        <main className="flex-1 p-24 max-w-4xl mx-auto w-full">
            <textarea className="w-full h-full bg-transparent text-3xl font-serif focus:outline-none resize-none italic text-zinc-300" placeholder="Start typing..."></textarea>
        </main>
    </div>
);

export default function App() {
    const [view, setView] = useState('landing');
    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 selection:bg-zinc-800">
            <AnimatePresence mode="wait">
                {view === 'landing' && <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Landing navigate={setView}/></motion.div>}
                {view === 'methodology' && <motion.div key="met" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Methodology navigate={setView}/></motion.div>}
                {view === 'manifesto' && <motion.div key="man" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Manifesto navigate={setView}/></motion.div>}
                {view === 'auth' && <motion.div key="a" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><div className="flex items-center justify-center h-screen"><button onClick={() => setView('dashboard')} className="px-12 py-4 bg-white text-black font-bold text-xl">Enter Studio</button></div></motion.div>}
                {view === 'dashboard' && <motion.div key="d" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Dashboard navigate={setView}/></motion.div>}
                {view === 'workspace' && <motion.div key="w" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Workspace navigate={setView}/></motion.div>}
            </AnimatePresence>
        </div>
    );
}
