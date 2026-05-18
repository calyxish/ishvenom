import { describe, expect, it } from 'vitest';
import { truncateCoordinate } from './geo.js';

describe('truncateCoordinate', () => {
  it('rounds to 2 decimals (~1.1 km precision)', () => {
    const result = truncateCoordinate({
      latitude: 5.614817,
      longitude: -0.205874,
    });
    expect(result.latitude).toBe(5.61);
    expect(result.longitude).toBe(-0.21);
  });

  it('handles zero coordinates', () => {
    expect(truncateCoordinate({ latitude: 0, longitude: 0 })).toEqual({
      latitude: 0,
      longitude: 0,
    });
  });

  it('handles edge-of-range coordinates', () => {
    const result = truncateCoordinate({
      latitude: -89.999,
      longitude: 179.999,
    });
    expect(result.latitude).toBeCloseTo(-90.0, 2);
    expect(result.longitude).toBeCloseTo(180.0, 2);
  });

  it('produces coordinates that cannot identify a household', () => {
    // Two households 50 m apart should round to the same cell.
    // At the equator, 0.0005° lat ≈ 55 m.
    const a = truncateCoordinate({ latitude: 5.6108, longitude: -0.2058 });
    const b = truncateCoordinate({ latitude: 5.6113, longitude: -0.2053 });
    expect(a).toEqual(b);
  });
});
