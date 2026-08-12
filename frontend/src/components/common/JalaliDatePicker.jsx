import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';
import { PERSIAN_MONTH_NAMES, g2j, j2g, formatJalali, formatGregorian } from '../../utils/jalali';

const YEARS = Array.from({ length: 25 }, (_, i) => 1395 + i);

export default function JalaliDatePicker({ label, value, onChange, placeholder = 'انتخاب تاریخ شمسی' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Value is expected to be { jy, jm, jd } or 'YYYY/MM/DD' string or null
  const parsedVal = React.useMemo(() => {
    if (!value) {
      const now = new Date();
      return g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }
    if (typeof value === 'object' && value.jy) return value;
    if (typeof value === 'string' && value.includes('/')) {
      const parts = value.split('/').map(Number);
      return { jy: parts[0] || 1403, jm: parts[1] || 1, jd: parts[2] || 1 };
    }
    if (typeof value === 'string' && value.includes('-')) {
      const parts = value.split('-').map(Number);
      if (parts[0] > 1700) {
        return g2j(parts[0], parts[1], parts[2]);
      }
      return { jy: parts[0] || 1403, jm: parts[1] || 1, jd: parts[2] || 1 };
    }
    const now = new Date();
    return g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, [value]);

  const [selYear, setSelYear] = useState(parsedVal.jy);
  const [selMonth, setSelMonth] = useState(parsedVal.jm);
  const [selDay, setSelDay] = useState(parsedVal.jd);

  useEffect(() => {
    setSelYear(parsedVal.jy);
    setSelMonth(parsedVal.jm);
    setSelDay(parsedVal.jd);
  }, [parsedVal]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = selMonth <= 6 ? 31 : selMonth <= 11 ? 30 : 29;

  const handleConfirm = () => {
    const validDay = Math.min(selDay, daysInMonth);
    const { gy, gm, gd } = j2g(selYear, selMonth, validDay);
    const jalaliStr = formatJalali(selYear, selMonth, validDay);
    const gregorianStr = formatGregorian(gy, gm, gd);

    if (onChange) {
      onChange({
        jy: selYear,
        jm: selMonth,
        jd: validDay,
        jalaliStr,
        gregorianStr,
        gy,
        gm,
        gd
      });
    }
    setIsOpen(false);
  };

  const currentGregorian = j2g(selYear, selMonth, Math.min(selDay, daysInMonth));
  const currentGregStr = formatGregorian(currentGregorian.gy, currentGregorian.gm, currentGregorian.gd);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 'bold', color: '#38BDF8', marginBottom: '0.45rem' }}>
          {label}
        </label>
      )}

      {/* Input Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: '#FFFFFF',
          borderRadius: '12px',
          padding: '0.65rem 0.95rem',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: '#6EE7B7' }}>
          <Calendar size={18} style={{ color: '#38BDF8' }} />
          {formatJalali(parsedVal.jy, parsedVal.jm, parsedVal.jd)}
        </span>
        <span style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          ({formatGregorian(j2g(parsedVal.jy, parsedVal.jm, parsedVal.jd).gy, j2g(parsedVal.jy, parsedVal.jm, parsedVal.jd).gm, j2g(parsedVal.jy, parsedVal.jm, parsedVal.jd).gd)})
          <ChevronDown size={16} />
        </span>
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '105%',
            right: 0,
            zIndex: 99999,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.99))',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            boxShadow: '0 15px 40px rgba(0,0,0,0.8), 0 0 25px rgba(56,189,248,0.3)',
            borderRadius: '16px',
            padding: '1.25rem',
            width: '320px',
            color: '#FFFFFF',
            backdropFilter: 'blur(12px)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.65rem' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.92rem', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🗓️ انتخاب تاریخ شمسی
            </span>
            <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          {/* Selectors: Year & Month */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.25rem' }}>سال:</label>
              <select
                value={selYear}
                onChange={e => setSelYear(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.88rem',
                  outline: 'none'
                }}
              >
                {YEARS.map(y => (
                  <option key={y} value={y} style={{ background: '#0F172A', color: '#FFF' }}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.25rem' }}>ماه:</label>
              <select
                value={selMonth}
                onChange={e => setSelMonth(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.88rem',
                  outline: 'none'
                }}
              >
                {PERSIAN_MONTH_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1} style={{ background: '#0F172A', color: '#FFF' }}>
                    {m} ({idx + 1})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Days Grid */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.35rem' }}>
              روز (۱ تا {daysInMonth}):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto', paddingRight: '0.2rem' }}>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                const isSelected = selDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelDay(d)}
                    style={{
                      background: isSelected ? '#10B981' : 'rgba(255, 255, 255, 0.06)',
                      border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#FFFFFF' : '#E2E8F0',
                      borderRadius: '6px',
                      padding: '0.3rem 0',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      cursor: 'pointer'
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gregorian Match Info */}
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', padding: '0.45rem 0.75rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#38BDF8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>معادل میلادی JQL:</span>
            <strong>{currentGregStr}</strong>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '0.55rem',
              fontSize: '0.88rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Check size={16} />
            تأیید و انتخاب تاریخ
          </button>
        </div>
      )}
    </div>
  );
}
