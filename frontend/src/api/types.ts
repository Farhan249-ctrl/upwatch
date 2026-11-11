export type MonitorState = 'UNKNOWN' | 'UP' | 'DOWN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  telegramChatId: string | null;
  alertsEnabled: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface StripBucket {
  ts: string;
  status: 'up' | 'degraded' | 'down' | 'nodata';
  avgResponseMs: number | null;
  okCount: number;
  failCount: number;
}

export interface OpenIncident {
  id: string;
  startedAt: string;
  durationSeconds: number;
  reason: string;
}

export interface OverviewMonitor {
  id: string;
  name: string;
  url: string;
  state: MonitorState;
  active: boolean;
  uptimePercent: number | null;
  avgResponseMs: number | null;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  openIncident: OpenIncident | null;
  strip: StripBucket[];
}

export interface OverviewResponse {
  counts: {
    up: number;
    down: number;
    paused: number;
  };
  monitors: OverviewMonitor[];
}

export interface Monitor {
  _id: string;
  id?: string;
  userId: string;
  name: string;
  url: string;
  intervalSeconds: 15 | 30 | 60 | 300;
  timeoutMs: number;
  expectedStatus: number[];
  allowSelfSigned: boolean;
  active: boolean;
  state: MonitorState;
  consecutiveFailures: number;
  firstFailureAt: string | null;
  lastCheckedAt: string | null;
  nextCheckAt: string;
  createdAt: string;
}

export interface MonitorStats {
  uptimePercent: number | null;
  avgResponseMs: number | null;
  maxResponseMs: number | null;
  totalChecks: number;
  failedChecks: number;
}

export interface SeriesBucket {
  bucket: string;
  okCount: number;
  failCount: number;
  avgResponseMs: number | null;
}

export interface Incident {
  id: string;
  monitorId: string;
  monitorName?: string;
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  reason: string;
  createdAt?: string;
}

export interface CheckItem {
  _id: string;
  monitorId: string;
  ts: string;
  ok: boolean;
  statusCode: number | null;
  responseMs: number;
  error: string | null;
}
