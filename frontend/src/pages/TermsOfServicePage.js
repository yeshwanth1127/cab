import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MainNavbar from '../components/MainNavbar';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import Icon from '../components/Icon';
import './BookingPage.css';
import './LegalPage.css';

const TermsOfServicePage = () => {
  const lastUpdated = 'February 2025';
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const fromState = location.state?.fromState;

  const handleBack = () => {
    if (from) {
      navigate(from, { state: fromState });
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  return (
    <div className="booking-page legal-page">
      <MainNavbar />
      <div className="booking-map-wrapper">
        <AnimatedMapBackground />
      </div>

      <section className="home-section legal-section">
        <div className="home-section-inner legal-inner">
          <div className="legal-top-actions">
            <button type="button" className="legal-back-btn" onClick={handleBack}>
              ← Back to booking
            </button>
          </div>
          <h1 className="legal-title">
            <Icon name="document" size={32} className="legal-title-icon" />
            Terms of Service
          </h1>
          <p className="legal-updated">Last updated: {lastUpdated}</p>

          <div className="legal-content">
            <p className="legal-intro">
              Welcome to <strong>Namma Cabs</strong>. By accessing or using our website nammacabs.com and our cab
              booking services (local, airport, outstation, corporate, and events) in and around Bangalore, you agree
              to be bound by these Terms of Service. Please read them carefully.
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By creating an account, making a booking, or using our website and services, you accept these Terms of
              Service and our <Link to="/privacy-policy">Privacy Policy</Link>. If you do not agree, please do not use our
              services.
            </p>

            <h2>2. Services Offered</h2>
            <p>
              Namma Cabs provides cab and chauffeur-driven vehicle services including local trips, airport transfers,
              outstation trips, corporate travel, and event transportation. Services are subject to availability,
              vehicle type, and the terms communicated at the time of booking (including fare, route, and cancellation
              policy).
            </p>

            <h2>3. Bookings and Payment</h2>
            <ul>
              <li>You must provide accurate pick-up and drop details, contact information, and any special requests at the time of booking.</li>
              <li>Fares quoted are as per our rate structure and may vary for outstation or custom routes; the final amount will be as confirmed in your booking or invoice.</li>
              <li>Payment terms (advance, on-trip, or post-trip) will be as specified for your booking type (e.g. corporate invoicing, event advance).</li>
              <li>You are responsible for any tolls, parking, or additional charges as communicated by the driver or our team.</li>
            </ul>

            <h2>4. Cancellation and Refunds</h2>
            <p>
              Cancellation and refund policies depend on the type of booking (local, airport, outstation, corporate,
              events). We will communicate the applicable cancellation policy at the time of booking or in your
              confirmation. Refunds, if applicable, will be processed as per our policy and within a reasonable time.
            </p>

            <h2>5. User Conduct</h2>
            <p>You agree to:</p>
            <ul>
              <li>Use our services only for lawful purposes and in accordance with these terms.</li>
              <li>Provide correct information and not impersonate any person or entity.</li>
              <li>Treat drivers and staff with respect; we reserve the right to refuse or terminate service in case of misconduct.</li>
              <li>Not use our platform for any fraudulent or illegal activity.</li>
            </ul>

            <h2>6. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Namma Cabs shall not be liable for any indirect, incidental,
              special, or consequential damages arising from your use of our services, including but not limited to
              delays, route changes, vehicle breakdowns, or acts of third parties. Our liability for direct loss related
              to a specific booking will be limited as per applicable law and the terms of that booking.
            </p>

            <h2>7. Intellectual Property</h2>
            <p>
              The Namma Cabs name, logo, website design, and content are our property. You may not copy, modify, or use
              them without our prior written consent.
            </p>

            <h2>8. Third-Party Links and Services</h2>
            <p>
              Our website may contain links to third-party sites or integrate third-party services (e.g. maps,
              payment). We are not responsible for their content or practices; your use of them is at your own risk.
            </p>

            <h2>9. Changes to Terms</h2>
            <p>
              We may update these Terms of Service from time to time. The &quot;Last updated&quot; date at the top will
              reflect the latest version. Continued use of our services after changes constitutes acceptance of the
              updated terms. Material changes may be communicated via email or a notice on our website.
            </p>

            <h2>10. Governing Law and Disputes</h2>
            <p>
              These terms are governed by the laws of India. Any disputes shall be subject to the exclusive
              jurisdiction of the courts in Bangalore, Karnataka.
            </p>

            <h2>11. Contact</h2>
            <p>
              For questions about these Terms of Service, contact us at{' '}
              <a href="mailto:nammacabs.2022@gmail.com">nammacabs.2022@gmail.com</a> or visit our{' '}
              <Link to="/contact">Contact</Link> page.
            </p>
          </div>

          <div className="legal-footer-links">
            <Link to="/privacy-policy" className="legal-link">Privacy Policy</Link>
            <span className="legal-sep">·</span>
            <Link to="/contact" className="legal-link">Contact</Link>
            <span className="legal-sep">·</span>
            <Link to="/" className="legal-link">Home</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TermsOfServicePage;
