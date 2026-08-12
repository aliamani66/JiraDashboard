import React from 'react';
import { Filter, RotateCcw, Activity, Calendar, Layers, Search } from 'lucide-react';
import './DashboardFilterPanel.css';

const componentMetaMap = {
  dev: { label: '🚀 توسعه', class: 'comp-dev' },
  infrastructure: { label: '🌐 زیرساخت', class: 'comp-infra' },
  monitoring: { label: '📊 مانیتورینگ', class: 'comp-mon' },
  security: { label: '🛡️ امنیت', class: 'comp-sec' },
  ai: { label: '🤖 هوش مصنوعی', class: 'comp-ai' },
  learning: { label: '📘 یادگیری', class: 'comp-learning' },
  meeting: { label: '👥 جلسه', class: 'comp-meeting' },
  support: { label: '🛠️ پشتیبانی', class: 'comp-support' },
  architecture: { label: '🏛️ معماری', class: 'comp-arch' },
  testing: { label: '🧪 تست', class: 'comp-qa' },
  documentation: { label: '📝 مستندات', class: 'comp-doc' },
  database: { label: '🗄️ دیتابیس', class: 'comp-db' },
  networking: { label: '🔌 شبکه', class: 'comp-net' },
  devops: { label: '⚙️ دواپس', class: 'comp-devops' },
};

const getCompMeta = (key) => {
  if (componentMetaMap[key]) return componentMetaMap[key];
  const labelName = key.charAt(0).toUpperCase() + key.slice(1);
  return { label: `📌 ${labelName}`, class: 'comp-generic' };
};

const DashboardFilterPanel = ({
  statusFilters = [],
  setStatusFilters,
  quarterFilters = [],
  setQuarterFilters,
  componentFilters = [],
  setComponentFilters,
  searchQuery = '',
  setSearchQuery,
  quarters = [],
  availableComponents = [],
  totalProjectsCount = 0,
  filteredCount = 0,
  onResetAll
}) => {
  const [compSearch, setCompSearch] = React.useState('');
  const [showAllComps, setShowAllComps] = React.useState(false);

  // Toggle helper for multi-select arrays
  const toggleSelection = (item, currentList, setList) => {
    if (currentList.includes(item)) {
      setList(currentList.filter(i => i !== item));
    } else {
      setList([...currentList, item]);
    }
  };

  const hasActiveFilters = statusFilters.length > 0 || quarterFilters.length > 0 || componentFilters.length > 0 || searchQuery.trim() !== '';

  // Filter components by search and sort selected ones first
  const filteredComponents = availableComponents.filter(c => {
    if (!compSearch.trim()) return true;
    const meta = getCompMeta(c);
    return c.toLowerCase().includes(compSearch.toLowerCase()) || meta.label.toLowerCase().includes(compSearch.toLowerCase());
  });

  // Sort so currently selected components appear at the top
  const sortedComponents = [...filteredComponents].sort((a, b) => {
    const aSel = componentFilters.includes(a);
    const bSel = componentFilters.includes(b);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return 0;
  });

  const COMP_LIMIT = 8;
  const visibleComponents = showAllComps || compSearch.trim() !== '' ? sortedComponents : sortedComponents.slice(0, COMP_LIMIT);
  const hiddenCount = sortedComponents.length - visibleComponents.length;

  return (
    <div className="glass-card main-filter-tile">
      
      {/* Tile Header: Title + Result Counter + Reset All Button */}
      <div className="mft-header">
        <div className="mft-header-right">
          <Filter size={20} className="text-accent-cyan" />
          <h2 className="mft-title">مرکز جستجو و فیلترهای پیشرفته پروژه‌ها</h2>
          <span className="mft-count-badge">
            نمایش <strong>{filteredCount}</strong> از <strong>{totalProjectsCount}</strong> پروژه
          </span>
        </div>

        <div className="mft-header-left">
          {/* Quick Search Input */}
          <div className="mft-search-box">
            <Search size={15} className="mft-search-icon" />
            <input 
              type="text"
              placeholder="جستجوی نام یا شناسه پروژه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mft-search-input"
            />
            {searchQuery && (
              <button className="mft-clear-search" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          {hasActiveFilters && (
            <button className="mft-reset-btn" onClick={onResetAll} title="پاک‌سازی تمامی فیلترهای انتخاب‌شده">
              <RotateCcw size={14} />
              <span>پاک‌سازی فیلترها</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Sub-Tiles Grid Side-by-Side */}
      <div className="mft-grid">

        {/* ─── Sub-Tile 1: Status Filter ──────────────────────────────────── */}
        <div className="mft-subcard">
          <div className="mft-subcard-header">
            <Activity size={16} className="text-accent-blue" />
            <span>۱. وضعیت اجرای پروژه</span>
            {statusFilters.length > 0 && <span className="sub-count-pill">{statusFilters.length} انتخابی</span>}
          </div>

          <div className="mft-pills-wrap">
            <button
              className={`mft-pill ${statusFilters.length === 0 ? 'active-all' : ''}`}
              onClick={() => setStatusFilters([])}
            >
              🌐 همه وضعیت‌ها
            </button>

            <button
              className={`mft-pill status-active-pill ${statusFilters.includes('active') ? 'active' : ''}`}
              onClick={() => toggleSelection('active', statusFilters, setStatusFilters)}
            >
              ⚡ در حال اجرا
            </button>

            <button
              className={`mft-pill status-done-pill ${statusFilters.includes('done') ? 'active' : ''}`}
              onClick={() => toggleSelection('done', statusFilters, setStatusFilters)}
            >
              ✅ انجام‌شده
            </button>

            <button
              className={`mft-pill status-critical-pill ${statusFilters.includes('critical') ? 'active' : ''}`}
              onClick={() => toggleSelection('critical', statusFilters, setStatusFilters)}
            >
              🚨 کریتیکال / متوقف
            </button>
          </div>
        </div>

        {/* ─── Sub-Tile 2: Quarter Filter (Multi-select) ──────────────────── */}
        <div className="mft-subcard">
          <div className="mft-subcard-header">
            <Calendar size={16} className="text-accent-cyan" />
            <span>۲. فصل‌های زمان‌بندی (انتخاب چندتایی)</span>
            {quarterFilters.length > 0 && <span className="sub-count-pill">{quarterFilters.length} انتخابی</span>}
          </div>

          <div className="mft-pills-wrap">
            <button
              className={`mft-pill ${quarterFilters.length === 0 ? 'active-all' : ''}`}
              onClick={() => setQuarterFilters([])}
            >
              🌐 همه فصل‌ها
            </button>

            {quarters.map(q => {
              const isSelected = quarterFilters.includes(q);
              return (
                <button
                  key={q}
                  className={`mft-pill quarter-item-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => toggleSelection(q, quarterFilters, setQuarterFilters)}
                >
                  📅 {q}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Sub-Tile 3: Component Filter (Multi-select) ────────────────── */}
        <div className="mft-subcard">
          <div className="mft-subcard-header">
            <Layers size={16} className="text-accent-purple" />
            <span>۳. کامپوننت‌ها و لیبل‌ها</span>
            {componentFilters.length > 0 && <span className="sub-count-pill">{componentFilters.length} انتخابی</span>}
          </div>

          {/* Quick Label Filter Input if > 6 components */}
          {availableComponents.length > 6 && (
            <div className="mft-mini-search">
              <input
                type="text"
                placeholder="🔍 فیلتر سریع لیبل‌ها..."
                value={compSearch}
                onChange={e => setCompSearch(e.target.value)}
                className="mft-mini-input"
              />
              {compSearch && (
                <button className="mft-mini-clear" onClick={() => setCompSearch('')}>×</button>
              )}
            </div>
          )}

          <div className="mft-pills-wrap scrollable">
            <button
              className={`mft-pill ${componentFilters.length === 0 ? 'active-all' : ''}`}
              onClick={() => setComponentFilters([])}
            >
              🌐 همه لیبل‌ها
            </button>

            {visibleComponents.map(key => {
              const meta = getCompMeta(key);
              const isSelected = componentFilters.includes(key);
              return (
                <button
                  key={key}
                  className={`mft-pill comp-item-pill ${meta.class} ${isSelected ? 'active' : ''}`}
                  onClick={() => toggleSelection(key, componentFilters, setComponentFilters)}
                >
                  {meta.label}
                </button>
              );
            })}

            {!compSearch && hiddenCount > 0 && (
              <button
                className="mft-expand-btn"
                onClick={() => setShowAllComps(true)}
              >
                + {hiddenCount} لیبل دیگر...
              </button>
            )}

            {!compSearch && showAllComps && availableComponents.length > COMP_LIMIT && (
              <button
                className="mft-expand-btn collapse"
                onClick={() => setShowAllComps(false)}
              >
                ▲ کمتر
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardFilterPanel;
