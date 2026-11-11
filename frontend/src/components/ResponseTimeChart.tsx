import React, { useId, useMemo, useState } from 'react';
import { Incident, SeriesBucket } from '../api/types';

interface ResponseTimeChartProps {
  series: SeriesBucket[];
  incidents: Incident[];
  range: '24h' | '7d';
}

export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  series,
  incidents,
  range,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    bucket: SeriesBucket;
    x: number;
    y: number;
  } | null>(null);

  const filterId = useId();

  const width = 1000;
  const height = 300;
  const padding = { top: 20, right: 24, bottom: 45, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Local';
    }
  }, []);

  const now = useMemo(() => Date.now(), []);
  const durationMs = range === '7d' ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
  const startTime = now - durationMs;

  // Filter series to valid points
  const points = useMemo(() => {
    return series
      .map((s) => ({
        ...s,
        timeMs: new Date(s.bucket).getTime(),
      }))
      .filter((s) => s.timeMs >= startTime && s.avgResponseMs !== null)
      .sort((a, b) => a.timeMs - b.timeMs);
  }, [series, startTime]);

  // Determine Y scale
  const maxMs = useMemo(() => {
    const rawMax = Math.max(...points.map((p) => p.avgResponseMs || 0), 100);
    // Round up to nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    return Math.ceil(rawMax / magnitude) * magnitude;
  }, [points]);

  const scaleX = React.useCallback(
    (timeMs: number) => {
      const clamped = Math.max(startTime, Math.min(now, timeMs));
      return padding.left + ((clamped - startTime) / durationMs) * plotWidth;
    },
    [startTime, now, durationMs, padding.left, plotWidth]
  );

  const scaleY = React.useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(maxMs, ms));
      return padding.top + plotHeight - (clamped / maxMs) * plotHeight;
    },
    [maxMs, padding.top, plotHeight]
  );

  // Build SVG path
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, idx) => {
        const x = scaleX(p.timeMs);
        const y = scaleY(p.avgResponseMs || 0);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [points, scaleX, scaleY]);

  const areaD = useMemo(() => {
    if (points.length === 0 || !pathD) return '';
    const firstX = scaleX(points[0].timeMs);
    const lastX = scaleX(points[points.length - 1].timeMs);
    const bottomY = padding.top + plotHeight;
    return `${pathD} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [pathD, points, scaleX, padding.top, plotHeight]);

  // Overlapping incidents
  const overlappingIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const s = new Date(inc.startedAt).getTime();
      const e = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : now;
      return e >= startTime && s <= now;
    });
  }, [incidents, startTime, now]);

  const formatLocalTime = (ms: number) => {
    const d = new Date(ms);
    return range === '7d'
      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })
      : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '8px',
        }}
      >
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
          Response time ({range === '7d' ? '7 days' : '24 hours'})
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
          Time zone: <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{timeZone}</span>
        </div>
      </div>

      <div style={{ width: '100%', height: 'auto', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseMove={(e) => {
            const svgRect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - svgRect.left) / svgRect.width) * width;
            if (mouseX < padding.left || mouseX > width - padding.right || points.length === 0) {
              setHoveredPoint(null);
              return;
            }

            // Find closest data point
            let closest = points[0];
            let minDist = Infinity;
            for (const p of points) {
              const dist = Math.abs(scaleX(p.timeMs) - mouseX);
              if (dist < minDist) {
                minDist = dist;
                closest = p;
              }
            }

            setHoveredPoint({
              bucket: closest,
              x: scaleX(closest.timeMs),
              y: scaleY(closest.avgResponseMs || 0),
            });
          }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id={`chart-fill-${filterId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Incident Red Bands */}
          {overlappingIncidents.map((inc) => {
            const s = new Date(inc.startedAt).getTime();
            const e = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : now;
            const x1 = scaleX(s);
            const x2 = scaleX(e);
            const bandWidth = Math.max(3, x2 - x1);

            return (
              <g key={inc.id}>
                <rect
                  x={x1}
                  y={padding.top}
                  width={bandWidth}
                  height={plotHeight}
                  fill="var(--color-down)"
                  opacity={0.12}
                />
                <line
                  x1={x1}
                  y1={padding.top}
                  x2={x1}
                  y2={padding.top + plotHeight}
                  stroke="var(--color-down)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
              </g>
            );
          })}

          {/* Horizontal Grid Lines & Y-axis labels */}
          {[0, 0.33, 0.66, 1].map((ratio) => {
            const val = Math.round(maxMs * (1 - ratio));
            const y = padding.top + ratio * plotHeight;

            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--color-line)"
                  strokeWidth="1"
                  strokeDasharray={ratio === 1 ? undefined : '2 2'}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="tabular"
                  style={{
                    fontSize: '11px',
                    fill: 'var(--color-muted)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {val} ms
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill={`url(#chart-fill-${filterId})`} />}

          {/* Line path */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* X-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const t = startTime + ratio * durationMs;
            const x = padding.left + ratio * plotWidth;
            const y = padding.top + plotHeight + 20;

            return (
              <text
                key={ratio}
                x={x}
                y={y}
                textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}
                style={{
                  fontSize: '11px',
                  fill: 'var(--color-muted)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {formatLocalTime(t)}
              </text>
            );
          })}

          {/* Hover Crosshair and Point */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={padding.top}
                x2={hoveredPoint.x}
                y2={padding.top + plotHeight}
                stroke="var(--color-accent)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="5"
                fill="var(--color-surface)"
                stroke="var(--color-accent)"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: 'var(--text-xs)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ color: 'var(--color-muted)' }}>
              {new Date(hoveredPoint.bucket.bucket).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
              <span className="tabular">{hoveredPoint.bucket.avgResponseMs} ms</span>
              {hoveredPoint.bucket.failCount > 0 && (
                <span style={{ color: 'var(--color-down)', marginLeft: '6px' }}>
                  ({hoveredPoint.bucket.failCount} failed)
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
