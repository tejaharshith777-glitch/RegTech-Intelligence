import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Building2, Globe2, Layers, ArrowRight, Loader2, AlertCircle, Check } from 'lucide-react';
import { authService, errorMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const JURISDICTIONS = [
  { id: 'IN', label: 'India', note: 'RBI · SEBI · IRDAI' },
  { id: 'US', label: 'United States', note: 'SEC · FINRA · FinCEN' },
  { id: 'EU', label: 'European Union', note: 'GDPR · MiFID II · Basel' },
  { id: 'UK', label: 'United Kingdom', note: 'FCA · PRA' },
  { id: 'SG', label: 'Singapore', note: 'MAS' },
  { id: 'GLOBAL', label: 'Multiple / global', note: 'Cross-border' },
];

const ENTITY_TYPES = [
  'bank', 'NBFC', 'broker-dealer', 'insurer', 'asset manager',
  'payment provider', 'crypto custodian', 'healthcare covered entity',
];

const BUSINESS_LINES = [
  'retail lending', 'equities', 'derivatives', 'digital assets',
  'payments', 'wealth management', 'insurance underwriting', 'health data',
];

/**
 * One-screen scope declaration.
 *
 * These three answers are the only reason the dashboard can say "9 apply to
 * you, 4 out of scope" instead of dumping every obligation on the user.
 * Shown once; afterwards `applicability.completedAt` is set server-side.
 */
export default function ApplicabilityGate({ onDone, onSkip }) {
  const { user, setUser } = useAuthStore();
  const [jurisdiction, setJurisdiction] = useState(user?.applicability?.jurisdiction || 'IN');
  const [entityTypes, setEntityTypes] = useState(user?.applicability?.entityTypes || ['NBFC']);
  const [businessLines, setBusinessLines] = useState(user?.applicability?.businessLines || ['retail lending']);
  const [error, setError] = useState('');

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const mutation = useMutation({
    mutationFn: (payload) => authService.saveApplicability(payload),
    onSuccess: (res) => {
      setUser(res.data.user);
      toast.success('Scope saved. Your obligations are now triaged.');
      onDone?.();
    },
    onError: (err) => {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!entityTypes.length) {
      setError('Choose at least one entity type so we can tell which obligations apply.');
      return;
    }
    mutation.mutate({ jurisdiction, entityTypes, businessLines });
  };

  return (
    <div className="min-h-screen bg-forge-black text-forge-text flex items-center justify-center px-6 py-14 relative">
      <div className="absolute inset-0 bg-texture opacity-80 pointer-events-none" />

      <form onSubmit={submit} className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-forge-accent/30 bg-forge-accent/5 mb-6">
            <Layers className="w-3.5 h-3.5 text-forge-accent" />
            <span className="text-2xs uppercase tracking-[0.2em] text-forge-gold">Step 1 of 1 · asked once</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight mb-4">
            Which regulations
            <br />
            <span className="italic text-gradient-gold">actually apply to you?</span>
          </h1>
          <p className="text-sm text-forge-muted max-w-lg mx-auto leading-relaxed">
            A regulator publishes a 40-page circular. Most of it will never touch your firm.
            Tell us what you are, and every obligation gets triaged as
            <span className="text-mint"> applies</span>,
            <span className="text-coral"> out of scope</span>, or
            <span className="text-amber"> unclear</span>.
          </p>
        </div>

        <div className="space-y-7 p-6 sm:p-8 rounded-lg bg-forge-card border border-forge-border">
          {/* Jurisdiction */}
          <section>
            <SectionTitle icon={Globe2} title="Primary jurisdiction" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {JURISDICTIONS.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setJurisdiction(j.id)}
                  className={`text-left p-3 rounded border transition-all ${
                    jurisdiction === j.id
                      ? 'border-forge-accent/70 bg-forge-accent/10'
                      : 'border-forge-border hover:border-forge-accent/40 bg-forge-dark'
                  }`}
                >
                  <div className="text-sm text-forge-text">{j.label}</div>
                  <div className="text-3xs text-forge-dim mt-0.5">{j.note}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Entity types */}
          <section>
            <SectionTitle icon={Building2} title="Entity type — pick all that fit" />
            <div className="flex flex-wrap gap-2">
              {ENTITY_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={entityTypes.includes(t)}
                  onClick={() => toggle(entityTypes, setEntityTypes, t)}
                />
              ))}
            </div>
          </section>

          {/* Business lines */}
          <section>
            <SectionTitle icon={Layers} title="Business lines (optional)" />
            <div className="flex flex-wrap gap-2">
              {BUSINESS_LINES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={businessLines.includes(t)}
                  onClick={() => toggle(businessLines, setBusinessLines, t)}
                />
              ))}
            </div>
          </section>

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded border border-coral/40 bg-coral/10 text-coral text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving
                </>
              ) : (
                <>
                  Save my scope <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="btn-ghost sm:w-auto"
                title="You can set this later. Until then, obligations show as UNCLEAR."
              >
                Later
              </button>
            )}
          </div>

          <p className="text-3xs text-forge-dim text-center leading-relaxed">
            Stored on your user record only. Change it any time from the dashboard header.
          </p>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-forge-accent" />
      <span className="text-2xs uppercase tracking-[0.18em] text-forge-muted">{title}</span>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs capitalize transition-all border ${
        active
          ? 'bg-forge-accent/15 border-forge-accent/60 text-forge-gold'
          : 'bg-forge-dark border-forge-border text-forge-muted hover:border-forge-accent/40 hover:text-forge-text'
      }`}
    >
      {active && <Check className="w-3 h-3" />}
      {label}
    </button>
  );
}
