import React, { useRef } from 'react';
import './DateTimePicker.css';

function formatDisplayValue(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

export default function DateTimePicker({ value = '', onChange, placeholder, disabled, min, max, className = '', id }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const v = e.target.value;
    if (onChange) onChange(v || '');
  };

  const handleWrapperClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const displayText = value ? formatDisplayValue(value) : (placeholder || 'Select date and time');

  return (
    <div
      className={`datetime-picker-wrap ${value ? 'has-value' : ''} ${className}`.trim()}
      role="button"
      tabIndex={disabled ? undefined : 0}
      onClick={handleWrapperClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleWrapperClick(); } }}
      aria-label={placeholder || 'Date and time'}
    >
      <span className="datetime-picker-display">{displayText}</span>
      <input
        ref={inputRef}
        type="datetime-local"
        id={id}
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        disabled={disabled}
        className="datetime-picker-single"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
