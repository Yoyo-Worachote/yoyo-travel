const R = 6371; // km

/** Great-circle distance in km between [lat, lng] points. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bangkok centroid used for "distance from Bangkok" estimates. */
export const BANGKOK: [number, number] = [13.7563, 100.5018];

/**
 * Order stops with a greedy nearest-neighbour walk from the first stop.
 * Uses straight-line distance only (no road network), so the UI must call it
 * an approximate order.
 */
export function orderByNearest<T extends { lat: number; lng: number }>(stops: T[]): T[] {
  if (stops.length <= 2) return [...stops];
  const remaining = [...stops];
  const out = [remaining.shift()!];
  while (remaining.length) {
    const last = out[out.length - 1];
    let bestIdx = 0;
    let best = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineKm([last.lat, last.lng], [s.lat, s.lng]);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    });
    out.push(remaining.splice(bestIdx, 1)[0]);
  }
  return out;
}

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function osmUrl(lat: number, lng: number, zoom = 16): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
