export function isWithinInteractionDistance(origin, target, maxDistance) {
  if (!origin || !target || !Number.isFinite(maxDistance) || maxDistance < 0) return false;
  if (![origin.x, origin.y, target.x, target.y].every(Number.isFinite)) return false;
  return Math.hypot(origin.x - target.x, origin.y - target.y) <= maxDistance;
}
