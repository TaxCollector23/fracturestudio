import { useState } from "react";
import { motion } from "framer-motion";

const POSTS = [
  { title: "The collapse point: the one sentence your case lives or dies on", tag: "Method", read: "5 min",
    body: "Every argument has a single load-bearing claim. Find it, defend it, and the rest of your case holds. We walk through how Fracture isolates it and what to do once you know yours." },
  { title: "Why 'studies show' is the weakest phrase in your draft", tag: "Evidence", read: "4 min",
    body: "Vague source language signals to a reader that you haven't checked. Here's how to replace it with specific, verifiable evidence — and how Fracture flags it before a grader does." },
  { title: "Warrants: the reasoning step everyone skips", tag: "Logic", read: "6 min",
    body: "A claim and evidence aren't an argument until you explain why one proves the other. We break down the warrant — the move that separates a strong case from a list of facts." },
  { title: "Scoring honestly: how a 100 is actually possible", tag: "Scoring", read: "3 min",
    body: "Most feedback engines cluster every score in the 70s to stay safe. Fracture commits to the score your work earns — including a perfect one when it's deserved." }
];

export default function Blog() {
  const [active, setActive] = useState(null);
  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-12">
      <div className="label-mono mb-2">Writing</div>
      <h1 className="font-serif text-4xl md:text-6xl mb-10">The Fracture Journal</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {POSTS.map((p, i) => (
          <motion.button key={p.title} onClick={() => setActive(p)}
            initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="card card-hover p-7 text-left flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <span className="pill">{p.tag}</span>
              <span className="faint text-xs font-mono">{p.read}</span>
            </div>
            <h2 className="font-serif text-2xl mb-2 leading-snug">{p.title}</h2>
            <p className="muted text-sm leading-relaxed line-clamp-3">{p.body}</p>
          </motion.button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-center justify-center p-6" onClick={() => setActive(null)}>
          <div className="card max-w-xl w-full p-8" onClick={(e) => e.stopPropagation()}>
            <span className="pill mb-4">{active.tag}</span>
            <h2 className="font-serif text-3xl mb-4 leading-tight">{active.title}</h2>
            <p className="muted leading-relaxed">{active.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}
