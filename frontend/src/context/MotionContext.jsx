import React, { createContext, useContext, useState, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';

const MotionContext = createContext();

export const MotionProvider = ({ children }) => {
  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem('app-reduced-motion');
    // Default is true (high performance mode ON by default) unless user explicitly turned it off
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
    if (reducedMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
    localStorage.setItem('app-reduced-motion', reducedMotion ? 'true' : 'false');
  }, [reducedMotion]);

  const toggleReducedMotion = () => {
    setReducedMotion((prev) => !prev);
  };

  return (
    <MotionContext.Provider value={{ reducedMotion, setReducedMotion, toggleReducedMotion }}>
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  );
};

export const useMotion = () => {
  const context = useContext(MotionContext);
  if (!context) {
    throw new Error('useMotion must be used within a MotionProvider');
  }
  return context;
};
