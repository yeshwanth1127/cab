import React, { useEffect, useRef, useState } from 'react';
import MainNavbar from '../components/MainNavbar';
import Icon from '../components/Icon';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import './ContactPage.css';

const ContactPage = () => {
  const [isVisible, setIsVisible] = useState({});
  const contactRefs = {
    header: useRef(null),
    address: useRef(null),
    phone: useRef(null),
    email: useRef(null),
  };

  useEffect(() => {
    const observers = Object.keys(contactRefs).map((key) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible((prev) => ({ ...prev, [key]: true }));
            }
          });
        },
        { threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
      );

      if (contactRefs[key].current) {
        observer.observe(contactRefs[key].current);
      }

      return observer;
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  const contactInfo = {
    address: {
      iconName: 'pin',
      title: 'Visit Us',
      details: [
        'No 44/B, Sri Venkateswara building',
        'Maheshwaramma Temple Street, Kadirenahalli',
        'Banashankari 2nd Stage, Bangalore – 560070',
      ],
      action: 'Get Directions',
      link: 'https://www.google.com/maps?q=No+44/B,+Sri+Venkateswara+building,+Maheshwaramma+Temple+Street,+Kadirenahalli,+Banashankari+2nd+Stage,+Bangalore+560070',
    },
    phone: {
      iconName: 'phone',
      title: 'Call Us',
      details: ['97312 67516', '96202 67516'],
      action: 'Call Now',
      link: 'tel:+919731267516',
    },
    email: {
      iconName: 'email',
      title: 'Email Us',
      details: ['nammacabs.2022@gmail.com'],
      action: 'Send Email',
      link: 'mailto:nammacabs.2022@gmail.com',
    },
  };

  return (
    <div className="contact-page">
      <MainNavbar />
      <div className="contact-map-wrapper">
        <AnimatedMapBackground />
      </div>

      <div className="contact-container">
        {
}
        <div
          ref={contactRefs.header}
          className={`contact-hero ${isVisible.header ? 'visible' : ''}`}
        >
          <h1 className="contact-title">
            <span className="title-line">Get in <span className="highlight">Touch</span></span>
          </h1>
          <p className="contact-subtitle">
            We&apos;re here to help with bookings, pricing, or any questions about your
            trip with <strong>Namma Cabs</strong>.
          </p>
        </div>

        {
}
        <div className="contact-cards-grid">
          {
}
          <div
            ref={contactRefs.address}
            className={`contact-card address-card ${isVisible.address ? 'visible' : ''}`}
          >
            <div className="card-icon-wrapper">
              <div className="card-icon"><Icon name={contactInfo.address.iconName} size={32} /></div>
              <div className="icon-pulse"></div>
            </div>
            <h3 className="card-title">{contactInfo.address.title}</h3>
            <div className="card-content">
              {contactInfo.address.details.map((line, index) => (
                <p key={index} className="card-line">
                  {line}
                </p>
              ))}
            </div>
            <a
              href={contactInfo.address.link}
              target="_blank"
              rel="noopener noreferrer"
              className="card-action-btn"
            >
              {contactInfo.address.action}
              <Icon name="arrowForward" size={18} className="btn-arrow" />
            </a>
            <div className="card-decoration"></div>
          </div>

          {
}
          <div
            ref={contactRefs.phone}
            className={`contact-card phone-card ${isVisible.phone ? 'visible' : ''}`}
          >
            <div className="card-icon-wrapper">
              <div className="card-icon"><Icon name={contactInfo.phone.iconName} size={32} /></div>
              <div className="icon-pulse"></div>
            </div>
            <h3 className="card-title">{contactInfo.phone.title}</h3>
            <div className="card-content">
              {contactInfo.phone.details.map((number, index) => (
                <a
                  key={index}
                  href={`tel:+91${number.replace(/\s/g, '')}`}
                  className="card-phone-link"
                >
                  {number}
                </a>
              ))}
            </div>
            <a
              href={contactInfo.phone.link}
              className="card-action-btn"
            >
              {contactInfo.phone.action}
              <Icon name="arrowForward" size={18} className="btn-arrow" />
            </a>
            <div className="card-decoration"></div>
          </div>

          {
}
          <div
            ref={contactRefs.email}
            className={`contact-card email-card ${isVisible.email ? 'visible' : ''}`}
          >
            <div className="card-icon-wrapper">
              <div className="card-icon"><Icon name={contactInfo.email.iconName} size={32} /></div>
              <div className="icon-pulse"></div>
            </div>
            <h3 className="card-title">{contactInfo.email.title}</h3>
            <div className="card-content">
              <a
                href={contactInfo.email.link}
                className="card-email-link"
              >
                {contactInfo.email.details[0]}
              </a>
            </div>
            <a
              href={contactInfo.email.link}
              className="card-action-btn"
            >
              {contactInfo.email.action}
              <Icon name="arrowForward" size={18} className="btn-arrow" />
            </a>
            <div className="card-decoration"></div>
          </div>
        </div>

        {
}
        <div className="contact-cta">
          <p className="cta-text">
            Need immediate assistance? <strong>Call us now!</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
