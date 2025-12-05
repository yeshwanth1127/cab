import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainNavbar from '../components/MainNavbar';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import './CarOptions.css';

const CarOptions = () => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/car-options');
        setOptions(response.data);
      } catch (err) {
        console.error('Error fetching car options:', err);
        setError('Unable to load car options. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, []);

  return (
    <div className="car-options-page">
      <MainNavbar />
      <div className="car-options-map-wrapper">
        <AnimatedMapBackground />
      </div>
      <div className="container">
        <div className="car-options-container">
          <div className="card car-options-card">
            <h2>Car Options</h2>
            <p className="subtitle">
              Explore our different ride options curated for your comfort and budget.
            </p>

            {loading && <div className="loading">Loading car options...</div>}
            {error && !loading && <div className="error-message">{error}</div>}

            {!loading && !error && options.length === 0 && (
              <div className="empty-state">
                <p>No car options available yet. Please check back soon.</p>
              </div>
            )}

            {!loading && !error && options.length > 0 && (
              <div className="car-options-grid">
                {options.map((opt) => (
                  <div key={opt.id} className="car-option-card">
                    {opt.image_url && (
                      <div className="car-option-image-wrapper">
                        <img
                          src={opt.image_url}
                          alt={opt.name}
                          className="car-option-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="car-option-content">
                      <h3>{opt.name}</h3>
                      {opt.description && <p>{opt.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarOptions;


