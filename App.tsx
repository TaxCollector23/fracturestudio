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
            <button onClick={() => navigate('auth')} className="px-10 py-5 bg-zinc-100 text-zinc-950 rounded-sm text-lg font-bold hover:bg-white">Start Drafting</button>
        </main>
    </div>
);

const Methodology = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-24 px-12 italic font-serif">
            <h1 className="text-7xl mb-12">The Adversarial Method</h1>
            <p className="text-2xl text-zinc-400">Logic is a weapon. We sharpen it.</p>
        </div>
    </div>
);

const Manifesto = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950">
        <Nav navigate={navigate} />
        <div className="max-w-4xl mx-auto py-24 px-12 text-center font-serif">
            <h1 className="text-8xl mb-12 italic">Rigor is a Choice.</h1>
        </div>
    </div>
);

const Dashboard = ({ navigate }) => (
    <div className="min-h-screen bg-zinc-950 p-12">
        <h1 className="text-4xl font-serif italic mb-12">Workspace</h1>
        <div className="grid grid-cols-3 gap-6">
            <div className="bg-zinc-900 p-8 border border-zinc-800 rounded-sm cursor-pointer hover:border-zinc-500" onClick={() => navigate('workspace')}>
                <h3 className="text-xl font-serif italic mb-4">Sample Case Study</h3>
                <p className="text-zinc-500 text-sm">Last modified 2h ago</p>
            </div>
        </div>
    </div>
);

const Workspace = ({ navigate }) => (
    <div className="h-screen flex flex-col bg-zinc-950 font-serif">
        <header className="h-16 border-b border-zinc-900 flex items-center px-6">
            <button onClick={() => navigate('dashboard')} className="text-zinc-400 hover:text-white mr-4"><ArrowLeft /></button>
            <span>Untitled Case</span>
        </header>
        <main className="flex-1 p-24">
            <textarea className="w-full h-full bg-transparent text-3xl focus:outline-none resize-none italic" placeholder="Break your logic here..."></textarea>
        </main>
    </div>
);

export default function App() {
    const [view, setView] = useState('landing');
    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 font-sans">
            <AnimatePresence mode="wait">
                {view === 'landing' && <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Landing navigate={setView}/></motion.div>}
                {view === 'methodology' && <motion.div key="met" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Methodology navigate={setView}/></motion.div>}
                {view === 'manifesto' && <motion.div key="man" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Manifesto navigate={setView}/></motion.div>}
                {view === 'auth' && <motion.div key="a" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><div className="flex items-center justify-center h-screen"><button onClick={() => setView('dashboard')} className="px-8 py-3 bg-white text-black font-bold">Log In</button></div></motion.div>}
                {view === 'dashboard' && <motion.div key="d" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Dashboard navigate={setView}/></motion.div>}
                {view === 'workspace' && <motion.div key="w" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Workspace navigate={setView}/></motion.div>}
            </AnimatePresence>
        </div>
    );
}
