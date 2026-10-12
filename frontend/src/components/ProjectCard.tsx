import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import TiltCard from './TiltCard';

interface ProjectCardProps {
  to: string;
  name: string;
  url: string;
  index: number;
  draft?: boolean;
  status?: string | null;
  runs?: number | null;
  lastRun?: string;
}

export default function ProjectCard({ to, name, url, index, draft = false, status, runs, lastRun }: ProjectCardProps) {
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
            <strong className="ct-pcard-name">{name}</strong>
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
    </TiltCard>
  );
}