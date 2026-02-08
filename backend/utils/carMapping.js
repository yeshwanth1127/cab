
const mapCarToSubtype = (name, description) => {
  if (!name) return null;
  const carName = name.toLowerCase().trim();
  const desc = (description || '').toLowerCase();
  

  if (carName.includes('honda city') || carName.includes('ciaz')) {
    return 'Sedan';
  }
  if (carName.includes('etios') || carName.includes('dzire')) {
    return 'Sedan';
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

const getCarCategory = (carOption) => {
  if (!carOption) return 'Sedan';

  if (carOption.name) {
    return carOption.name;
  }

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
