import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const MainNavbar = () => {
  const { user, logout } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const closeMenu = () => setMenuOpen(false);

  const navbarClass = `navbar${hidden ? ' navbar--hidden' : ''}`;
  const linksClass = `nav-links${menuOpen ? ' nav-links--open' : ''}`;

  return (
    <nav className={navbarClass}>
      <div className="container nav-inner">
        <div />
        <button
          className={`nav-toggle${menuOpen ? ' nav-toggle--open' : ''}`}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
        >
          <span />
          <span />
          <span />
        </button>
        <div className={linksClass}>
          <a href="/" className="nav-link" onClick={closeMenu}>Home</a>
          <a href="/about" className="nav-link" onClick={closeMenu}>About Us</a>
          <a href="/contact" className="nav-link" onClick={closeMenu}>Contact</a>
          <a href="/car-options" className="nav-link" onClick={closeMenu}>Car Options</a>
          <a href="/check-booking" className="nav-link" onClick={closeMenu}>Check Booking</a>
          {user ? (
            <>
              <a
                href={user.role === 'admin' ? '/admin' : '/account'}
                className="nav-link"
                title={user.role === 'admin' ? 'Admin Dashboard' : 'My Account'}
                onClick={closeMenu}
              >
                👤 {user.username}
              </a>
              <button
                type="button"
                onClick={() => { logout(); closeMenu(); }}
                className="admin-link nav-logout-button"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="nav-link" onClick={closeMenu}>Login</a>
              <a href="/admin/login" className="admin-link" onClick={closeMenu}>Admin</a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default MainNavbar;

