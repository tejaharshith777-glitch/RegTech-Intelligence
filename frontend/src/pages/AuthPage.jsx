import React, { useState } from 'react';
import { Lock, Mail, User, ArrowRight, Loader2, ChevronLeft } from 'lucide-react';
import { authService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function AuthPage({ onBack, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'researcher',
  });

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const res = await authService.login({
          email: formData.email,
          password: formData.password,
        });
        setAuth(res.data.user, res.data.token);
        toast.success(`Welcome back, ${res.data.user.username}`);
        onSuccess?.();
      } else {
        const res = await authService.register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
        setAuth(res.data.user, res.data.token);
        toast.success('Account created successfully');
        onSuccess?.();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Authentication failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = async (role) => {
    setLoading(true);
    const email = role === 'admin' ? 'admin@compliance.org' : 'researcher@compliance.org';
    const password = role === 'admin' ? 'AdminPass123!' : 'ResearcherPass123!';
    try {
      const res = await authService.login({ email, password });
      setAuth(res.data.user, res.data.token);
      toast.success(`Signed in as ${role === 'admin' ? 'Admin' : 'Researcher'}`);
      onSuccess?.();
    } catch {
      try {
        const regRes = await authService.register({
          username: role === 'admin' ? 'ComplianceAdmin' : 'ComplianceResearcher',
          email, password, role,
        });
        setAuth(regRes.data.user, regRes.data.token);
        toast.success(`Created & signed in as ${role}`);
        onSuccess?.();
      } catch (regErr) {
        toast.error('Demo login failed: ' + (regErr.response?.data?.message || regErr.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-forge-black bg-texture relative overflow-hidden grain-overlay">
      {/* Ambient */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-forge-accent/[0.03] blur-[140px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        {/* Back */}
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-forge-muted hover:text-white font-sans mb-8 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        )}

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 mx-auto border border-forge-accent/30 rounded flex items-center justify-center mb-4">
            <span className="text-forge-accent font-serif text-2xl">§</span>
          </div>
          <h2 className="font-serif text-3xl tracking-tight text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Join RegTech'}
          </h2>
          <p className="text-xs text-forge-muted font-sans">
            Automated Regulatory Intelligence & Governance
          </p>
        </div>

        {/* Card */}
        <div className="p-8 bg-forge-card border border-white/[0.06] space-y-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`py-3 text-[11px] uppercase tracking-[0.2em] font-sans transition-all border-b-2 ${
                isLogin ? 'border-forge-accent text-white' : 'border-transparent text-forge-muted hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`py-3 text-[11px] uppercase tracking-[0.2em] font-sans transition-all border-b-2 ${
                !isLogin ? 'border-forge-accent text-white' : 'border-transparent text-forge-muted hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-forge-muted font-sans">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-forge-muted/50 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text" name="username" required
                      placeholder="e.g. sarah_compliance"
                      value={formData.username} onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3 bg-forge-black border border-white/[0.08] text-sm text-white placeholder-forge-muted/40 font-sans focus:outline-none focus:border-forge-accent/40 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-forge-muted font-sans">Platform Role</label>
                  <select
                    name="role" value={formData.role} onChange={handleChange}
                    className="w-full px-4 py-3 bg-forge-black border border-white/[0.08] text-sm text-white/80 font-sans focus:outline-none focus:border-forge-accent/40 cursor-pointer"
                  >
                    <option value="researcher">Compliance Researcher</option>
                    <option value="admin">Chief Compliance Officer (Admin)</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-forge-muted font-sans">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-forge-muted/50 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email" name="email" required
                  placeholder="name@organization.com"
                  value={formData.email} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 bg-forge-black border border-white/[0.08] text-sm text-white placeholder-forge-muted/40 font-sans focus:outline-none focus:border-forge-accent/40 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-forge-muted font-sans">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-forge-muted/50 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password" name="password" required
                  placeholder="••••••••••••"
                  value={formData.password} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 bg-forge-black border border-white/[0.08] text-sm text-white placeholder-forge-muted/40 font-sans focus:outline-none focus:border-forge-accent/40 transition-colors"
                />
              </div>
              {!isLogin && (
                <p className="text-[10px] text-forge-muted/50 font-sans">Min 8 characters, 1 uppercase, 1 lowercase, 1 number</p>
              )}
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 border border-forge-accent/40 hover:border-forge-accent text-[11px] uppercase tracking-[0.2em] font-sans text-white transition-all duration-500 hover:bg-forge-accent/10 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In to Platform' : 'Create Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo */}
          <div className="pt-5 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-forge-muted/50 font-sans text-center mb-4">Instant Demo Access</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button" onClick={() => quickDemoLogin('researcher')} disabled={loading}
                className="py-3 text-[10px] uppercase tracking-[0.15em] font-sans text-forge-muted border border-white/[0.06] hover:border-forge-accent/30 hover:text-white transition-all duration-300 disabled:opacity-40"
              >
                Researcher
              </button>
              <button
                type="button" onClick={() => quickDemoLogin('admin')} disabled={loading}
                className="py-3 text-[10px] uppercase tracking-[0.15em] font-sans text-forge-muted border border-white/[0.06] hover:border-forge-accent/30 hover:text-white transition-all duration-300 disabled:opacity-40"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
