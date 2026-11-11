import React, { useEffect, useRef, useState } from 'react';
import { Monitor } from '../api/types';

interface MonitorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Monitor>) => Promise<void>;
  initialData?: Monitor | null;
}

export const MonitorDrawer: React.FC<MonitorDrawerProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState<15 | 30 | 60 | 300>(60);
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [expectedStatus, setExpectedStatus] = useState('');
  const [allowSelfSigned, setAllowSelfSigned] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setUrl(initialData.url);
        setIntervalSeconds(initialData.intervalSeconds);
        setTimeoutMs(initialData.timeoutMs || 10000);
        setExpectedStatus(
          initialData.expectedStatus && initialData.expectedStatus.length > 0
            ? initialData.expectedStatus.join(', ')
            : ''
        );
        setAllowSelfSigned(initialData.allowSelfSigned || false);
        setShowAdvanced(
          Boolean(
            (initialData.timeoutMs && initialData.timeoutMs !== 10000) ||
              (initialData.expectedStatus && initialData.expectedStatus.length > 0) ||
              initialData.allowSelfSigned
          )
        );
      } else {
        setName('');
        setUrl('');
        setIntervalSeconds(60);
        setTimeoutMs(10000);
        setExpectedStatus('');
        setAllowSelfSigned(false);
        setShowAdvanced(false);
      }
      setErrors({});
      setServerError(null);

      // Focus first input
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialData]);

  // Escape key & focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = 'Monitor name is required';
    }
    if (!url.trim()) {
      errs.url = 'Target URL is required';
    } else {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errs.url = 'URL must start with http:// or https://';
        }
      } catch {
        errs.url = 'Enter a valid URL (e.g. https://api.myproject.com)';
      }
    }
    if (timeoutMs < 100 || timeoutMs > 30000) {
      errs.timeoutMs = 'Timeout must be between 100ms and 30000ms';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setServerError(null);

    let parsedStatus: number[] = [];
    if (expectedStatus.trim()) {
      parsedStatus = expectedStatus
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }

    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        intervalSeconds,
        timeoutMs,
        expectedStatus: parsedStatus,
        allowSelfSigned,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save monitor';
      setServerError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-heading"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          backgroundColor: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-line)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid var(--color-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 id="drawer-heading" style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
            {isEditing ? 'Edit monitor' : 'Add monitor'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted)',
              fontSize: '20px',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Server errors in aria-live region */}
        <div aria-live="polite">
          {serverError && (
            <div
              style={{
                margin: '16px 28px 0 28px',
                padding: '12px 16px',
                backgroundColor: 'rgba(201, 60, 60, 0.1)',
                border: '1px solid var(--color-down)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-down)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {serverError}
            </div>
          )}
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '24px 28px',
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Name */}
          <div>
            <label
              htmlFor="monitor-name"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px' }}
            >
              Monitor name
            </label>
            <input
              ref={firstInputRef}
              id="monitor-name"
              type="text"
              value={name}
              placeholder="e.g. Production API"
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${errors.name ? 'var(--color-down)' : 'var(--color-line)'}`,
                backgroundColor: 'var(--color-paper)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-base)',
              }}
            />
            {errors.name && (
              <p style={{ color: 'var(--color-down)', fontSize: 'var(--text-xs)', marginTop: '4px' }}>
                {errors.name}
              </p>
            )}
          </div>

          {/* URL */}
          <div>
            <label
              htmlFor="monitor-url"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px' }}
            >
              Target URL
            </label>
            <input
              id="monitor-url"
              type="text"
              value={url}
              placeholder="https://example.com/api/health"
              onChange={(e) => setUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${errors.url ? 'var(--color-down)' : 'var(--color-line)'}`,
                backgroundColor: 'var(--color-paper)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-base)',
              }}
            />
            {errors.url && (
              <p style={{ color: 'var(--color-down)', fontSize: 'var(--text-xs)', marginTop: '4px' }}>
                {errors.url}
              </p>
            )}
          </div>

          {/* Interval */}
          <div>
            <label
              htmlFor="monitor-interval"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px' }}
            >
              Check interval
            </label>
            <select
              id="monitor-interval"
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value) as 15 | 30 | 60 | 300)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-line)',
                backgroundColor: 'var(--color-paper)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-base)',
              }}
            >
              <option value={15}>15 seconds (Fast, for demos)</option>
              <option value={30}>30 seconds (Fast, for demos)</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>

          {/* Collapsed Advanced Section */}
          <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 0,
              }}
            >
              <span>{showAdvanced ? '− Hide advanced settings' : '+ Advanced settings'}</span>
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Timeout */}
                <div>
                  <label
                    htmlFor="monitor-timeout"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px' }}
                  >
                    Timeout in milliseconds
                  </label>
                  <input
                    id="monitor-timeout"
                    type="number"
                    value={timeoutMs}
                    min={100}
                    max={30000}
                    step={500}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-line)',
                      backgroundColor: 'var(--color-paper)',
                      color: 'var(--color-ink)',
                      fontSize: 'var(--text-base)',
                    }}
                  />
                  {errors.timeoutMs && (
                    <p style={{ color: 'var(--color-down)', fontSize: 'var(--text-xs)', marginTop: '4px' }}>
                      {errors.timeoutMs}
                    </p>
                  )}
                </div>

                {/* Expected Status Codes */}
                <div>
                  <label
                    htmlFor="monitor-status-codes"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px' }}
                  >
                    Expected status codes (comma-separated, default 200–399)
                  </label>
                  <input
                    id="monitor-status-codes"
                    type="text"
                    value={expectedStatus}
                    placeholder="200, 204, 301"
                    onChange={(e) => setExpectedStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-line)',
                      backgroundColor: 'var(--color-paper)',
                      color: 'var(--color-ink)',
                      fontSize: 'var(--text-base)',
                    }}
                  />
                </div>

                {/* Allow Self Signed */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    id="monitor-self-signed"
                    type="checkbox"
                    checked={allowSelfSigned}
                    onChange={(e) => setAllowSelfSigned(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="monitor-self-signed"
                    style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)', cursor: 'pointer' }}
                  >
                    Allow self-signed SSL certificates
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Actions */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '20px',
              borderTop: '1px solid var(--color-line)',
              display: 'flex',
              gap: '12px',
            }}
          >
            <button
              type="submit"
              disabled={isSaving}
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: 'var(--color-accent)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Add monitor'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '10px 16px',
                backgroundColor: 'transparent',
                color: 'var(--color-ink)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
