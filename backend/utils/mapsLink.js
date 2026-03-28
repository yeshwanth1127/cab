
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
