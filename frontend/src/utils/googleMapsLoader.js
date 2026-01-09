let googleMapsPromise;

export function loadGoogleMaps(apiKey) {
  // 1️⃣ If already loaded, resolve immediately
  if (window.google?.maps) {
    return Promise.resolve();
  }

  // 2️⃣ If loading is already in progress, return same promise
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  // 3️⃣ LOCK immediately (this prevents race condition)
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
      googleMapsPromise = null; // allow retry if failed
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

