import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { loadSettings } from '../lib/settings';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface ChaosCubeHandle {
  /** A ripple through the cube. Typing uses a small one. */
  pulse: (power?: number) => void;
  /** Red flash, shockwave and a quick scramble. Used for errors. */
  glitch: () => void;
}

interface Wave {
  t0: number;
  x: number;
  y: number;
  power: number;
}

interface Twist {
  axis: number;
  layer: number;
  dir: number;
  t0: number;
  dur: number;
}

const N = 5;
const SPACING = 0.64;
const SIZE = 0.56;
const COUNT = N * N * N;
const BASE_A = new THREE.Color(0x353a42);
const BASE_B = new THREE.Color(0x40464f);
const ACCENT = new THREE.Color(0x58a6dd);
const RED = new THREE.Color(0xe5534b);
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const noop = () => undefined;

function createRenderer(): THREE.WebGLRenderer | null {
  try {
    return new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
}

/** A cube made of cubes that scrambles itself and reacts to the cursor and the form. Decorative only. */
const ChaosCube = forwardRef<ChaosCubeHandle>(function ChaosCube(_props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const actions = useRef<ChaosCubeHandle>({ pulse: noop, glitch: noop });

  useImperativeHandle(
    ref,
    () => ({ pulse: (p) => actions.current.pulse(p), glitch: () => actions.current.glitch() }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = createRenderer();
    if (!renderer) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || loadSettings().reduceEffects;
    const canvas = renderer.domElement;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    canvas.style.cursor = 'grab';
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    camera.position.set(0, 0, 9.5);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(3, 5, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x58a6dd, 0.8);
    rim.position.set(-5, -2, 3);
    scene.add(rim);

    const geometry = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 3, 0.07);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.2 });
    const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // Per-cube state. "home" is the grid position; twists rotate it.
    const home = new Float32Array(COUNT * 3);
    const homeQ: THREE.Quaternion[] = [];
    const seed = new Float32Array(COUNT * 3);
    const checker = new Uint8Array(COUNT);
    const off = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const rot = new Float32Array(COUNT * 3);
    const rvel = new Float32Array(COUNT * 3);
    const heat = new Float32Array(COUNT);
    let n = 0;
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          const i3 = n * 3;
          home[i3] = (x - (N - 1) / 2) * SPACING;
          home[i3 + 1] = (y - (N - 1) / 2) * SPACING;
          home[i3 + 2] = (z - (N - 1) / 2) * SPACING;
          homeQ.push(new THREE.Quaternion());
          for (let a = 0; a < 3; a++) seed[i3 + a] = Math.random() * 2 - 1;
          checker[n] = (x + y + z) % 2;
          if (!reduced) {
            // Start exploded and fly together
            for (let a = 0; a < 3; a++) {
              off[i3 + a] = (Math.random() - 0.5) * 14;
              rot[i3 + a] = (Math.random() - 0.5) * 8;
            }
          }
          n++;
        }
      }
    }

    const waves: Wave[] = [];
    let twist: Twist | null = null;
    let nextTwist = 1.4;
    let burst = 0;
    let flash = 0;
    let yaw = 0.6;
    let px = 1e3;
    let py = 1e3;
    let mx = 0;
    let my = 0;
    const t0 = performance.now();
    const clock = () => (performance.now() - t0) / 1000;

    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const qBase = new THREE.Quaternion();
    const qx = new THREE.Quaternion();
    const rotQ = new THREE.Quaternion();
    const twistQ = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const eulR = new THREE.Euler(0, 0, 0, 'YXZ');
    const col = new THREE.Color();
    const sc = new THREE.Vector3();

    const inLayer = (i: number, axis: number, layer: number) =>
      Math.round(home[i * 3 + axis] / SPACING + (N - 1) / 2) === layer;

    const commitTwist = (tw: Twist) => {
      twistQ.setFromAxisAngle(AXES[tw.axis], tw.dir * Math.PI * 0.5);
      for (let i = 0; i < COUNT; i++) {
        if (!inLayer(i, tw.axis, tw.layer)) continue;
        const i3 = i * 3;
        tmp.set(home[i3], home[i3 + 1], home[i3 + 2]).applyQuaternion(twistQ);
        home[i3] = Math.round(tmp.x / SPACING) * SPACING;
        home[i3 + 1] = Math.round(tmp.y / SPACING) * SPACING;
        home[i3 + 2] = Math.round(tmp.z / SPACING) * SPACING;
        homeQ[i].premultiply(twistQ);
      }
    };

    const frame = (t: number, dt: number) => {
      flash = Math.max(0, flash - dt * 1.6);

      if (twist && t - twist.t0 >= twist.dur) {
        commitTwist(twist);
        twist = null;
      }
      if (!reduced && !twist && t >= nextTwist) {
        const dur = burst > 0 ? 0.28 : 0.75;
        twist = {
          axis: Math.floor(Math.random() * 3),
          layer: Math.floor(Math.random() * N),
          dir: Math.random() < 0.5 ? 1 : -1,
          t0: t,
          dur,
        };
        nextTwist = t + dur + (burst > 0 ? 0.05 : 1.1 + Math.random() * 1.4);
        if (burst > 0) burst--;
      }
      if (twist) {
        const p = Math.min(1, (t - twist.t0) / twist.dur);
        twistQ.setFromAxisAngle(AXES[twist.axis], ease(p) * twist.dir * Math.PI * 0.5);
      }
      for (let w = waves.length - 1; w >= 0; w--) {
        if (t - waves[w].t0 > 2.4) waves.splice(w, 1);
      }

      if (!reduced) yaw += dt * 0.22;
      eulR.set(-0.35 + my * 0.15, yaw + mx * 0.25, 0);
      rotQ.setFromEuler(eulR);

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        pos.set(home[i3], home[i3 + 1], home[i3 + 2]);
        qBase.copy(homeQ[i]);
        if (twist && inLayer(i, twist.axis, twist.layer)) {
          pos.applyQuaternion(twistQ);
          qBase.premultiply(twistQ);
        }
        pos.applyQuaternion(rotQ);

        if (dt > 0) {
          const wx = pos.x + off[i3];
          const wy = pos.y + off[i3 + 1];

          const dx = wx - px;
          const dy = wy - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < 2.56) {
            const d = Math.sqrt(d2) + 1e-4;
            const f = 1 - d / 1.6;
            const k = f * f * 34;
            vel[i3] += (dx / d) * k * dt;
            vel[i3 + 1] += (dy / d) * k * dt;
            vel[i3 + 2] += k * 0.5 * dt;
            for (let a = 0; a < 3; a++) rvel[i3 + a] += seed[i3 + a] * k * dt * 5;
          }
          for (let w = 0; w < waves.length; w++) {
            const wave = waves[w];
            const wdx = wx - wave.x;
            const wdy = wy - wave.y;
            const dist = Math.sqrt(wdx * wdx + wdy * wdy) + 1e-4;
            const delta = Math.abs(dist - (t - wave.t0) * 7);
            if (delta < 0.8) {
              const f = (1 - delta / 0.8) * wave.power;
              vel[i3] += (wdx / dist) * f * 38 * dt;
              vel[i3 + 1] += (wdy / dist) * f * 38 * dt;
              vel[i3 + 2] += f * 14 * dt;
              for (let a = 0; a < 3; a++) rvel[i3 + a] += seed[i3 + a] * f * dt * 18;
            }
          }
          for (let a = 0; a < 3; a++) {
            const j = i3 + a;
            vel[j] += (-off[j] * 14 - vel[j] * 3.2) * dt;
            off[j] += vel[j] * dt;
            rvel[j] += (-rot[j] * 16 - rvel[j] * 3.5) * dt;
            rot[j] += rvel[j] * dt;
          }
          const mag = Math.sqrt(off[i3] * off[i3] + off[i3 + 1] * off[i3 + 1] + off[i3 + 2] * off[i3 + 2]);
          heat[i] += (Math.max(Math.min(1, mag / 1.6), flash) - heat[i]) * Math.min(1, dt * 10);
        }

        pos.set(pos.x + off[i3], pos.y + off[i3 + 1], pos.z + off[i3 + 2]);
        eul.set(rot[i3], rot[i3 + 1], rot[i3 + 2]);
        qx.setFromEuler(eul);
        quat.copy(rotQ).multiply(qBase).multiply(qx);
        const h = heat[i];
        sc.setScalar(1 + h * 0.25);
        m4.compose(pos, quat, sc);
        mesh.setMatrixAt(i, m4);
        if (h < 0.5) col.copy(checker[i] ? BASE_B : BASE_A).lerp(ACCENT, h * 2);
        else col.copy(ACCENT).lerp(RED, (h - 0.5) * 2);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    let width = 0;
    let height = 0;
    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.position.setLength(camera.aspect >= 1.05 ? 9.5 : 9.5 * (1.05 / camera.aspect));
      if (reduced) {
        frame(0, 0);
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

    actions.current.pulse = (power = 0.25) => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.2;
      waves.push({ t0: clock(), x: Math.cos(a) * r, y: Math.sin(a) * r, power });
    };
    actions.current.glitch = () => {
      waves.push({ t0: clock(), x: 0, y: 0, power: 1.6 });
      flash = 1;
      burst = 3;
      nextTwist = 0;
    };

    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
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
    };
    const onMove = (e: PointerEvent) => toWorld(e);
    const onDown = (e: PointerEvent) => {
      toWorld(e);
      waves.push({ t0: clock(), x: px, y: py, power: 1 });
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

    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || !width) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      frame((now - t0) / 1000, dt);
      camera.position.x += (mx * 0.7 - camera.position.x) * 0.05;
      camera.position.y += (my * 0.4 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      actions.current.pulse = noop;
      actions.current.glitch = noop;
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

  return <div className="ct-cube" ref={hostRef} />;
});

export default ChaosCube;