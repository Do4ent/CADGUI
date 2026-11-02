import { useEffect, useId, useRef, type ReactNode } from 'react';
import '../../styles/dialogs.css';

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  onApply?: () => void;
}

/** Native modal semantics contain focus and restore it to the invoking control. */
export function Dialog({ open, title, children, onCancel, onConfirm, confirmDisabled = false, confirmLabel = 'ОК', onApply }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="bc-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onCancel(); }}
    onKeyDown={event => event.stopPropagation()}>
    <form onSubmit={event => { event.preventDefault(); if (!confirmDisabled) onConfirm(); }}>
      <header className="bc-dialog-title" id={titleId}>{title}</header>
      <div className="bc-dialog-content">{children}</div>
      <footer className="bc-dialog-actions">
        <button type="submit" disabled={confirmDisabled}>{confirmLabel}</button>
        <button type="button" onClick={onCancel}>Отмена</button>
        {onApply && <button type="button" disabled={confirmDisabled} onClick={onApply}>Применить</button>}
      </footer>
    </form>
  </dialog>;
}
