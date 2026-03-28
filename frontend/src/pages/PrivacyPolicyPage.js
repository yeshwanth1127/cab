import React from 'react';
import { Link } from 'react-router-dom';
import MainNavbar from '../components/MainNavbar';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import Icon from '../components/Icon';
import './BookingPage.css';
import './LegalPage.css';

const PrivacyPolicyPage = () => {
  const lastUpdated = 'February 2025';

  return (
    <div className="booking-page legal-page">
      <MainNavbar />
      <div className="booking-map-wrapper">
        <AnimatedMapBackground />
      </div>

      <section className="home-section legal-section">
        <div className="home-section-inner legal-inner">
          <h1 className="legal-title">
            <Icon name="shield" size={32} className="legal-title-icon" />
            Privacy Policy
          </h1>
          <p className="legal-updated">Last updated: {lastUpdated}</p>

          <div className="legal-content">
            <p className="legal-intro">
              <strong>Namma Cabs</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
              website nammacabs.com and our cab booking services in and around Bangalore.
            </p>

            <h2>1. Information We Collect</h2>
            <p>We may collect the following types of information:</p>
            <ul>
              <li><strong>Personal identification:</strong> Name, email address, phone number.</li>
              <li><strong>Booking details:</strong> Pick-up and drop locations, travel dates and times, trip type (local, airport, outstation, corporate, events).</li>
              <li><strong>Account data:</strong> If you create an account, we store your login credentials and profile information.</li>
              <li><strong>Usage data:</strong> IP address, browser type, device information, and how you use our website.</li>
              <li><strong>Communications:</strong> Records of support requests, feedback, or correspondence with us.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Process and manage your cab bookings and provide ride-related services.</li>
              <li>Send booking confirmations, driver details, invoices, and trip updates (including via SMS/WhatsApp/email where applicable).</li>
              <li>Improve our website, services, and customer support.</li>
              <li>Comply with legal and regulatory requirements.</li>
              <li>Send promotional or service-related communications (only if you have opted in; you can opt out at any time).</li>
            </ul>

            <h2>3. Sharing of Information</h2>
            <p>
              We may share your information with drivers and service partners to fulfil your bookings. We do not sell your
              personal data. We may disclose information to authorities when required by law or to protect our rights and
              safety.
            </p>

            <h2>4. Data Security</h2>
            <p>
              We implement reasonable technical and organisational measures to protect your personal data against
              unauthorised access, alteration, disclosure, or destruction. No method of transmission over the Internet
              is 100% secure; we strive to use industry-standard practices.
            </p>

            <h2>5. Data Retention</h2>
            <p>
              We retain your personal and booking data for as long as necessary to provide our services, resolve disputes,
              and comply with legal obligations (e.g. tax and accounting). You may request deletion of your account and
              associated data subject to applicable law.
            </p>

            <h2>6. Your Rights</h2>
            <p>You may have the right to access, correct, or delete your personal data. To exercise these rights or ask
              questions about this policy, contact us at{' '}
              <a href="mailto:nammacabs.2022@gmail.com">nammacabs.2022@gmail.com</a> or call us at the numbers listed on
              our <Link to="/contact">Contact</Link> page.
            </p>

            <h2>7. Cookies and Tracking</h2>
            <p>
              Our website may use cookies and similar technologies to improve your experience, remember preferences, and
              analyse usage. You can adjust your browser settings to limit or block cookies.
            </p>

            <h2>8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the top will reflect
              the latest version. Continued use of our services after changes constitutes acceptance of the updated policy.
            </p>

            <h2>9. Contact Us</h2>
            <p>
              For any privacy-related queries, write to us at{' '}
              <a href="mailto:nammacabs.2022@gmail.com">nammacabs.2022@gmail.com</a> or visit our{' '}
              <Link to="/contact">Contact</Link> page.
            </p>
          </div>

          <div className="legal-footer-links">
            <Link to="/terms-of-service" className="legal-link">Terms of Service</Link>
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

export default PrivacyPolicyPage;
