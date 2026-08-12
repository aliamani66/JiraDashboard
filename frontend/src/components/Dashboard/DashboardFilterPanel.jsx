import React from 'react';
import { Filter, RotateCcw, Activity, Calendar, Layers, Search, FolderGit2 } from 'lucide-react';
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
  projectFilters = [],
  setProjectFilters,
  searchQuery = '',
  setSearchQuery,
  quarters = [],
  availableComponents = [],
  availableProjects = [],
  totalProjectsCount = 0,
  filteredCount = 0,
  onResetAll
}) => {
  const [compSearch, setCompSearch] = React.useState('');
  const [showAllComps, setShowAllComps] = React.useState(false);

  const [quarterSearch, setQuarterSearch] = React.useState('');
  const [showAllQuarters, setShowAllQuarters] = React.useState(false);

  const [projectSearch, setProjectSearch] = React.useState('');
  const [showAllProjects, setShowAllProjects] = React.useState(false);

  // Toggle helper for multi-select arrays
  const toggleSelection = (item, currentList, setList) => {
    if (currentList.includes(item)) {
      setList(currentList.filter(i => i !== item));
    } else {
      setList([...currentList, item]);
    }
  };

  const hasActiveFilters = statusFilters.length > 0 || quarterFilters.length > 0 || componentFilters.length > 0 || projectFilters.length > 0 || searchQuery.trim() !== '';

  // Filter & sort Quarters
  const filteredQuarters = quarters.filter(q => {
    if (!quarterSearch.trim()) return true;
    return q.toLowerCase().includes(quarterSearch.toLowerCase().trim());
  });

  const sortedQuarters = [...filteredQuarters].sort((a, b) => {
    const aSel = quarterFilters.includes(a);
    const bSel = quarterFilters.includes(b);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return 0;
  });

  const Q_LIMIT = 6;
  const visibleQuarters = showAllQuarters || quarterSearch.trim() !== '' ? sortedQuarters : sortedQuarters.slice(0, Q_LIMIT);
  const hiddenQuartersCount = sortedQuarters.length - visibleQuarters.length;

  // Filter & sort Components / Labels
  const filteredComponents = availableComponents.filter(c => {
    if (!compSearch.trim()) return true;
    const meta = getCompMeta(c);
    return c.toLowerCase().includes(compSearch.toLowerCase()) || meta.label.toLowerCase().includes(compSearch.toLowerCase());
  });

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

  // Filter & sort Projects
  const filteredProjectsList = availableProjects.filter(p => {
    if (!projectSearch.trim()) return true;
    const term = projectSearch.toLowerCase().trim();
    const pKey = typeof p === 'object' ? (p.id || p.key || '') : String(p);
    const pTitle = typeof p === 'object' ? (p.title || '') : '';
    return pKey.toLowerCase().includes(term) || pTitle.toLowerCase().includes(term);
  });

  const sortedProjectsList = [...filteredProjectsList].sort((a, b) => {
    const aKey = typeof a === 'object' ? (a.id || a.key) : String(a);
    const bKey = typeof b === 'object' ? (b.id || b.key) : String(b);
    const aSel = projectFilters.includes(aKey);
    const bSel = projectFilters.includes(bKey);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return 0;
  });

  const PROJ_LIMIT = 6;
  const visibleProjects = showAllProjects || projectSearch.trim() !== '' ? sortedProjectsList : sortedProjectsList.slice(0, PROJ_LIMIT);
  const hiddenProjectsCount = sortedProjectsList.length - visibleProjects.length;

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
              className={`mft-pill ${statusFilters.includes('todo') ? 'active' : ''}`}
              onClick={() => toggleSelection('todo', statusFilters, setStatusFilters)}
              style={statusFilters.includes('todo') ? { background: 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(192,132,252,0.35))', borderColor: '#C084FC', color: '#FFFFFF', boxShadow: '0 0 12px rgba(192,132,252,0.35)' } : {}}
            >
              📋 برای انجام
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

          {/* Quick Quarter Filter Input if > 6 quarters */}
          {quarters.length > 6 && (
            <div className="mft-mini-search">
              <input
                type="text"
                placeholder="🔍 فیلتر سریع فصل‌ها (مثال: 1404 یا Q1)..."
                value={quarterSearch}
                onChange={e => setQuarterSearch(e.target.value)}
                className="mft-mini-input"
              />
              {quarterSearch && (
                <button className="mft-mini-clear" onClick={() => setQuarterSearch('')}>×</button>
              )}
            </div>
          )}

          <div className="mft-pills-wrap scrollable">
            <button
              className={`mft-pill ${quarterFilters.length === 0 ? 'active-all' : ''}`}
              onClick={() => setQuarterFilters([])}
            >
              🌐 همه فصل‌ها
            </button>

            {visibleQuarters.map(q => {
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

            {!quarterSearch && hiddenQuartersCount > 0 && (
              <button
                className="mft-expand-btn"
                onClick={() => setShowAllQuarters(true)}
              >
                + {hiddenQuartersCount} فصل دیگر...
              </button>
            )}

            {!quarterSearch && showAllQuarters && quarters.length > Q_LIMIT && (
              <button
                className="mft-expand-btn collapse"
                onClick={() => setShowAllQuarters(false)}
              >
                ▲ کمتر
              </button>
            )}
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

        {/* ─── Sub-Tile 4: Project Key Filter (Multi-select) ──────────────────── */}
        {availableProjects && availableProjects.length > 0 && (
          <div className="mft-subcard">
            <div className="mft-subcard-header">
              <FolderGit2 size={16} className="text-accent-purple" style={{ color: '#C084FC' }} />
              <span>۴. پروژه‌های عملیاتی (انتخاب چندتایی)</span>
              {projectFilters.length > 0 && <span className="sub-count-pill" style={{ background: 'rgba(192, 132, 252, 0.25)', color: '#E9D5FF', border: '1px solid rgba(192, 132, 252, 0.4)' }}>{projectFilters.length} انتخابی</span>}
            </div>

            {/* Quick Project Search Input */}
            {availableProjects.length > 4 && (
              <div className="mft-mini-search">
                <input
                  type="text"
                  placeholder="🔍 فیلتر سریع پروژه‌ها (نام یا شناسه)..."
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  className="mft-mini-input"
                />
                {projectSearch && (
                  <button className="mft-mini-clear" onClick={() => setProjectSearch('')}>×</button>
                )}
              </div>
            )}

            <div className="mft-pills-wrap scrollable">
              <button
                className={`mft-pill ${projectFilters.length === 0 ? 'active-all' : ''}`}
                onClick={() => setProjectFilters([])}
              >
                🌐 همه پروژه‌ها
              </button>

              {visibleProjects.map(p => {
                const pKey = typeof p === 'object' ? (p.key || p.id) : String(p);
                const count = typeof p === 'object' ? p.count : null;
                const isSelected = projectFilters.includes(pKey);
                return (
                  <button
                    key={pKey}
                    className={`mft-pill project-item-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleSelection(pKey, projectFilters, setProjectFilters)}
                    title={`فیلتر پروژه‌های وابسته به کلید ${pKey}`}
                    style={isSelected ? { background: 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(192,132,252,0.35))', borderColor: '#C084FC', color: '#FFFFFF', boxShadow: '0 0 12px rgba(192,132,252,0.35)' } : {}}
                  >
                    📂 <strong>پروژه {pKey}</strong> {count ? <small style={{ opacity: 0.85, fontSize: '0.76rem' }}>({count} اپیک)</small> : null}
                  </button>
                );
              })}

              {!projectSearch && hiddenProjectsCount > 0 && !showAllProjects && (
                <button 
                  className="mft-expand-btn"
                  onClick={() => setShowAllProjects(true)}
                >
                  + {hiddenProjectsCount} پروژه دیگر...
                </button>
              )}

              {!projectSearch && showAllProjects && sortedProjectsList.length > PROJ_LIMIT && (
                <button 
                  className="mft-expand-btn collapse"
                  onClick={() => setShowAllProjects(false)}
                >
                  ▲ کمتر
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DashboardFilterPanel;
