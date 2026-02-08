
export const searchAddresses = async (query, userLocation = null) => {
  return [];

};

export const validateAddress = async (placeId, eLoc = null) => {
  throw new Error('Use Google only: /api/places/details');

};

export const reverseGeocode = async (lat, lng) => {
  throw new Error('Use Google only: /api/places/reverse');

};
