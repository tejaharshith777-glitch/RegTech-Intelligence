import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import AuthPage from './pages/AuthPage';
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
  const { isAuthenticated } = useAuthStore();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0e1626',
            color: '#f3f4f6',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '12px',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#0e1626',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#0e1626',
            },
          },
        }}
      />

      {!isAuthenticated ? (
        <AuthPage />
      ) : (
        <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
          <Navbar onOpenUpload={() => setIsUploadModalOpen(true)} />
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
            <Dashboard />
          </main>

          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['insights'] })}
          />

          <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-slate-500">
            RegTech Automated Compliance Platform · Integrated with Gemini 2.5 Flash & AI Guardrail Architecture
          </footer>
        </div>
      )}
    </QueryClientProvider>
  );
}
