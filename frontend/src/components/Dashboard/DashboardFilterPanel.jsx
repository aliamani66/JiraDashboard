import React from 'react';
import { Filter, RotateCcw, Activity, Calendar, Layers, Search, FolderGit2, Sparkles, X } from 'lucide-react';
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

// Parse quarter string to numeric order for sorting
const parseQuarterOrder = (s) => {
  if (!s) return 0;
  const clean = String(s).trim();
  const yearMatch = clean.match(/(13\d\d|14\d\d|20\d\d)/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  let qNum = 0;
  if (/q1|بهار|فروردین|اردیبهشت|خرداد/i.test(clean)) qNum = 1;
  else if (/q2|تابستان|تیر|مرداد|شهریور/i.test(clean)) qNum = 2;
  else if (/q3|پاییز|مهر|آبان|آذر/i.test(clean)) qNum = 3;
  else if (/q4|زمستان|دی|بهمن|اسفند/i.test(clean)) qNum = 4;
  else {
    const digitMatch = clean.replace(String(year), '').match(/\d+/);
    if (digitMatch) qNum = parseInt(digitMatch[0], 10);
  }
  return year * 10 + qNum;
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

  const hasActiveFilters =
    statusFilters.length > 0 ||
    quarterFilters.length > 0 ||
    componentFilters.length > 0 ||
    projectFilters.length > 0 ||
    searchQuery.trim() !== '';

  // Filter & sort Quarters DESCENDING (Newest first)
  const filteredQuarters = quarters.filter(q => {
    if (!quarterSearch.trim()) return true;
    return q.toLowerCase().includes(quarterSearch.toLowerCase().trim());
  });

  const sortedQuarters = [...filteredQuarters].sort((a, b) => {
    const aSel = quarterFilters.includes(a);
    const bSel = quarterFilters.includes(b);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    // Sort descending by chronological quarter value (newest first)
    return parseQuarterOrder(b) - parseQuarterOrder(a);
  });

  const Q_LIMIT = 5;
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
    return a.localeCompare(b);
  });

  const COMP_LIMIT = 6;
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

  const PROJ_LIMIT = 5;
  const visibleProjects = showAllProjects || projectSearch.trim() !== '' ? sortedProjectsList : sortedProjectsList.slice(0, PROJ_LIMIT);
  const hiddenProjectsCount = sortedProjectsList.length - visibleProjects.length;

  return (
    <div className="glass-card compact-filter-panel">
      
      {/* ─── Top Control Row: Search + Counter + Reset ─────────────────── */}
      <div className="cfp-top-row">
        <div className="cfp-search-wrap">
          <Search size={15} className="cfp-search-icon" />
          <input 
            type="text"
            placeholder="جستجوی سریع در پروژه‌ها، اپیک‌ها و تگ‌ها..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cfp-search-input"
          />
          {searchQuery && (
            <button className="cfp-clear-search" onClick={() => setSearchQuery('')} title="پاک کردن جستجو">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="cfp-meta-actions">
          <div className="cfp-counter-badge" title="تعداد نتایج فیلترشده از کل پروژه‌ها">
            <span>نمایش:</span>
            <strong>{filteredCount}</strong>
            <span className="cfp-slash">/</span>
            <span>{totalProjectsCount}</span>
          </div>

          {hasActiveFilters && (
            <button className="cfp-reset-btn" onClick={onResetAll} title="پاک‌سازی تمامی فیلترها">
              <RotateCcw size={13} />
              <span>بازنشانی</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Compact Horizontal Filter Rows ─────────────────────────────── */}
      <div className="cfp-rows-container">

        {/* Row 1: Status Filters */}
        <div className="cfp-filter-row">
          <div className="cfp-row-label">
            <Activity size={13} className="text-accent-blue" />
            <span>وضعیت:</span>
          </div>
          <div className="cfp-pills-row">
            <button
              className={`cfp-pill ${statusFilters.length === 0 ? 'active-all' : ''}`}
              onClick={() => setStatusFilters([])}
            >
              همه
            </button>
            <button
              className={`cfp-pill status-active-pill ${statusFilters.includes('active') ? 'active' : ''}`}
              onClick={() => toggleSelection('active', statusFilters, setStatusFilters)}
            >
              ⚡ در حال اجرا
            </button>
            <button
              className={`cfp-pill ${statusFilters.includes('todo') ? 'active-todo' : ''}`}
              onClick={() => toggleSelection('todo', statusFilters, setStatusFilters)}
            >
              📋 برای انجام
            </button>
            <button
              className={`cfp-pill status-done-pill ${statusFilters.includes('done') ? 'active' : ''}`}
              onClick={() => toggleSelection('done', statusFilters, setStatusFilters)}
            >
              ✅ انجام‌شده
            </button>
            <button
              className={`cfp-pill status-critical-pill ${statusFilters.includes('critical') ? 'active' : ''}`}
              onClick={() => toggleSelection('critical', statusFilters, setStatusFilters)}
            >
              🚨 کریتیکال
            </button>
          </div>
        </div>

        {/* Row 2: Quarter Filter (Descending / Newest first) */}
        {quarters.length > 0 && (
          <div className="cfp-filter-row">
            <div className="cfp-row-label">
              <Calendar size={13} className="text-accent-cyan" />
              <span>فصل:</span>
            </div>
            <div className="cfp-pills-row">
              <button
                className={`cfp-pill ${quarterFilters.length === 0 ? 'active-all' : ''}`}
                onClick={() => setQuarterFilters([])}
              >
                همه
              </button>

              {visibleQuarters.map(q => {
                const isSelected = quarterFilters.includes(q);
                return (
                  <button
                    key={q}
                    className={`cfp-pill quarter-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleSelection(q, quarterFilters, setQuarterFilters)}
                  >
                    📅 {q}
                  </button>
                );
              })}

              {hiddenQuartersCount > 0 && !showAllQuarters && (
                <button className="cfp-more-btn" onClick={() => setShowAllQuarters(true)}>
                  + {hiddenQuartersCount} فصل دیگر...
                </button>
              )}
              {showAllQuarters && quarters.length > Q_LIMIT && (
                <button className="cfp-more-btn collapse" onClick={() => setShowAllQuarters(false)}>
                  ▲ کمتر
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Component Filter */}
        {availableComponents.length > 0 && (
          <div className="cfp-filter-row">
            <div className="cfp-row-label">
              <Layers size={13} className="text-accent-purple" />
              <span>کامپوننت:</span>
            </div>
            <div className="cfp-pills-row">
              <button
                className={`cfp-pill ${componentFilters.length === 0 ? 'active-all' : ''}`}
                onClick={() => setComponentFilters([])}
              >
                همه
              </button>

              {visibleComponents.map(key => {
                const meta = getCompMeta(key);
                const isSelected = componentFilters.includes(key);
                return (
                  <button
                    key={key}
                    className={`cfp-pill comp-pill ${meta.class} ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleSelection(key, componentFilters, setComponentFilters)}
                  >
                    {meta.label}
                  </button>
                );
              })}

              {hiddenCount > 0 && !showAllComps && (
                <button className="cfp-more-btn" onClick={() => setShowAllComps(true)}>
                  + {hiddenCount} مورد...
                </button>
              )}
              {showAllComps && availableComponents.length > COMP_LIMIT && (
                <button className="cfp-more-btn collapse" onClick={() => setShowAllComps(false)}>
                  ▲ کمتر
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 4: Projects Filter (If multiple projects configured) */}
        {availableProjects && availableProjects.length > 1 && (
          <div className="cfp-filter-row">
            <div className="cfp-row-label">
              <FolderGit2 size={13} style={{ color: '#C084FC' }} />
              <span>پروژه:</span>
            </div>
            <div className="cfp-pills-row">
              <button
                className={`cfp-pill ${projectFilters.length === 0 ? 'active-all' : ''}`}
                onClick={() => setProjectFilters([])}
              >
                همه
              </button>

              {visibleProjects.map(p => {
                const pKey = typeof p === 'object' ? (p.key || p.id) : String(p);
                const count = typeof p === 'object' ? p.count : null;
                const isSelected = projectFilters.includes(pKey);
                return (
                  <button
                    key={pKey}
                    className={`cfp-pill project-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleSelection(pKey, projectFilters, setProjectFilters)}
                  >
                    📂 {pKey} {count ? <small>({count})</small> : null}
                  </button>
                );
              })}

              {hiddenProjectsCount > 0 && !showAllProjects && (
                <button className="cfp-more-btn" onClick={() => setShowAllProjects(true)}>
                  + {hiddenProjectsCount} پروژه...
                </button>
              )}
              {showAllProjects && sortedProjectsList.length > PROJ_LIMIT && (
                <button className="cfp-more-btn collapse" onClick={() => setShowAllProjects(false)}>
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
