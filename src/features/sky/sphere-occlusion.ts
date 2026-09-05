/** The same camera-relative sphere and ray projection used by cloud-landmarks. */
export type SphereProjection = {
  width: number;
  height: number;
  aspect: number;
  centerX: number;
  centerY: number;
  depth: number;
  radius: number;
  framingY: number;
  layerScale: number;
  layerShiftY: number;
};

/** Exact ray/sphere coverage, including the shader's antialiased silhouette.
 * An off-axis sphere projects to an offset ellipse, not a circle around its
 * projected center. Invert the cloud deck's CSS transform before casting the ray.
 */
export function sphereCoverageAt(x: number, y: number, view: SphereProjection): number {
  if (view.width <= 0 || view.height <= 0 || view.layerScale <= 0) return 0;
  const localX = (x - view.width * 0.5) / view.layerScale + view.width * 0.5;
  const localY = (y - view.layerShiftY - view.height * 0.5) / view.layerScale + view.height * 0.5;
  const dx = ((2 * localX) / view.width - 1) * view.aspect;
  const dy = 1 - (2 * localY) / view.height + view.framingY;
  const dz = -1.5;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const alongRay = view.centerX * dx + view.centerY * dy - view.depth * dz;
  const centerSquared = view.centerX ** 2 + view.centerY ** 2 + view.depth ** 2;
  const discriminant = alongRay * alongRay - lengthSquared * (centerSquared - view.radius ** 2);
  if (discriminant <= 0 || alongRay - Math.sqrt(discriminant) <= 0) return 0;
  // Divide by |ray|² to reproduce the normalized GLSL ray's discriminant.
  const t = Math.max(0, Math.min(1, discriminant / lengthSquared / 0.045));
  return t * t * (3 - 2 * t);
}
