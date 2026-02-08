
export function getRouteDistance(origin, destination) {
  if (!window.google?.maps?.DistanceMatrixService) {
    return Promise.reject(new Error('Google Maps DistanceMatrixService not loaded'));
  }
  const service = new window.google.maps.DistanceMatrixService();
  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins: [new window.google.maps.LatLng(origin.lat, origin.lng)],
        destinations: [new window.google.maps.LatLng(destination.lat, destination.lng)],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status !== window.google.maps.DistanceMatrixStatus.OK) {
          reject(new Error(status || 'Distance Matrix request failed'));
          return;
        }
        const element = response?.rows?.[0]?.elements?.[0];
        if (!element || element.status !== 'OK') {
          reject(new Error(element?.status === 'ZERO_RESULTS' ? 'No route found' : 'Could not get distance'));
          return;
        }
        const distanceMeters = element.distance?.value ?? 0;
        const durationSeconds = element.duration?.value ?? 0;
        resolve({
          distance_km: Math.round((distanceMeters / 1000) * 100) / 100,
          duration_minutes: Math.round(durationSeconds / 60),
        });
      }
    );
  });
}

export function getMultiLegDistance(waypoints) {
  if (!waypoints || waypoints.length < 2) {
    return Promise.reject(new Error('At least 2 waypoints required'));
  }
  const legs = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    legs.push({ origin: waypoints[i], destination: waypoints[i + 1] });
  }
  return Promise.all(legs.map(({ origin, destination }) => getRouteDistance(origin, destination))).then(
    (results) => ({
      distance_km: Math.round(results.reduce((sum, r) => sum + r.distance_km, 0) * 100) / 100,
      duration_minutes: results.reduce((sum, r) => sum + r.duration_minutes, 0),
    })
  );
}
