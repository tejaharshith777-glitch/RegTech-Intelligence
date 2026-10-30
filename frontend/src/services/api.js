import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * Single axios instance.
 *
 * baseURL stays '/api':
 *  - In development Vite proxies /api -> http://localhost:5000
 *  - In production frontend/vercel.json rewrites /api/* -> the Render API
 *
 * Keeping it relative means the browser never makes a cross-origin request,
 * so there is no CORS surface to break at demo time.
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // AI extraction can take a while on a cold Render instance
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token || localStorage.getItem('regtech_jwt');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthAttempt) {
        console.warn('[API] 401 - clearing session');
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

/** Turn any axios failure into a sentence a human can act on. */
export const errorMessage = (err) => {
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please retry.';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Check your connection and retry.';
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join(' ');
  return data?.message || err?.message || 'Something went wrong.';
};

/** Save a blob/download response to disk. */
const saveBlob = (res, fallbackName) => {
  const disposition = res.headers?.['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const name = match?.[1] || fallbackName;

  const blob = new Blob([res.data], { type: res.headers['content-type'] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return name;
};

export const authService = {
  login: async (credentials) => (await api.post('/auth/login', credentials)).data,
  register: async (userData) => (await api.post('/auth/register', userData)).data,
  getMe: async () => (await api.get('/auth/me')).data,
  saveApplicability: async (payload) => (await api.patch('/auth/me/applicability', payload)).data,
  updateRole: async (userId, role) => (await api.patch(`/auth/users/${userId}/role`, { role })).data,
};

export const researchService = {
  uploadDocument: async (file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('document', file);
    const res = await api.post('/research/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return res.data;
  },

  getInsights: async (params = {}) => (await api.get('/research/insights', { params })).data,
  getInsightById: async (id) => (await api.get(`/research/insights/${id}`)).data,

  approveInsight: async (id, status, reason = '') =>
    (await api.put(`/research/insights/${id}/approve`, { humanApprovalStatus: status, reason })).data,

  clarifyInsight: async (id, question) =>
    (await api.post(`/research/insights/${id}/clarify`, { question })).data,

  compareDocuments: async (documentIdA, documentIdB) =>
    (await api.post('/research/compare', { documentIdA, documentIdB })).data,

  verifyAuditChain: async () => (await api.get('/research/audit/verify')).data,

  downloadAuditPack: async (id) => {
    const res = await api.get(`/research/insights/${id}/audit-pack`, { responseType: 'blob' });
    return saveBlob(res, `audit-pack-${id}.md`);
  },

  downloadObligationsCsv: async (id) => {
    const res = await api.get(`/research/insights/${id}/obligations.csv`, { responseType: 'blob' });
    return saveBlob(res, `obligations-${id}.csv`);
  },

  health: async () => (await api.get('/health')).data,
};

export default api;
