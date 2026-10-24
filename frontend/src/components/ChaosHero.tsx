import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { loadSettings } from '../lib/settings';

const COLS = 9;
const ROWS = 9;
const LAYERS = 4;
const SPACING = 0.5;
const CUBE = 0.3;
const COUNT = COLS * ROWS * LAYERS;
const POINTER_RADIUS = 1.5;

const BASE = new THREE.Color(0x3a3f47);
const ACCENT = new THREE.Color(0x58a6dd);
const RED = new THREE.Color(0xe5534b);

interface Wave {
  t0: number;
  x: number;
  y: number;
  power: number;
}

function createRenderer(): THREE.WebGLRenderer | null {
  try {
    return new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
}

interface ChaosHeroProps {
  children: ReactNode;
  hint?: string;
}

/**
 * A grid of cubes you can disturb. Cursor pushes them away, a click sends a shockwave,
 * and the more a cube is displaced the more it shifts from grey to blue to red.
 * Purely decorative: it does not represent any data.
 */
export default function ChaosHero({
  children,
  hint = 'Move over the grid. Click to scatter it.',
}: ChaosHeroProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = createRenderer();
    if (!renderer) return; // no WebGL: the text still works without the grid

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || loadSettings().reduceEffects;
    const canvas = renderer.domElement;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.insertBefore(canvas, host.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    camera.position.set(0, 0, 10);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 5, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x58a6dd, 0.7);
    rim.position.set(-5, -2, 3);
    scene.add(rim);

    const geometry = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.15 });
    const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // Home positions: a tilted block of cubes
    const baseQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, 0.6, 0.08));
    const home = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    const tmp = new THREE.Vector3();
    let n = 0;
    for (let l = 0; l < LAYERS; l++) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          tmp
            .set(
              (c - (COLS - 1) / 2) * SPACING,
              (r - (ROWS - 1) / 2) * SPACING,
              (l - (LAYERS - 1) / 2) * SPACING * 1.1,
            )
            .applyQuaternion(baseQ);
          home[n * 3] = tmp.x;
          home[n * 3 + 1] = tmp.y;
          home[n * 3 + 2] = tmp.z;
          seed[n * 3] = Math.random() * 2 - 1;
          seed[n * 3 + 1] = Math.random() * 2 - 1;
          seed[n * 3 + 2] = Math.random() * 2 - 1;
          phase[n] = tmp.x * 0.9 + tmp.y * 0.9;
          mesh.setColorAt(n, BASE);
          n++;
        }
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    // Per-cube state
    const off = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const rot = new Float32Array(COUNT * 3);
    const rvel = new Float32Array(COUNT * 3);
    const heat = new Float32Array(COUNT);

    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const qx = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    const shift = new THREE.Vector3();

    const writeInstances = (t: number) => {
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        const h = heat[i];
        pos.set(
          home[i3] + shift.x + off[i3],
          home[i3 + 1] + shift.y + off[i3 + 1],
          home[i3 + 2] + off[i3 + 2] + Math.sin(t * 0.9 + phase[i]) * 0.05,
        );
        eul.set(rot[i3], rot[i3 + 1], rot[i3 + 2]);
        qx.setFromEuler(eul);
        quat.copy(baseQ).multiply(qx);
        sc.setScalar(1 + h * 0.3);
        m4.compose(pos, quat, sc);
        mesh.setMatrixAt(i, m4);
        if (h < 0.5) col.copy(BASE).lerp(ACCENT, h * 2);
        else col.copy(ACCENT).lerp(RED, (h - 0.5) * 2);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    // Sizing: lattice on the right for wide panels, centred and lower on narrow ones
    let width = 0;
    let height = 0;
    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
      if (camera.aspect >= 1.6) shift.set(Math.min(halfW - 3.4, 7), 0, 0);
      else shift.set(0, -0.9, 0);
      if (reduced) {
        writeInstances(0);
        renderer.render(scene, camera);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    if (reduced) {
      return () => {
        ro.disconnect();
        geometry.dispose();
        material.dispose();
        mesh.dispose();
        renderer.dispose();
        if (canvas.parentNode === host) host.removeChild(canvas);
      };
    }

    // Pointer
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const waves: Wave[] = [];
    const t0 = performance.now();
    let px = 1e3;
    let py = 1e3;
    let mx = 0;
    let my = 0;
    let lastInput = 0;

    const toWorld = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        px = hit.x;
        py = hit.y;
      }
      mx = ndc.x;
      my = ndc.y;
      lastInput = performance.now();
    };
    const onMove = (e: PointerEvent) => toWorld(e);
    const onDown = (e: PointerEvent) => {
      toWorld(e);
      waves.push({ t0: (performance.now() - t0) / 1000, x: px, y: py, power: 1 });
    };
    const onLeave = () => {
      px = 1e3;
      py = 1e3;
      mx = 0;
      my = 0;
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointerleave', onLeave);

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) visible = last.isIntersecting;
    });
    io.observe(host);

    // Simulation + render loop
    const R2 = POINTER_RADIUS * POINTER_RADIUS;
    let last = performance.now();
    let lastAuto = -4.8;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || !width) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      const t = (now - t0) / 1000;

      // A gentle wave when nobody is touching it
      if (now - lastInput > 2500 && t - lastAuto > 6) {
        waves.push({
          t0: t,
          x: shift.x + (Math.random() - 0.5) * 3.2,
          y: shift.y + (Math.random() - 0.5) * 3.2,
          power: 0.55,
        });
        lastAuto = t;
      }
      for (let w = waves.length - 1; w >= 0; w--) {
        if (t - waves[w].t0 > 2.4) waves.splice(w, 1);
      }

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        const wx = home[i3] + shift.x + off[i3];
        const wy = home[i3 + 1] + shift.y + off[i3 + 1];

        const dx = wx - px;
        const dy = wy - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 1e-4;
          const f = 1 - d / POINTER_RADIUS;
          const k = f * f * 30;
          vel[i3] += (dx / d) * k * dt;
          vel[i3 + 1] += (dy / d) * k * dt;
          vel[i3 + 2] += k * 0.5 * dt;
          rvel[i3] += seed[i3] * k * dt * 5;
          rvel[i3 + 1] += seed[i3 + 1] * k * dt * 5;
          rvel[i3 + 2] += seed[i3 + 2] * k * dt * 5;
        }

        for (let w = 0; w < waves.length; w++) {
          const wave = waves[w];
          const radius = (t - wave.t0) * 7;
          const wdx = wx - wave.x;
          const wdy = wy - wave.y;
          const dist = Math.sqrt(wdx * wdx + wdy * wdy) + 1e-4;
          const delta = Math.abs(dist - radius);
          if (delta < 0.7) {
            const f = (1 - delta / 0.7) * wave.power;
            vel[i3] += (wdx / dist) * f * 38 * dt;
            vel[i3 + 1] += (wdy / dist) * f * 38 * dt;
            vel[i3 + 2] += f * 14 * dt;
            rvel[i3] += seed[i3] * f * dt * 18;
            rvel[i3 + 1] += seed[i3 + 1] * f * dt * 18;
            rvel[i3 + 2] += seed[i3 + 2] * f * dt * 18;
          }
        }

        // Springs pull everything back into the grid
        for (let a = 0; a < 3; a++) {
          const j = i3 + a;
          vel[j] += (-off[j] * 14 - vel[j] * 3.2) * dt;
          off[j] += vel[j] * dt;
          rvel[j] += (-rot[j] * 16 - rvel[j] * 3.5) * dt;
          rot[j] += rvel[j] * dt;
        }

        const mag = Math.sqrt(off[i3] * off[i3] + off[i3 + 1] * off[i3 + 1] + off[i3 + 2] * off[i3 + 2]);
        heat[i] += (Math.min(1, mag / 1.6) - heat[i]) * Math.min(1, dt * 10);
      }

      camera.position.x += (mx * 0.9 - camera.position.x) * 0.05;
      camera.position.y += (my * 0.5 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      writeInstances(t);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerleave', onLeave);
      geometry.dispose();
      material.dispose();
      mesh.dispose();
      renderer.dispose();
      if (canvas.parentNode === host) host.removeChild(canvas);
    };
  }, []);

  return (
    <section className="ct-hero" ref={hostRef}>
      <div className="ct-hero-copy">{children}</div>
      <div className="ct-hero-hint" aria-hidden="true">
        {hint}
      </div>
    </section>
  );
}