"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const TEAL = 0x2ba89a;

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
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500);
    camera.position.set(0, 0, 42);

    const group = new THREE.Group();
    scene.add(group);

    // ── Helper: thin rectangular frame (window outline) ───────────
    function makeFrame(
      w: number, h: number, opacity: number,
      px = 0, py = 0, pz = 0,
      rx = 0, ry = 0,
    ) {
      const hw = w / 2, hh = h / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0),
        new THREE.Vector3( hw, -hh, 0),
        new THREE.Vector3( hw,  hh, 0),
        new THREE.Vector3(-hw,  hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity });
      const line = new THREE.Line(geo, mat);
      line.position.set(px, py, pz);
      line.rotation.x = rx;
      line.rotation.y = ry;
      return line;
    }

    // ── Helper: window with central cross-bar (mullion) ───────────
    function makeWindowFrame(
      w: number, h: number, opacity: number,
      px = 0, py = 0, pz = 0,
      rx = 0, ry = 0,
    ) {
      const hw = w / 2, hh = h / 2;
      const pts: THREE.Vector3[] = [
        // Outer rectangle
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3( hw, -hh, 0),
        new THREE.Vector3( hw, -hh, 0), new THREE.Vector3( hw,  hh, 0),
        new THREE.Vector3( hw,  hh, 0), new THREE.Vector3(-hw,  hh, 0),
        new THREE.Vector3(-hw,  hh, 0), new THREE.Vector3(-hw, -hh, 0),
        // Horizontal bar (at 1/3 from top)
        new THREE.Vector3(-hw, hh * 0.35, 0), new THREE.Vector3(hw, hh * 0.35, 0),
        // Vertical bar (centre)
        new THREE.Vector3(0, -hh, 0), new THREE.Vector3(0, hh, 0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity });
      const seg = new THREE.LineSegments(geo, mat);
      seg.position.set(px, py, pz);
      seg.rotation.x = rx;
      seg.rotation.y = ry;
      return seg;
    }

    // ── Architectural window frames ───────────────────────────────
    // Central feature window — larger, front and centre
    const mainWindow = makeWindowFrame(13, 19, 0.13, 0, 2, 0, 0, 0.06);
    group.add(mainWindow);

    // Flanking frames — receding into depth
    const leftFrame  = makeFrame(8,  14, 0.07, -20,  3, -10,  0.05, 0.30);
    const rightFrame = makeFrame(10, 15, 0.07,  21, -1, -14,  0.0, -0.28);
    const topFrame   = makeFrame(6,   9, 0.05,  -6, 15, -8,  -0.1,  0.15);
    const deepFrame  = makeFrame(14, 20, 0.03,   2,  0, -24,  0.0,  0.0);
    group.add(leftFrame, rightFrame, topFrame, deepFrame);

    // ── Vertical curtain-fold lines (subtle, clustered right) ─────
    function makeLine(
      x1: number, y1: number, z: number,
      x2: number, y2: number,
      opacity: number,
    ) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y1, z),
        new THREE.Vector3(x2, y2, z),
      ]);
      const mat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity });
      return new THREE.Line(geo, mat);
    }

    // Curtain drape on the right side of centre window
    const DRAPE_X = 7.5;
    const DRAPE_Z = 0.5;
    group.add(makeLine(DRAPE_X + 0.0,  11, DRAPE_Z, DRAPE_X - 0.3, -11, 0.05));
    group.add(makeLine(DRAPE_X + 1.2,  11, DRAPE_Z, DRAPE_X + 0.8, -11, 0.04));
    group.add(makeLine(DRAPE_X + 2.4,  11, DRAPE_Z, DRAPE_X + 1.9, -11, 0.03));
    // Left drape
    const DRAPE_LX = -7.5;
    group.add(makeLine(DRAPE_LX + 0.0,  11, DRAPE_Z, DRAPE_LX + 0.3, -11, 0.05));
    group.add(makeLine(DRAPE_LX - 1.2,  11, DRAPE_Z, DRAPE_LX - 0.8, -11, 0.04));

    // Horizon line (subtle room floor-plane vanishing)
    const horizGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-36, -10, -5),
      new THREE.Vector3( 36, -10, -5),
    ]);
    const horizMat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.04 });
    group.add(new THREE.Line(horizGeo, horizMat));

    // ── Sparse floating dots (much fewer than before) ─────────────
    const DOT_COUNT = 22;
    const dotPos  = new Float32Array(DOT_COUNT * 3);
    const dotVel  = Array.from({ length: DOT_COUNT }, () => ({
      x: (Math.random() - 0.5) * 0.007,
      y: (Math.random() - 0.5) * 0.007,
    }));
    for (let i = 0; i < DOT_COUNT; i++) {
      dotPos[i * 3]     = (Math.random() - 0.5) * 52;
      dotPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      dotPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const dotGeo  = new THREE.BufferGeometry();
    const dotAttr = new THREE.BufferAttribute(dotPos, 3);
    dotGeo.setAttribute("position", dotAttr);
    const dotMat  = new THREE.PointsMaterial({
      color: TEAL, size: 0.16, transparent: true, opacity: 0.4, sizeAttenuation: true,
    });
    group.add(new THREE.Points(dotGeo, dotMat));

    // ── Mouse parallax ────────────────────────────────────────────
    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth  - 0.5) * 2;
      my = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // ── Resize ────────────────────────────────────────────────────
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
    let ry = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      t  += 0.004;
      ry += 0.00035;  // ~0.02 deg/frame → full rotation ~17 min

      // Scene auto-rotation (very slow, dreamy)
      group.rotation.y  = ry;
      group.rotation.x  = Math.sin(t * 0.4) * 0.04;

      // Individual frame micro-breathing
      mainWindow.rotation.y = 0.06 + Math.sin(t * 0.7) * 0.012;
      leftFrame.rotation.y  = 0.30 + Math.sin(t * 0.5 + 1.2) * 0.015;
      rightFrame.rotation.y = -0.28 + Math.sin(t * 0.6 + 2.4) * 0.013;

      // Dot animation
      for (let i = 0; i < DOT_COUNT; i++) {
        const v = dotVel[i]!;
        dotPos[i * 3]     = (dotPos[i * 3]!     ?? 0) + v.x;
        dotPos[i * 3 + 1] = (dotPos[i * 3 + 1]! ?? 0) + v.y;
        if (Math.abs(dotPos[i * 3]!)     > 27) v.x *= -1;
        if (Math.abs(dotPos[i * 3 + 1]!) > 21) v.y *= -1;
      }
      dotAttr.needsUpdate = true;

      // Very gentle camera parallax (±1.5 units max)
      camera.position.x += (mx * 1.5 - camera.position.x) * 0.025;
      camera.position.y += (my * 1.2 - camera.position.y) * 0.025;
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
