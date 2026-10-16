'use client';

import { useEffect, useState } from 'react';
import { KeySettings } from '@/components/KeySettings';
import type { KeyStatusMap } from '@/lib/keys';
import type { PoolUsage } from '@/lib/limits';

export function SettingsModal({
  isOpen,
  onClose,
  initialKeys,
  usage,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialKeys: KeyStatusMap | null;
  usage?: PoolUsage | null;
}) {
  const [keys, setKeys] = useState<KeyStatusMap | null>(initialKeys);

  useEffect(() => {
    if (isOpen) {
      // Refresh key status when opening modal
      fetch('/api/key')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setKeys(data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[6px] border border-rule bg-paper p-6 sm:p-8 shadow-2xl settle">
        <div className="flex items-center justify-between border-b border-rule pb-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight text-ink">Pengaturan API Key</h2>
            <p className="text-[13px] text-muted">
              Pasang kunci provider kamu sendiri agar tidak dibatasi kuota bersama.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-[3px] p-1.5 text-faint hover:bg-paper-sunk hover:text-ink transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6">
          <KeySettings initial={keys} usage={usage ?? null} />
        </div>
      </div>
    </div>
  );
}
