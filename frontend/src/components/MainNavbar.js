import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { gsap } from 'gsap';

const MainNavbar = ({ logoOnly = false }) => {
  const { user, logout } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  
  const circleRefs = useRef([]);
  const tlRefs = useRef([]);
  const activeTweenRefs = useRef([]);
  const logoTextRef = useRef(null);
  const logoTweenRef = useRef(null);
  const ease = 'power3.easeOut';

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

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, i) => {
        if (!circle?.parentElement) return;
        const pill = circle.parentElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`
        });

        const label = pill.querySelector('.pill-label');
        const white = pill.querySelector('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        tlRefs.current[i]?.kill();

        const tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);
        
        if (label) {
          tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        }
        
        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        }

        tlRefs.current[i] = tl;
      });
    };

    layout();
    
    // Throttle resize handler for performance
    let resizeTimeout;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        layout();
      }, 150);
    };
    
    window.addEventListener('resize', onResize, { passive: true });
    
    if (document.fonts?.ready) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  const handleEnter = (i) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLeave = (i) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLogoEnter = () => {
    const logo = logoTextRef.current;
    if (!logo) return;
    logoTweenRef.current?.kill();
    gsap.set(logo, { scale: 1 });
    logoTweenRef.current = gsap.to(logo, {
      scale: 1.1,
      duration: 0.2,
      ease,
      overwrite: 'auto'
    });
  };

  const closeMenu = () => setMenuOpen(false);

  const navbarClass = `navbar${hidden ? ' navbar--hidden' : ''}`;
  const linksClass = `nav-links${menuOpen ? ' nav-links--open' : ''}`;

  // Build nav items array (skip when logoOnly)
  const navItems = logoOnly
    ? []
    : [
        { label: 'Home', href: '/' },
        { label: 'About Us', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Events', href: '/events', hasDropdown: true },
        { label: 'Check Booking', href: '/check-booking' },
      ];

  if (!logoOnly) {
    if (user) {
      navItems.push({
        label: `👤 ${user.username}`,
        href: user.role === 'admin' ? '/admin' : '/account'
      });
      navItems.push({
        label: 'Logout',
        href: '#',
        onClick: () => { logout(); closeMenu(); },
        isButton: true
      });
    } else {
      navItems.push({ label: 'Login', href: '/login' });
      navItems.push({ label: 'Admin', href: '/admin/login' });
    }
  }

  return (
    <nav className={navbarClass}>
      <div className="container nav-inner">
        <a 
          href="/" 
          className="navbar-logo" 
          aria-label="Namma Cabs home"
          onMouseEnter={handleLogoEnter}
        >
          <img 
            src="/nammacabs-logo.png" 
            alt="Namma Cabs" 
            style={{ 
              height: '140px', 
              width: 'auto',
              objectFit: 'contain',
              marginRight: '10px'
            }}
          />
          <span className="logo-text" ref={logoTextRef} style={{ display: 'none' }}>
            <span className="logo-namma">namma</span>
            <span className="logo-cabs">cabs</span>
          </span>
        </a>
        {!logoOnly && (
          <>
            <button
              className={`nav-toggle${menuOpen ? ' nav-toggle--open' : ''}`}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle menu"
            >
              <span />
              <span />
              <span />
            </button>
            <div className={linksClass}>
              <ul className="pill-list">
                {navItems.map((item, i) => (
                  <React.Fragment key={item.href || `item-${i}`}>
                    {i > 0 && (
                      <li className="nav-separator-wrapper">
                        <span className="nav-separator" />
                      </li>
                    )}
                    <li style={{ position: 'relative' }}>
                      {item.hasDropdown ? (
                        <div
                          style={{ position: 'relative' }}
                          onMouseEnter={() => setEventsDropdownOpen(true)}
                          onMouseLeave={() => setEventsDropdownOpen(false)}
                        >
                          <a
                            href={item.href}
                            className="pill"
                            onClick={(e) => {
                              e.preventDefault();
                              setEventsDropdownOpen(!eventsDropdownOpen);
                            }}
                            onMouseEnter={() => handleEnter(i)}
                            onMouseLeave={() => handleLeave(i)}
                          >
                            <span
                              className="hover-circle"
                              aria-hidden="true"
                              ref={el => { circleRefs.current[i] = el; }}
                            />
                            <span className="label-stack">
                              <span className="pill-label">{item.label} ▼</span>
                              <span className="pill-label-hover" aria-hidden="true">
                                {item.label} ▼
                              </span>
                            </span>
                          </a>
                          {eventsDropdownOpen && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '8px',
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                minWidth: '180px',
                                zIndex: 1000,
                                padding: '8px 0'
                              }}
                            >
                              <a
                                href="/events?type=weddings"
                                onClick={closeMenu}
                                style={{
                                  display: 'block',
                                  padding: '12px 20px',
                                  color: '#333',
                                  textDecoration: 'none',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                              >
                                💒 Weddings
                              </a>
                              <a
                                href="/events?type=birthdays"
                                onClick={closeMenu}
                                style={{
                                  display: 'block',
                                  padding: '12px 20px',
                                  color: '#333',
                                  textDecoration: 'none',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                              >
                                🎂 Birthdays
                              </a>
                              <a
                                href="/events?type=others"
                                onClick={closeMenu}
                                style={{
                                  display: 'block',
                                  padding: '12px 20px',
                                  color: '#333',
                                  textDecoration: 'none',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                              >
                                🎉 Others
                              </a>
                            </div>
                          )}
                        </div>
                      ) : item.isButton ? (
                        <button
                          type="button"
                          className="pill nav-pill-button"
                          onClick={item.onClick}
                          onMouseEnter={() => handleEnter(i)}
                          onMouseLeave={() => handleLeave(i)}
                        >
                          <span
                            className="hover-circle"
                            aria-hidden="true"
                            ref={el => { circleRefs.current[i] = el; }}
                          />
                          <span className="label-stack">
                            <span className="pill-label">{item.label}</span>
                            <span className="pill-label-hover" aria-hidden="true">
                              {item.label}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <a
                          href={item.href}
                          className="pill"
                          onClick={closeMenu}
                          onMouseEnter={() => handleEnter(i)}
                          onMouseLeave={() => handleLeave(i)}
                        >
                          <span
                            className="hover-circle"
                            aria-hidden="true"
                            ref={el => { circleRefs.current[i] = el; }}
                          />
                          <span className="label-stack">
                            <span className="pill-label">{item.label}</span>
                            <span className="pill-label-hover" aria-hidden="true">
                              {item.label}
                            </span>
                          </span>
                        </a>
                      )}
                    </li>
                  </React.Fragment>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default MainNavbar;

