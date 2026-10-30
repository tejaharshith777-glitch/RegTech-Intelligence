import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('regtech_user') || 'null'),
  token: localStorage.getItem('regtech_jwt') || null,
  isAuthenticated: !!localStorage.getItem('regtech_jwt'),

  setAuth: (user, token) => {
    localStorage.setItem('regtech_jwt', token);
    localStorage.setItem('regtech_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('regtech_jwt');
    localStorage.removeItem('regtech_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  // Helper for fast developer switching between Admin and Researcher demo roles
  quickSwitchRole: async (role) => {
    try {
      const email = role === 'admin' ? 'admin@compliance.org' : 'researcher@compliance.org';
      const password = role === 'admin' ? 'AdminPass123!' : 'ResearcherPass123!';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success && data.data?.token) {
        get().setAuth(data.data.user, data.data.token);
        return true;
      }
    } catch (e) {
      console.error('Role switch failed:', e);
    }
    return false;
  },
}));
