import React, { useEffect, useState } from 'react';

const CornerLogo = () => {
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showImage, setShowImage] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY || window.pageYOffset || 0;
      const goingDown = currentY > lastScrollY;
      const isPastThreshold = currentY > 80;

      if (goingDown && isPastThreshold) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      setLastScrollY(currentY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const className = `corner-logo${hidden ? ' corner-logo--hidden' : ''}`;

  return (
    <a href="/" className={className} aria-label="Namma Cabs home">
      {showImage ? (
        <img
          src="/logo.png"
          alt="Namma Cabs"
          className="corner-logo__img"
          onError={() => setShowImage(false)}
        />
      ) : (
        <span className="logo-text">
          <span className="logo-namma">namma</span>
          <span className="logo-cabs">cabs</span>
        </span>
      )}
    </a>
  );
};

export default CornerLogo;


