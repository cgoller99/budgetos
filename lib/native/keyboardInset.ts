export function keyboardOverlapPx(metrics: {
  innerHeight: number;
  viewportHeight: number;
  offsetTop: number;
}): number {
  const { innerHeight, viewportHeight, offsetTop } = metrics;
  if (!Number.isFinite(innerHeight) || !Number.isFinite(viewportHeight)) {
    return 0;
  }

  const overlap = innerHeight - viewportHeight - (Number.isFinite(offsetTop) ? offsetTop : 0);
  return overlap > 0 ? Math.round(overlap) : 0;
}
