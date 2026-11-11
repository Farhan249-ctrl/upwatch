import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isConfirming = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-desc"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 600,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-line)',
          padding: '24px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h3
          id="dialog-title"
          style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '8px' }}
        >
          {title}
        </h3>
        <p
          id="dialog-desc"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: '24px' }}
        >
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            style={{
              padding: '8px 14px',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--color-down)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: '#FFFFFF',
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isConfirming ? 0.7 : 1,
            }}
          >
            {isConfirming ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
