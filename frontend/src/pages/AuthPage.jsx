import React, { useState } from 'react';
import { Shield, Lock, Mail, User, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { authService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function AuthPage() {
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
        toast.success(`Welcome back, ${res.data.user.username}!`);
      } else {
        const res = await authService.register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
        setAuth(res.data.user, res.data.token);
        toast.success('Registration successful!');
      }
    } catch (err) {
      console.error('Auth error:', err);
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
      toast.success(`Logged in as ${role === 'admin' ? 'Compliance Admin' : 'Compliance Researcher'}`);
    } catch (err) {
      // If user not registered yet, register on the fly
      try {
        const regRes = await authService.register({
          username: role === 'admin' ? 'ComplianceAdmin' : 'ComplianceResearcher',
          email,
          password,
          role,
        });
        setAuth(regRes.data.user, regRes.data.token);
        toast.success(`Registered & logged in as ${role}`);
      } catch (regErr) {
        toast.error('Quick demo login failed: ' + (regErr.response?.data?.message || regErr.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#070b14] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center mx-auto text-white font-extrabold text-2xl shadow-xl shadow-blue-500/20">
            §
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">RegTech Intelligence</h2>
          <p className="text-xs text-slate-400">
            Automated Regulatory Auditing, PII Sanitization & Human Approval
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-8 rounded-2xl bg-[#0c1322] border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-900/80 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                !isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      name="username"
                      required
                      placeholder="e.g. sarah_compliance"
                      value={formData.username}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Platform Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="researcher">Compliance Researcher</option>
                    <option value="admin">Chief Compliance Officer (Admin)</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@organization.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              {!isLogin && (
                <div className="text-[10px] text-slate-500">Min 8 characters, 1 uppercase, 1 lowercase, 1 number</div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In to Workspace' : 'Create Researcher Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-4 border-t border-white/10 space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant One-Click Demo Access</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickDemoLogin('researcher')}
                disabled={loading}
                className="py-2 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-slate-300 text-[11px] font-medium transition-all"
              >
                Sign In as Researcher
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin('admin')}
                disabled={loading}
                className="py-2 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-slate-300 text-[11px] font-medium transition-all"
              >
                Sign In as Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
