import React, { useState } from 'react';
import {
  Lock, Mail, User as UserIcon, ArrowRight, Loader2, ChevronLeft,
  ShieldCheck, AlertCircle, Sparkles, Eye, EyeOff, KeyRound,
} from 'lucide-react';
import { authService, errorMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

/**
 * Sign in / Register.
 *
 * There is intentionally NO role selector and NO "instant demo login" button:
 *   - the server assigns every new account the researcher role
 *   - a button that silently registers a throwaway account on click is a lie
 *     about how authentication works
 */
export default function AuthPage({ onBack, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({ username: '', email: '', password: '' });

  const update = (e) => {
    setError('');
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const res = await authService.login({ email: form.email, password: form.password });
        setAuth(res.data.user, res.data.token);
        toast.success(`Welcome back, ${res.data.user.username}`);
      } else {
        // role is never sent - the server decides it
        const res = await authService.register({
          username: form.username,
          email: form.email,
          password: form.password,
        });
        setAuth(res.data.user, res.data.token);
        toast.success(
          res.data.user.role === 'admin'
            ? 'Account created. You are signed in as an administrator.'
            : 'Account created. You are signed in as a researcher.'
        );
      }
      onSuccess?.();
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    const isAdmin = role === 'admin';
    setMode('login');
    setError('');
    setForm({
      username: '',
      email: isAdmin ? 'chief@example.com' : 'researcher@example.com',
      password: 'Passw0rdTest',
    });
    toast.success('Demo credentials filled in. Press Sign In to continue.');
  };

  return (
    <div className="min-h-screen w-full flex bg-forge-black text-forge-text">
      {/* Left: form */}
      <div className="w-full lg:w-[52%] flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative">
        <div className="absolute inset-0 bg-texture opacity-70 pointer-events-none" />

        <div className="relative z-10 w-full max-w-md mx-auto">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-forge-muted hover:text-forge-cream transition-colors mb-10"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to overview
            </button>
          )}

          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded border border-forge-accent/40 flex items-center justify-center">
              <span className="font-serif text-forge-accent text-xl">§</span>
            </div>
            <div>
              <div className="font-serif text-lg text-forge-cream leading-tight">RegTech Intelligence</div>
              <div className="text-2xs uppercase tracking-[0.2em] text-forge-dim">Compliance evidence platform</div>
            </div>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl text-white leading-[1.05] mb-3">
            {mode === 'login' ? 'Sign in to' : 'Create your'}
            <br />
            <span className="italic text-gradient-gold">{mode === 'login' ? 'the evidence ledger' : 'researcher account'}</span>
          </h1>
          <p className="text-sm text-forge-muted mb-8 leading-relaxed">
            {mode === 'login'
              ? 'Every decision you make is written to a hash-chained audit trail.'
              : 'New accounts start as researchers. Only an administrator can approve findings.'}
          </p>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-px bg-forge-border mb-7 rounded overflow-hidden">
            {[
              { id: 'login', label: 'Sign in' },
              { id: 'register', label: 'Register' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setMode(tab.id); setError(''); }}
                className={`py-3 text-xs uppercase tracking-[0.18em] font-semibold transition-colors ${
                  mode === tab.id
                    ? 'bg-forge-raised text-forge-gold'
                    : 'bg-forge-card text-forge-dim hover:text-forge-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode === 'register' && (
              <Field label="Username" icon={UserIcon}>
                <input
                  type="text"
                  name="username"
                  required
                  minLength={3}
                  autoComplete="username"
                  placeholder="sarah_compliance"
                  value={form.username}
                  onChange={update}
                  className="input-base pl-11"
                />
              </Field>
            )}

            <Field label="Email address" icon={Mail}>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@firm.com"
                value={form.email}
                onChange={update}
                className="input-base pl-11"
              />
            </Field>

            <Field label="Password" icon={Lock}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••••••"
                value={form.password}
                onChange={update}
                className="input-base pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-forge-dim hover:text-forge-text transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </Field>

            {mode === 'register' && (
              <p className="text-xs text-forge-dim -mt-1">
                At least 8 characters, with one uppercase, one lowercase and one number.
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded border border-coral/40 bg-coral/10 text-coral text-xs leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Please wait</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign in' : 'Create account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials: fills the form, does not bypass authentication */}
          <div className="mt-8 pt-6 border-t border-forge-border" style={{ borderColor: '#252a3a' }}>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-3.5 h-3.5 text-forge-accent" />
              <span className="text-2xs uppercase tracking-[0.2em] text-forge-dim">Demo accounts</span>
            </div>
            <p className="text-xs text-forge-dim mb-3 leading-relaxed">
              Fills the form with the seeded demo accounts. This does not skip authentication —
              you still sign in with a real password checked by the server.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('researcher')}
                className="py-2.5 text-2xs uppercase tracking-[0.14em] border border-forge-border text-forge-muted hover:border-forge-accent/60 hover:text-forge-gold transition-colors rounded"
              >
                Researcher
              </button>
              <button
                type="button"
                onClick={() => fillDemo('admin')}
                className="py-2.5 text-2xs uppercase tracking-[0.14em] border border-forge-border text-forge-muted hover:border-forge-accent/60 hover:text-forge-gold transition-colors rounded"
              >
                Administrator
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: proof panel */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden border-l border-forge-border bg-forge-dark">
        <div className="absolute inset-0 bg-texture" />
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="relative z-10 m-auto max-w-md px-12">
          <Sparkles className="w-6 h-6 text-forge-accent mb-6 animate-pulse-soft" />
          <p className="font-serif text-3xl text-forge-cream leading-snug mb-8">
            “The AI proposes, a human decides, and the system proves both.”
          </p>
          <div className="space-y-4">
            {[
              ['Server-assigned roles', 'Nobody can sign themselves up as an admin.'],
              ['Maker-checker', 'Only an administrator can approve or reject a finding.'],
              ['Hash-chained ledger', 'Every decision is sealed with SHA-256.'],
              ['Verifiable clauses', 'A quote that is not in the PDF is never shown as a citation.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <ShieldCheck className="w-4 h-4 text-mint shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-forge-text font-medium">{title}</div>
                  <div className="text-xs text-forge-dim">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="block text-2xs uppercase tracking-[0.2em] text-forge-dim mb-2">{label}</span>
      <span className="relative block">
        <Icon className="w-4 h-4 text-forge-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        {children}
      </span>
    </label>
  );
}
