// Solmara utility helpers: deterministic PRNG, math primitives, and 2D collision routines.

/**
 * Fast deterministic 32-bit PRNG (Mulberry32).
 * Given a seed integer, yields repeatable pseudo-random floats in [0, 1).
 */
export function createRng(seed = 1) {
  let s = Math.floor(Math.abs(seed)) || 1;
  return function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential damping. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Normalizes an angle into the [-PI, PI] range. */
export function normalizeAngle(rad) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

/** Shortest-arc angular lerp. */
export function angleLerp(a, b, t) {
  const diff = normalizeAngle(b - a);
  return a + diff * t;
}

export function dist2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.hypot(dx, dz);
}

export function distSq2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return dx * dx + dz * dz;
}

/**
 * Tests collision between a 2D circle and an Axis-Aligned Bounding Box (AABB).
 * Returns { hit: boolean, normalX: number, normalZ: number, depth: number }
 */
export function circleIntersectsAABB(cx, cz, radius, minX, minZ, maxX, maxZ) {
  const closestX = clamp(cx, minX, maxX);
  const closestZ = clamp(cz, minZ, maxZ);

  const dx = cx - closestX;
  const dz = cz - closestZ;
  const dSq = dx * dx + dz * dz;

  if (dSq > radius * radius) {
    return { hit: false, normalX: 0, normalZ: 0, depth: 0 };
  }

  const dist = Math.sqrt(dSq);
  if (dist > 1e-5) {
    return {
      hit: true,
      normalX: dx / dist,
      normalZ: dz / dist,
      depth: radius - dist,
    };
  }

  // Circle center is inside the box: push out along the nearest axis
  const left = cx - minX;
  const right = maxX - cx;
  const top = cz - minZ;
  const bottom = maxZ - cz;
  const minEdge = Math.min(left, right, top, bottom);

  if (minEdge === left) return { hit: true, normalX: -1, normalZ: 0, depth: radius + left };
  if (minEdge === right) return { hit: true, normalX: 1, normalZ: 0, depth: radius + right };
  if (minEdge === top) return { hit: true, normalX: 0, normalZ: -1, depth: radius + top };
  return { hit: true, normalX: 0, normalZ: 1, depth: radius + bottom };
}

/** District definitions for Solmara. */
export const DISTRICTS = {
  CORAL_AVENUE: {
    id: 'coral_avenue',
    name: 'Coral Avenue',
    subtitle: 'Sun-Drenched Beach Boulevard',
    color: '#ffaa66',
  },
  PALM_HEIGHTS: {
    id: 'palm_heights',
    name: 'Palm Heights',
    subtitle: 'Lush Palms & Luxury Condos',
    color: '#7ac79e',
  },
  OLD_MARINA: {
    id: 'old_marina',
    name: 'Old Marina',
    subtitle: 'Historic Docks & Warehouses',
    color: '#e27b68',
  },
  SUNSET_HILLS: {
    id: 'sunset_hills',
    name: 'Sunset Hills',
    subtitle: 'Golden Skyline Overlook',
    color: '#ffc15e',
  },
  DOCKSIDE: {
    id: 'dockside',
    name: 'Dockside',
    subtitle: 'Industrial Shipyards & Freighters',
    color: '#5b82a6',
  },
};
