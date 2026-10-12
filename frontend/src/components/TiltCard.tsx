import { useRef } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  max?: number;
}

/** A card that leans toward the cursor in 3D. */
export default function TiltCard({ children, className = '', style, max = 7 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(x - 0.5) * 2 * max}deg`);
    el.style.setProperty('--rx', `${-(y - 0.5) * 2 * max}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  return (
    <div ref={ref} className={`ct-tilt ${className}`} style={style} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </div>
  );
}