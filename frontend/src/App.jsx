import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { authService } from './services/api';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import UploadModal from './components/UploadModal';
import ApplicabilityGate from './components/ApplicabilityGate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15000,
    },
  },
});

export default function App() {
  const { isAuthenticated, user, setUser, logout } = useAuthStore();
  const [view, setView] = useState('landing'); // 'landing' | 'auth' | 'app'
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [scopeSkipped, setScopeSkipped] = useState(false);
  const [booting, setBooting] = useState(false);

  /**
   * Refresh the profile on boot. The cached role could be stale: an
   * administrator may have promoted or demoted this account since the token
   * was issued. The server is always the source of truth.
   */
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('regtech_jwt');
    if (!token) return;

    setBooting(true);
    authService
      .getMe()
      .then((res) => {
        if (!cancelled && res?.data?.user) setUser(res.data.user);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterPlatform = () => setView(isAuthenticated ? 'app' : 'auth');

  const needsScope =
    isAuthenticated && !scopeSkipped && !user?.applicability?.completedAt;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['insights'] });
    queryClient.invalidateQueries({ queryKey: ['auditChain'] });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#12151f',
            color: '#eef1f8',
            border: '1px solid #252a3a',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            borderRadius: '6px',
            maxWidth: '420px',
          },
          success: { iconTheme: { primary: '#4ade9c', secondary: '#12151f' } },
          error: { iconTheme: { primary: '#ff7a90', secondary: '#12151f' } },
        }}
      />

      {view === 'landing' && (
        <LandingPage onEnterApp={enterPlatform} isAuthenticated={isAuthenticated} user={user} />
      )}

      {view === 'auth' && (
        <AuthPage onBack={() => setView('landing')} onSuccess={() => setView('app')} />
      )}

      {view === 'app' && !isAuthenticated && (
        <AuthPage onBack={() => setView('landing')} onSuccess={() => setView('app')} />
      )}

      {view === 'app' && isAuthenticated && needsScope && (
        <ApplicabilityGate
          onDone={() => setScopeSkipped(true)}
          onSkip={() => setScopeSkipped(true)}
        />
      )}

      {view === 'app' && isAuthenticated && !needsScope && (
        <div className="min-h-screen bg-forge-black text-forge-text flex flex-col font-sans">
          <Navbar
            onOpenUpload={() => setIsUploadOpen(true)}
            onGoHome={() => setView('landing')}
            booting={booting}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto px-5 md:px-8 py-8 md:py-10">
            <Dashboard onOpenUpload={() => setIsUploadOpen(true)} />
          </main>

          <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onSuccess={invalidateAll} />

          <footer className="border-t border-forge-border bg-forge-dark/60 mt-10">
            <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-2xs text-forge-dim">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint" />
                <span className="uppercase tracking-[0.18em]">RegTech Intelligence · Evidence ledger</span>
              </div>
              <div className="text-center sm:text-right">
                Synthetic test corpus modelled on FINRA / SEC / GDPR / HIPAA / Basel III / FinCEN formats.
                A demonstration product, not legal advice.
              </div>
              <button
                onClick={() => setView('landing')}
                className="hover:text-forge-gold transition-colors underline underline-offset-4 decoration-forge-accent/40"
              >
                Back to overview
              </button>
            </div>
          </footer>
        </div>
      )}
    </QueryClientProvider>
  );
}
