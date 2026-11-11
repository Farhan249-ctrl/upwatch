import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

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

export const IncidentsPage: React.FC = () => {
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', filter],
    queryFn: () => api.getIncidents(filter),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--text-hero)',
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: '-0.8px',
              color: 'var(--color-ink)',
              margin: '0 0 6px 0',
            }}
          >
            Incidents
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', margin: 0 }}>
            Track service disruptions across all your monitors.
          </p>
        </div>

        {/* Filter toggle: Open | All */}
        <div
          role="group"
          aria-label="Filter incidents"
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
            onClick={() => setFilter('open')}
            aria-pressed={filter === 'open'}
            style={{
              padding: '6px 14px',
              fontSize: 'var(--text-sm)',
              fontWeight: filter === 'open' ? 600 : 400,
              backgroundColor: filter === 'open' ? 'var(--color-paper)' : 'transparent',
              color: 'var(--color-ink)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
            style={{
              padding: '6px 14px',
              fontSize: 'var(--text-sm)',
              fontWeight: filter === 'all' ? 600 : 400,
              backgroundColor: filter === 'all' ? 'var(--color-paper)' : 'transparent',
              color: 'var(--color-ink)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            All
          </button>
        </div>
      </div>

      {/* Incidents List Container */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ height: '48px', backgroundColor: 'var(--color-line)', borderRadius: 'var(--radius-sm)' }} />
            <div style={{ height: '48px', backgroundColor: 'var(--color-line)', borderRadius: 'var(--radius-sm)' }} />
            <div style={{ height: '48px', backgroundColor: 'var(--color-line)', borderRadius: 'var(--radius-sm)' }} />
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(20, 138, 91, 0.1)',
                color: 'var(--color-up)',
                fontSize: '20px',
                marginBottom: '12px',
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--color-ink)' }}>
              {filter === 'open' ? 'No open incidents' : 'No incidents recorded'}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', margin: 0 }}>
              {filter === 'open' ? 'All active monitors are running normally.' : 'Your monitors have maintained 100% uptime.'}
            </p>
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
                  <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-muted)' }}>Monitor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-muted)' }}>Started</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-muted)' }}>Resolved</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-muted)' }}>Duration</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-muted)' }}>Reason</th>
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
                        height: '56px',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        <Link
                          to={`/monitors/${inc.monitorId}`}
                          style={{
                            color: 'var(--color-accent)',
                            textDecoration: 'none',
                          }}
                        >
                          {inc.monitorName || 'Monitor'}
                        </Link>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-ink)' }}>
                        <span className="tabular">{formatDateTime(inc.startedAt)}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: isOngoing ? 'var(--color-down)' : 'var(--color-ink)' }}>
                        {isOngoing ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-down)',
                              }}
                            />
                            Ongoing
                          </span>
                        ) : (
                          <span className="tabular">{formatDateTime(inc.resolvedAt)}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-ink)' }}>
                        <span className="tabular">
                          {formatDuration(inc.durationSeconds)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-muted)' }}>
                        {inc.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
