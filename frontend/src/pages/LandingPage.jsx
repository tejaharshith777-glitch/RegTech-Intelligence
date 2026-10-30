import React, { useEffect, useState } from 'react';
import {
  Shield,
  ArrowRight,
  ChevronDown,
  Zap,
  Eye,
  Lock,
  FileText,
  Brain,
  CheckCircle,
  ExternalLink,
  Sparkles,
  Sliders,
  Database,
  KeyRound,
  Terminal,
} from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

function RevealSection({ children, className = '', delay = '' }) {
  const [ref, isVisible] = useScrollReveal();
  return (
    <div ref={ref} className={`reveal ${delay} ${isVisible ? 'visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

function Counter({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useScrollReveal();

  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function LandingPage({ onEnterApp, isAuthenticated, user }) {
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [activeSlide, setActiveSlide] = useState(1);
  const [simStep, setSimStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setNavSolid(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(1);
    setTimeout(() => setSimStep(2), 1200);
    setTimeout(() => setSimStep(3), 2400);
    setTimeout(() => setSimStep(4), 3600);
    setTimeout(() => {
      setSimStep(5);
      setIsSimulating(false);
    }, 4800);
  };

  return (
    <div className="bg-[#050505] text-white grain-overlay min-h-screen selection:bg-forge-accent/20 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* ─── FIXED LUXURY MINIMALIST HEADER ─── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          navSolid
            ? 'bg-[#050505]/95 backdrop-blur-2xl border-b border-white/[0.05] py-4'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
          {/* Left subtle indicator */}
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-accent animate-pulse-soft" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-forge-muted font-sans hidden sm:inline-block">
              Apex RegTech 2026
            </span>
          </div>

          {/* Centered Luxury Apex Emblem (Identical to reference screenshot style) */}
          <div className="flex flex-col items-center cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="flex items-center justify-center w-7 h-7 text-white group-hover:text-forge-accent transition-colors duration-500">
              {/* Minimalist Apex Glyph */}
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L1 21h4.5l6.5-12 6.5 12H23L12 2z" />
              </svg>
            </div>
            <span className="font-serif text-[13px] tracking-[0.25em] uppercase text-white mt-1">
              Apex
            </span>
          </div>

          {/* Right Navigation & CTAs */}
          <div className="flex items-center gap-6 md:gap-8">
            <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-sans text-forge-muted">
              <button onClick={() => scrollToSection('approach')} className="hover:text-white transition-colors duration-300 hover-line pb-1">Approach</button>
              <button onClick={() => scrollToSection('insight')} className="hover:text-white transition-colors duration-300 hover-line pb-1">Insight</button>
              <button onClick={() => scrollToSection('architecture')} className="hover:text-white transition-colors duration-300 hover-line pb-1">Architecture</button>
            </div>

            <button
              onClick={onEnterApp}
              className="group relative px-5 py-2.5 border border-white/20 hover:border-forge-accent/70 text-[10px] md:text-[11px] uppercase tracking-[0.25em] font-sans transition-all duration-500 bg-black/40 hover:bg-forge-accent/10 flex items-center gap-2"
            >
              <span>{isAuthenticated ? `Console (${user?.username || 'Active'})` : 'Research Console'}</span>
              <ArrowRight className="w-3 h-3 text-forge-accent group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION: "For Those Who Refuse Ordinary" ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20 bg-texture overflow-hidden">
        {/* Subtle cinematic radial backlights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-forge-accent/[0.035] blur-[170px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-rose-500/[0.015] blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center max-w-5xl mx-auto w-full">
          {/* Subtle micro tag */}
          <div className="overflow-hidden mb-6">
            <p className="text-[11px] uppercase tracking-[0.35em] text-forge-muted font-sans animate-fade-in inline-block border-b border-forge-accent/20 pb-1">
              Autonomous Compliance Engineering
            </p>
          </div>

          {/* Grand bespoke serif heading (Reference Screenshot 2 & 3 exact aesthetic) */}
          <div className="overflow-hidden mb-6">
            <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-normal leading-[1.0] tracking-tight text-white animate-fade-in-up">
              For Those Who<br />
              <span className="italic font-light text-[#f5f0e8]">Refuse Ordinary</span>
            </h1>
          </div>

          <div className="overflow-hidden max-w-xl mx-auto mb-14">
            <p className="text-xs md:text-sm text-forge-muted font-sans tracking-[0.12em] leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              BESPOKE REGULATORY INTELLIGENCE CRAFTED FOR ABSOLUTE COMPLIANCE & IMMUNITY
            </p>
          </div>

          {/* ─── TRIO OF OBSIDIAN MONOLITH SHOWCASES (Mirroring the 3 vehicles on asphalt from Screenshot 2) ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16 text-left">
            {/* Monolith 1: Ingestion Core */}
            <div className="group relative bg-[#0b0b0d] border border-white/[0.07] hover:border-forge-accent/40 p-8 rounded-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-forge-accent/50 transition-all duration-700" />
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-mono text-forge-muted/50 tracking-widest">01 / CORE</span>
                <Database className="w-4 h-4 text-forge-muted/60 group-hover:text-forge-accent transition-colors" />
              </div>
              <h3 className="font-serif text-2xl text-white mb-2 group-hover:text-forge-cream transition-colors">
                Zero-Disk Buffer
              </h3>
              <p className="text-xs text-forge-muted leading-relaxed mb-6 font-sans">
                Memory-only PDF parsing stream. FIPS 140-3 cryptographic sanitization with zero filesystem residue or leak vectors.
              </p>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-forge-accent/80 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-forge-accent" />
                <span>Streaming Ingestion</span>
              </div>
            </div>

            {/* Monolith 2: The Red Racing Engine (GT3 RS analog from Screenshot 2) */}
            <div className="group relative bg-[#0d090a] border border-rose-500/20 hover:border-rose-500/50 p-8 rounded-sm transition-all duration-700 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-rose-950/20">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500/20 via-rose-500 to-rose-500/20 group-hover:via-rose-400 transition-all duration-700" />
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-mono text-rose-400/70 tracking-widest">02 / REASONING</span>
                <Brain className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="font-serif text-2xl text-white mb-2 group-hover:text-rose-100 transition-colors">
                Gemini 2.5 Flash
              </h3>
              <p className="text-xs text-rose-100/70 leading-relaxed mb-6 font-sans">
                Sub-second structural extraction of policy mandates, risk vectors, punitive thresholds, and verbatim regulatory clauses.
              </p>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-rose-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>Ultra-Low Latency</span>
              </div>
            </div>

            {/* Monolith 3: Immutable Provenance */}
            <div className="group relative bg-[#0b0b0d] border border-white/[0.07] hover:border-forge-accent/40 p-8 rounded-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-forge-accent/50 transition-all duration-700" />
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-mono text-forge-muted/50 tracking-widest">03 / PROVENANCE</span>
                <Lock className="w-4 h-4 text-forge-muted/60 group-hover:text-forge-accent transition-colors" />
              </div>
              <h3 className="font-serif text-2xl text-white mb-2 group-hover:text-forge-cream transition-colors">
                SHA-256 Ledger
              </h3>
              <p className="text-xs text-forge-muted leading-relaxed mb-6 font-sans">
                Cryptographic audit trail. Human sign-off approvals are hashed into a tamper-evident chain for internal and external auditors.
              </p>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-forge-accent/80 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-forge-accent" />
                <span>Zero-Tamper Chain</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              onClick={onEnterApp}
              className="px-9 py-4 bg-white text-black hover:bg-forge-cream font-sans text-[11px] uppercase tracking-[0.25em] font-semibold transition-all duration-300 shadow-xl shadow-white/5 hover:scale-[1.02]"
            >
              Launch Research Console
            </button>
            <button
              onClick={() => scrollToSection('approach')}
              className="px-9 py-4 border border-white/20 hover:border-white/50 text-white font-sans text-[11px] uppercase tracking-[0.25em] transition-all duration-300 hover:bg-white/[0.03]"
            >
              Explore Architecture
            </button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float cursor-pointer" onClick={() => scrollToSection('philosophy')}>
          <ChevronDown className="w-4 h-4 text-forge-muted/40 hover:text-white transition-colors" />
        </div>
      </section>

      {/* ─── PHILOSOPHICAL MANIFESTO (Screenshot 4 exact aesthetic) ─── */}
      <section id="philosophy" className="relative py-36 md:py-48 bg-[#070708] border-t border-b border-white/[0.04] text-center px-6">
        <RevealSection className="max-w-4xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.35em] text-forge-accent/70 font-sans mb-8">
            The Apex Creed
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.1] tracking-tight text-white mb-8">
            We Don't Modify Regulations<br />
            <span className="italic font-light text-forge-cream">We Build Immunity</span> For You
          </h2>
          <div className="luxury-divider max-w-xs mx-auto my-10" />
          <p className="text-xs md:text-sm text-forge-muted font-sans tracking-[0.15em] uppercase max-w-xl mx-auto leading-relaxed">
            Form follows precision. Every mandate, risk classification, and audit receipt is verified with zero tolerance for ambiguity.
          </p>
        </RevealSection>
      </section>

      {/* ─── INSIGHT SHOWCASE (Screenshot 1 exact aesthetic: "02 / 03 Insight") ─── */}
      <section id="insight" className="relative py-28 md:py-36 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column (Screenshot 1: Dark Fine-Bordered Frame with macro inspection visual) */}
            <div className="lg:col-span-7">
              <RevealSection>
                <div className="relative bg-[#09090b] border border-white/[0.08] p-8 md:p-10 rounded-sm overflow-hidden group">
                  {/* Fine edge highlight */}
                  <div className="absolute top-0 left-0 w-24 h-[1px] bg-forge-accent" />
                  <div className="absolute top-0 left-0 w-[1px] h-24 bg-forge-accent" />

                  {/* Header inside card */}
                  <div className="flex items-center justify-between pb-6 border-b border-white/[0.05] mb-6">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-rose-400">
                        Critical Mandate Vector
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-forge-muted/60">
                      FINRA Notice 26-08 • p. 4
                    </span>
                  </div>

                  {/* Document preview simulation */}
                  <div className="space-y-5">
                    <div className="bg-[#111114] border border-white/[0.04] p-5 rounded-sm">
                      <div className="text-[10px] uppercase tracking-wider text-forge-muted/50 mb-1 font-mono">
                        Obligation Text
                      </div>
                      <p className="font-serif text-lg text-white/95 leading-relaxed">
                        "Broker-dealers deploying algorithmic execution systems must conduct semi-annual stress simulations under stressed liquidity scenarios."
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                      <div className="bg-[#111114] p-3 border border-white/[0.04]">
                        <span className="text-[9px] uppercase tracking-wider text-forge-muted font-mono block mb-1">Risk Severity</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-400">High Risk</span>
                      </div>
                      <div className="bg-[#111114] p-3 border border-white/[0.04]">
                        <span className="text-[9px] uppercase tracking-wider text-forge-muted font-mono block mb-1">PII Status</span>
                        <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Sanitized
                        </span>
                      </div>
                      <div className="bg-[#111114] p-3 border border-white/[0.04] col-span-2 sm:col-span-1">
                        <span className="text-[9px] uppercase tracking-wider text-forge-muted font-mono block mb-1">Provenance Hash</span>
                        <span className="text-[10px] font-mono text-forge-accent truncate block">7f8c2b9a1...</span>
                      </div>
                    </div>
                  </div>

                  {/* Corner indicator */}
                  <div className="mt-8 pt-4 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono text-forge-muted/50">
                    <span>FIPS 140-3 CRYPTOGRAPHIC ATTESTATION</span>
                    <span>CONFIDENTIAL</span>
                  </div>
                </div>
              </RevealSection>
            </div>

            {/* Right Column (Screenshot 1: "02 / 03 Insight" + Editorial Typography) */}
            <div className="lg:col-span-5">
              <RevealSection delay="reveal-delay-1">
                {/* 02 / 03 Tag */}
                <div className="text-[11px] uppercase tracking-[0.35em] text-forge-accent font-sans mb-4">
                  02 / 03
                </div>

                {/* Big Luxury Title: Insight */}
                <h2 className="font-serif text-5xl sm:text-6xl md:text-7xl font-normal leading-none tracking-tight text-white mb-8">
                  <span className="italic font-light">Insight</span>
                </h2>

                <p className="text-sm md:text-base text-forge-muted font-sans leading-[1.8] mb-10">
                  Every decision is intentional, every extraction has purpose. We combine Gemini 2.5 Flash's reasoning with deterministic regex guards to distill complex statutory texts into indisputable obligations.
                </p>

                {/* Refined line slider indicator (From Screenshot 1) */}
                <div className="flex items-center gap-3 py-6 border-t border-white/[0.06] mb-8">
                  <div className="w-12 h-[1px] bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-forge-accent" />
                  <div className="w-24 h-[1px] bg-white/10" />
                  <span className="text-[10px] font-mono tracking-widest text-forge-muted/60 ml-2">
                    VERIFIED
                  </span>
                </div>

                <button
                  onClick={onEnterApp}
                  className="inline-flex items-center gap-3 px-7 py-3.5 border border-white/20 hover:border-forge-accent text-[11px] uppercase tracking-[0.25em] font-sans transition-all duration-300 hover:bg-forge-accent/10 group"
                >
                  <span>Open Active Console</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </RevealSection>
            </div>
          </div>
        </div>
      </section>

      {/* ─── OUR APPROACH SECTION (Screenshot 5 exact aesthetic with regulatory agency crests) ─── */}
      <section id="approach" className="relative py-28 md:py-36 bg-[#08080a] border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start mb-20">
            {/* Left Title: Our Approach To Every Build */}
            <div className="lg:col-span-5">
              <RevealSection>
                <div className="text-[11px] uppercase tracking-[0.35em] text-forge-accent font-sans mb-4">
                  01 / 03
                </div>
                <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-white">
                  Our Approach<br />
                  <span className="italic font-light text-forge-cream">To Every Build</span>
                </h2>
              </RevealSection>
            </div>

            {/* Right Editorial Copy */}
            <div className="lg:col-span-7">
              <RevealSection delay="reveal-delay-1">
                <p className="text-sm md:text-base text-forge-muted font-sans leading-[1.8] mb-8">
                  We reject the prevailing industry model of treating regulatory compliance as a probabilistic guessing game. When millions in capital adequacy and regulatory fines are on the line, AI summaries alone are insufficient. Every extraction must have character-level provenance, verifiable statutory citations, and an immutable human-in-the-loop audit sign-off.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-white/[0.05]">
                  <div>
                    <span className="font-serif text-3xl text-white block mb-1">0.00%</span>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-forge-muted font-sans">
                      PII Leak Tolerance
                    </span>
                  </div>
                  <div>
                    <span className="font-serif text-3xl text-white block mb-1">&lt;850ms</span>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-forge-muted font-sans">
                      Extraction Latency
                    </span>
                  </div>
                  <div>
                    <span className="font-serif text-3xl text-white block mb-1">100%</span>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-forge-muted font-sans">
                      Provenance Proof
                    </span>
                  </div>
                </div>
              </RevealSection>
            </div>
          </div>

          {/* ─── LUXURY REGULATORY AUTHORITY CRESTS (Mirroring Ferrari, Lambo, Defender logos in Screenshot 5) ─── */}
          <div className="pt-12 border-t border-white/[0.05]">
            <p className="text-center text-[10px] uppercase tracking-[0.3em] text-forge-muted/40 font-sans mb-10">
              Validated Across Global Regulatory Frameworks
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6 items-center justify-items-center opacity-70 hover:opacity-100 transition-opacity duration-500">
              {[
                { name: 'SEC', subtitle: 'US Securities & Exchange' },
                { name: 'FINRA', subtitle: 'Financial Regulatory' },
                { name: 'CFTC', subtitle: 'Commodity Futures' },
                { name: 'ESMA', subtitle: 'MiFID II Europe' },
                { name: 'MAS', subtitle: 'Monetary Authority SG' },
                { name: 'BaFin', subtitle: 'Federal Financial DE' },
              ].map((crest) => (
                <div
                  key={crest.name}
                  className="group flex flex-col items-center justify-center p-4 border border-white/[0.05] hover:border-forge-accent/40 w-full rounded-sm transition-all duration-300 hover:bg-white/[0.02]"
                >
                  <span className="font-serif text-xl md:text-2xl tracking-widest text-white/80 group-hover:text-forge-accent transition-colors">
                    {crest.name}
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.15em] text-forge-muted/60 mt-1 font-mono">
                    {crest.subtitle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE LIVE SIMULATOR DIRECTLY ON LANDING PAGE ─── */}
      <section className="relative py-28 md:py-36 bg-[#050505] border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <RevealSection>
            <p className="text-[10px] uppercase tracking-[0.3em] text-forge-accent font-sans mb-4">
              Real-Time Verification
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-white mb-6">
              Experience the <span className="italic font-light">Engine</span> in Action
            </h2>
            <p className="text-xs md:text-sm text-forge-muted font-sans max-w-lg mx-auto mb-10 leading-relaxed">
              Test how Apex processes incoming regulatory PDF streams: zero-disk buffer, AI extraction, PII scrub, and SHA-256 block commitment.
            </p>

            {/* Interactive Terminal Card */}
            <div className="bg-[#0a0a0c] border border-white/[0.08] rounded-sm p-6 md:p-8 text-left font-mono text-xs shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-[11px] text-forge-muted/60 ml-2">apex-pipeline-stream.log</span>
                </div>

                <button
                  onClick={runSimulation}
                  disabled={isSimulating}
                  className="px-4 py-1.5 border border-forge-accent/40 text-forge-accent hover:bg-forge-accent/10 text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {isSimulating ? 'Processing...' : '▶ Run Ingestion Simulation'}
                </button>
              </div>

              {/* Log stream outputs */}
              <div className="space-y-3 min-h-[160px]">
                {simStep === 0 && (
                  <div className="text-forge-muted/50 italic">
                    Press "Run Ingestion Simulation" to observe the sub-second compliance workflow...
                  </div>
                )}
                {simStep >= 1 && (
                  <div className="text-forge-muted flex items-center gap-2 animate-fade-in">
                    <span className="text-forge-accent">[00.12s]</span>
                    <span>INGEST: Zero-disk memory buffer allocated for "SEC_Custody_Rule_2026.pdf" (612 KB)</span>
                  </div>
                )}
                {simStep >= 2 && (
                  <div className="text-sky-300 flex items-center gap-2 animate-fade-in">
                    <span className="text-forge-accent">[00.45s]</span>
                    <span>GEMINI 2.5: Parsed 3 binding mandates, 2 reporting deadlines, 1 high-severity vector.</span>
                  </div>
                )}
                {simStep >= 3 && (
                  <div className="text-emerald-400 flex items-center gap-2 animate-fade-in">
                    <span className="text-forge-accent">[00.78s]</span>
                    <span>REDACT: 2 SSNs & 1 personal email masked via deterministic regex guardrail. Residual: 0.</span>
                  </div>
                )}
                {simStep >= 4 && (
                  <div className="text-amber-300 flex items-center gap-2 animate-fade-in">
                    <span className="text-forge-accent">[00.91s]</span>
                    <span>LEDGER: Minted block #104. SHA-256: 4a3e91f09b8c... Waiting for Human-in-the-Loop Sign-off.</span>
                  </div>
                )}
                {simStep >= 5 && (
                  <div className="text-forge-cream pt-2 border-t border-white/[0.05] flex items-center justify-between font-bold animate-fade-in">
                    <span>STATUS: READY FOR AUDIT APPROVAL</span>
                    <button onClick={onEnterApp} className="text-forge-accent underline text-xs font-sans tracking-wider">
                      Review in Console →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── FINAL EDITORIAL CALL TO ACTION ─── */}
      <section className="relative py-32 md:py-44 bg-[#050505] text-center px-6">
        <RevealSection className="max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.35em] text-forge-accent font-sans mb-6">
            Command Your Compliance
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.1] text-white mb-10">
            Engineered For Those Who<br />
            <span className="italic font-light text-forge-cream">Cannot Afford Failure</span>
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onEnterApp}
              className="w-full sm:w-auto px-10 py-5 bg-white text-black hover:bg-forge-cream font-sans text-[11px] uppercase tracking-[0.25em] font-semibold transition-all duration-300 shadow-2xl hover:scale-105"
            >
              Enter Research Console
            </button>
          </div>
        </RevealSection>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.05] bg-[#030304] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] uppercase tracking-[0.2em] text-forge-muted/50 font-sans">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border border-forge-accent/40 rounded flex items-center justify-center">
              <span className="text-forge-accent font-serif text-[10px]">§</span>
            </div>
            <span className="text-white/80 font-serif tracking-widest">Apex Regulatory Intelligence</span>
          </div>

          <div className="flex items-center gap-6">
            <span>FIPS 140-3 Compliant</span>
            <span className="w-1 h-1 rounded-full bg-forge-muted/30" />
            <span>Zero-Disk Buffer</span>
            <span className="w-1 h-1 rounded-full bg-forge-muted/30" />
            <span>SHA-256 Audit Trail</span>
          </div>

          <div>
            © 2026 Apex RegTech. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
