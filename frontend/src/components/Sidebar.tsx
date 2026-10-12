import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Button from './Button';
import { FolderIcon, GearIcon, ListIcon, LogoIcon, PlusIcon } from './Icons';
import { useAuth } from '../lib/auth';
import { useDrafts } from '../lib/drafts';
import { paths } from '../lib/routes';
import { useProjectList } from '../lib/useProjectList';

const NAV = [
  { to: paths.projects, label: 'Projects', Icon: FolderIcon, end: true },
  { to: paths.runs, label: 'Runs', Icon: ListIcon, end: false },
  { to: paths.settings, label: 'Settings', Icon: GearIcon, end: false },
];

/** Where to send a guest back to after they sign in. */
function useReturnPath(): string {
  const { pathname, search } = useLocation();
  return pathname === paths.signInRequired ? paths.projects : pathname + search;
}

export default function Sidebar() {
  const { user, status: authStatus, signOut } = useAuth();
  const { projects, status } = useProjectList(authStatus === 'authed');
  const drafts = useDrafts();
  const navigate = useNavigate();
  const returnTo = useReturnPath();
  const guest = authStatus === 'anon';

  const tone = status === 'ready' ? 'ok' : status === 'error' ? 'bad' : 'neutral';
  const label = status === 'ready' ? 'API reachable' : status === 'error' ? 'API unreachable' : 'Checking API';

  const items = guest
    ? drafts.map((d) => ({ id: d.id, name: d.name }))
    : projects.map((p) => ({ id: p.id, name: p.name }));
  const loadingList = !guest && items.length === 0 && (status === 'loading' || status === 'idle');

  return (
    <aside className="ct-sidebar" aria-label="Primary">
      <div className="ct-brand">
        <LogoIcon />
        <span>AI Chaos Tester</span>
      </div>

      <Button
        className="ct-newproject"
        icon={<PlusIcon />}
        onClick={() => navigate(paths.projects, { state: { newProject: true } })}
      >
        New project
      </Button>

      <nav className="ct-nav">
        {NAV.map(({ to, label: text, Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon />
            {text}
          </NavLink>
        ))}
      </nav>

      <div className="ct-side-label">Your projects</div>
      <div className="ct-plist">
        {loadingList ? (
          <>
            <span className="ct-skel" style={{ width: '70%', margin: '8px' }} />
            <span className="ct-skel" style={{ width: '55%', margin: '8px' }} />
          </>
        ) : items.length === 0 ? (
          <div className="ct-plist-empty">{status === 'error' ? 'Could not load projects' : 'No projects yet'}</div>
        ) : (
          items.map((p) => (
            <NavLink key={p.id} to={paths.project(p.id)} title={p.name}>
              {p.name}
            </NavLink>
          ))
        )}
      </div>

      <div className="ct-sidebar-foot">
        {user ? (
          <>
            <div className="ct-user">
              <span className="ct-user-email" title={user.email}>
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
            <span className={`ct-badge ct-tone-${tone}`}>
              <span className="ct-dot" />
              {label}
            </span>
          </>
        ) : guest ? (
          <div className="ct-guest-actions">
            <Link className="ct-btn ct-btn-primary ct-btn-block" to={paths.login} state={{ from: returnTo }}>
              Sign in
            </Link>
            <Link className="ct-inline-link" to={paths.signup} state={{ from: returnTo }}>
              Create account
            </Link>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function TopNav() {
  const { user, signOut } = useAuth();
  const returnTo = useReturnPath();
  return (
    <header className="ct-topnav">
      <div className="ct-brand" aria-label="AI Chaos Tester">
        <LogoIcon />
        <span>AI Chaos Tester</span>
      </div>
      <nav style={{ display: 'flex', gap: 4 }}>
        {NAV.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end}>
            {label}
          </NavLink>
        ))}
      </nav>
      {user ? (
        <Button variant="ghost" size="sm" onClick={signOut} style={{ marginLeft: 'auto', flex: 'none' }}>
          Sign out
        </Button>
      ) : (
        <Link
          className="ct-btn ct-btn-sm"
          to={paths.login}
          state={{ from: returnTo }}
          style={{ marginLeft: 'auto', flex: 'none' }}
        >
          Sign in
        </Link>
      )}
    </header>
  );
}