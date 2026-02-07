/**
 * Build a single-location Google Maps search URL (pickup or drop point).
 * Uses coordinates when available for accuracy; URL-encodes the value.
 * @param {string|null} address - Text address (from_location or to_location)
 * @param {number|null} lat - Latitude
 * @param {number|null} lng - Longitude
 * @returns {string|null} Google Maps search URL or null
 */
function buildLocationSearchUrl(address, lat, lng) {
  if (lat != null && lng != null) {
    const la = Number(lat);
    const ln = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      const point = `${la},${ln}`;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`;
    }
  }
  if (address && String(address).trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address).trim())}`;
  }
  return null;
}

/**
 * Generate map link(s) for a booking by service type:
 * - Local: pickup location link only.
 * - Airport: pickup location link + drop location link.
 * - Outstation: pickup location link only.
 * @param {Object} booking - { service_type, from_location, to_location, pickup_lat, pickup_lng, destination_lat, destination_lng }
 * @returns {{ pickup: string|null, drop: string|null }}
 */
function generateGoogleMapsLink(booking) {
  const serviceType = (booking.service_type || 'local').toLowerCase();
  const pickupUrl = buildLocationSearchUrl(
    booking.from_location,
    booking.pickup_lat,
    booking.pickup_lng
  );
  let dropUrl = null;
  if (serviceType === 'airport') {
    dropUrl = buildLocationSearchUrl(
      booking.to_location,
      booking.destination_lat,
      booking.destination_lng
    );
  }
  return { pickup: pickupUrl, drop: dropUrl };
}

module.exports = { generateGoogleMapsLink, buildLocationSearchUrl };
