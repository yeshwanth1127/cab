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
            <h3>Your trusted airport, local, outstation & corporate cab partner in Bangalore</h3>
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

      {/* Corporate Services Section - Full Width Highlight */}
      <section className="home-section corporate-section" style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
        padding: '60px 0',
        marginTop: '40px'
      }}>
        <div className="home-section-inner" style={{ maxWidth: '1200px' }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '50px'
          }}>
            <h2 style={{
              fontSize: '42px',
              fontWeight: '700',
              color: '#facc15',
              marginBottom: '20px',
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}>
              🏢 Corporate Cab Services
            </h2>
            <h3 style={{
              fontSize: '28px',
              fontWeight: '600',
              color: '#e5e7eb',
              marginBottom: '30px',
              lineHeight: '1.4'
            }}>
              Your Trusted Business Transportation Partner in Bangalore
            </h3>
            <p style={{
              fontSize: '20px',
              lineHeight: '1.8',
              color: '#cbd5e1',
              maxWidth: '900px',
              margin: '0 auto 40px'
            }}>
              <strong>Transform your company&apos;s mobility with Namma Cabs Corporate Solutions.</strong> 
              We provide end-to-end transportation services designed to keep your business moving 
              efficiently, safely, and cost-effectively.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '30px',
            marginBottom: '50px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)',
              border: '2px solid rgba(250, 204, 21, 0.3)',
              borderRadius: '20px',
              padding: '35px',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease'
            }}>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#facc15',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '32px' }}>🚗</span> Dedicated Fleet Management
              </h3>
              <p style={{
                fontSize: '16px',
                lineHeight: '1.8',
                color: '#e5e7eb',
                marginBottom: '15px'
              }}>
                Get assigned vehicles and professional drivers exclusively for your company. 
                Consistent service, familiar faces, and reliable transportation that your 
                employees can count on every single day.
              </p>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                fontSize: '15px',
                lineHeight: '2',
                color: '#cbd5e1'
              }}>
                <li>✓ Fixed vehicle assignments for regular routes</li>
                <li>✓ Professional, uniformed drivers</li>
                <li>✓ GPS tracking and real-time updates</li>
                <li>✓ Flexible scheduling for shifts</li>
              </ul>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)',
              border: '2px solid rgba(250, 204, 21, 0.3)',
              borderRadius: '20px',
              padding: '35px',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease'
            }}>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#facc15',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '32px' }}>💼</span> Business-Grade Billing
              </h3>
              <p style={{
                fontSize: '16px',
                lineHeight: '1.8',
                color: '#e5e7eb',
                marginBottom: '15px'
              }}>
                Streamlined invoicing designed for businesses. Get monthly consolidated bills, 
                GST-compliant invoices, detailed usage reports, and transparent pricing with 
                volume-based discounts.
              </p>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                fontSize: '15px',
                lineHeight: '2',
                color: '#cbd5e1'
              }}>
                <li>✓ Monthly consolidated billing</li>
                <li>✓ GST invoices (with/without GST options)</li>
                <li>✓ Detailed usage analytics</li>
                <li>✓ Volume discounts and corporate rates</li>
              </ul>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)',
              border: '2px solid rgba(250, 204, 21, 0.3)',
              borderRadius: '20px',
              padding: '35px',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease'
            }}>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#facc15',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '32px' }}>🛡️</span> Enterprise Safety Standards
              </h3>
              <p style={{
                fontSize: '16px',
                lineHeight: '1.8',
                color: '#e5e7eb',
                marginBottom: '15px'
              }}>
                Your employees&apos; safety is our priority. All drivers undergo rigorous 
                background checks, vehicles are regularly serviced and insured, and we 
                maintain comprehensive safety protocols.
              </p>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                fontSize: '15px',
                lineHeight: '2',
                color: '#cbd5e1'
              }}>
                <li>✓ Verified drivers with background checks</li>
                <li>✓ Fully insured vehicles</li>
                <li>✓ 24/7 emergency support</li>
                <li>✓ Safety compliance certifications</li>
              </ul>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.2) 0%, rgba(234, 179, 8, 0.15) 100%)',
            border: '3px solid rgba(250, 204, 21, 0.4)',
            borderRadius: '24px',
            padding: '50px',
            textAlign: 'center',
            marginTop: '40px'
          }}>
            <h3 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#facc15',
              marginBottom: '25px'
            }}>
              Perfect For Every Business Need
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '25px',
              marginTop: '30px',
              textAlign: 'left'
            }}>
              <div>
                <h4 style={{ color: '#facc15', fontSize: '18px', marginBottom: '10px' }}>
                  📍 Daily Employee Commutes
                </h4>
                <p style={{ color: '#e5e7eb', fontSize: '15px', lineHeight: '1.6' }}>
                  Reliable pick-up and drop services for your workforce, with fixed routes 
                  and schedules tailored to your company&apos;s needs.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#facc15', fontSize: '18px', marginBottom: '10px' }}>
                  ✈️ Client & Airport Transfers
                </h4>
                <p style={{ color: '#e5e7eb', fontSize: '15px', lineHeight: '1.6' }}>
                  Professional transportation for visiting clients, executives, and 
                  airport transfers with premium vehicles and experienced drivers.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#facc15', fontSize: '18px', marginBottom: '10px' }}>
                  🎯 On-Demand Business Travel
                </h4>
                <p style={{ color: '#e5e7eb', fontSize: '15px', lineHeight: '1.6' }}>
                  Flexible booking for meetings, site visits, and business trips with 
                  instant confirmation and real-time tracking.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#facc15', fontSize: '18px', marginBottom: '10px' }}>
                  🎉 Team Events & Outings
                </h4>
                <p style={{ color: '#e5e7eb', fontSize: '15px', lineHeight: '1.6' }}>
                  Comfortable group transportation for company events, team building 
                  activities, and corporate outings with spacious vehicles.
                </p>
              </div>
            </div>
            <div style={{
              marginTop: '40px',
              paddingTop: '30px',
              borderTop: '2px solid rgba(250, 204, 21, 0.3)'
            }}>
              <p style={{
                fontSize: '22px',
                fontWeight: '600',
                color: '#facc15',
                marginBottom: '25px'
              }}>
                Ready to Elevate Your Company&apos;s Transportation?
              </p>
              <a 
                href="/corporate" 
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
                  color: '#000',
                  padding: '18px 40px',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  boxShadow: '0 8px 25px rgba(250, 204, 21, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-3px)';
                  e.target.style.boxShadow = '0 12px 35px rgba(250, 204, 21, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 8px 25px rgba(250, 204, 21, 0.3)';
                }}
              >
                Get Started with Corporate Booking →
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
