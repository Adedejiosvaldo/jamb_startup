'use client';

import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { buttonClass } from './button';

const backdrop = 'fixed inset-0 z-30 bg-black/70 backdrop-blur-sm';
const popup =
  'fixed bottom-0 left-1/2 z-30 max-h-[90dvh] w-full max-w-md -translate-x-1/2 overflow-y-auto rounded-t-3xl border border-line bg-surface-2 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl focus:outline-none sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:-translate-y-1/2 sm:rounded-3xl sm:pb-6';

/** Confirmation for destructive or irreversible actions (baseline-ui: MUST use AlertDialog). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  danger,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={backdrop} />
        <AlertDialog.Popup className={popup}>
          <AlertDialog.Title className="text-lg font-semibold text-balance">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 text-pretty text-fg-2">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close className={buttonClass('secondary')}>
              {cancelLabel}
            </AlertDialog.Close>
            <button
              type="button"
              className={buttonClass(danger ? 'danger' : 'primary')}
              onClick={onConfirm}
              disabled={busy}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdrop} />
        <BaseDialog.Popup className={popup}>
          <div className="flex items-start justify-between gap-4">
            <BaseDialog.Title className="text-lg font-semibold text-balance">
              {title}
            </BaseDialog.Title>
            <BaseDialog.Close
              aria-label="Close"
              className={buttonClass('ghost', 'sm', '-mt-1 -mr-2')}
            >
              <span aria-hidden="true">✕</span>
            </BaseDialog.Close>
          </div>
          <div className="mt-3">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
