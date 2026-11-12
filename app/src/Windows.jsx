// Tashqi devorlardagi derazalar: ichida haqiqiy osmon rangi (quyoshga qarab o'zgaradi).
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useOffice } from './store.js';

const WW = 1.6;
const WH = 0.6;
const Y = 0.68;
const INSET = 0.15;

export default function Windows({ L }) {
  const { top, horizon, lamps } = useOffice((s) => s.sky);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(WW, WH, 1, 1);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12), 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.5 }), []);

  useEffect(() => {
    const t = new THREE.Color(top);
    const h = new THREE.Color(horizon);
    const boost = 1 + (1 - lamps) * 0.15;
    t.multiplyScalar(boost); h.multiplyScalar(boost);
    const c = geo.attributes.color;
    [t, t, h, h].forEach((col, i) => c.setXYZ(i, col.r, col.g, col.b));
    c.needsUpdate = true;
  }, [top, horizon, lamps, geo]);

  return L.windows.map(([side, at], i) => {
    let pos, rotY;
    if (side === 'top') { const [x, z] = L.toWorld([at, 0]); pos = [x, Y, z + INSET]; rotY = 0; }
    else if (side === 'left') { const [x, z] = L.toWorld([0, at]); pos = [x + INSET, Y, z]; rotY = Math.PI / 2; }
    else { const [x, z] = L.toWorld([L.W - 1, at]); pos = [x - INSET, Y, z]; rotY = -Math.PI / 2; }
    return (
      <group key={`${L.key}-${i}`} position={pos} rotation-y={rotY}>
        <mesh geometry={geo} material={mat} />
        <mesh position-y={WH / 2 + 0.03} material={frameMat}><boxGeometry args={[WW + 0.1, 0.05, 0.04]} /></mesh>
        <mesh position={[0, -WH / 2 - 0.04, 0.03]} material={frameMat}><boxGeometry args={[WW + 0.16, 0.05, 0.1]} /></mesh>
        <mesh position-x={-WW / 2 - 0.03} material={frameMat}><boxGeometry args={[0.05, WH + 0.1, 0.04]} /></mesh>
        <mesh position-x={WW / 2 + 0.03} material={frameMat}><boxGeometry args={[0.05, WH + 0.1, 0.04]} /></mesh>
        <mesh material={frameMat}><boxGeometry args={[0.03, WH, 0.03]} /></mesh>
      </group>
    );
  });
}
