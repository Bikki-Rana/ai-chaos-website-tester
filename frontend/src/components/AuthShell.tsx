import type { ReactNode, Ref } from 'react';
import ChaosCube from './ChaosCube';
import type { ChaosCubeHandle } from './ChaosCube';
import { LogoIcon } from './Icons';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  cubeRef?: Ref<ChaosCubeHandle>;
  shake?: boolean;
}

export default function AuthShell({ title, subtitle, children, footer, cubeRef, shake = false }: AuthShellProps) {
  return (
    <div className="ct-authx">
      <aside className="ct-authx-art" aria-hidden="true">
        <ChaosCube ref={cubeRef} />
        <div className="ct-authx-brand">
          <LogoIcon />
          <span>AI Chaos Tester</span>
        </div>
        <div className="ct-authx-tag">
          <strong>Break it before your users do.</strong>
          <span>Autonomous chaos testing for any website.</span>
        </div>
      </aside>
      <main className="ct-authx-main">
        <div className={`ct-authx-card ct-authx-in${shake ? ' ct-shake' : ''}`}>
          <h1>{title}</h1>
          {subtitle ? <p className="ct-sub">{subtitle}</p> : null}
          {children}
          {footer ? <div className="ct-auth-foot">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}