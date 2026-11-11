import React from 'react';
import { MonitorState } from '../api/types';

interface StatusIndicatorProps {
  state: MonitorState | 'PAUSED' | 'up' | 'down' | 'degraded' | 'nodata';
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  active = true,
  size = 'md',
}) => {
  let displayWord = 'Unknown';
  let dotColor = 'var(--color-nodata)';

  if (!active || state === 'PAUSED') {
    displayWord = 'Paused';
    dotColor = 'var(--color-muted)';
  } else if (state === 'UP' || state === 'up') {
    displayWord = 'Up';
    dotColor = 'var(--color-up)';
  } else if (state === 'DOWN' || state === 'down') {
    displayWord = 'Down';
    dotColor = 'var(--color-down)';
  } else if (state === 'degraded') {
    displayWord = 'Degraded';
    dotColor = 'var(--color-degraded)';
  } else if (state === 'nodata') {
    displayWord = 'No data';
    dotColor = 'var(--color-nodata)';
  }

  const dotSize = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
  const textSize = size === 'sm' ? 'var(--text-xs)' : size === 'lg' ? 'var(--text-base)' : 'var(--text-sm)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: textSize,
        fontWeight: 500,
        color: 'var(--color-ink)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
          transition: 'background-color 0.2s ease',
        }}
      />
      <span>{displayWord}</span>
    </span>
  );
};
