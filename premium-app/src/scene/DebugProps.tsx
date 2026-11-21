// ?debug=props[&items=Name@palette,…] — a row of props with axes, to check orientation and palettes.
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Suspense } from 'react';
import { Prop, type Palette } from './assets';

const DEFAULT = 'B:Wall_Blank_01@01,B:Wall_Blank_01@02,B:Wall_Blank_01@03,B:Wall_Blank_01@04,B:Wall_Brick_01@01,B:Wall_Brick_01@02,B:FeatureWall_Wood_01@01,B:FeatureWall_Slate_01@01,B:FeatureWall_Square_01@01,B:Wall_Blank_Window_01@02,Couch_03@02,Couch_03@03';

export function DebugProps() {
  const params = new URLSearchParams(location.search);
  const gap = Number(params.get('gap') ?? 3.2);
  const items = (params.get('items') ?? DEFAULT).split(',').map((s) => {
    const [name, palette = '01'] = s.split('@');
    return { name, palette: palette as Palette };
  });
  return (
    <Canvas camera={{ position: (params.get('cam') ?? '0,5,16').split(',').map(Number) as [number, number, number], fov: 50 }} style={{ position: 'fixed', inset: 0 }}>
      <color attach="background" args={['#202633']} />
      <hemisphereLight args={['#fff', '#444', 2]} />
      <directionalLight position={[5, 10, 8]} intensity={2} />
      <Suspense fallback={null}>
        {items.map((it, i) => (
          <group key={i} position={[(i % 6) * gap - 8, 0, Math.floor(i / 6) * -gap * 1.4]}>
            <Prop name={it.name} palette={it.palette} />
            <Html position={[1.2, 3.4, 0]} center><div style={{ color: 'white', font: '11px sans-serif', whiteSpace: 'nowrap' }}>{it.name}@{it.palette}</div></Html>
          </group>
        ))}
      </Suspense>
      <gridHelper args={[40, 40]} />
      <OrbitControls />
    </Canvas>
  );
}
