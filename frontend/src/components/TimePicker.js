/**
 * Clock-style time picker using react-time-picker. Value/onChange: "HH:mm" (24-hour).
 * Uses format "hh:mm a" for display; converts to/from 24h for parent components.
 */

import React from 'react';
import ReactTimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import './TimePicker.css';

/** Convert "HH:mm" (24h) to "hh:mm a" for react-time-picker */
function to12h(value) {
  if (!value || typeof value !== 'string') return null;
  const [hStr, mStr] = value.trim().split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (isNaN(h)) return null;
  const hour24 = Math.min(23, Math.max(0, h));
  const minute = Math.min(59, Math.max(0, m));
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hh = String(hour12).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm} ${ampm}`;
}

/** Convert "hh:mm a" from react-time-picker to "HH:mm" (24h) */
function to24h(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  let hour12 = parseInt(match[1], 10);
  const minute = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  const isPM = match[3].toUpperCase() === 'PM';
  if (hour12 === 12) hour12 = 0;
  const hour24 = isPM ? hour12 + 12 : hour12;
  const h = String(hour24).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m}`;
}

export default function TimePickerWrap({
  value = '',
  onChange,
  placeholder = 'Select time',
  disabled,
  min,
  max,
  className = '',
  id,
}) {
  const displayValue = to12h(value);

  const handleChange = (newValue) => {
    if (onChange) {
      onChange(newValue ? to24h(newValue) : '');
    }
  };

  const minDisplay = min ? to12h(min) : undefined;
  const maxDisplay = max ? to12h(max) : undefined;

  return (
    <div className={`time-picker-wrap ${className}`}>
      <ReactTimePicker
        id={id}
        onChange={handleChange}
        value={displayValue}
        clockIcon={true}
        clearIcon={null}
        format="hh:mm a"
        disabled={disabled}
        minTime={minDisplay}
        maxTime={maxDisplay}
        className="time-picker-react"
        placeholder={placeholder}
      />
    </div>
  );
}
