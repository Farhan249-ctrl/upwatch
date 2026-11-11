import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [telegramChatId, setTelegramChatId] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user) {
      setTelegramChatId(user.telegramChatId || '');
      setAlertsEnabled(user.alertsEnabled || false);
    }
  }, [user]);

  const isWired = Boolean(alertsEnabled && telegramChatId.trim());

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      await api.updateAlerts({
        telegramChatId: telegramChatId.trim() || null,
        alertsEnabled,
      });
      await refreshUser();
      setFeedback({ type: 'success', message: 'Alert settings saved.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update alert settings';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setFeedback(null);

    try {
      const res = await api.sendTestAlert();
      setFeedback({
        type: 'success',
        message: res.message || 'Test alert delivered to Telegram.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send test alert';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '640px' }}>
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
          Settings
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', margin: 0 }}>
          Manage your notification channels and alert preferences.
        </p>
      </div>

      {/* Telegram Alerts Card */}
      <section
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--color-ink)' }}>
              Telegram notifications
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', margin: 0 }}>
              Receive instant alerts on service downtime and recoveries.
            </p>
          </div>

          {/* Status badge: Wired or Inactive */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: isWired ? 'rgba(20, 138, 91, 0.1)' : 'var(--color-paper)',
              color: isWired ? 'var(--color-up)' : 'var(--color-muted)',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isWired ? 'var(--color-up)' : 'var(--color-nodata)',
              }}
            />
            <span>{isWired ? 'Wired' : 'Inactive'}</span>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            role="status"
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              marginBottom: '20px',
              backgroundColor: feedback.type === 'success' ? 'rgba(20, 138, 91, 0.1)' : 'rgba(201, 60, 60, 0.1)',
              color: feedback.type === 'success' ? 'var(--color-up)' : 'var(--color-down)',
              border: `1px solid ${feedback.type === 'success' ? 'var(--color-up)' : 'var(--color-down)'}`,
            }}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label
              htmlFor="telegramChatId"
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--color-ink)',
                marginBottom: '6px',
              }}
            >
              Telegram chat ID
            </label>
            <input
              id="telegramChatId"
              type="text"
              placeholder="e.g. 123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-line)',
                backgroundColor: 'var(--color-paper)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-sm)',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px', margin: '4px 0 0 0' }}>
              Message @userinfobot on Telegram to discover your personal chat ID.
            </p>
          </div>

          {/* Alerts Enabled Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              id="alertsEnabled"
              type="checkbox"
              checked={alertsEnabled}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: 'var(--color-accent)',
              }}
            />
            <label
              htmlFor="alertsEnabled"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--color-ink)',
                cursor: 'pointer',
              }}
            >
              Enable Telegram notifications
            </label>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '9px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-accent)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'Saving...' : 'Save settings'}
            </button>

            <button
              type="button"
              onClick={handleSendTest}
              disabled={isTesting || !telegramChatId.trim()}
              style={{
                padding: '9px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-ink)',
                border: '1px solid var(--color-line)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: isTesting || !telegramChatId.trim() ? 'not-allowed' : 'pointer',
                opacity: isTesting || !telegramChatId.trim() ? 0.6 : 1,
              }}
            >
              {isTesting ? 'Sending test...' : 'Send test alert'}
            </button>
          </div>
        </form>
      </section>

      {/* Account Info Card */}
      <section
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
        }}
      >
        <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--color-ink)' }}>
          Account
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--text-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-line)', paddingBottom: '10px' }}>
            <span style={{ color: 'var(--color-muted)' }}>Name</span>
            <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{user?.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-line)', paddingBottom: '10px' }}>
            <span style={{ color: 'var(--color-muted)' }}>Email</span>
            <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{user?.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-muted)' }}>Role</span>
            <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{user?.role}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
