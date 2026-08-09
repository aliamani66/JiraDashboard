import React from 'react';
import { 
  Layers, Rocket, BookOpen, Wrench, Users, Shield, Cpu, Code, 
  Search, Database, FileText, Activity, Network, CheckSquare 
} from 'lucide-react';
import './ComponentBreakdown.css';

const presetConfig = {
  'dev': { label: 'توسعه و پیاده‌سازی', icon: Rocket, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
  'learning': { label: 'یادگیری و آموزش', icon: BookOpen, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
  'support': { label: 'پشتیبانی عملیاتی', icon: Wrench, color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' },
  'meeting': { label: 'جلسات و هماهنگی', icon: Users, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)' },
  'arch': { label: 'معماری سیستم', icon: Layers, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' },
  'architecture': { label: 'معماری سیستم', icon: Layers, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' },
  'sec': { label: 'امنیت و تست نفوذ', icon: Shield, color: '#EAB308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' },
  'security': { label: 'امنیت و تست نفوذ', icon: Shield, color: '#EAB308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' },
  'infra': { label: 'زیرساخت و کلاستر', icon: Cpu, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },
  'infrastructure': { label: 'زیرساخت و کلاستر', icon: Cpu, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },
  'research': { label: 'تحقیق و توسعه R&D', icon: Search, color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)' },
  'db': { label: 'پایگاه داده و دیتابیس', icon: Database, color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.15)', border: 'rgba(20, 184, 166, 0.3)' },
  'database': { label: 'پایگاه داده و دیتابیس', icon: Database, color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.15)', border: 'rgba(20, 184, 166, 0.3)' },
  'devops': { label: 'دواپس و CI/CD', icon: Code, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
  'monitoring': { label: 'مانیتورینگ و لوگ', icon: Activity, color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)' },
  'documentation': { label: 'مستندسازی و Wiki', icon: FileText, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)' },
  'networking': { label: 'شبکه و روترینگ', icon: Network, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' },
  'testing': { label: 'تست و آزمون', icon: CheckSquare, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' }
};

const fallbackPalettes = [
  { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
  { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
  { color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' },
  { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)' },
  { color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' },
  { color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },
  { color: '#EAB308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' },
  { color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)' }
];

const ComponentBreakdown = ({ tasks = [] }) => {
  if (!tasks || tasks.length === 0) return null;

  // Extract ALL components dynamically from real Jira tasks
  const dynamicStats = {};
  let totalHours = 0;

  for (const t of tasks) {
    let compKey = 'dev';
    if (t.component) {
      compKey = String(t.component).toLowerCase().trim();
    } else if (t.labels) {
      try {
        const labelsArr = typeof t.labels === 'string' ? JSON.parse(t.labels) : t.labels;
        const compLabel = labelsArr.find(l => typeof l === 'string' && l.startsWith('comp:'));
        if (compLabel) {
          compKey = compLabel.replace('comp:', '').toLowerCase().trim();
        }
      } catch (e) {}
    }

    if (!dynamicStats[compKey]) {
      dynamicStats[compKey] = {
        key: compKey,
        count: 0,
        hours: 0
      };
    }

    const hrs = t.spent_hours || t.estimate_hours || 10;
    dynamicStats[compKey].count += 1;
    dynamicStats[compKey].hours += hrs;
    totalHours += hrs;
  }

  const entries = Object.values(dynamicStats);
  if (entries.length === 0) return null;

  return (
    <div className="glass-card component-breakdown-card">
      <div className="cb-header">
        <h3 className="section-title">
          <Layers size={22} className="text-accent-cyan" />
          تفکیک فعالیت‌ها و سهم کامپوننت‌های پروژه ({entries.length} کامپوننت Jira)
        </h3>
        <span className="cb-total-hours">مجموع زمان کارکرد: {Math.round(totalHours)}h</span>
      </div>

      {/* Multi-segment Segmented Progress Bar */}
      <div className="cb-segmented-bar">
        {entries.map((item, idx) => {
          if (item.count === 0) return null;
          const pct = totalHours > 0 ? Math.round((item.hours / totalHours) * 100) : 0;
          const conf = presetConfig[item.key] || {
            label: item.key,
            color: fallbackPalettes[idx % fallbackPalettes.length].color
          };

          return (
            <div 
              key={item.key} 
              className="cb-bar-segment"
              style={{ width: `${Math.max(4, pct)}%`, backgroundColor: conf.color }}
              title={`${conf.label}: ${pct}% (${item.hours}h / ${item.count} تسک)`}
            />
          );
        })}
      </div>

      {/* Dynamic Component Stat Cards Grid */}
      <div className="cb-cards-grid">
        {entries.map((item, idx) => {
          const fallback = fallbackPalettes[idx % fallbackPalettes.length];
          const conf = presetConfig[item.key] || {
            label: item.key.charAt(0).toUpperCase() + item.key.slice(1),
            icon: Layers,
            color: fallback.color,
            bg: fallback.bg,
            border: fallback.border
          };
          const IconComp = conf.icon || Layers;
          const pct = totalHours > 0 ? Math.round((item.hours / totalHours) * 100) : 0;

          return (
            <div 
              key={item.key} 
              className="cb-stat-pill"
              style={{ backgroundColor: conf.bg, borderColor: conf.border }}
            >
              <div className="cb-pill-top">
                <IconComp size={18} style={{ color: conf.color }} />
                <span className="cb-pill-label">{conf.label}</span>
              </div>
              <div className="cb-pill-bottom">
                <span className="cb-pill-hours" style={{ color: conf.color }}>
                  {Math.round(item.hours)}h <small>({pct}%)</small>
                </span>
                <span className="cb-pill-count">{item.count} تسک</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComponentBreakdown;
