import {
  AuthResponse,
  CheckItem,
  Incident,
  Monitor,
  MonitorStats,
  OverviewResponse,
  SeriesBucket,
  User,
} from './types';

const TOKEN_KEY = 'upwatch_token';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Turn 401 into logout and redirect
    setStoredToken(null);
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }
    const errData = await response.json().catch(() => ({ error: 'Unauthorized' }));
    throw new Error(errData.error || 'Authentication session expired');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  register: (data: { name: string; email: string; password: string }) =>
    apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => apiRequest<{ user: User }>('/api/auth/me'),

  updateAlerts: (data: { telegramChatId?: string | null; alertsEnabled?: boolean }) =>
    apiRequest<{ user: User }>('/api/auth/me/alerts', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  sendTestAlert: () =>
    apiRequest<{ message: string }>('/api/alerts/test', {
      method: 'POST',
    }),

  // Overview
  getOverview: (range: '24h' | '7d') =>
    apiRequest<OverviewResponse>(`/api/overview?range=${range}`),

  // Monitors
  getMonitors: () => apiRequest<Monitor[]>('/api/monitors'),

  getMonitor: (id: string) => apiRequest<Monitor>(`/api/monitors/${id}`),

  createMonitor: (data: Partial<Monitor>) =>
    apiRequest<Monitor>('/api/monitors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMonitor: (id: string, data: Partial<Monitor>) =>
    apiRequest<Monitor>(`/api/monitors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteMonitor: (id: string) =>
    apiRequest<{ message: string }>(`/api/monitors/${id}`, {
      method: 'DELETE',
    }),

  getStats: (id: string, range: '24h' | '7d') =>
    apiRequest<MonitorStats>(`/api/monitors/${id}/stats?range=${range}`),

  getSeries: (id: string, range: '24h' | '7d') =>
    apiRequest<SeriesBucket[]>(`/api/monitors/${id}/series?range=${range}`),

  getChecks: (id: string, limit = 50) =>
    apiRequest<CheckItem[]>(`/api/monitors/${id}/checks?limit=${limit}`),

  // Incidents
  getMonitorIncidents: (id: string) =>
    apiRequest<Incident[]>(`/api/monitors/${id}/incidents`),

  getIncidents: (status: 'open' | 'all' = 'all') =>
    apiRequest<Incident[]>(`/api/incidents?status=${status}`),
};
