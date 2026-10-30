import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Base Axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s for AI file processing
});

// Request Interceptor: Attach JWT token from Zustand store or localStorage
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token || localStorage.getItem('regtech_jwt');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config;
      // Do not logout if it's the login/register attempt itself
      if (!originalRequest.url.includes('/auth/login') && !originalRequest.url.includes('/auth/register')) {
        console.warn('[API] 401 Unauthorized - clearing token and resetting session');
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

// Auth Endpoints
export const authService = {
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// Research Endpoints
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
  getInsights: async (params = {}) => {
    const res = await api.get('/research/insights', { params });
    return res.data;
  },
  getInsightById: async (id) => {
    const res = await api.get(`/research/insights/${id}`);
    return res.data;
  },
  approveInsight: async (id, status, reason = '') => {
    const res = await api.put(`/research/insights/${id}/approve`, {
      humanApprovalStatus: status,
      reason,
    });
    return res.data;
  },
  compareDocuments: async (documentIdA, documentIdB) => {
    const res = await api.post('/research/compare', {
      documentIdA,
      documentIdB,
    });
    return res.data;
  },
  verifyAuditChain: async () => {
    const res = await api.get('/research/audit/verify');
    return res.data;
  },
};

export default api;
