import React from 'react';
import { Zap } from 'lucide-react';
import './Capabilities.css';

const Capabilities = ({ capabilities }) => {
  return (
    <div className="glass-card capabilities-card">
      <h3 className="section-title">
        <Zap size={20} className="text-accent-yellow" />
        قابلیت‌های جدید عملیاتی
      </h3>
      <div className="capabilities-grid">
        {capabilities.map((cap, idx) => (
          <div key={idx} className="capability-badge">
            <span className="cap-dot"></span>
            {cap}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Capabilities;
