import { calculateDistance, type Coordinate } from './distance';

describe('calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    const coord: Coordinate = { latitude: 40.7128, longitude: -74.006 };
    expect(calculateDistance(coord, coord)).toBe(0);
  });

  it('calculates distance between New York and Los Angeles (~3,944 km)', () => {
    const nyc: Coordinate = { latitude: 40.7128, longitude: -74.006 };
    const la: Coordinate = { latitude: 34.0522, longitude: -118.2437 };
    const distance = calculateDistance(nyc, la);
    // Known distance is approximately 3,944 km
    expect(distance).toBeGreaterThan(3_930_000);
    expect(distance).toBeLessThan(3_960_000);
  });

  it('calculates distance between London and Paris (~343 km)', () => {
    const london: Coordinate = { latitude: 51.5074, longitude: -0.1278 };
    const paris: Coordinate = { latitude: 48.8566, longitude: 2.3522 };
    const distance = calculateDistance(london, paris);
    // Known distance is approximately 343 km
    expect(distance).toBeGreaterThan(340_000);
    expect(distance).toBeLessThan(346_000);
  });

  it('calculates short walking distance (~100 meters)', () => {
    // Two points approximately 100 meters apart on the same street
    const start: Coordinate = { latitude: 40.748817, longitude: -73.985428 };
    const end: Coordinate = { latitude: 40.749717, longitude: -73.985428 };
    const distance = calculateDistance(start, end);
    // ~100 meters (1 degree latitude ≈ 111km, so 0.0009 deg ≈ 100m)
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(110);
  });

  it('calculates distance across the equator', () => {
    const north: Coordinate = { latitude: 1, longitude: 0 };
    const south: Coordinate = { latitude: -1, longitude: 0 };
    const distance = calculateDistance(north, south);
    // 2 degrees of latitude ≈ 222 km
    expect(distance).toBeGreaterThan(220_000);
    expect(distance).toBeLessThan(224_000);
  });

  it('calculates distance across the antimeridian (date line)', () => {
    const west: Coordinate = { latitude: 0, longitude: 179 };
    const east: Coordinate = { latitude: 0, longitude: -179 };
    const distance = calculateDistance(west, east);
    // 2 degrees of longitude at equator ≈ 222 km
    expect(distance).toBeGreaterThan(220_000);
    expect(distance).toBeLessThan(224_000);
  });

  it('is symmetric (distance A->B equals B->A)', () => {
    const a: Coordinate = { latitude: 37.7749, longitude: -122.4194 };
    const b: Coordinate = { latitude: 34.0522, longitude: -118.2437 };
    expect(calculateDistance(a, b)).toBe(calculateDistance(b, a));
  });

  it('handles GPS drift distances (<10 meters)', () => {
    // Two points very close together (simulating GPS drift)
    const point1: Coordinate = { latitude: 40.748817, longitude: -73.985428 };
    const point2: Coordinate = { latitude: 40.748827, longitude: -73.985438 };
    const distance = calculateDistance(point1, point2);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(10);
  });

  it('handles poles correctly', () => {
    const northPole: Coordinate = { latitude: 90, longitude: 0 };
    const southPole: Coordinate = { latitude: -90, longitude: 0 };
    const distance = calculateDistance(northPole, southPole);
    // Half the Earth's circumference ≈ 20,015 km
    expect(distance).toBeGreaterThan(20_000_000);
    expect(distance).toBeLessThan(20_040_000);
  });
});
