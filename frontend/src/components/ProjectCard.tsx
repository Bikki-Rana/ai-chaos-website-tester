import { Link } from 'react-router-dom';
import { PinIcon } from './Icons';
import ProjectActionMenu from './ProjectActionMenu';
import type { OrderEntry } from './ProjectActionMenu';
import StatusBadge from './StatusBadge';
import TiltCard from './TiltCard';

interface ProjectCardProps {
  id: string;
  to: string;
  name: string;
  url: string;
  index: number;
  draft?: boolean;
  pinned?: boolean;
  status?: string | null;
  runs?: number | null;
  lastRun?: string;
  order?: OrderEntry[];
}

export default function ProjectCard({
  id, to, name, url, index, draft = false, pinned = false, status, runs, lastRun, order,
}: ProjectCardProps) {
  let foot: string;
  if (draft) foot = 'Saved on this device. Log in only when you run it.';
  else if (runs === null || runs === undefined) foot = 'Runs unavailable';
  else if (runs === 0) foot = 'No runs yet';
  else foot = `${runs} ${runs === 1 ? 'run' : 'runs'}${lastRun ? ` \u00b7 last ${lastRun}` : ''}`;

  return (
    <TiltCard className="ct-pcard ct-rise" style={{ ['--i' as string]: index }}>
      <Link to={to}>
        <div className="ct-lift">
          <div className="ct-pcard-top">
            <strong className="ct-pcard-name">
              {pinned ? <PinIcon className="ct-pin" width={12} height={12} /> : null}
              {name}
            </strong>
            {draft ? (
              <span className="ct-sev">Draft</span>
            ) : status ? (
              <StatusBadge status={status} />
            ) : null}
          </div>
          <div className="ct-mono ct-wrap ct-faint ct-pcard-url">{url}</div>
        </div>
        <div className="ct-pcard-foot ct-small ct-faint">{foot}</div>
      </Link>
      <ProjectActionMenu
        project={{ id, name, url, pinned }}
        draft={draft}
        order={order}
        className="ct-pcard-menu"
      />
    </TiltCard>
  );
}