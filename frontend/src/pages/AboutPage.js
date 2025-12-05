import React from 'react';
import MainNavbar from '../components/MainNavbar';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import './BookingPage.css';

const AboutPage = () => {
  return (
    <div className="booking-page about-page">
      <MainNavbar />
      <div className="booking-map-wrapper">
        <AnimatedMapBackground />
      </div>

      <section className="home-section about-section about-section-alt">
        <div className="home-section-inner about-two-panel">
          {/* Left side – upper section content */}
          <div className="about-hero-left">
            <h2>About Namma Cabs</h2>
            <h3>Your trusted airport, local and outstation partner in Bangalore</h3>
            <p>
              <strong>Namma Cabs</strong> was born in Bangalore with one simple idea:
              give people clean, reliable cars with honest pricing and zero drama.
              From early morning airport drops to last–minute outstation plans,
              we’ve been moving families, executives and travellers across Karnataka
              for years.
            </p>
            <p>
              We focus on the details that matter – well–maintained cars, verified
              drivers, transparent fares and real human support on the phone when you
              need it. No hidden surge, no confusing add–ons, just clear point–to–point
              service.
            </p>
          </div>

          {/* Right side – lower section content */}
          <div className="about-hero-right">
            <h2>Why Ride With Us</h2>
            <p className="about-intro">
              Whether you&apos;re catching a flight, exploring the city or heading
              outstation with family, we&apos;ve tuned our service around how people
              actually travel in and around Bangalore.
            </p>

            <div className="about-columns">
              <div className="about-card">
                <h3>Airport &amp; Local</h3>
                <ul>
                  <li>On–time pickup guarantee for airport drops</li>
                  <li>Fixed, transparent fares – no surprise surge at checkout</li>
                  <li>Multiple car options from compact to premium sedans &amp; SUVs</li>
                  <li>Professional, city–trained drivers who know the routes</li>
                </ul>
              </div>

              <div className="about-card">
                <h3>Outstation &amp; Family Trips</h3>
                <ul>
                  <li>Comfortable vehicles for long–distance travel</li>
                  <li>Experienced highway drivers for day or multi–day trips</li>
                  <li>Clean interiors, AC, luggage support and flexible halts</li>
                  <li>Up–front itinerary &amp; fare shared before your trip starts</li>
                </ul>
              </div>

              <div className="about-card">
                <h3>Safety &amp; Service</h3>
                <ul>
                  <li>Verified drivers with regular background and license checks</li>
                  <li>Well–maintained cars with periodic service and cleaning</li>
                  <li>24×7 phone support for changes, delays or assistance</li>
                  <li>Digital invoices and booking receipts for every ride</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
