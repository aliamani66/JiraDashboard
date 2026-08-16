import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, User, CheckCircle2, LogOut, Shield, ChevronDown, Palette, Sparkles, X, Layers, FileCheck, AlertTriangle, Zap, ZapOff } from 'lucide-react';
import Sidebar from './Sidebar';
import './Layout.css';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMotion } from '../../context/MotionContext';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { reducedMotion, toggleReducedMotion } = useMotion();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('---');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 🔄 Dedicated Modern Header Sync Modal State
  const [syncModal, setSyncModal] = useState({
    isOpen: false,
    status: 'idle', // 'syncing' | 'success' | 'error'
    result: null,
    time: null,
    error: null
  });

  const menuRef = useRef(null);

  const formatSyncTime = (rawDateStr) => {
    if (!rawDateStr) return 'همگام‌نشده';
    try {
      let d;
      if (typeof rawDateStr === 'string') {
        if (rawDateStr.includes('T')) {
          d = new Date(rawDateStr);
        } else {
          d = new Date(rawDateStr.replace(' ', 'T'));
        }
      } else {
        d = new Date(rawDateStr);
      }

      if (isNaN(d.getTime())) return 'همگام‌نشده';

      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

      if (isToday) {
        return `امروز ساعت ${timeStr}`;
      }
      const dateStr = d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
      return `${dateStr} ساعت ${timeStr}`;
    } catch (e) {
      return 'همگام‌نشده';
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const status = await api.getSyncStatus();
      if (status && status.synced_at) {
        setLastSync(formatSyncTime(status.synced_at));
      }
    } catch (e) {
      console.error('Error fetching sync status:', e);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncModal({
      isOpen: true,
      status: 'syncing',
      result: null,
      time: null,
      error: null
    });

    try {
      const res = await api.triggerSync();
      const nowStr = new Date().toISOString();
      const formattedTime = formatSyncTime(nowStr);
      setLastSync(formattedTime);

      setSyncModal({
        isOpen: true,
        status: 'success',
        result: res,
        time: formattedTime,
        error: null
      });
    } catch (e) {
      console.error('Header sync error:', e);
      setSyncModal({
        isOpen: true,
        status: 'error',
        result: null,
        time: null,
        error: e.message || 'خطا در برقراری ارتباط با سرور جیرا'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const displayName = user?.display_name || user?.username || 'مدیر سیستم';
  const roleTitle = user?.role === 'admin' ? 'مدیر ارشد سیستم' : 'کاربر داشبورد';
  const roleBadgeColor = user?.role === 'admin' ? 'badge-admin' : 'badge-user';

  return (
    <div className={`layout-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="layout-content">
        <header className="topbar">
          <div className="topbar-right">
            <div className="title-area">
              <h2 className="page-title">داشبورد ویترین عملیات R&D</h2>
            </div>
          </div>
          
          <div className="topbar-left">
            {/* ⚡ Performance / Eco Mode Toggle (Reduced Motion) */}
            <button 
              className={`motion-toggle-btn ${reducedMotion ? 'reduced-active' : ''}`}
              onClick={toggleReducedMotion}
              title={reducedMotion ? 'حالت عملکرد بهینه (فعال) - انیمیشن‌ها و افکت‌های سنگین غیرفعال هستند. کلیک جهت فعال‌سازی' : 'حالت کاهش انیمیشن و افزایش سرعت (غیرفعال) - مناسب سرور و سیستم‌های ضعیف'}
              style={{ padding: '0.45rem', borderRadius: '50%', width: '36px', height: '36px', justifyContent: 'center' }}
            >
              {reducedMotion ? <ZapOff size={17} style={{ color: '#10b981' }} /> : <Zap size={17} />}
            </button>

            {/* 🎨 Theme Toggle Button (Icon Only) */}
            <button 
              className={`theme-toggle-btn icon-only-theme-btn ${theme === 'dracula' ? 'dracula-active' : ''}`}
              onClick={toggleTheme}
              title={theme === 'dracula' ? 'تغییر تم داشبورد (فعلی: دراکولا)' : 'تغییر تم داشبورد (فعلی: سایبرپانک)'}
              style={{ padding: '0.45rem', borderRadius: '50%', width: '36px', height: '36px', justifyContent: 'center' }}
            >
              <Palette size={17} />
            </button>

            <div className="sync-section">
              <div className="live-sync-badge">
                <span className="live-pulse-dot"></span>
                <span className="last-sync">آخرین سینک: <strong>{lastSync}</strong></span>
              </div>
              <button 
                className={`sync-btn ${isSyncing ? 'syncing' : ''}`} 
                onClick={handleSync}
                title="همگام‌سازی ۱۰ روز گذشته با جیرا (بدون پاک شدن دیتابیس)"
              >
                <RefreshCw size={17} className={isSyncing ? 'spin-icon' : ''} />
              </button>
            </div>

            {/* 👤 Topbar User Profile Menu */}
            <div className="topbar-user-menu-wrap" ref={menuRef}>
              <button 
                type="button"
                className="topbar-user-badge-btn" 
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="مشاهده اطلاعات حساب کاربر"
              >
                <div className="user-avatar">
                  <User size={18} />
                </div>
                <div className="topbar-user-info">
                  <span className="tb-user-name">{displayName}</span>
                  <span className={`tb-user-role ${roleBadgeColor}`}>{roleTitle}</span>
                </div>
                <ChevronDown size={14} className={`tb-user-arrow ${showUserMenu ? 'open' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="user-dropdown-card glass-card">
                  <div className="udc-header">
                    <div className="udc-avatar">
                      <User size={24} />
                    </div>
                    <div className="udc-details">
                      <span className="udc-name">{displayName}</span>
                      <span className="udc-username">@{user?.username || 'admin'}</span>
                    </div>
                  </div>

                  <div className="udc-divider"></div>

                  <div className="udc-info-row">
                    <Shield size={14} className="text-accent-cyan" />
                    <span>نقش کاربری: <strong>{roleTitle}</strong></span>
                  </div>

                  <div className="udc-divider"></div>

                  <button className="udc-logout-btn" onClick={logout}>
                    <LogOut size={16} />
                    <span>خروج از حساب کاربر</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* 🔄 MODERN SYNC RESULT MODAL */}
        <AnimatePresence>
          {syncModal.isOpen && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(11, 15, 25, 0.85)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '1.5rem',
              direction: 'rtl'
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.99))',
                  border: syncModal.status === 'error'
                    ? '1px solid rgba(239, 68, 68, 0.45)'
                    : '1px solid rgba(56, 189, 248, 0.4)',
                  boxShadow: syncModal.status === 'error'
                    ? '0 25px 60px -15px rgba(239, 68, 68, 0.35), 0 0 40px rgba(0, 0, 0, 0.8)'
                    : '0 25px 60px -15px rgba(56, 189, 248, 0.35), 0 0 40px rgba(0, 0, 0, 0.8)',
                  borderRadius: '24px',
                  padding: '2rem',
                  maxWidth: '520px',
                  width: '100%',
                  color: '#F8FAFC',
                  direction: 'rtl'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '14px',
                      background: syncModal.status === 'error'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : syncModal.status === 'success'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(56, 189, 248, 0.2)',
                      border: syncModal.status === 'error'
                        ? '1px solid rgba(239, 68, 68, 0.5)'
                        : syncModal.status === 'success'
                        ? '1px solid rgba(16, 185, 129, 0.5)'
                        : '1px solid rgba(56, 189, 248, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: syncModal.status === 'error'
                        ? '#F87171'
                        : syncModal.status === 'success'
                        ? '#34D399'
                        : '#38BDF8'
                    }}>
                      {syncModal.status === 'syncing' ? (
                        <RefreshCw size={22} className="spin-icon" />
                      ) : syncModal.status === 'success' ? (
                        <CheckCircle2 size={24} />
                      ) : (
                        <AlertTriangle size={24} />
                      )}
                    </div>

                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                        {syncModal.status === 'syncing'
                          ? 'در حال همگام‌سازی ۱۰ روز اخیر با Jira'
                          : syncModal.status === 'success'
                          ? 'همگام‌سازی موفق ۱۰ روز اخیر با Jira'
                          : 'خطا در همگام‌سازی با Jira'}
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '0.2rem', display: 'block' }}>
                        {syncModal.status === 'syncing' ? 'ارتباط با سرور جیرا و واکشی تسک‌ها...' : `وضعیت: ${syncModal.status === 'success' ? 'تکمیل شد' : 'ناموفق'}`}
                      </span>
                    </div>
                  </div>

                  {syncModal.status !== 'syncing' && (
                    <button
                      type="button"
                      onClick={() => setSyncModal(prev => ({ ...prev, isOpen: false }))}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.3rem' }}
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                {/* Body Content */}
                {syncModal.status === 'syncing' && (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '0.9rem 1.4rem' }}>
                      <RefreshCw size={18} className="spin-icon" color="#38BDF8" />
                      <span style={{ color: '#38BDF8', fontSize: '0.88rem', fontWeight: 700 }}>
                        در حال استخراج تغییرات ۱۰ روز گذشته بدون تغییر داده‌های قبلی...
                      </span>
                    </div>
                  </div>
                )}

                {syncModal.status === 'success' && (
                  <div>
                    {/* Metrics Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '14px', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#94A3B8', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                          <Layers size={15} color="#38BDF8" />
                          <span>پروژه‌ها و اپیک‌ها</span>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38BDF8' }}>
                          {syncModal.result?.projectsSynced || 0}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '14px', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#94A3B8', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                          <FileCheck size={15} color="#34D399" />
                          <span>تسک‌های همگام‌شده</span>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34D399' }}>
                          {syncModal.result?.tasksSynced || 0}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '1rem', fontSize: '0.85rem', lineHeight: '1.7', color: '#CBD5E1', marginBottom: '1.5rem' }}>
                      <p style={{ margin: '0 0 0.4rem', color: '#6EE7B7', fontWeight: 700 }}>
                        ✅ همگام‌سازی امن با موفقیت پایان یافت.
                      </p>
                      <p style={{ margin: 0 }}>
                        تمام تسک‌های ایجادشده یا تغییریافته در ۱۰ روز گذشته با موفقیت بروز شدند و کلیه اطلاعات دیتابیس قبلی حفظ گردید.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setSyncModal(prev => ({ ...prev, isOpen: false }))}
                        style={{
                          padding: '0.65rem 1.3rem',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94A3B8',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        بستن
                      </button>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                          padding: '0.65rem 1.5rem',
                          borderRadius: '12px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #10B981, #059669)',
                          boxShadow: '0 6px 18px rgba(16, 185, 129, 0.4)',
                          color: '#FFFFFF',
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem'
                        }}
                      >
                        <RefreshCw size={15} />
                        <span>به‌روزرسانی صفحه</span>
                      </button>
                    </div>
                  </div>
                )}

                {syncModal.status === 'error' && (
                  <div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '14px', padding: '1rem', color: '#FCA5A5', fontSize: '0.86rem', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                      {syncModal.error}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setSyncModal(prev => ({ ...prev, isOpen: false }))}
                        style={{
                          padding: '0.65rem 1.3rem',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94A3B8',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        بستن
                      </button>
                      <button
                        type="button"
                        onClick={handleSync}
                        style={{
                          padding: '0.65rem 1.5rem',
                          borderRadius: '12px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                          boxShadow: '0 6px 18px rgba(239, 68, 68, 0.4)',
                          color: '#FFFFFF',
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        تلاش مجدد
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <main className="main-content">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default Layout;
