import {
  haversineMeters,
  nearestCenter,
  topNearest,
  truncateForSync,
  formatDistance,
} from '../lib/geo';

describe('haversineMeters', () => {
  test('returns 0 for identical points', () => {
    const p = { latitude: 5.6037, longitude: -0.187 }; // Accra
    expect(haversineMeters(p, p)).toBeCloseTo(0, 1);
  });

  test('Accra to Kumasi is roughly 200 km', () => {
    const accra = { latitude: 5.6037, longitude: -0.187 };
    const kumasi = { latitude: 6.6885, longitude: -1.6244 };
    const d = haversineMeters(accra, kumasi);
    expect(d).toBeGreaterThan(190_000);
    expect(d).toBeLessThan(220_000);
  });

  test('is symmetric', () => {
    const a = { latitude: 9.0, longitude: 8.6 };
    const b = { latitude: 6.45, longitude: 3.39 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 3);
  });
});

describe('nearestCenter', () => {
  const centers = [
    { id: '1', name: 'Accra', country: 'GH', latitude: 5.6037, longitude: -0.187 },
    { id: '2', name: 'Kumasi', country: 'GH', latitude: 6.6885, longitude: -1.6244 },
    { id: '3', name: 'Lagos', country: 'NG', latitude: 6.5244, longitude: 3.3792 },
  ];

  test('returns null when list is empty', () => {
    expect(nearestCenter({ latitude: 0, longitude: 0 }, [])).toBeNull();
  });

  test('picks the closest by haversine', () => {
    const near = nearestCenter({ latitude: 6.0, longitude: -0.5 }, centers);
    expect(near?.id).toBe('1');
    expect(near?.distanceMeters).toBeGreaterThan(0);
  });

  test('picks Kumasi when the user is in the Ashanti region', () => {
    const near = nearestCenter({ latitude: 6.7, longitude: -1.6 }, centers);
    expect(near?.id).toBe('2');
  });
});

describe('topNearest', () => {
  const centers = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    name: `C${i}`,
    country: 'GH',
    latitude: 5.6 + i * 0.1,
    longitude: -0.187,
  }));

  test('returns at most N centers sorted ascending by distance', () => {
    const res = topNearest({ latitude: 5.6, longitude: -0.187 }, centers, 3);
    expect(res).toHaveLength(3);
    expect(res[0]!.distanceMeters).toBeLessThanOrEqual(res[1]!.distanceMeters);
    expect(res[1]!.distanceMeters).toBeLessThanOrEqual(res[2]!.distanceMeters);
  });

  test('N = 0 returns empty array', () => {
    expect(topNearest({ latitude: 0, longitude: 0 }, centers, 0)).toEqual([]);
  });
});

describe('truncateForSync', () => {
  test('rounds to 2 decimal places (~1.1km precision)', () => {
    const t = truncateForSync({ latitude: 5.60378, longitude: -0.18701 });
    expect(t.latitude).toBe(5.6);
    expect(t.longitude).toBe(-0.19);
  });

  test('two users within ~1km collapse to the same coordinate', () => {
    const a = truncateForSync({ latitude: 5.6042, longitude: -0.1872 });
    const b = truncateForSync({ latitude: 5.6048, longitude: -0.1868 });
    expect(a).toEqual(b);
  });
});

describe('formatDistance', () => {
  test('meters under 1km', () => {
    expect(formatDistance(432)).toBe('432 m');
  });
  test('km one decimal between 1 and 10', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });
  test('km rounded above 10', () => {
    expect(formatDistance(15_432)).toBe('15 km');
  });
});
