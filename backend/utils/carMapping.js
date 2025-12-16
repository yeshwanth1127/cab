/**
 * Utility functions for mapping cars to subtypes
 * Ensures consistent mapping across the application
 */

/**
 * Maps a car name and description to its subtype
 * @param {string} name - Car name (e.g., "Etios", "Honda City")
 * @param {string} description - Car description
 * @returns {string|null} - Subtype: Sedan, SUV, Innova, Innova Crysta, Tempo, Urbenia, Minibus
 */
const mapCarToSubtype = (name, description) => {
  if (!name) return null;
  const carName = name.toLowerCase().trim();
  const desc = (description || '').toLowerCase();
  
  // Map specific car names to subtypes
  if (carName.includes('honda city') || carName.includes('ciaz')) {
    return 'Sedan';
  }
  if (carName.includes('etios') || carName.includes('dzire')) {
    return 'Sedan'; // Entry-level sedans map to Sedan
  }
  if (carName.includes('ertiga') || carName.includes('marazzo') || carName.includes('rumion')) {
    return 'SUV';
  }
  if (carName === 'innova' || (carName.includes('innova') && !carName.includes('crysta'))) {
    return 'Innova';
  }
  if (carName.includes('crysta')) {
    return 'Innova Crysta';
  }
  if (carName.includes('tempo')) {
    return 'Tempo';
  }
  if (carName.includes('urbenia')) {
    return 'Urbenia';
  }
  if (carName.includes('minibus')) {
    return 'Minibus';
  }
  
  // Fallback to description-based mapping
  if (desc.includes('sedan')) {
    return 'Sedan';
  }
  if (desc.includes('suv')) {
    return 'SUV';
  }
  if (desc.includes('innova crysta') || desc.includes('crysta')) {
    return 'Innova Crysta';
  }
  if (desc.includes('innova')) {
    return 'Innova';
  }
  if (desc.includes('tempo')) {
    return 'Tempo';
  }
  if (desc.includes('urbenia')) {
    return 'Urbenia';
  }
  if (desc.includes('minibus')) {
    return 'Minibus';
  }
  
  return null;
};

/**
 * Gets the car category used for rate meter lookup.
 * We now treat each CAR as its own "category":
 *  - Prefer the car's name (so rates are per car),
 *  - Fallback to subtype mapping only if name is missing.
 */
const getCarCategory = (carOption) => {
  if (!carOption) return 'Sedan';

  // Primary: use the specific car name so each car can have its own rate
  if (carOption.name) {
    return carOption.name;
  }

  // Fallbacks: keep existing subtype logic as backup
  if (carOption.car_subtype) {
    return carOption.car_subtype;
  }
  
  const mapped = mapCarToSubtype(carOption.name, carOption.description);
  return mapped || 'Sedan';
};

module.exports = {
  mapCarToSubtype,
  getCarCategory,
};

