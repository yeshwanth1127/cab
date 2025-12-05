import React from 'react';
import MainNavbar from '../components/MainNavbar';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import './BookingPage.css';

const ContactPage = () => {
  return (
    <div className="booking-page contact-page">
      <MainNavbar />
      <div className="contact-map-wrapper">
        <AnimatedMapBackground />
      </div>

      <section className="home-section contact-section">
        <div className="home-section-inner">
          <div className="contact-card">
            <h2>Contact Us</h2>
            <p>
              We&apos;re here to help with bookings, pricing, or any questions about your
              trip with <strong>Namma Cabs</strong>.
            </p>

            <div className="contact-car">
              <img src="/carbackside.png" alt="Namma Cabs car back" />
              <div className="contact-car-window">
                <div>No 44/B, Sri Venkateswara building.</div>
                <div>Maheshwaramma Temple Street, Kadirenahalli,</div>
                <div>Banashankari 2nd Stage, Bangalore &ndash; 560070</div>
              </div>
              <div className="contact-car-tag contact-car-phone">
                📞 97312 67516<br />
                📞 96202 67516
              </div>
              <div className="contact-car-tag contact-car-email">
                ✉️ nammacabs.2022@gmail.com
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
