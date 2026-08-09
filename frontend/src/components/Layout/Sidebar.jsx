import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, LogOut, TerminalSquare, Clock, ChevronRight, TrendingUp, Users, Settings } from 'lucide-react';
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
            <TerminalSquare size={28} className="sidebar-logo-icon" />
            <h1 className="sidebar-logo-text">عملیات R&D</h1>
          </div>
          
          <button className="sidebar-toggle-btn" onClick={toggle} title="جمع کردن منو">
            <ChevronRight size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {hasPerm('dashboard') && (
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={20} />
              <span>داشبورد</span>
            </NavLink>
          )}

          {hasPerm('overall_timeline') && (
            <NavLink to="/overall-timeline" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <TrendingUp size={20} />
              <span>تایم‌لاین پیشرفت کل</span>
            </NavLink>
          )}
          
          {hasPerm('waiting_tasks') && (
            <NavLink to="/waiting-tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Clock size={20} />
              <span>تسک‌های منتظر</span>
            </NavLink>
          )}

          {hasPerm('user_management') && (
            <NavLink to="/user-management" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>مدیریت کاربران</span>
            </NavLink>
          )}

          {hasPerm('jira_settings') && (
            <NavLink to="/jira-settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={20} />
              <span>تنظیمات و پایش جیرا</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-badge">
            <span className="user-icon">👤</span>
            <span className="user-name">{user?.display_name || user?.username || 'کاربر سیستم'}</span>
          </div>
          <button className="nav-item logout-btn" onClick={logout}>
            <LogOut size={20} />
            <span>خروج</span>
          </button>
        </div>
      </div>
      
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={toggle}></div>}
    </>
  );
};

export default Sidebar;
