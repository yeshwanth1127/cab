/**
 * Single date+time field. Value/onChange: "YYYY-MM-DDTHH:mm" (datetime-local format).
 * Uses one input on all screens so mobile doesn't show two separate boxes.
 */

import React from 'react';
import './DateTimePicker.css';

export default function DateTimePicker({ value = '', onChange, placeholder, disabled, min, max, className = '', id }) {
  const handleChange = (e) => {
    const v = e.target.value;
    if (onChange) onChange(v || '');
  };

  return (
    <div className={`datetime-picker-wrap ${className}`}>
      <input
        type="datetime-local"
        id={id}
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        disabled={disabled}
        className="datetime-picker-single"
        aria-label={placeholder || 'Date and time'}
      />
    </div>
  );
}
