let googleMapsPromise;

export function loadGoogleMaps(apiKey) {

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;

    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.maps) {
        resolve();
      } else {
        reject(new Error('Google Maps loaded but API unavailable'));
      }
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
