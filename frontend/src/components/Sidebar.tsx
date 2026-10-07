import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Button from './Button';
import { FolderIcon, GearIcon, ListIcon, LogoIcon } from './Icons';
import { listProjects } from '../lib/client';
import { useAuth } from '../lib/auth';
import { paths } from '../lib/routes';

const NAV = [
  { to: paths.projects, label: 'Projects', Icon: FolderIcon },
  { to: paths.runs, label: 'Runs', Icon: ListIcon },
  { to: paths.settings, label: 'Settings', Icon: GearIcon },
];

type ApiStatus = 'checking' | 'online' | 'offline';

function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');
  useEffect(() => {
    let alive = true;
    const check = () => {
      listProjects().then(
        () => alive && setStatus('online'),
        () => alive && setStatus('offline'),
      );
    };
    check();
    const t = window.setInterval(check, 60000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  return status;
}

export default function Sidebar() {
  const status = useApiStatus();
  const { user, signOut } = useAuth();
  const tone = status === 'online' ? 'ok' : status === 'offline' ? 'bad' : 'neutral';
  const label = status === 'online' ? 'API reachable' : status === 'offline' ? 'API unreachable' : 'Checking API';

  return (
    <aside className="ct-sidebar" aria-label="Primary">
      <div className="ct-brand">
        <LogoIcon />
        <span>AI Chaos Tester</span>
      </div>
      <nav className="ct-nav">
        {NAV.map(({ to, label: text, Icon }) => (
          <NavLink key={to} to={to}>
            <Icon />
            {text}
          </NavLink>
        ))}
      </nav>
      <div className="ct-sidebar-foot">
        {user ? (
          <div className="ct-user">
            <span className="ct-user-email" title={user.email}>
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        ) : null}
        <span className={`ct-badge ct-tone-${tone}`}>
          <span className="ct-dot" />
          {label}
        </span>
      </div>
    </aside>
  );
}

export function TopNav() {
  const { signOut } = useAuth();
  return (
    <header className="ct-topnav">
      <div className="ct-brand" aria-label="AI Chaos Tester">
        <LogoIcon />
        <span>AI Chaos Tester</span>
      </div>
      <nav style={{ display: 'flex', gap: 4 }}>
        {NAV.map(({ to, label }) => (
          <NavLink key={to} to={to}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Button variant="ghost" size="sm" onClick={signOut} style={{ marginLeft: 'auto', flex: 'none' }}>
        Sign out
      </Button>
    </header>
  );
}