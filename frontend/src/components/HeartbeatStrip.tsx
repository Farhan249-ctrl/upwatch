import React, { useState } from 'react';
import { StripBucket } from '../api/types';

interface HeartbeatStripProps {
  strip: StripBucket[];
  range: '24h' | '7d';
  uptimePercent: number | null;
}

export const HeartbeatStrip: React.FC<HeartbeatStripProps> = ({
  strip,
  range,
  uptimePercent,
}) => {
  const [activeBucket, setActiveBucket] = useState<{
    bucket: StripBucket;
    x: number;
    y: number;
  } | null>(null);

  // Compute summary for aria-label
  const outages = strip.filter(b => b.status === 'down').length;
  const rangeLabel = range === '7d' ? 'Last 7 days' : 'Last 24 hours';
  const uptimeLabel = uptimePercent !== null ? `${uptimePercent}% up` : 'No checks';
  const outagesLabel = outages === 1 ? '1 outage' : `${outages} outages`;
  const ariaLabel = `${rangeLabel}: ${uptimeLabel}, ${outagesLabel}`;

  const getColor = (status: StripBucket['status']) => {
    switch (status) {
      case 'up':
        return 'var(--color-up)';
      case 'degraded':
        return 'var(--color-degraded)';
      case 'down':
        return 'var(--color-down)';
      case 'nodata':
      default:
        return 'var(--color-nodata)';
    }
  };

  const formatBucketTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusText = (b: StripBucket) => {
    if (b.status === 'down') {
      return `Down (${b.failCount} failed)`;
    }
    if (b.status === 'degraded') {
      return `Degraded (${b.avgResponseMs} ms)`;
    }
    if (b.status === 'up') {
      return `Up (${b.okCount} checks)`;
    }
    return 'No data recorded';
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        maxWidth: '480px',
        height: '32px',
      }}
    >
      <div
        role="img"
        aria-label={ariaLabel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          width: '100%',
          height: '24px',
        }}
      >
        {strip.map((bucket, idx) => {
          // Staggered draw-in animation delay (< 600ms total)
          const animDelay = `${(idx / 60) * 0.45}s`;

          return (
            <div
              key={bucket.ts || idx}
              tabIndex={0}
              role="button"
              aria-label={`${formatBucketTime(bucket.ts)}: ${getStatusText(bucket)}`}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveBucket({
                  bucket,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }}
              onMouseLeave={() => setActiveBucket(null)}
              onFocus={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveBucket({
                  bucket,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }}
              onBlur={() => setActiveBucket(null)}
              className="bucket-bar"
              style={{
                flex: 1,
                minWidth: '3px',
                height: '100%',
                backgroundColor: getColor(bucket.status),
                borderRadius: '1.5px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, background-color 0.2s ease',
                animation: 'drawIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: animDelay,
                outline: 'none',
              }}
            />
          );
        })}
      </div>

      {/* Polish Tooltip */}
      {activeBucket && (
        <div
          style={{
            position: 'fixed',
            left: `${activeBucket.x}px`,
            top: `${activeBucket.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--color-surface)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
            pointerEvents: 'none',
            zIndex: 1000,
            fontSize: 'var(--text-xs)',
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ color: 'var(--color-muted)', fontWeight: 500 }}>
            {formatBucketTime(activeBucket.bucket.ts)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: getColor(activeBucket.bucket.status),
              }}
            />
            <span style={{ fontWeight: 600 }}>{getStatusText(activeBucket.bucket)}</span>
          </div>
          {activeBucket.bucket.avgResponseMs !== null && (
            <div style={{ color: 'var(--color-muted)' }}>
              Avg response: <span className="tabular" style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{activeBucket.bucket.avgResponseMs} ms</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes drawIn {
          from {
            opacity: 0;
            transform: scaleY(0.2);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }
        .bucket-bar:hover,
        .bucket-bar:focus-visible {
          transform: scaleY(1.25);
          z-index: 2;
        }
        .bucket-bar:focus-visible {
          box-shadow: 0 0 0 2px var(--color-accent);
        }
      `}</style>
    </div>
  );
};
