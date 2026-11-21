// One stable DOM layer for every 3D-anchored label. Passing it to drei <Html portal>
// keeps labels from re-mounting when the canvas connects its events.
const layer = document.createElement('div');
layer.id = 'label-layer';
Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1', overflow: 'hidden' });
document.body.appendChild(layer);

export const labelPortal = { current: layer };
