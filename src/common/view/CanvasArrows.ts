/**
 * CanvasArrows.ts
 *
 * Arrow-heads on a canvas.
 *
 * Motion is the one thing a still cross-section cannot show, so every screen that draws
 * one needs a triangle pointing the way something is going. The Plate Motion screen uses
 * this for convergence and divergence arrows and for the descending slab.
 *
 * Free functions taking a context: they carry no state, and the caller sets the fill
 * before calling.
 */

/** Half-angle of the arrow-head, radians. Wide enough to read at 5 px. */
const HEAD_HALF_ANGLE = 2.4;

/** One filled triangular arrow-head at (x, y), pointing along `angle`. */
export function paintArrowHead(context: CanvasRenderingContext2D, x: number, y: number, angle: number, size = 5): void {
  context.beginPath();
  context.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  context.lineTo(x + Math.cos(angle + HEAD_HALF_ANGLE) * size, y + Math.sin(angle + HEAD_HALF_ANGLE) * size);
  context.lineTo(x + Math.cos(angle - HEAD_HALF_ANGLE) * size, y + Math.sin(angle - HEAD_HALF_ANGLE) * size);
  context.closePath();
  context.fill();
}
