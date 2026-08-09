import React, { useState, useEffect } from 'react';
import { RefreshCw, User, CheckCircle2 } from 'lucide-react';
import Sidebar from './Sidebar';
import './Layout.css';
import { api } from '../../services/api';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('---');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await api.triggerSync();
      const nowStr = new Date().toLocaleTimeString('fa-IR');
      setLastSync(nowStr);
      setToastMessage(`همگام‌سازی موفق با جیرا (${res.projectsSynced || 0} پروژه، ${res.tasksSynced || 0} تسک)`);
      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
        // Refresh page data so dashboard components render latest synced data
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
            <div className="user-avatar">
              <User size={20} />
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
