import React, { useRef, useState, useEffect } from 'react';
import './DateTimePicker.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate 15-minute time slots for 24h
function getTimeSlots() {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push({ h, m, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
    }
  }
  return slots;
}

const TIME_SLOTS = getTimeSlots();

function roundTo15Min(date) {
  const d = new Date(date);
  const m = d.getMinutes();
  const rounded = Math.floor(m / 15) * 15;
  d.setMinutes(rounded, 0, 0);
  return d;
}

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

function toISOLocal(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}

function parseValue(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : roundTo15Min(d);
  } catch {
    return null;
  }
}

export default function DateTimePicker({ value = '', onChange, placeholder, disabled, min, max, className = '', id }) {
  const containerRef = useRef(null);
  const timeListRef = useRef(null);
  const [open, setOpen] = useState(false);
  const parsed = parseValue(value);
  const minDate = min ? new Date(min) : null;
  const maxDate = max ? new Date(max) : null;

  const [viewDate, setViewDate] = useState(() => {
    const d = parsed || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null);
  const [selectedTime, setSelectedTime] = useState(() => {
    if (!parsed) return null;
    const idx = TIME_SLOTS.findIndex(s => s.h === parsed.getHours() && s.m === parsed.getMinutes());
    return idx >= 0 ? TIME_SLOTS[idx].label : null;
  });

  useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setSelectedDate(new Date(p.getFullYear(), p.getMonth(), p.getDate()));
      const idx = TIME_SLOTS.findIndex(s => s.h === p.getHours() && s.m === p.getMinutes());
      setSelectedTime(idx >= 0 ? TIME_SLOTS[idx].label : null);
      setViewDate(new Date(p.getFullYear(), p.getMonth(), 1));
    } else {
      setSelectedDate(null);
      setSelectedTime(null);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && timeListRef.current && selectedTime) {
      const idx = TIME_SLOTS.findIndex(s => s.label === selectedTime);
      if (idx >= 0) {
        const el = timeListRef.current.children[idx];
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  }, [open, selectedTime]);

  const handleWrapperClick = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  const commit = (date, timeLabel) => {
    if (!date || !timeLabel) return;
    const [h, m] = timeLabel.split(':').map(Number);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
    onChange(toISOLocal(d));
  };

  const handleDateClick = (year, month, day) => {
    const d = new Date(year, month, day);
    setSelectedDate(d);
    setViewDate(new Date(year, month, 1));
    if (selectedTime) commit(d, selectedTime);
  };

  const handleTimeClick = (label) => {
    setSelectedTime(label);
    if (selectedDate) {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      commit(d, label);
    }
  };

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const setMonth = (e) => {
    const m = Number(e.target.value);
    setViewDate(new Date(viewDate.getFullYear(), m, 1));
  };
  const setYear = (e) => {
    const y = Number(e.target.value);
    setViewDate(new Date(y, viewDate.getMonth(), 1));
  };

  const displayText = value ? formatDisplayValue(value) : (placeholder || 'Select date and time');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const isDayDisabled = (d) => {
    if (!d) return true;
    const date = new Date(year, month, d);
    if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const now = new Date();
  const yearMin = minDate ? minDate.getFullYear() : now.getFullYear();
  const yearMax = maxDate ? maxDate.getFullYear() : now.getFullYear() + 2;
  const years = [];
  for (let y = yearMin; y <= yearMax; y++) years.push(y);

  return (
    <div ref={containerRef} className={`datetime-picker-wrap ${value ? 'has-value' : ''} ${className}`.trim()}>
      <div
        role="button"
        tabIndex={disabled ? undefined : 0}
        onClick={handleWrapperClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleWrapperClick(); } }}
        aria-label={placeholder || 'Date and time'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="datetime-picker-trigger"
      >
        <span className="datetime-picker-display">{displayText}</span>
      </div>

      {open && (
        <div className="datetime-picker-dropdown" role="dialog" aria-label="Choose date and time">
          <div className="datetime-picker-calendar">
            <div className="datetime-picker-calendar-header">
              <button type="button" className="datetime-picker-nav" onClick={prevMonth} aria-label="Previous month">&lt;</button>
              <button type="button" className="datetime-picker-nav datetime-picker-nav-home" aria-label="Today" onClick={() => { const t = new Date(); setViewDate(new Date(t.getFullYear(), t.getMonth(), 1)); }}>⌂</button>
              <select className="datetime-picker-month-select" value={month} onChange={setMonth} aria-label="Month">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select className="datetime-picker-year-select" value={year} onChange={setYear} aria-label="Year">
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="button" className="datetime-picker-nav" onClick={nextMonth} aria-label="Next month">&gt;</button>
            </div>
            <div className="datetime-picker-weekdays">
              {DAYS.map((d) => (
                <span key={d} className="datetime-picker-weekday">{d}</span>
              ))}
            </div>
            <div className="datetime-picker-days">
              {calendarDays.map((d, i) => {
                const selected = d && selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d;
                const disabled = isDayDisabled(d);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`datetime-picker-day ${selected ? 'datetime-picker-day-selected' : ''} ${disabled ? 'datetime-picker-day-disabled' : ''}`}
                    disabled={disabled}
                    onClick={() => !disabled && d && handleDateClick(year, month, d)}
                  >
                    {d || ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="datetime-picker-time-section">
            <div className="datetime-picker-time-header">Time</div>
            <div className="datetime-picker-time-arrows">▾</div>
            <div className="datetime-picker-time-list-wrap" ref={timeListRef}>
              {TIME_SLOTS.map((slot) => {
                const selected = selectedTime === slot.label;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    className={`datetime-picker-time-slot ${selected ? 'datetime-picker-time-slot-selected' : ''}`}
                    onClick={() => handleTimeClick(slot.label)}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
            <div className="datetime-picker-time-arrows datetime-picker-time-arrows-bottom">▾</div>
          </div>
        </div>
      )}
    </div>
  );
}
