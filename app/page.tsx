"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    label: "Smart Chat",
    desc: "LLM-powered conversations with Groq & Gemini fallback",
    color: "from-indigo-500/20 to-indigo-600/5",
    border: "border-indigo-500/20",
    icon_bg: "bg-indigo-500/10 text-indigo-400",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    label: "Image Generation",
    desc: "Generate AI art via Pollinations & Stable Diffusion",
    color: "from-purple-500/20 to-purple-600/5",
    border: "border-purple-500/20",
    icon_bg: "bg-purple-500/10 text-purple-400",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    label: "Code Execution",
    desc: "Write, run & debug code in 8+ languages live",
    color: "from-cyan-500/20 to-cyan-600/5",
    border: "border-cyan-500/20",
    icon_bg: "bg-cyan-500/10 text-cyan-400",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    label: "Web Search",
    desc: "Real-time web search with sourced answers",
    color: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/20",
    icon_bg: "bg-emerald-500/10 text-emerald-400",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M5.5 8.5a8 8 0 000 7" />
      </svg>
    ),
    label: "Voice Synthesis",
    desc: "Neural text-to-speech via Microsoft Edge TTS",
    color: "from-orange-500/20 to-orange-600/5",
    border: "border-orange-500/20",
    icon_bg: "bg-orange-500/10 text-orange-400",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    label: "Long-Term Memory",
    desc: "Vector-powered memory that learns your preferences",
    color: "from-pink-500/20 to-pink-600/5",
    border: "border-pink-500/20",
    icon_bg: "bg-pink-500/10 text-pink-400",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
} as const;

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#09090b] overflow-hidden">
      {/* ── Ambient background orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-64 -left-64 w-[700px] h-[700px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -right-64 w-[600px] h-[600px] rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #a855f7, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #22d3ee, transparent 70%)" }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse-glow"
               style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Synthox AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-zinc-400 hover:text-white text-sm font-medium transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
          >
            Log in
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/signup"
              className="text-white text-sm font-semibold px-4 py-2 rounded-lg block transition-all duration-200"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}
            >
              Get Started
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-5xl mx-auto w-full"
      >
        {/* Badge */}
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-indigo-300 mb-8"
          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          6 specialized AI agents — one platform
        </motion.div>

        {/* Heading */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white leading-tight mb-6 text-balance"
        >
          The AI assistant that{" "}
          <span className="text-gradient">thinks in agents</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-zinc-400 text-lg sm:text-xl max-w-2xl leading-relaxed mb-10 text-balance"
        >
          Synthox AI routes your request to the right specialist automatically —
          chat, code execution, image generation, web search, voice, and long-term memory.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/signup"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}
            >
              Start for free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-zinc-200 transition-all duration-200 hover:text-white"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              Log in to your account
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          variants={itemVariants}
          className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full"
        >
          {features.map((f) => (
            <motion.div
              key={f.label}
              whileHover={{ scale: 1.03, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`relative rounded-2xl p-5 text-left transition-all duration-300 bg-gradient-to-br ${f.color} border ${f.border}`}
              style={{ background: undefined, backdropFilter: "blur(8px)" }}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${f.icon_bg}`}>
                {f.icon}
              </div>
              <p className="text-sm font-semibold text-zinc-100 mb-1">{f.label}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.main>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-6 text-xs text-zinc-600">
        © {new Date().getFullYear()} Synthox AI. All rights reserved.
      </footer>
    </div>
  );
}
