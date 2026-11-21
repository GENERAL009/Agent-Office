// Lighting for when the camera is inside the building: in Walk in, or during a camera shot that ends inside.
// Seen from above, one warm lamp per room falling off with distance squared looks right; at eye level it leaves the
// corners dark. Inside, the same lamps fall off more gently and reach further, rescaled so the floor right under each
// lamp is as bright as before; a softer fill lifts the walls and ceilings the lamps only graze, and the ambient
// occlusion is lighter. No new lights and nothing new to draw, so it costs nothing extra.
import { findShot } from './shots';

/** Walk in, or a shot that ends inside (the ones that show the ceiling). */
export const insideView = (mode: string, shot: string | null) => mode === 'life' || !!(shot && findShot(shot)?.ceiling);

/** ?darkcorners keeps the overview lighting inside too: the way Walk in looked before, to compare. */
const DARK_CORNERS = new URLSearchParams(location.search).has('darkcorners');
/** Should the lamps, the fill and the ambient occlusion use the inside settings below? */
export const insideLight = (mode: string, shot: string | null) => !DARK_CORNERS && insideView(mode, shot);

/**
 * `decay` / `reach`: the room lamps' falloff and how much further they reach. A lower decay lets more light through
 * the walls too (lamps cast no shadows), so it stops where the game room's lamp would start washing Cyber Security.
 * `ambient` / `hemisphere`: the fill (overview: 0.1 and 0.6). `ao`: ambient occlusion (overview: 1.1 m, 2.6).
 */
export const INSIDE = { decay: 1.1, reach: 1.5, ambient: 0.4, hemisphere: 0.8, ao: { radius: 0.5, intensity: 1.0 } };
/** Cyber Security keeps its moodier falloff, a little stronger so its cool glow still wins over the warmer fill. */
export const SOC_INSIDE = { decay: 1.3, reach: 1.4, boost: 1.15 };
/** A lamp's intensity with falloff `decay` that gives the same light `h` metres below it as `intensity` with decay 2. */
export const insideIntensity = (intensity: number, h: number, decay = INSIDE.decay) => intensity * h ** (decay - 2);
