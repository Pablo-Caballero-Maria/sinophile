/**
 * Grading of free-hand drawings (no template) against the reference stroke
 * medians. Inspired by Hanzi Writer's stroke matcher, but applied after the
 * fact so the learner gets no hints while drawing.
 *
 * Coordinates: everything is converted to a 1024×1024 box with y pointing down.
 * The learner's drawing is first normalised (translated + uniformly scaled) so
 * its bounding box fits the reference character's, which forgives drawing the
 * character small or off-centre.
 */
export interface Point {
  x: number;
  y: number;
}

export interface DrawingGrade {
  /** Per expected stroke (in order): did the learner's stroke with the same index match it? */
  strokeOk: boolean[];
  expected: number;
  drawn: number;
  /** 0..1 */
  score: number;
  passed: boolean;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Reference medians in screen space (y down). */
export const mediansToScreen = (medians: number[][][]): Point[][] => medians.map((m) => m.map(([x, y]) => ({ x, y: 900 - y })));

function length(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** Resamples a polyline to `n` evenly spaced points. */
export function resample(points: Point[], n = 16): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: n }, () => points[0]);
  const step = length(points) / (n - 1) || 1;
  const out: Point[] = [points[0]];
  let carried = 0;
  for (let i = 1; i < points.length && out.length < n; i++) {
    let a = points[i - 1];
    const b = points[i];
    let segment = dist(a, b);
    while (carried + segment >= step && out.length < n) {
      const t = (step - carried) / segment;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      segment = dist(a, b);
      carried = 0;
    }
    carried += segment;
  }
  while (out.length < n) out.push(points[points.length - 1]);
  return out;
}

function bounds(strokes: Point[][]) {
  const all = strokes.flat();
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Fits the learner's strokes into the reference bounding box (uniform scale, centred). */
export function normalise(user: Point[][], reference: Point[][]): Point[][] {
  const u = bounds(user);
  const r = bounds(reference);
  const uw = Math.max(u.maxX - u.minX, 1);
  const uh = Math.max(u.maxY - u.minY, 1);
  const scale = Math.min((r.maxX - r.minX || 1) / uw, (r.maxY - r.minY || 1) / uh);
  // Very thin shapes (一) would explode in one axis: cap the scale.
  const s = Math.min(scale, 4);
  const ucx = (u.minX + u.maxX) / 2;
  const ucy = (u.minY + u.maxY) / 2;
  const rcx = (r.minX + r.maxX) / 2;
  const rcy = (r.minY + r.maxY) / 2;
  return user.map((stroke) => stroke.map((p) => ({ x: rcx + (p.x - ucx) * s, y: rcy + (p.y - ucy) * s })));
}

/** Does one drawn stroke match one reference median (position, direction, shape)? */
export function strokeMatches(drawn: Point[], median: Point[]): boolean {
  if (drawn.length < 2) return false;
  const a = resample(drawn);
  const b = resample(median);
  const startOk = dist(a[0], b[0]) < 260;
  const endOk = dist(a[a.length - 1], b[b.length - 1]) < 260;
  const avg = a.reduce((sum, p, i) => sum + dist(p, b[i]), 0) / a.length;
  const da = { x: a[a.length - 1].x - a[0].x, y: a[a.length - 1].y - a[0].y };
  const db = { x: b[b.length - 1].x - b[0].x, y: b[b.length - 1].y - b[0].y };
  const cos = (da.x * db.x + da.y * db.y) / ((Math.hypot(da.x, da.y) || 1) * (Math.hypot(db.x, db.y) || 1));
  const ratio = length(a) / (length(b) || 1);
  return startOk && endOk && avg < 200 && cos > 0.3 && ratio > 0.35 && ratio < 2.8;
}

/** Grades a whole character drawn in a square canvas of `size` px. */
export function gradeDrawing(strokesPx: Point[][], size: number, medians: number[][][]): DrawingGrade {
  const reference = mediansToScreen(medians);
  const expected = reference.length;
  const drawn = strokesPx.filter((s) => s.length > 1);
  if (drawn.length === 0) return { strokeOk: reference.map(() => false), expected, drawn: 0, score: 0, passed: false };
  const scaled = drawn.map((s) => s.map((p) => ({ x: (p.x / size) * 1024, y: (p.y / size) * 1024 })));
  const user = normalise(scaled, reference);
  const strokeOk = reference.map((median, i) => !!user[i] && strokeMatches(user[i], median));
  const score = strokeOk.filter(Boolean).length / Math.max(expected, drawn.length);
  return { strokeOk, expected, drawn: drawn.length, score, passed: score >= 0.75 };
}
