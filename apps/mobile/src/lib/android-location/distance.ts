/**
 * Haversine distance calculation between two geographic coordinates.
 * Returns distance in meters.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two points on Earth
 * using the haversine formula.
 *
 * @param coord1 - First coordinate (latitude, longitude in degrees)
 * @param coord2 - Second coordinate (latitude, longitude in degrees)
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);

  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}
