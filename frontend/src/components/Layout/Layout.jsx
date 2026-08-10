import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, User, CheckCircle2, LogOut, Shield, ChevronDown, Palette } from 'lucide-react';
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

  const fetchSyncStatus = async () => {
    try {
      const status = await api.getSyncStatus();
      if (status && status.synced_at) {
        const d = new Date(status.synced_at);
        const timeStr = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        setLastSync(`ساعت ${timeStr}`);
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
      const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      setLastSync(`ساعت ${nowStr}`);
      setToastMessage(`همگام‌سازی موفق با جیرا (${res.projectsSynced || 0} پروژه، ${res.tasksSynced || 0} تسک)`);
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
        <header className="topbar glass-card">
          <div className="topbar-right">
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              ☰
            </button>
            <h2 className="page-title">داشبورد ویترین عملیات R&D</h2>
          </div>
          
          <div className="topbar-left">
            {/* 🎨 Theme Toggle Button */}
            <button 
              className={`theme-toggle-btn ${theme === 'dracula' ? 'dracula-active' : ''}`}
              onClick={toggleTheme}
              title={theme === 'dracula' ? 'تغییر به تم سایبرپانک (پیش‌فرض)' : 'تغییر به تم دراکولا (Dracula Theme)'}
            >
              <Palette size={16} />
              <span className="theme-toggle-label">
                {theme === 'dracula' ? '🧛 تم دراکولا' : '🌌 تم سایبرپانک'}
              </span>
            </button>

            <div className="sync-section">
              <span className="last-sync">آخرین سینک: {lastSync}</span>
              <button 
                className={`sync-btn ${isSyncing ? 'syncing' : ''}`} 
                onClick={handleSync}
                title="بروزرسانی داده‌ها از جیرا"
              >
                <RefreshCw size={18} className={isSyncing ? 'spin-icon' : ''} />
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
