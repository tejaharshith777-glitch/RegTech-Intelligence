import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ChevronDown, ShieldCheck, FileSearch, UserCheck, Link2,
  Lock, ScrollText, AlertTriangle, CheckCircle2, XCircle, Database,
  Brain, Download, Fingerprint, Server, Sparkles, Terminal,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   Scroll helpers
   ──────────────────────────────────────────────────────────────── */

function useReveal(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fall back to "visible" when IntersectionObserver is unavailable so the
    // page is never blank on an old browser.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? '0px 0px -8% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return [ref, visible];
}

function Reveal({ children, className = '', delay = '', variant = '' }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={`reveal ${variant} ${delay} ${visible ? 'visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

function CountUp({ to, suffix = '', duration = 1400 }) {
  const [value, setValue] = useState(0);
  const [ref, visible] = useReveal({ threshold: 0.4 });

  useEffect(() => {
    if (!visible) return;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, to, duration]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────── */

export default function LandingPage({ onEnterApp, isAuthenticated, user }) {
  const [scrollY, setScrollY] = useState(0);
  const [progress, setProgress] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const timers = useRef([]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrollY(y);
      setNavSolid(y > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min((y / max) * 100, 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const runSimulation = () => {
    if (simRunning) return;
    timers.current.forEach(clearTimeout);
    setSimRunning(true);
    setSimStep(1);
    [2, 3, 4, 5].forEach((step, i) => {
      timers.current.push(setTimeout(() => setSimStep(step), 900 * (i + 1)));
    });
    timers.current.push(
      setTimeout(() => {
        setSimRunning(false);
      }, 4600)
    );
  };

  const heroFade = Math.max(0, 1 - scrollY / 620);
  const heroShift = Math.min(scrollY * 0.28, 180);

  return (
    <div className="bg-forge-black text-forge-text font-sans overflow-x-hidden">
      <div className="scroll-progress" style={{ width: `${progress}%` }} />

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          navSolid
            ? 'bg-forge-black/90 backdrop-blur-xl border-b border-forge-border py-3'
            : 'bg-transparent py-5'
        }`}
        style={navSolid ? { borderColor: '#252a3a' } : undefined}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 flex items-center justify-between gap-4">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded border border-forge-accent/40 flex items-center justify-center group-hover:border-forge-accent transition-colors">
              <span className="text-forge-accent font-serif">§</span>
            </span>
            <span className="font-serif text-base text-forge-cream tracking-wide">RegTech Intelligence</span>
          </button>

          <div className="hidden md:flex items-center gap-7 text-2xs uppercase tracking-[0.18em] text-forge-muted">
            <button onClick={() => scrollTo('problem')} className="hover:text-forge-gold transition-colors">Problem</button>
            <button onClick={() => scrollTo('how')} className="hover:text-forge-gold transition-colors">How it works</button>
            <button onClick={() => scrollTo('governance')} className="hover:text-forge-gold transition-colors">Governance</button>
            <button onClick={() => scrollTo('proof')} className="hover:text-forge-gold transition-colors">Proof</button>
          </div>

          <button onClick={onEnterApp} className="btn-primary !py-2.5 !px-5 !text-2xs">
            <span>{isAuthenticated ? `Console · ${user?.username || 'you'}` : 'Open console'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* ── HERO (centered) ─────────────────────────────────── */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-5 pt-28 pb-16">
        <div className="absolute inset-0 bg-texture" />
        <div className="absolute inset-0 grid-lines opacity-70" aria-hidden="true" />
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[620px] h-[620px] rounded-full blur-[150px] pointer-events-none animate-glow-drift"
          style={{ background: 'radial-gradient(circle, rgba(232,180,100,0.16), transparent 65%)', opacity: heroFade }}
          aria-hidden="true"
        />

        <div
          className="relative z-10 max-w-4xl mx-auto"
          style={{ opacity: heroFade, transform: `translateY(${heroShift * 0.25}px)` }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-forge-accent/30 bg-forge-accent/[0.06] mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-soft" />
            <span className="text-2xs uppercase tracking-[0.2em] text-forge-gold">
              AI Security, Privacy &amp; Trust
            </span>
          </div>

          <h1 className="font-serif text-[2.7rem] sm:text-6xl md:text-7xl lg:text-[5.2rem] leading-[1.02] tracking-tight text-white mb-7 animate-fade-in-up">
            The AI proposes.
            <br />
            <span className="text-gradient-gold italic">A human decides.</span>
            <br />
            <span className="text-forge-text/90">The system proves both.</span>
          </h1>

          <p className="text-base md:text-lg text-forge-muted max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            Regulatory circulars in. Verifiable obligations out. Every quote checked against the
            source PDF, every decision signed by a named administrator and sealed into a
            hash-chained audit ledger.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <button onClick={onEnterApp} className="btn-primary w-full sm:w-auto animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
              {isAuthenticated ? 'Enter the console' : 'Try the live console'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => scrollTo('how')} className="btn-ghost w-full sm:w-auto">
              See how it works
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden border border-forge-border bg-forge-border max-w-3xl mx-auto">
            {[
              { value: <CountUp to={4} />, label: 'Trust controls' },
              { value: <span>SHA-256</span>, label: 'Chained ledger' },
              { value: <CountUp to={3} />, label: 'Triage states' },
              { value: <CountUp to={0} />, label: 'Disk retention' },
            ].map((s) => (
              <div key={s.label} className="bg-forge-card px-4 py-5">
                <div className="font-serif text-2xl text-forge-gold mb-1">{s.value}</div>
                <div className="text-3xs uppercase tracking-[0.16em] text-forge-dim">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => scrollTo('problem')}
          className="absolute bottom-7 left-1/2 -translate-x-1/2 text-forge-dim hover:text-forge-gold transition-colors animate-float"
          aria-label="Scroll down"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────── */}
      <div className="border-y border-forge-border bg-forge-dark/60 py-4 overflow-hidden marquee-mask" style={{ borderColor: '#252a3a' }}>
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center shrink-0" aria-hidden={copy === 1}>
              {[
                'SYNTHETIC CORPUS MODELLED ON FINRA NOTICES',
                'SEC RULEMAKING FORMATS',
                'GDPR ARTICLE 46 MEMORANDA',
                'HIPAA SECURITY RULE UPDATES',
                'BASEL III CAPITAL FRAMEWORKS',
                'FinCEN BSA TRAVEL RULE',
              ].map((label) => (
                <span key={label} className="flex items-center gap-4 px-6 whitespace-nowrap">
                  <span className="text-3xs uppercase tracking-[0.22em] text-forge-dim">{label}</span>
                  <span className="w-1 h-1 rounded-full bg-forge-accent/50" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEM ─────────────────────────────────────────── */}
      <section id="problem" className="relative py-24 md:py-32 px-5">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-3xl mx-auto mb-16">
            <span className="eyebrow">The gap</span>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-4 mb-6 leading-tight">
              Compliance work happens.
              <br />
              <span className="italic text-forge-muted">The evidence does not.</span>
            </h2>
            <p className="text-forge-muted leading-relaxed">
              A 40-page circular lands on a Monday. Someone reads it, someone decides what to do,
              and by Friday nobody can reconstruct who decided what, on which page, and why.
              That is the finding an auditor writes.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: FileSearch,
                title: 'Citations you cannot check',
                body: 'An AI summary says "the firm must do X". Which page? Which clause? If you cannot point at the sentence, you cannot defend it.',
                accent: 'coral',
              },
              {
                icon: UserCheck,
                title: 'Decisions with no author',
                body: '"Approved" with no name, no timestamp, no reason. Maker-checker becomes a formality nobody can prove happened.',
                accent: 'amber',
              },
              {
                icon: ScrollText,
                title: 'An audit trail you can edit',
                body: 'If the record lives in a spreadsheet, anyone with write access can rewrite history. That is not an audit trail.',
                accent: 'sky',
              },
            ].map((card, i) => (
              <Reveal key={card.title} delay={`reveal-delay-${i + 1}`} variant="reveal-scale">
                <div className="h-full p-7 rounded-lg bg-forge-card border border-forge-border card-glow transition-colors hover:border-forge-accent/30" style={{ borderColor: '#252a3a' }}>
                  <card.icon className={`w-6 h-6 mb-5 text-${card.accent}`} style={{ color: card.accent === 'coral' ? '#ff7a90' : card.accent === 'amber' ? '#fbbf24' : '#6fa8ff' }} />
                  <h3 className="font-serif text-xl text-forge-cream mb-3">{card.title}</h3>
                  <p className="text-sm text-forge-muted leading-relaxed">{card.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how" className="relative py-24 md:py-32 px-5 bg-forge-dark/40 border-y border-forge-border" style={{ borderColor: '#252a3a' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="mb-16 max-w-2xl">
            <span className="eyebrow">The pipeline</span>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-4 leading-tight">
              Six steps from PDF to <span className="italic text-gradient-gold">provable</span> decision
            </h2>
          </Reveal>

          <div className="relative">
            <div className="absolute left-[27px] top-3 bottom-3 w-px bg-gradient-to-b from-forge-accent/60 via-forge-border to-transparent hidden md:block" style={{ background: 'linear-gradient(180deg, rgba(232,180,100,0.6), #252a3a, transparent)' }} aria-hidden="true" />

            <div className="space-y-4">
              {[
                { icon: Database, step: '01', title: 'Ingest in memory', body: 'The PDF is read into a buffer. It never touches disk, so there is no temp file to leak or forget.' },
                { icon: Brain, step: '02', title: 'Extract with Gemini', body: 'The model returns obligations as strict JSON: summary, plain meaning, page, clause, tier, deadline, and declared scope.' },
                { icon: Lock, step: '03', title: 'Scan for PII deterministically', body: 'After the model runs, a regex guard sweeps the output for 8 identifier patterns. The model\'s promise is never the last word.' },
                { icon: FileSearch, step: '04', title: 'Verify every clause', body: 'Our own PDF text extractor checks the quoted sentence against the real document. Not found? The citation is removed, not dressed up.' },
                { icon: ShieldCheck, step: '05', title: 'Triage to your scope', body: 'Each obligation is marked applies, out of scope, or unclear against the entity types you declared.' },
                { icon: Link2, step: '06', title: 'Decide and seal', body: 'An administrator approves or rejects with a reason. The decision is hashed with the previous block: SHA-256, chained.' },
              ].map((item, i) => (
                <Reveal key={item.step} delay={`reveal-delay-${Math.min(i, 4)}`} variant="reveal-left">
                  <div className="flex gap-5 items-start p-5 rounded-lg bg-forge-card/70 border border-forge-border hover:border-forge-accent/30 transition-colors" style={{ borderColor: '#252a3a' }}>
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-lg bg-forge-raised border border-forge-border flex items-center justify-center" style={{ borderColor: '#252a3a' }}>
                        <item.icon className="w-5 h-5 text-forge-accent" />
                      </div>
                    </div>
                    <div>
                      <div className="text-3xs uppercase tracking-[0.2em] text-forge-dim mb-1">Step {item.step}</div>
                      <h3 className="font-serif text-xl text-forge-cream mb-1.5">{item.title}</h3>
                      <p className="text-sm text-forge-muted leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── GOVERNANCE ──────────────────────────────────────── */}
      <section id="governance" className="py-24 md:py-32 px-5">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <span className="eyebrow">Separation of duties</span>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-4 mb-5 leading-tight">
              Maker-checker, enforced by the server
            </h2>
            <p className="text-forge-muted leading-relaxed">
              Not a UI hint. Not a disabled button that a crafted request can bypass.
              The rule is checked in the route, in the controller, and the database keeps the name.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-5 mb-8">
            <Reveal variant="reveal-left">
              <div className="h-full p-7 rounded-lg bg-forge-card border-2 border-sky/25" style={{ borderColor: 'rgba(111,168,255,0.25)' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-sky/10 border border-sky/30 flex items-center justify-center">
                    <FileSearch className="w-5 h-5 text-sky" style={{ color: '#6fa8ff' }} />
                  </div>
                  <div>
                    <div className="text-3xs uppercase tracking-[0.2em] text-forge-dim">Maker</div>
                    <h3 className="font-serif text-lg text-forge-cream">Researcher</h3>
                  </div>
                </div>
                <ul className="space-y-2.5 text-sm">
                  {[
                    ['Ingest circulars', true],
                    ['Read extracted obligations', true],
                    ['Request clarification', true],
                    ['Approve or reject', false],
                  ].map(([label, allowed]) => (
                    <li key={label} className="flex items-center gap-2.5">
                      {allowed ? (
                        <CheckCircle2 className="w-4 h-4 text-mint shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-coral shrink-0" />
                      )}
                      <span className={allowed ? 'text-forge-text' : 'text-forge-dim line-through'}>{label}</span>
                      {!allowed && <span className="ml-auto text-3xs font-mono text-coral">403</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal variant="reveal-right" delay="reveal-delay-1">
              <div className="h-full p-7 rounded-lg bg-forge-card border-2 border-forge-accent/30" style={{ borderColor: 'rgba(232,180,100,0.3)' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-forge-accent/10 border border-forge-accent/30 flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-forge-accent" />
                  </div>
                  <div>
                    <div className="text-3xs uppercase tracking-[0.2em] text-forge-dim">Checker</div>
                    <h3 className="font-serif text-lg text-forge-cream">Administrator</h3>
                  </div>
                </div>
                <ul className="space-y-2.5 text-sm">
                  {[
                    ['Everything a researcher can do', true],
                    ['Approve a finding', true],
                    ['Reject with a mandatory reason', true],
                    ['Promote another administrator', true],
                  ].map(([label]) => (
                    <li key={label} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-forge-accent shrink-0" />
                      <span className="text-forge-text">{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div className="p-5 rounded-lg bg-forge-raised/60 border border-forge-border flex items-start gap-3" style={{ borderColor: '#252a3a' }}>
              <AlertTriangle className="w-5 h-5 text-amber shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
              <p className="text-sm text-forge-muted leading-relaxed">
                <span className="text-forge-text font-medium">Roles are never client-supplied.</span>{' '}
                Registration ignores any role in the request body. In the full test suite,
                <code className="mx-1.5 px-1.5 py-0.5 rounded bg-forge-black text-forge-gold text-xs font-mono">{"{\"role\":\"admin\"}"}</code>
                still creates a researcher, and a researcher calling the approve endpoint gets a 403.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── OBLIGATION CARD PREVIEW ─────────────────────────── */}
      <section className="py-24 md:py-32 px-5 bg-forge-dark/40 border-y border-forge-border" style={{ borderColor: '#252a3a' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <Reveal variant="reveal-left">
            <span className="eyebrow">What an obligation looks like</span>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-4 mb-6 leading-tight">
              Two layers.
              <br />
              <span className="italic text-forge-muted">Always.</span>
            </h2>
            <p className="text-forge-muted leading-relaxed mb-6">
              A plain-language line you can forward to the business, and underneath it,
              the exact sentence from the regulator with its page number. If the second layer
              is missing, you are told why — never quietly handed a confident paraphrase.
            </p>
            <ul className="space-y-3 text-sm">
              {[
                'Clause text is verified against the PDF text layer',
                'Unverifiable citations are withheld, not invented',
                'Triage tells you whether it applies to your firm',
                'Every finding exports as CSV and as a markdown audit pack',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-forge-muted">
                  <CheckCircle2 className="w-4 h-4 text-mint shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal variant="reveal-right" delay="reveal-delay-1">
            <div className="rounded-lg bg-forge-card border border-forge-border p-6 shadow-lift" style={{ borderColor: '#252a3a' }}>
              <div className="flex items-center justify-between pb-4 border-b border-forge-border mb-5" style={{ borderColor: '#252a3a' }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-coral" />
                  <span className="text-3xs uppercase tracking-[0.16em] text-forge-dim">MANDATORY</span>
                </div>
                <span className="text-3xs font-mono text-forge-dim">p. 4 · APPLIES</span>
              </div>

              <div className="mb-5">
                <div className="text-3xs uppercase tracking-[0.18em] text-forge-accent mb-1.5">What this means</div>
                <p className="text-sm text-forge-text leading-relaxed">
                  Refresh the customer order-routing disclosure on the public portal every month,
                  and keep the published copy as evidence.
                </p>
              </div>

              <div className="p-4 rounded bg-forge-black border-l-2 border-forge-accent/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xs uppercase tracking-[0.16em] text-forge-dim">Clause · p.4</span>
                  <span className="flex items-center gap-1 text-3xs font-mono text-mint">
                    <Fingerprint className="w-3 h-3" /> verified
                  </span>
                </div>
                <p className="font-serif italic text-sm text-forge-cream/90 leading-relaxed">
                  “Member firms must update customer order routing disclosures on the public
                  investor portal within 30 days of each calendar quarter.”
                </p>
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-forge-border text-3xs" style={{ borderColor: '#252a3a' }}>
                <span className="text-forge-dim">Deadline · 30 days</span>
                <span className="flex items-center gap-1.5 text-forge-dim">
                  <Lock className="w-3 h-3" /> Awaiting administrator
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PROOF ───────────────────────────────────────────── */}
      <section id="proof" className="py-24 md:py-32 px-5">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <span className="eyebrow">Proof, not adjectives</span>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-4 mb-5 leading-tight">
              Every claim here has a
              <br />
              <span className="italic text-gradient-gold">way to be checked</span>
            </h2>
            <p className="text-forge-muted leading-relaxed">
              Four controls, each enforced server-side, each with the test that proves it.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                icon: Server,
                accent: '#a78bfa',
                title: 'Server-assigned roles',
                prove: 'Register with {"role":"admin"} → the account is a researcher.',
                detail: 'The register handler ignores the field entirely and reads only the server-side ADMIN_EMAILS bootstrap.',
              },
              {
                icon: UserCheck,
                accent: '#6fa8ff',
                title: 'Maker-checker approval',
                prove: 'Researcher calls approve → 403. Admin rejects with no reason → 422.',
                detail: 'Checked at the route (requireAdmin) and again in the controller, so neither layer alone is load-bearing.',
              },
              {
                icon: Fingerprint,
                accent: '#4ade9c',
                title: 'Clause verification',
                prove: 'A fabricated sentence is returned with its citation removed.',
                detail: 'A dependency-free PDF text extractor compares the quote to the real document; a mismatch nulls the clause and the page.',
              },
              {
                icon: Link2,
                accent: '#e8b464',
                title: 'Tamper-evident ledger',
                prove: 'GET /api/research/audit/verify → valid: true, plus the block count.',
                detail: 'Each decision hashes the previous block, the actor, the timestamp and the reason. Change one character and the chain breaks.',
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={`reveal-delay-${i + 1}`} variant="reveal-scale">
                <div className="h-full p-6 rounded-lg bg-forge-card border border-forge-border card-glow" style={{ borderColor: '#252a3a' }}>
                  <c.icon className="w-5 h-5 mb-4" style={{ color: c.accent }} />
                  <h3 className="font-serif text-lg text-forge-cream mb-2">{c.title}</h3>
                  <p className="text-sm text-forge-muted leading-relaxed mb-4">{c.detail}</p>
                  <div className="flex items-start gap-2 p-3 rounded bg-forge-black border border-forge-border" style={{ borderColor: '#252a3a' }}>
                    <Terminal className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: c.accent }} />
                    <span className="text-xs font-mono text-forge-muted leading-relaxed">{c.prove}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIMULATION ──────────────────────────────────────── */}
      <section className="py-24 md:py-32 px-5 bg-forge-dark/40 border-y border-forge-border" style={{ borderColor: '#252a3a' }}>
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <span className="eyebrow">Watch the pipeline</span>
            <h2 className="font-serif text-3xl md:text-4xl text-white mt-4 mb-4">
              One circular, six stages
            </h2>
            <p className="text-forge-muted mb-10 max-w-xl mx-auto">
              A walkthrough of what happens between dropping a PDF and an administrator signing off.
            </p>
          </Reveal>

          <Reveal delay="reveal-delay-1">
            <div className="text-left rounded-lg bg-forge-black border border-forge-border overflow-hidden" style={{ borderColor: '#252a3a' }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-forge-border bg-forge-card" style={{ borderColor: '#252a3a' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-coral/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber/70" style={{ backgroundColor: 'rgba(251,191,36,0.7)' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-mint/70" />
                  <span className="ml-2 text-2xs font-mono text-forge-dim">pipeline.log</span>
                </div>
                <button
                  onClick={runSimulation}
                  disabled={simRunning}
                  className="px-3.5 py-1.5 rounded border border-forge-accent/40 text-forge-gold text-2xs uppercase tracking-[0.14em] hover:bg-forge-accent/10 transition-colors disabled:opacity-50"
                >
                  {simRunning ? 'Running…' : 'Run walkthrough'}
                </button>
              </div>

              <div className="p-5 space-y-2.5 font-mono text-xs min-h-[210px]">
                {simStep === 0 && (
                  <p className="text-forge-dim italic">
                    Press “Run walkthrough” to see the six stages.
                  </p>
                )}
                {[
                  ['01', 'INGEST', 'PDF read into memory (612 KB). No file written to disk.', 'text-forge-muted'],
                  ['02', 'EXTRACT', 'Gemini returns 3 obligations with page, clause, tier and scope.', 'text-sky'],
                  ['03', 'PII', 'Deterministic scan finds 1 SSN and 1 email. Both replaced. Residual: 0.', 'text-mint'],
                  ['04', 'VERIFY', '2 clauses matched the PDF text. 1 fabricated quote had its citation withheld.', 'text-forge-gold'],
                  ['05', 'TRIAGE', '2 marked APPLIES for your entity type, 1 OUT_OF_SCOPE.', 'text-violet'],
                  ['06', 'DECIDE', 'Administrator rejects with a reason. Block sealed. Ledger valid: true.', 'text-forge-cream'],
                ].map(([n, stage, text, color], i) => (
                  simStep > i && (
                    <div key={n} className="flex items-start gap-3 animate-fade-in">
                      <span className="text-forge-dim shrink-0">{n}</span>
                      <span className="shrink-0 w-16" style={{ color: 'inherit' }}>
                        <span className={color}>{stage}</span>
                      </span>
                      <span className="text-forge-muted leading-relaxed">{text}</span>
                    </div>
                  )
                ))}
                {simStep >= 6 && (
                  <div className="pt-3 mt-2 border-t border-forge-border flex items-center justify-between" style={{ borderColor: '#252a3a' }}>
                    <span className="text-mint font-semibold">PIPELINE COMPLETE · HUMAN DECISION RECORDED</span>
                    <button onClick={onEnterApp} className="text-forge-gold hover:underline text-xs">
                      Open console →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          <p className="text-3xs text-forge-dim mt-4">
            Illustrative walkthrough of the pipeline stages — not a recording of a live request.
          </p>
        </div>
      </section>

      {/* ── CAPABILITIES ────────────────────────────────────── */}
      <section className="py-24 md:py-28 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Download, title: 'Audit pack export', body: 'One markdown bundle: obligations, clauses, pages, actor, timestamp, reason, chain status, and a SHA-256 of the pack.' },
              { icon: ScrollText, title: 'Obligation CSV', body: 'The same findings as a spreadsheet, for the people who live in spreadsheets.' },
              { icon: Layers2Icon, title: 'Version diff', body: 'Compare two circulars and see what was added, removed and reworded.' },
              { icon: Sparkles, title: 'Plain-language layer', body: 'Every obligation carries a one-line meaning you can forward without a translation call.' },
            ].map((c, i) => (
              <Reveal key={c.title} delay={`reveal-delay-${i + 1}`}>
                <div className="h-full p-6 rounded-lg bg-forge-card/60 border border-forge-border hover:border-forge-accent/30 transition-colors" style={{ borderColor: '#252a3a' }}>
                  <c.icon className="w-5 h-5 text-forge-accent mb-4" />
                  <h3 className="text-base font-medium text-forge-cream mb-2">{c.title}</h3>
                  <p className="text-xs text-forge-muted leading-relaxed">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOSING (centered hero) ─────────────────────────── */}
      <section className="relative py-28 md:py-40 px-5 text-center overflow-hidden">
        <div className="absolute inset-0 bg-texture" />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[380px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(232,180,100,0.13), transparent 70%)' }}
          aria-hidden="true"
        />
        <Reveal className="relative z-10 max-w-3xl mx-auto">
          <span className="eyebrow">Close the gap</span>
          <h2 className="font-serif text-5xl sm:text-6xl md:text-7xl text-white mt-6 mb-8 leading-[1.05]">
            Prove it.
            <br />
            <span className="italic text-gradient-gold">Every control. Every time.</span>
          </h2>
          <p className="text-forge-muted max-w-xl mx-auto mb-10 leading-relaxed">
            Bring a circular. We will show you the obligation, the page, the person who decided,
            and the hash that proves nobody edited it afterwards.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={onEnterApp} className="btn-primary w-full sm:w-auto">
              {isAuthenticated ? 'Enter the console' : 'Open the console'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => scrollTo('proof')} className="btn-ghost w-full sm:w-auto">
              Review the controls
            </button>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-forge-border bg-forge-dark/60 px-5 py-10" style={{ borderColor: '#252a3a' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5 text-2xs text-forge-dim">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded border border-forge-accent/40 flex items-center justify-center">
              <span className="text-forge-accent font-serif text-xs">§</span>
            </span>
            <span className="font-serif text-forge-cream text-sm">RegTech Intelligence</span>
          </div>

          <p className="text-center max-w-md leading-relaxed">
            Demonstration product. Uses a synthetic test corpus modelled on FINRA / SEC / GDPR /
            HIPAA / Basel III / FinCEN formats. Not legal advice.
          </p>

          <div className="flex items-center gap-4">
            <span>© 2026</span>
            <button onClick={onEnterApp} className="hover:text-forge-gold transition-colors underline underline-offset-4 decoration-forge-accent/40">
              Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* small icon alias used above */
function Layers2Icon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}
