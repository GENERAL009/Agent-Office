import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** A canvas-backed texture that redraws whenever `deps` change. Depth-tested, unlike DOM overlays. */
export function useCanvasTexture(w: number, h: number, draw: Draw, deps: unknown[]) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { canvas, texture };
  }, [w, h]);

  useEffect(() => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

export const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
export const MONO = 'JetBrains Mono, ui-monospace, Menlo, monospace';
