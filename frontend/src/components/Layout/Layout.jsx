import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, User, CheckCircle2, LogOut, Shield, ChevronDown, Palette, Sparkles } from 'lucide-react';
import Sidebar from './Sidebar';
import './Layout.css';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('---');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

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
    try {
      const res = await api.triggerSync();
      const nowStr = new Date().toISOString();
      setLastSync(formatSyncTime(nowStr));
      setToastMessage(res.message || `همگام‌سازی موفق ۱۰ روز اخیر با جیرا (${res.projectsSynced || 0} پروژه، ${res.tasksSynced || 0} تسک)`);
      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
        window.location.reload();
      }, 1200);

    } catch (e) {
      console.error(e);
      setToastMessage('خطا در همگام‌سازی با جیرا. دوباره تلاش کنید.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
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

        {/* Sync Toast Notification */}
        {showToast && (
          <div className="sync-toast glass-card">
            <CheckCircle2 size={18} className="toast-icon" />
            <span>{toastMessage}</span>
          </div>
        )}
        
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
