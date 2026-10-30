import React, { useEffect, useState } from 'react';
import { LogOut, Plus, Menu, X, ShieldCheck, Home, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

/**
 * Top bar for the signed-in app.
 *
 * There used to be a <select> here that switched the signed-in user between
 * "Researcher" and "Admin" by logging into a different hardcoded account. That
 * made a server-enforced governance model look optional, so it is gone. The
 * role below is read-only: it comes from the server.
 */
export default function Navbar({ onOpenUpload, onGoHome, booting }) {
  const { user, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-forge-black/92 backdrop-blur-xl border-b border-forge-border'
          : 'bg-forge-black/70 backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <button onClick={onGoHome} className="flex items-center gap-3 group shrink-0">
          <span className="w-9 h-9 rounded border border-forge-accent/40 flex items-center justify-center group-hover:border-forge-accent transition-colors">
            <span className="text-forge-accent font-serif text-lg">§</span>
          </span>
          <span className="hidden sm:block text-left">
            <span className="block font-serif text-base text-forge-cream leading-tight">RegTech Intelligence</span>
            <span className="block text-3xs uppercase tracking-[0.18em] text-forge-dim">Evidence ledger</span>
          </span>
        </button>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={onOpenUpload} className="btn-primary !py-2.5 !px-5 !text-2xs">
            <Plus className="w-3.5 h-3.5" />
            Upload circular
          </button>

          <div className="w-px h-8 bg-forge-border mx-1" style={{ backgroundColor: '#252a3a' }} />

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-forge-text leading-tight flex items-center justify-end gap-1.5">
                {booting && <Loader2 className="w-3 h-3 animate-spin text-forge-dim" />}
                {user?.username || 'Analyst'}
              </div>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-forge-accent' : 'bg-sky'}`} />
                <span className="text-3xs uppercase tracking-[0.16em] text-forge-dim">
                  {isAdmin ? 'Administrator' : 'Researcher'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                toast.success('Signed out');
              }}
              className="p-2.5 rounded border border-forge-border text-forge-dim hover:text-coral hover:border-coral/40 transition-colors"
              style={{ borderColor: '#252a3a' }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden p-2 text-forge-muted"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-forge-border bg-forge-dark px-5 py-4 space-y-3">
          <button
            onClick={() => {
              setMobileOpen(false);
              onOpenUpload();
            }}
            className="btn-primary w-full !py-3"
          >
            <Plus className="w-4 h-4" /> Upload circular
          </button>

          <button
            onClick={() => {
              setMobileOpen(false);
              onGoHome();
            }}
            className="btn-ghost w-full !py-3"
          >
            <Home className="w-4 h-4" /> Overview
          </button>

          <div className="flex items-center justify-between pt-3 border-t border-forge-border">
            <div>
              <div className="text-sm text-forge-text">{user?.username}</div>
              <div className="text-3xs uppercase tracking-[0.16em] text-forge-dim flex items-center gap-1.5 mt-1">
                <ShieldCheck className="w-3 h-3" />
                {isAdmin ? 'Administrator' : 'Researcher'}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                toast.success('Signed out');
              }}
              className="text-2xs uppercase tracking-[0.14em] text-forge-dim hover:text-coral transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
