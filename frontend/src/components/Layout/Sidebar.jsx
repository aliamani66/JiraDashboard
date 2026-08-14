import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, LogOut, Clock, ChevronRight, TrendingUp, Users, Settings, Flame, BarChart3, Database } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, toggle }) => {
  const { user, logout } = useAuth();

  // Strict user permissions evaluation
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const hasPerm = (key) => user?.role === 'admin' || perms.includes(key);

  return (
    <>
      <div className={`sidebar glass-card ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-title">
            <h1 className="sidebar-logo-text">عملیات R&D</h1>
          </div>
          
          <button className="sidebar-toggle-btn" onClick={toggle} title={isOpen ? "جمع کردن منو" : "باز کردن منو"}>
            <ChevronRight size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {hasPerm('dashboard') && (
            <NavLink 
              to="/" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
              end
              title="داشبورد"
            >
              <LayoutDashboard size={20} className="nav-icon" />
              <span className="nav-text">داشبورد</span>
            </NavLink>
          )}

          {hasPerm('overall_timeline') && (
            <NavLink 
              to="/sprints" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="جلسات اسپرینت"
            >
              <Flame size={20} className="nav-icon" />
              <span className="nav-text">جلسات اسپرینت</span>
            </NavLink>
          )}

          {hasPerm('overall_timeline') && (
            <NavLink 
              to="/overall-timeline" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="تایم‌لاین پیشرفت کل"
            >
              <TrendingUp size={20} className="nav-icon" />
              <span className="nav-text">تایم‌لاین پیشرفت کل</span>
            </NavLink>
          )}

          {hasPerm('manager_reports') || user?.role === 'admin' || true ? (
            <NavLink 
              to="/manager-reports" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="گزارش مدیر"
            >
              <BarChart3 size={20} className="nav-icon" />
              <span className="nav-text">گزارش مدیر</span>
            </NavLink>
          ) : null}
          
          {hasPerm('waiting_tasks') && (
            <NavLink 
              to="/waiting-tasks" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="تسک‌های منتظر"
            >
              <Clock size={20} className="nav-icon" />
              <span className="nav-text">تسک‌های منتظر</span>
            </NavLink>
          )}

          {hasPerm('user_management') && (
            <NavLink 
              to="/user-management" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="مدیریت کاربران"
            >
              <Users size={20} className="nav-icon" />
              <span className="nav-text">مدیریت کاربران</span>
            </NavLink>
          )}

          {hasPerm('jira_settings') && (
            <NavLink 
              to="/jira-settings" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="تنظیمات"
            >
              <Settings size={20} className="nav-icon" />
              <span className="nav-text">تنظیمات</span>
            </NavLink>
          )}

          {hasPerm('jira_settings') && (
            <NavLink 
              to="/database-manager" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="مدیریت دیتابیس"
            >
              <Database size={20} className="nav-icon" />
              <span className="nav-text">مدیریت دیتابیس</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-badge" title={user?.display_name || user?.username || 'کاربر سیستم'}>
            <span className="user-icon">👤</span>
            <span className="user-name">{user?.display_name || user?.username || 'کاربر سیستم'}</span>
          </div>
          <button className="nav-item logout-btn" onClick={logout} title="خروج از حساب">
            <LogOut size={20} className="nav-icon" />
            <span className="nav-text">خروج</span>
          </button>
        </div>
      </div>
      
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={toggle}></div>}
    </>
  );
};

export default Sidebar;
