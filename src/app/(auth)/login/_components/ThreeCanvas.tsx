"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const TEAL = 0x2ba89a;
const PARTICLE_COUNT = 130;
const LINK_DIST = 11;
const MAX_LINKS = 380;

type Vec3 = { x: number; y: number; z: number };

export function ThreeCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth || 800;
    const H = mount.clientHeight || 600;

    // ── Renderer ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x0b1918, 1);
    mount.appendChild(renderer.domElement);

    // ── Scene & camera ────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
    camera.position.set(0, 0, 42);

    // ── Particle field ────────────────────────────────────────────
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    const vel: Vec3[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pPos[i * 3]     = (Math.random() - 0.5) * 64;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 52;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 22;
      vel.push({
        x: (Math.random() - 0.5) * 0.016,
        y: (Math.random() - 0.5) * 0.016,
        z: (Math.random() - 0.5) * 0.005,
      });
    }
    const pGeo  = new THREE.BufferGeometry();
    const pAttr = new THREE.BufferAttribute(pPos, 3);
    pGeo.setAttribute("position", pAttr);
    const pMat = new THREE.PointsMaterial({
      color: TEAL, size: 0.22, transparent: true, opacity: 0.9, sizeAttenuation: true,
    });
    scene.add(new THREE.Points(pGeo, pMat));

    // ── Connection lines ──────────────────────────────────────────
    const lPos  = new Float32Array(MAX_LINKS * 6);
    const lGeo  = new THREE.BufferGeometry();
    const lAttr = new THREE.BufferAttribute(lPos, 3);
    lGeo.setAttribute("position", lAttr);
    lGeo.setDrawRange(0, 0);
    const lMat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.12 });
    scene.add(new THREE.LineSegments(lGeo, lMat));

    // ── Decorative wireframe shapes ───────────────────────────────
    const wireMat = new THREE.MeshBasicMaterial({
      color: TEAL, wireframe: true, transparent: true, opacity: 0.05,
    });

    const oct1 = new THREE.Mesh(new THREE.OctahedronGeometry(9, 1), wireMat);
    oct1.position.set(-22, 12, -12);
    scene.add(oct1);

    const oct2 = new THREE.Mesh(new THREE.OctahedronGeometry(5.5, 0), wireMat.clone());
    oct2.position.set(22, -10, -6);
    scene.add(oct2);

    const ico  = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 0), wireMat.clone());
    ico.position.set(10, 18, -18);
    scene.add(ico);

    const tor  = new THREE.Mesh(new THREE.TorusGeometry(5, 1.2, 6, 12), wireMat.clone());
    tor.position.set(-14, -16, -8);
    scene.add(tor);

    // ── Mouse parallax ────────────────────────────────────────────
    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth  - 0.5) * 2;
      my = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // ── Container resize observer ─────────────────────────────────
    const observer = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(mount);

    // ── Animation loop ────────────────────────────────────────────
    let raf: number;
    let t = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      t += 0.005;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const v = vel[i]!;
        const b = i * 3;
        pPos[b]     = (pPos[b]     ?? 0) + v.x;
        pPos[b + 1] = (pPos[b + 1] ?? 0) + v.y;
        pPos[b + 2] = (pPos[b + 2] ?? 0) + v.z;
        if (Math.abs(pPos[b]     ?? 0) > 34) v.x *= -1;
        if (Math.abs(pPos[b + 1] ?? 0) > 28) v.y *= -1;
        if (Math.abs(pPos[b + 2] ?? 0) > 12) v.z *= -1;
      }
      pAttr.needsUpdate = true;

      let lc = 0;
      const distSq = LINK_DIST * LINK_DIST;
      for (let i = 0; i < PARTICLE_COUNT && lc < MAX_LINKS; i++) {
        const ix = pPos[i * 3]!, iy = pPos[i * 3 + 1]!, iz = pPos[i * 3 + 2]!;
        for (let j = i + 1; j < PARTICLE_COUNT && lc < MAX_LINKS; j++) {
          const dx = ix - pPos[j * 3]!;
          const dy = iy - pPos[j * 3 + 1]!;
          const dz = iz - pPos[j * 3 + 2]!;
          if (dx * dx + dy * dy + dz * dz < distSq) {
            lPos[lc * 6]     = ix;  lPos[lc * 6 + 1] = iy;  lPos[lc * 6 + 2] = iz;
            lPos[lc * 6 + 3] = pPos[j * 3]!;
            lPos[lc * 6 + 4] = pPos[j * 3 + 1]!;
            lPos[lc * 6 + 5] = pPos[j * 3 + 2]!;
            lc++;
          }
        }
      }
      lGeo.setDrawRange(0, lc * 2);
      lAttr.needsUpdate = true;

      oct1.rotation.x = t * 0.17;  oct1.rotation.y = t * 0.22;
      oct2.rotation.x = -t * 0.13; oct2.rotation.z = t * 0.19;
      ico.rotation.y  = t * 0.10;  ico.rotation.z  = -t * 0.14;
      tor.rotation.x  = t * 0.20;  tor.rotation.y  = t * 0.11;

      camera.position.x += (mx * 3 - camera.position.x) * 0.04;
      camera.position.y += (my * 2.5 - camera.position.y) * 0.04;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      observer.disconnect();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
