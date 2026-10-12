import type { ReactNode } from 'react';
import { LogoIcon } from './Icons';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="ct-auth">
      <div className="ct-auth-card">
        <div className="ct-auth-brand">
          <LogoIcon />
          <span>AI Chaos Tester</span>
        </div>
        <h1>{title}</h1>
        {subtitle ? <p className="ct-sub">{subtitle}</p> : null}
        {children}
        {footer ? <div className="ct-auth-foot">{footer}</div> : null}
      </div>
    </div>
  );
}