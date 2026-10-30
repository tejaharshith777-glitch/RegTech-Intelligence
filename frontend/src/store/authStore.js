import { create } from 'zustand';

/**
 * Authentication state.
 *
 * Deliberately has NO "switch role" helper. In an earlier version a dropdown
 * let anyone log themselves in as an administrator from the UI, which made the
 * whole maker-checker story theatre. Roles now come from the server only.
 */
export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('regtech_user') || 'null'),
  token: localStorage.getItem('regtech_jwt') || null,
  isAuthenticated: !!localStorage.getItem('regtech_jwt'),

  setAuth: (user, token) => {
    localStorage.setItem('regtech_jwt', token);
    localStorage.setItem('regtech_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  /** Refresh the cached profile after /auth/me or an applicability save. */
  setUser: (user) => {
    localStorage.setItem('regtech_user', JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('regtech_jwt');
    localStorage.removeItem('regtech_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  isAdmin: () => useAuthStore.getState().user?.role === 'admin',
}));
