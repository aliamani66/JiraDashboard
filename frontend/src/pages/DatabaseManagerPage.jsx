import React, { useState, useEffect, useCallback } from 'react';
import { Database, Search, Play, RefreshCw, Layers, CheckCircle2, AlertTriangle, Table, FileText, ChevronLeft, ChevronRight, Copy, Terminal } from 'lucide-react';
import { api } from '../services/api';
import './JiraSettingsPage.css';

const isValidEpicKey = (k) => k && /^[A-Z][A-Z0-9_]*-\d+$/i.test(k);

const DatabaseManagerPage = () => {
  const [activeTab, setActiveTab] = useState('browser'); // 'browser' | 'sql'

  // Tables list state
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('tasks');
  const [tableLoading, setTableLoading] = useState(false);

  // Table Data State
  const [tableData, setTableData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'with_epic', 'without_epic', 'subtasks'
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // SQL Query Console State
  const [sqlQuery, setSqlQuery] = useState('SELECT id, project_id, parent_task_id, parent_key, is_subtask, title, status FROM tasks LIMIT 100');
  const [queryResult, setQueryResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Tables List
  const fetchTables = useCallback(async () => {
    try {
      const res = await api.getDbTables();
      if (res && res.success && res.tables) {
        setTables(res.tables);
        if (res.tables.length > 0 && !res.tables.some(t => t.name === selectedTable)) {
          setSelectedTable(res.tables[0].name);
        }
      }
    } catch (e) {
      showToast('خطا در دریافت جداول دیتابیس: ' + e.message, 'error');
    }
  }, [selectedTable]);

  // Fetch Table Content Data
  const fetchTableData = useCallback(async (tableName, page, search, category, limitVal) => {
    try {
      setTableLoading(true);
      const res = await api.getDbTableData(tableName, page, search, category, limitVal);
      if (res && res.success) {
        setTableData(res);
      }
    } catch (e) {
      showToast('خطا در بارگذاری داده‌ها: ' + e.message, 'error');
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (selectedTable && activeTab === 'browser') {
      fetchTableData(selectedTable, currentPage, searchTerm, categoryFilter, limit);
    }
  }, [selectedTable, currentPage, categoryFilter, limit, activeTab, fetchTableData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTableData(selectedTable, 1, searchTerm, categoryFilter, limit);
  };

  const handleExecuteQuery = async () => {
    if (!sqlQuery || !sqlQuery.trim()) {
      showToast('لطفاً یک کوئری SQL وارد کنید.', 'error');
      return;
    }
    try {
      setQueryLoading(true);
      setQueryError(null);
      setQueryResult(null);
      const res = await api.runDbQuery(sqlQuery);
      if (res && res.success) {
        setQueryResult(res);
        showToast(`✅ کوئری با موفقیت در ${res.executionTimeMs}ms اجرا شد (${res.rowCount} ردیف).`, 'success');
      } else {
        setQueryError(res?.message || 'خطا در اجرای کوئری');
      }
    } catch (e) {
      setQueryError(e.message);
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setQueryLoading(false);
    }
  };

  const presets = [
    { label: '📋 کل تسک‌ها', sql: 'SELECT id, project_id, epic_id, parent_task_id, parent_key, title, status FROM tasks LIMIT 100' },
    { label: '⚡ تسک‌های دارای اپیک', sql: "SELECT id, title, epic_id, status FROM tasks WHERE epic_id IS NOT NULL AND epic_id != '' AND INSTR(epic_id, '-') > 0 LIMIT 100" },
    { label: '⚠️ تسک‌های بدون اپیک', sql: "SELECT id, title, epic_id, status FROM tasks WHERE (epic_id IS NULL OR epic_id = '' OR INSTR(epic_id, '-') = 0) LIMIT 100" },
    { label: '🔹 زیرتسک‌ها (Sub-tasks)', sql: 'SELECT id, title, parent_key, status FROM tasks WHERE is_subtask = 1 LIMIT 100' },
    { label: '🔗 کل روابط و تسک‌های مرتبط', sql: 'SELECT task_id, linked_task_id, relationship, title, status, assignee, start_date, due_date FROM task_relations LIMIT 100' },
    { label: '⛔ تسک‌های دارای وابستگی (Blocked/Depends)', sql: "SELECT task_id, linked_task_id, relationship, title, status, assignee FROM task_relations WHERE relationship LIKE '%block%' OR relationship LIKE '%depend%' OR relationship LIKE '%wait%' LIMIT 100" },
    { label: '📌 پروژه‌ها و اپیک‌ها', sql: 'SELECT * FROM projects' },
    { label: '⚙️ تنظیمات سیستم', sql: 'SELECT * FROM system_settings' }
  ];

  return (
    <div style={{ padding: '1.5rem', background: '#090D16', minHeight: '100vh', color: '#F8FAFC', fontFamily: 'inherit' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999,
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#FFFFFF', padding: '0.65rem 1.15rem', borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)', fontSize: '0.85rem', fontWeight: 700
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={28} color="#C084FC" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
              مدیریت و کنسول دیتابیس سیستم (SQLite Database Manager)
            </h1>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '0.3rem 0 0 0' }}>
            مشاهده مستقیم تمام جداول دیتابیس، اجرای سریع کوئری‌های SQL و بررسی دقیق ستون‌های ذخیره‌شده
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => {
              if (activeTab === 'browser') fetchTableData(selectedTable, currentPage, searchTerm, categoryFilter, limit);
              else handleExecuteQuery();
            }}
            style={{
              background: 'rgba(192, 132, 252, 0.15)', border: '1px solid rgba(192, 132, 252, 0.35)',
              color: '#C084FC', padding: '0.45rem 0.95rem', borderRadius: '8px',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <RefreshCw size={14} className={tableLoading || queryLoading ? 'spin' : ''} />
            <span>به‌روزرسانی داده‌ها</span>
          </button>
        </div>
      </div>

      {/* Quick Database Metrics Summary */}
      {tableData?.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600 }}>مجموع کل تسک‌های دیتابیس</div>
            <div style={{ color: '#F8FAFC', fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem' }}>
              {(tableData.stats.totalDbTasks || 0).toLocaleString()} تسک
            </div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
            <div style={{ color: '#6EE7B7', fontSize: '0.75rem', fontWeight: 600 }}>⚡ تسک‌های دارای اپیک</div>
            <div style={{ color: '#6EE7B7', fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem' }}>
              {(tableData.stats.withEpicCount || 0).toLocaleString()} تسک
            </div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
            <div style={{ color: '#FBBF24', fontSize: '0.75rem', fontWeight: 600 }}>⚠️ تسک‌های بدون اپیک</div>
            <div style={{ color: '#FBBF24', fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem' }}>
              {(tableData.stats.withoutEpicCount || 0).toLocaleString()} تسک
            </div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(96, 165, 250, 0.25)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
            <div style={{ color: '#60A5FA', fontSize: '0.75rem', fontWeight: 600 }}>🔹 زیرتسک‌ها (Sub-tasks)</div>
            <div style={{ color: '#60A5FA', fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem' }}>
              {(tableData.stats.subtasksCount || 0).toLocaleString()} تسک
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTab('browser')}
          style={{
            background: activeTab === 'browser' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'browser' ? '2px solid #C084FC' : '2px solid transparent',
            color: activeTab === 'browser' ? '#C084FC' : '#94A3B8',
            padding: '0.65rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
        >
          <Table size={16} />
          <span>📋 مرور جداول دیتابیس</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          style={{
            background: activeTab === 'sql' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'sql' ? '2px solid #38BDF8' : '2px solid transparent',
            color: activeTab === 'sql' ? '#38BDF8' : '#94A3B8',
            padding: '0.65rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
        >
          <Terminal size={16} />
          <span>⚡ کنسول کوئری‌ساز SQL</span>
        </button>
      </div>

      {/* TAB 1: TABLE BROWSER */}
      {activeTab === 'browser' && (
        <div>
          {/* Controls Bar */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>جدول:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => { setSelectedTable(e.target.value); setCurrentPage(1); setCategoryFilter('all'); }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#F8FAFC', padding: '0.35rem 0.65rem', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 700
                  }}
                >
                  {tables.map(t => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.count} ردیف)
                    </option>
                  ))}
                </select>
              </div>

              {selectedTable === 'tasks' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <button
                    onClick={() => { setCategoryFilter('all'); setCurrentPage(1); }}
                    style={{ background: categoryFilter === 'all' ? 'rgba(192, 132, 252, 0.25)' : 'transparent', border: 'none', color: categoryFilter === 'all' ? '#C084FC' : '#94A3B8', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    همه تسک‌ها
                  </button>
                  <button
                    onClick={() => { setCategoryFilter('with_epic'); setCurrentPage(1); }}
                    style={{ background: categoryFilter === 'with_epic' ? 'rgba(16, 185, 129, 0.25)' : 'transparent', border: 'none', color: categoryFilter === 'with_epic' ? '#6EE7B7' : '#94A3B8', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⚡ دارای اپیک
                  </button>
                  <button
                    onClick={() => { setCategoryFilter('without_epic'); setCurrentPage(1); }}
                    style={{ background: categoryFilter === 'without_epic' ? 'rgba(251, 191, 36, 0.25)' : 'transparent', border: 'none', color: categoryFilter === 'without_epic' ? '#FBBF24' : '#94A3B8', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⚠️ بدون اپیک
                  </button>
                  <button
                    onClick={() => { setCategoryFilter('subtasks'); setCurrentPage(1); }}
                    style={{ background: categoryFilter === 'subtasks' ? 'rgba(96, 165, 250, 0.25)' : 'transparent', border: 'none', color: categoryFilter === 'subtasks' ? '#60A5FA' : '#94A3B8', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    🔹 زیرتسک‌ها
                  </button>
                </div>
              )}
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="جستجو در تمام ستون‌ها..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#F8FAFC', padding: '0.35rem 2rem 0.35rem 0.65rem', borderRadius: '7px', fontSize: '0.78rem', width: '220px'
                  }}
                />
              </div>
              <button
                type="submit"
                style={{ background: 'rgba(192, 132, 252, 0.2)', border: '1px solid rgba(192, 132, 252, 0.4)', color: '#C084FC', padding: '0.35rem 0.75rem', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                جستجو
              </button>
            </form>
          </div>

          {/* Table Render */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            {tableLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#C084FC' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <div>در حال استخراج داده‌های جدول از دیتابیس...</div>
              </div>
            ) : !tableData || !tableData.rows || tableData.rows.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94A3B8' }}>
                هیچ داده‌ای در این جدول با فیلترهای انتخابی یافت نشد.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#1E293B', color: '#94A3B8', borderBottom: '2px solid rgba(255, 255, 255, 0.15)', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 3px 8px rgba(0, 0, 0, 0.5)' }}>
                      <th style={{ padding: '0.7rem 0.8rem', textAlign: 'center', width: '40px', background: '#1E293B' }}>#</th>
                      {tableData.columns.map(col => (
                        <th key={col.name} style={{ padding: '0.7rem 0.8rem', background: '#1E293B', color: (col.name === 'epic_id' || col.name === 'parent_task_id') ? '#6EE7B7' : (col.name === 'parent_key' ? '#60A5FA' : '#94A3B8'), fontWeight: 800 }}>
                          {col.name} {col.pk ? '🔑' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, idx) => {
                      const rowNum = (currentPage - 1) * limit + idx + 1;
                      const hasEpic = isValidEpicKey(row.epic_id || row.parent_task_id);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)' }}>
                          <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#64748B', fontWeight: 600 }}>{rowNum}</td>
                          {tableData.columns.map(col => {
                            const val = row[col.name];
                            return (
                              <td key={col.name} style={{ padding: '0.55rem 0.8rem', color: '#E2E8F0', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {(col.name === 'epic_id' || col.name === 'parent_task_id') ? (
                                  hasEpic && val ? (
                                    <span style={{ background: 'rgba(16, 185, 129, 0.18)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#6EE7B7', padding: '0.15rem 0.45rem', borderRadius: '5px', fontWeight: 700, fontSize: '0.74rem' }}>
                                      ⚡ {val}
                                    </span>
                                  ) : (
                                    <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#FBBF24', padding: '0.15rem 0.45rem', borderRadius: '5px', fontWeight: 700, fontSize: '0.74rem' }}>
                                      ⚠️ بدون اپیک
                                    </span>
                                  )
                                ) : col.name === 'parent_key' && val ? (
                                  <span style={{ background: 'rgba(96, 165, 250, 0.18)', border: '1px solid rgba(96, 165, 250, 0.35)', color: '#60A5FA', padding: '0.15rem 0.45rem', borderRadius: '5px', fontWeight: 700, fontSize: '0.74rem' }}>
                                    🔹 تسک پدر: {val}
                                  </span>
                                ) : col.name === 'linked_tasks' && val ? (
                                  (() => {
                                    let links = [];
                                    try { links = typeof val === 'string' ? JSON.parse(val) : val; } catch (_) {}
                                    if (!Array.isArray(links) || links.length === 0) return <span style={{ color: '#64748B' }}>—</span>;
                                    return (
                                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                        {links.map((item, i) => (
                                          <span key={i} title={`${item.relationship || ''}: ${item.title || ''}`} style={{ background: 'rgba(192, 132, 252, 0.15)', border: '1px solid rgba(192, 132, 252, 0.3)', color: '#C084FC', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                                            🔗 {item.key} ({item.relationship || item.linkType})
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })()
                                ) : col.name === 'id' ? (
                                  <strong style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{val}</strong>
                                ) : val !== null && val !== undefined ? String(val) : <span style={{ color: '#64748B', italic: true }}>null</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {tableData && tableData.totalPages > 1 && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  صفحه {tableData.page} از {tableData.totalPages} (مجموعاً {tableData.totalRows} ردیف)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: currentPage <= 1 ? '#64748B' : '#F8FAFC', padding: '0.25rem 0.55rem', borderRadius: '6px', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    disabled={currentPage >= tableData.totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(tableData.totalPages, prev + 1))}
                    style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: currentPage >= tableData.totalPages ? '#64748B' : '#F8FAFC', padding: '0.25rem 0.55rem', borderRadius: '6px', cursor: currentPage >= tableData.totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SQL QUERY CONSOLE */}
      {activeTab === 'sql' && (
        <div>
          {/* Quick Presets */}
          <div style={{ marginBottom: '0.85rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '0.4rem', fontWeight: 600 }}>کوئری‌های آماده سریع:</div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSqlQuery(p.sql)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#E2E8F0', padding: '0.3rem 0.65rem', borderRadius: '7px', fontSize: '0.75rem',
                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* SQL Editor Area */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38BDF8', fontSize: '0.8rem', fontWeight: 700 }}>
                <Terminal size={15} />
                <span>کنسول اجرا (SQL Editor)</span>
              </div>
              <button
                onClick={handleExecuteQuery}
                disabled={queryLoading}
                style={{
                  background: 'linear-gradient(135deg, #38BDF8, #0284C7)', border: 'none',
                  color: '#FFFFFF', padding: '0.35rem 0.95rem', borderRadius: '7px',
                  fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                  boxShadow: '0 3px 10px rgba(56, 189, 248, 0.3)'
                }}
              >
                <Play size={13} />
                <span>{queryLoading ? 'در حال اجرا...' : 'اجرای کوئری SQL'}</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="دستور SQL خود را وارد کنید (مثال: SELECT * FROM tasks)..."
              style={{
                width: '100%', background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px', color: '#38BDF8', padding: '0.75rem', fontFamily: 'monospace',
                fontSize: '0.88rem', lineHeight: '1.5', resize: 'vertical'
              }}
            />
          </div>

          {/* Query Error Message */}
          {queryError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#FCA5A5', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <strong>⚠️ خطا در اجرای کوئری:</strong> {queryError}
            </div>
          )}

          {/* Query Results */}
          {queryResult && (
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.1rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.3))', borderBottom: '1px solid rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#6EE7B7', fontSize: '0.82rem', fontWeight: 800 }}>
                  ✅ اجرا با موفقیت انجام شد: {queryResult.rowCount} ردیف استخراج گردید (زمان پاسخ: {queryResult.executionTimeMs}ms)
                </span>
              </div>

              {queryResult.rows.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                  کوئری اجرا شد اما هیچ داده‌ای برای نمایش یافت نشد (0 ردیف).
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '550px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: '#1E293B', color: '#94A3B8', borderBottom: '2px solid rgba(255, 255, 255, 0.15)', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 3px 8px rgba(0, 0, 0, 0.5)' }}>
                        <th style={{ padding: '0.7rem 0.8rem', textAlign: 'center', width: '40px', background: '#1E293B' }}>#</th>
                        {queryResult.columns.map(col => (
                          <th key={col} style={{ padding: '0.7rem 0.8rem', background: '#1E293B', color: col === 'parent_task_id' ? '#6EE7B7' : '#38BDF8', fontWeight: 800 }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                          {queryResult.columns.map(col => (
                            <td key={col} style={{ padding: '0.55rem 0.8rem', color: '#E2E8F0', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span style={{ color: '#64748B', italic: true }}>null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseManagerPage;
