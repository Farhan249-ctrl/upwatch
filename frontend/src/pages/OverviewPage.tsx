import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { HeartbeatStrip } from '../components/HeartbeatStrip';
import { MonitorDrawer } from '../components/MonitorDrawer';
import { StatusIndicator } from '../components/StatusIndicator';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Poll overview every 10 seconds while tab is visible
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api.getOverview(range),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  // Ticking counter for "Last check X seconds ago"
  useEffect(() => {
    const interval = setInterval(() => {
      if (dataUpdatedAt) {
        setSecondsAgo(Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const monitors = data?.monitors || [];
  const totalMonitors = monitors.length;

  // Status sentence computation
  const statusSentence = useMemo(() => {
    const counts = data?.counts || { up: 0, down: 0, paused: 0 };
    if (totalMonitors === 0) {
      return { text: 'No monitors configured yet', dotColor: 'var(--color-nodata)' };
    }
    if (counts.down > 0) {
      const text = counts.down === totalMonitors
        ? `All ${totalMonitors} monitors are down`
        : `${counts.down} of ${totalMonitors} monitors ${counts.down === 1 ? 'is' : 'are'} down`;
      return { text, dotColor: 'var(--color-down)' };
    }
    if (counts.paused === totalMonitors) {
      return { text: `All ${totalMonitors} monitors are paused`, dotColor: 'var(--color-muted)' };
    }
    return {
      text: totalMonitors === 1 ? 'Your 1 monitor is up' : `All ${totalMonitors} monitors are up`,
      dotColor: 'var(--color-up)',
    };
  }, [totalMonitors, data?.counts]);

  const handleAddMonitor = async (newMonitorData: Parameters<typeof api.createMonitor>[0]) => {
    await api.createMonitor(newMonitorData);
    await queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Overview Header */}
      <div>
        {/* Status sentence at 40px with a small status dot */}
        <h1
          style={{
            fontSize: 'var(--text-hero)',
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: '-0.8px',
            color: 'var(--color-ink)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '8px',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: statusSentence.dotColor,
              flexShrink: 0,
              transition: 'background-color 0.2s ease',
            }}
          />
          <span>{statusSentence.text}</span>
        </h1>

        {/* Live ticking last check */}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
          Last check <span className="tabular">{secondsAgo}</span> {secondsAgo === 1 ? 'second' : 'seconds'} ago
        </p>
      </div>

      {/* Controls Bar: Range toggle & Add Monitor button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Range Toggle */}
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
              padding: '6px 14px',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              backgroundColor: range === '24h' ? 'var(--color-paper)' : 'transparent',
              color: range === '24h' ? 'var(--color-ink)' : 'var(--color-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            24 hours
          </button>
          <button
            type="button"
            onClick={() => setRange('7d')}
            aria-pressed={range === '7d'}
            style={{
              padding: '6px 14px',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              backgroundColor: range === '7d' ? 'var(--color-paper)' : 'transparent',
              color: range === '7d' ? 'var(--color-ink)' : 'var(--color-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            7 days
          </button>
        </div>

        {/* Add Monitor Button */}
        <button
          type="button"
          onClick={() => setIsAddDrawerOpen(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-accent)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
        >
          Add monitor
        </button>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                height: '64px',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: n < 3 ? '1px solid var(--color-line)' : 'none',
              }}
            >
              <div style={{ width: '160px', height: '18px', backgroundColor: 'var(--color-line)', borderRadius: '4px' }} />
              <div style={{ width: '400px', height: '18px', backgroundColor: 'var(--color-line)', borderRadius: '4px' }} />
              <div style={{ width: '80px', height: '18px', backgroundColor: 'var(--color-line)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div
          role="alert"
          style={{
            padding: '24px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-down)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-down)' }}>
            Failed to load overview data
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
            {error instanceof Error ? error.message : 'A network error occurred while connecting to the UpWatch API.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              alignSelf: 'flex-start',
              padding: '6px 14px',
              backgroundColor: 'var(--color-paper)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && totalMonitors === 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-lg)',
            padding: '64px 32px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-ink)' }}>
            Watch your first site
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', maxWidth: '420px', lineHeight: 1.5 }}>
            UpWatch continuously checks your deployed endpoints, alerts you on outages, and records response time histories.
          </p>
          <button
            type="button"
            onClick={() => setIsAddDrawerOpen(true)}
            style={{
              marginTop: '8px',
              padding: '10px 18px',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add monitor
          </button>
        </div>
      )}

      {/* ONE Bordered List of Monitors */}
      {!isLoading && !isError && totalMonitors > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {monitors.map((m, idx) => (
            <div
              key={m.id}
              tabIndex={0}
              role="button"
              onClick={() => navigate(`/monitors/${m.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate(`/monitors/${m.id}`);
                }
              }}
              className="monitor-row"
              style={{
                height: '64px',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '24px',
                borderBottom: idx < monitors.length - 1 ? '1px solid var(--color-line)' : 'none',
                cursor: 'pointer',
                transition: 'background-color 0.12s ease',
                outline: 'none',
              }}
            >
              {/* Left Column: Status indicator + Monitor Name & URL */}
              <div
                style={{
                  minWidth: '220px',
                  maxWidth: '280px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <StatusIndicator state={m.state} active={m.active} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--color-ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.url.replace(/^https?:\/\//, '')}
                  </div>
                </div>
              </div>

              {/* Middle Column: Heartbeat Strip (60 thin vertical bars) */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <HeartbeatStrip
                  strip={m.strip}
                  range={range}
                  uptimePercent={m.uptimePercent}
                />
              </div>

              {/* Right Column: Uptime percentage & avg response */}
              <div
                style={{
                  minWidth: '140px',
                  textAlign: 'right',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
                  <span className="tabular">
                    {m.uptimePercent !== null ? `${m.uptimePercent.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                  <span className="tabular">
                    {m.avgResponseMs !== null ? `${m.avgResponseMs} ms` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Monitor Drawer */}
      <MonitorDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        onSubmit={handleAddMonitor}
      />

      <style>{`
        .monitor-row:hover,
        .monitor-row:focus-visible {
          background-color: var(--color-paper);
        }
        @media (max-width: 768px) {
          .monitor-row {
            height: auto;
            padding: 16px;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .monitor-row > div:nth-child(2) {
            width: 100%;
          }
          .monitor-row > div:nth-child(3) {
            align-self: flex-start;
            text-align: left;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};
