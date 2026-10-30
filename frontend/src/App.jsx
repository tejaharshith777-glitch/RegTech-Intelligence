import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import UploadModal from './components/UploadModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  const { isAuthenticated, user } = useAuthStore();
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'app' | 'auth'
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleEnterPlatform = () => {
    if (isAuthenticated) {
      setCurrentView('app');
    } else {
      setCurrentView('auth');
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111111',
            color: '#f5f0e8',
            border: '1px solid rgba(200, 169, 126, 0.25)',
            fontSize: '11px',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.05em',
            borderRadius: '4px',
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.8)',
          },
          success: {
            iconTheme: {
              primary: '#c8a97e',
              secondary: '#111111',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#111111',
            },
          },
        }}
      />

      {currentView === 'landing' && (
        <LandingPage
          onEnterApp={handleEnterPlatform}
          isAuthenticated={isAuthenticated}
          user={user}
        />
      )}

      {currentView === 'auth' && (
        <AuthPage
          onBack={() => setCurrentView('landing')}
          onSuccess={() => setCurrentView('app')}
        />
      )}

      {currentView === 'app' && (
        <div className="min-h-screen bg-forge-black text-white flex flex-col font-sans selection:bg-forge-accent/20 selection:text-white">
          <Navbar
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onGoHome={() => setCurrentView('landing')}
          />
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
            <Dashboard />
          </main>

          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['insights'] })}
          />

          <footer className="border-t border-white/[0.04] bg-forge-black py-8 px-8 text-center">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-[0.2em] text-forge-muted/60 font-sans">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-forge-accent" />
                <span>Apex Regulatory Intelligence Terminal</span>
              </div>
              <div>Zero-Disk Extraction · Gemini 2.5 Flash · SHA-256 Provenance Ledger</div>
              <button
                onClick={() => setCurrentView('landing')}
                className="hover:text-forge-accent transition-colors underline decoration-forge-accent/30 underline-offset-4"
              >
                Back to Brand Overview
              </button>
            </div>
          </footer>
        </div>
      )}
    </QueryClientProvider>
  );
}
