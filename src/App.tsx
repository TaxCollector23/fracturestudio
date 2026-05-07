import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, Zap, Search, Plus, Clock, Save } from 'lucide-react';

const Nav = ({ navigate }) => (
    <nav className="h-20 border-b border-zinc-900 flex items-center justify-between px-12 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('landing')}>
            <div className="w-8 h-8 bg-zinc-100 rounded-sm flex items-center justify-center text-zinc-950 font-serif text-xl italic font-bold">f</div>
            <span className="font-serif italic text-xl tracking-wide">Fracture Studio</span>
        </div>
        <div className="flex gap-8 items-center text-sm font-medium text-zinc-400">
            <button onClick={() => navigate('methodology')} className="hover:text-zinc-50">Methodology</button>
            <button onClick={() => navigate('manifesto')} className="hover:text-zinc-50">Manifesto</button>
            <button onClick={() => navigate('auth')} className="px-5 py-2 bg-zinc-100 text-zinc-950 rounded-sm hover:bg-white text-zinc-950 font-bold transition-colors">Enter Studio</button>
        </div>
    </nav>
);

export default function App() {
    const [view, setView] = useState('landing');
    const [content, setContent] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const callAI = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: "user", content: `Analyze the following logic for fracture points: ${content}` }]
                })
            });
            const data = await res.json();
            alert("AI Response: " + (data.choices?.[0]?.message?.content || "No response"));
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 selection:bg-zinc-800">
            <AnimatePresence mode="wait">
                {view === 'landing' && (
                    <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                        <Nav navigate={setView} />
                        <div className="flex flex-col items-center justify-center pt-40 px-6 text-center">
                            <h1 className="text-[9vw] font-serif leading-none tracking-tighter mb-8">Construct logic <br/><span className="text-zinc-600 italic">that cannot break.</span></h1>
                            <button onClick={() => setView('auth')} className="px-10 py-5 bg-zinc-100 text-zinc-950 rounded-sm text-lg font-bold hover:bg-white">Start Drafting</button>
                        </div>
                    </motion.div>
                )}
                {view === 'auth' && (
                    <motion.div key="a" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center justify-center h-screen">
                        <button onClick={() => setView('dashboard')} className="px-12 py-4 bg-white text-black font-bold text-xl rounded-sm">Log In</button>
                    </motion.div>
                )}
                {view === 'dashboard' && (
                    <motion.div key="d" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-12">
                         <h1 className="text-4xl font-serif italic mb-12">Workspace</h1>
                         <div className="bg-zinc-900/50 border border-zinc-800 p-8 w-80 cursor-pointer hover:border-zinc-500" onClick={() => setView('workspace')}>
                             <h3 className="text-xl font-serif italic">New Debate Draft</h3>
                             <p className="text-zinc-500 text-xs mt-4">Pressure test your argument</p>
                         </div>
                    </motion.div>
                )}
                {view === 'workspace' && (
                    <motion.div key="w" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="h-screen flex flex-col">
                        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-6">
                            <button onClick={() => setView('dashboard')}><ArrowLeft /></button>
                            <button 
                                onClick={callAI}
                                disabled={isAnalyzing}
                                className="bg-zinc-100 text-zinc-950 px-4 py-1.5 rounded-sm font-bold text-xs disabled:opacity-50"
                            >
                                {isAnalyzing ? "Analyzing..." : "Run Adversarial Check"}
                            </button>
                        </header>
                        <main className="flex-1 p-24 max-w-3xl mx-auto w-full">
                            <textarea 
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full h-full bg-transparent text-3xl font-serif italic focus:outline-none resize-none text-zinc-200" 
                                placeholder="Start typing your argument..."
                            />
                        </main>
                    </motion.div>
                )}
                {/* Methodology and Manifesto remain standard */}
            </AnimatePresence>
        </div>
    );
}
