import React, { useState, useEffect } from 'react';
import { FileText, LogOut, User, ChevronDown, Plus, Menu, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function Navbar({ onOpenUpload, onGoHome }) {
  const { user, logout, quickSwitchRole } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRoleSwitch = async (e) => {
    const newRole = e.target.value;
    const ok = await quickSwitchRole(newRole);
    if (ok) toast.success(`Switched to ${newRole === 'admin' ? 'Admin' : 'Researcher'}`);
    else toast.error('Role switch failed');
  };

  return (
    <header className={`sticky top-0 z-40 w-full transition-all duration-500 ${
      scrolled ? 'bg-forge-black/95 backdrop-blur-xl border-b border-white/[0.04]' : 'bg-forge-black/80 backdrop-blur-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onGoHome}>
          <div className="w-8 h-8 border border-forge-accent/30 rounded flex items-center justify-center group-hover:border-forge-accent/60 transition-colors">
            <span className="text-forge-accent font-serif text-lg">§</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-serif text-base text-white tracking-wide">RegTech Intelligence</span>
            <div className="text-[9px] uppercase tracking-[0.2em] text-forge-muted/50 font-sans mt-0.5">Gemini 2.5 Flash · Live</div>
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-5">
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-5 py-2.5 border border-forge-accent/30 hover:border-forge-accent/60 text-[10px] uppercase tracking-[0.2em] font-sans text-forge-accent hover:text-white transition-all duration-300 hover:bg-forge-accent/5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>

          {/* User Info */}
          <div className="flex items-center gap-4 pl-5 border-l border-white/[0.06]">
            <div className="text-right">
              <div className="text-xs font-sans text-white/80">{user?.username || 'Analyst'}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-forge-muted/60 font-sans justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                <span className="capitalize">{user?.role || 'researcher'}</span>
              </div>
            </div>

            <select
              value={user?.role || 'researcher'}
              onChange={handleRoleSwitch}
              className="bg-forge-black border border-white/[0.06] text-[10px] uppercase tracking-wider px-2.5 py-1.5 text-forge-muted font-sans focus:outline-none focus:border-forge-accent/30 cursor-pointer"
            >
              <option value="researcher">Researcher</option>
              <option value="admin">Admin</option>
            </select>

            <button
              onClick={() => { logout(); toast.success('Signed out'); }}
              className="p-2 text-forge-muted/50 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-forge-muted">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-forge-dark border-t border-white/[0.04] px-6 py-4 space-y-4 animate-fade-in-down">
          <button onClick={onOpenUpload} className="w-full py-3 border border-forge-accent/30 text-[10px] uppercase tracking-[0.2em] font-sans text-forge-accent">
            Upload Document
          </button>
          <div className="flex items-center justify-between text-xs text-forge-muted">
            <span>{user?.username} ({user?.role})</span>
            <button onClick={() => { logout(); toast.success('Signed out'); }} className="text-forge-muted hover:text-white text-[10px] uppercase tracking-wider">
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
