import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Button from './Button';
import { CloseIcon } from './Icons';

interface ModalProps {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}

export default function Modal({ title, onClose, busy = false, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className="ct-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="ct-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="ct-modal-head">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy} aria-label="Close">
            <CloseIcon />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}