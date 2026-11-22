// Original circuit layouts for the live track map. Each layout is a list of
// control points smoothed into a closed loop. None of them copies a real circuit.

export interface Point { x: number; y: number }

export interface TrackGeometry {
  name: string;
  path: string; // SVG path of the racing line
  samples: Point[];
  lengths: number[]; // cumulative length at each sample, 0..1
  pointAt: (fraction: number) => Point;
  angleAt: (fraction: number) => number; // degrees, direction of travel
}

export const TRACK_VIEWBOX = { width: 1000, height: 700 };

const LAYOUTS: Record<string, [number, number][]> = {
  'Port Avalon Street Circuit': [[120, 560], [420, 590], [560, 560], [600, 470], [700, 450], [880, 470], [900, 380], [780, 300], [800, 180], [700, 110], [560, 140], [520, 250], [400, 260], [330, 160], [200, 130], [110, 220], [150, 340], [90, 450]],
  'Highveld Ring': [[150, 500], [300, 600], [520, 610], [700, 560], [860, 600], [930, 480], [860, 360], [700, 330], [640, 220], [760, 140], [640, 80], [440, 110], [360, 220], [250, 200], [140, 290], [100, 400]],
  'Mistral Bay Autodrome': [[150, 350], [180, 150], [420, 90], [700, 90], [880, 170], [900, 330], [780, 420], [620, 400], [560, 480], [700, 560], [560, 620], [300, 600], [160, 520]],
  'Frostholm Raceway': [[100, 600], [800, 620], [900, 560], [860, 480], [560, 460], [520, 380], [860, 330], [900, 250], [820, 170], [500, 180], [420, 90], [220, 80], [150, 180], [260, 280], [160, 380], [90, 480]],
  'Saffron Hills Circuit': [[140, 620], [380, 600], [460, 520], [600, 560], [760, 620], [900, 540], [860, 420], [720, 400], [760, 300], [900, 240], [840, 110], [640, 100], [560, 200], [420, 160], [300, 90], [160, 140], [220, 260], [120, 360], [200, 460], [110, 540]],
  'Coral Coast Speedway': [[500, 620], [820, 560], [920, 380], [820, 160], [500, 90], [180, 160], [80, 380], [180, 560]],
  'Kestrel Downs Park': [[120, 520], [260, 620], [480, 600], [560, 520], [700, 580], [880, 520], [880, 400], [740, 360], [860, 250], [800, 130], [600, 140], [480, 240], [360, 180], [260, 90], [130, 160], [180, 300], [100, 400]],
  'Lanternport Harbour Circuit': [[100, 580], [600, 610], [760, 540], [920, 560], [900, 420], [720, 420], [680, 320], [880, 240], [880, 120], [560, 100], [520, 200], [360, 210], [300, 110], [140, 130], [120, 260], [240, 330], [240, 440], [110, 470]],
};

const MOTOR_SPORTS = new Set(['f1', 'motogp', 'indycar']);

export function hasTrackMap(sportId: string): boolean {
  return MOTOR_SPORTS.has(sportId);
}

/** Closed Catmull-Rom spline through the control points. */
function smooth(points: [number, number][], perSegment = 24): Point[] {
  const n = points.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  return out;
}

const cache = new Map<string, TrackGeometry>();

export function trackFor(circuitName: string): TrackGeometry {
  const key = LAYOUTS[circuitName] ? circuitName : Object.keys(LAYOUTS)[0];
  const hit = cache.get(key);
  if (hit) return hit;
  const samples = smooth(LAYOUTS[key]);
  const raw: number[] = [0];
  for (let i = 1; i <= samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i % samples.length];
    raw.push(raw[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = raw[raw.length - 1];
  const lengths = raw.map((l) => l / total);
  const path = `M ${samples.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`;

  const locate = (fraction: number) => {
    const f = ((fraction % 1) + 1) % 1;
    let lo = 0;
    let hi = lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] <= f) lo = mid; else hi = mid;
    }
    const a = samples[lo % samples.length];
    const b = samples[(lo + 1) % samples.length];
    const span = lengths[lo + 1] - lengths[lo] || 1;
    return { a, b, t: (f - lengths[lo]) / span };
  };
  const geometry: TrackGeometry = {
    name: key,
    path,
    samples,
    lengths,
    pointAt: (fraction) => {
      const { a, b, t } = locate(fraction);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    },
    angleAt: (fraction) => {
      const { a, b } = locate(fraction);
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    },
  };
  cache.set(key, geometry);
  return geometry;
}
