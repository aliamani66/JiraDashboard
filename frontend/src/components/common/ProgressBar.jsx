import React, { useEffect, useState } from 'react';
import './common.css';

const ProgressBar = ({ progress, status }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Animate on load
    const timer = setTimeout(() => {
      setWidth(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const getColorClass = () => {
    if (status === 'blocked') return 'bg-danger';
    if (status === 'done' || progress === 100) return 'bg-success';
    return 'bg-primary';
  };

  return (
    <div className="progress-bar-container">
      <div 
        className={`progress-bar-fill ${getColorClass()}`} 
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

export default ProgressBar;
