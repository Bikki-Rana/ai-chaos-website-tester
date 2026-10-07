import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CheckIcon, CopyIcon } from './Icons';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: ReactNode;
}

export default function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'ct-btn',
    variant === 'primary' ? 'ct-btn-primary' : '',
    variant === 'ghost' ? 'ct-btn-ghost' : '',
    size === 'sm' ? 'ct-btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ct-spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={copy} icon={copied ? <CheckIcon /> : <CopyIcon />}>
      {copied ? 'Copied' : label}
    </Button>
  );
}