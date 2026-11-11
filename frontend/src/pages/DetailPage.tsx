import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Monitor } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MonitorDrawer } from '../components/MonitorDrawer';
import { ResponseTimeChart } from '../components/ResponseTimeChart';
import { StatusIndicator } from '../components/StatusIndicator';

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const mins = Math.floor(seconds / 60);
  const remainingSecs = Math.round(seconds % 60);
  if (mins < 60) {
    return remainingSecs > 0 ? `${mins} min ${remainingSecs} s` : `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours < 24) {
    return remainingMins > 0 ? `${hours} hr ${remainingMins} min` : `${hours} hr`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} d ${remHours} hr` : `${days} d`;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

export const DetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  // Poll queries every 10 seconds while tab is visible
  const {
    data: monitor,
    isLoading: isMonitorLoading,
    isError: isMonitorError,
  } = useQuery({
    queryKey: ['monitor', id],
    queryFn: () => (id ? api.getMonitor(id) : Promise.reject('No ID')),
    enabled: Boolean(id),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', id, range],
    queryFn: () => (id ? api.getStats(id, range) : Promise.reject('No ID')),
    enabled: Boolean(id),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const { data: series = [] } = useQuery({
    queryKey: ['series', id, range],
    queryFn: () => (id ? api.getSeries(id, range) : Promise.reject('No ID')),
    enabled: Boolean(id),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['monitorIncidents', id],
    queryFn: () => (id ? api.getMonitorIncidents(id) : Promise.reject('No ID')),
    enabled: Boolean(id),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ['checks', id],
    queryFn: () => (id ? api.getChecks(id, 50) : Promise.reject('No ID')),
    enabled: Boolean(id),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  // Since time computation
  const sinceText = useMemo(() => {
    if (!monitor) return '';
    if (!monitor.active) return 'Paused';
    if (monitor.state === 'DOWN' && monitor.firstFailureAt) {
      return `Down since ${formatDateTime(monitor.firstFailureAt)}`;
    }
    if (monitor.state === 'UP' && monitor.lastCheckedAt) {
      return `Up since ${formatDateTime(monitor.lastCheckedAt)}`;
    }
    return monitor.state;
  }, [monitor]);

  const handleTogglePause = async () => {
    if (!id || !monitor || isTogglingPause) return;
    setIsTogglingPause(true);
    try {
      await api.updateMonitor(id, { active: !monitor.active });
      await queryClient.invalidateQueries({ queryKey: ['monitor', id] });
      await queryClient.invalidateQueries({ queryKey: ['overview'] });
    } finally {
      setIsTogglingPause(false);
    }
  };

  const handleEdit = async (data: Partial<Monitor>) => {
    if (!id) return;
    await api.updateMonitor(id, data);
    await queryClient.invalidateQueries({ queryKey: ['monitor', id] });
    await queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const handleDelete = async () => {
    if (!id || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.deleteMonitor(id);
      await queryClient.invalidateQueries({ queryKey: ['overview'] });
      navigate('/');
    } catch {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isMonitorLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ height: '36px', width: '240px', backgroundColor: 'var(--color-line)', borderRadius: 'var(--radius-sm)' }} />
        <div style={{ height: '100px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }} />
        <div style={{ height: '300px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  if (isMonitorError || !monitor) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '8px' }}>Monitor not found</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: '20px' }}>
          This monitor may have been removed or does not belong to you.
        </p>
        <Link to="/" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
          ← Back to overview
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Back button */}
      <div>
        <Link
          to="/"
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-muted)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '12px',
          }}
        >
          ← Overview
        </Link>
      </div>

      {/* Header: Name, URL as a link, state pill with text and since time, action buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              {monitor.name}
            </h1>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-line)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
              }}
            >
              <StatusIndicator state={monitor.state} active={monitor.active} />
              {sinceText && (
                <span style={{ marginLeft: '6px', color: 'var(--color-muted)' }}>
                  ({sinceText})
                </span>
              )}
            </div>
          </div>

          <a
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-muted)',
              textDecoration: 'none',
              wordBreak: 'break-all',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{monitor.url}</span>
            <span aria-hidden="true" style={{ fontSize: '12px' }}>↗</span>
          </a>
        </div>

        {/* Action Buttons: Pause/Resume, Edit, Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleTogglePause}
            disabled={isTogglingPause}
            style={{
              padding: '7px 14px',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            {monitor.active ? 'Pause checks' : 'Resume checks'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditDrawerOpen(true)}
            style={{
              padding: '7px 14px',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            style={{
              padding: '7px 14px',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-down)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Range toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div
          role="group"
          aria-label="Time range"
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
        >
          <button
            type="button"
            onClick={() => setRange('24h')}
            aria-pressed={range === '24h'}
            style={{
              padding: '4px 12px',
              fontSize: 'var(--text-sm)',
              fontWeight: range === '24h' ? 600 : 400,
              backgroundColor: range === '24h' ? 'var(--color-paper)' : 'transparent',
              color: 'var(--color-ink)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            24 hours
          </button>
          <button
            type="button"
            onClick={() => setRange('7d')}
            aria-pressed={range === '7d'}
            style={{
              padding: '4px 12px',
              fontSize: 'var(--text-sm)',
              fontWeight: range === '7d' ? 600 : 400,
              backgroundColor: range === '7d' ? 'var(--color-paper)' : 'transparent',
              color: 'var(--color-ink)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            7 days
          </button>
        </div>
      </div>

      {/* Row of figures separated by thin dividers: Uptime, Average response, Slowest response, Checks run */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px', borderRight: '1px solid var(--color-line)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Uptime
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-ink)' }}>
            <span className="tabular">
              {stats?.uptimePercent != null ? `${stats.uptimePercent.toFixed(2)}%` : '—'}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 24px', borderRight: '1px solid var(--color-line)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Average response
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-ink)' }}>
            <span className="tabular">
              {stats?.avgResponseMs != null ? `${Math.round(stats.avgResponseMs)} ms` : '—'}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 24px', borderRight: '1px solid var(--color-line)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Slowest response
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-ink)' }}>
            <span className="tabular">
              {stats?.maxResponseMs != null ? `${Math.round(stats.maxResponseMs)} ms` : '—'}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Checks run
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-ink)' }}>
            <span className="tabular">
              {stats?.totalChecks != null ? stats.totalChecks.toLocaleString() : '0'}
            </span>
          </div>
        </div>
      </div>

      {/* Response time chart for chosen range */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: 0, color: 'var(--color-ink)' }}>
            Response time
          </h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            {range === '24h' ? '5-minute buckets' : '1-hour buckets'}
          </span>
        </div>
        <ResponseTimeChart series={series} incidents={incidents} range={range} />
      </div>

      {/* Two sections: Incidents & Recent checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Incident list */}
        <section
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 16px 0',
            }}
          >
            Incidents
          </h2>

          {incidents.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', padding: '16px 0' }}>
              No incidents recorded for this monitor.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Started</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Resolved</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Duration</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => {
                    const isOngoing = !inc.resolvedAt;
                    return (
                      <tr
                        key={inc.id}
                        style={{
                          borderBottom: '1px solid var(--color-line)',
                          height: '48px',
                        }}
                      >
                        <td style={{ padding: '8px 12px', color: 'var(--color-ink)' }}>
                          <span className="tabular">{formatDateTime(inc.startedAt)}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: isOngoing ? 'var(--color-down)' : 'var(--color-ink)' }}>
                          {isOngoing ? (
                            <span style={{ fontWeight: 600 }}>Ongoing</span>
                          ) : (
                            <span className="tabular">{formatDateTime(inc.resolvedAt)}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-ink)' }}>
                          <span className="tabular">
                            {formatDuration(inc.durationSeconds)}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-muted)' }}>
                          {inc.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent checks */}
        <section
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 16px 0',
            }}
          >
            Recent checks
          </h2>

          {checks.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', padding: '16px 0' }}>
              No checks recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Time</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Status</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>HTTP code</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Response time</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-muted)' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((check) => (
                    <tr
                      key={check._id}
                      style={{
                        borderBottom: '1px solid var(--color-line)',
                        height: '44px',
                      }}
                    >
                      <td style={{ padding: '8px 12px', color: 'var(--color-muted)' }}>
                        <span className="tabular">{formatDateTime(check.ts)}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <StatusIndicator state={check.ok ? 'UP' : 'DOWN'} />
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-ink)' }}>
                        <span className="tabular">{check.statusCode ?? '—'}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-ink)' }}>
                        <span className="tabular">{check.responseMs} ms</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-down)' }}>
                        {check.error || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Edit Drawer */}
      <MonitorDrawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        onSubmit={handleEdit}
        initialData={monitor}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete monitor"
        message={`Are you sure you want to delete "${monitor.name}"? All check history and incidents will be permanently removed.`}
        confirmLabel="Delete monitor"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
        isConfirming={isDeleting}
      />
    </div>
  );
};
