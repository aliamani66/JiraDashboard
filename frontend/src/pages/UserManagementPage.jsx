import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Search,
  Check,
  LayoutDashboard,
  Flame,
  TrendingUp,
  BarChart3,
  Clock,
  Database,
  Settings,
  Sliders,
  Activity,
  GitMerge,
  Calendar,
  AlertTriangle,
  FlaskConical,
  Terminal,
  Table,
  Code2,
  Lock,
  Sparkles,
  Info,
  Layers,
  KeyRound
} from 'lucide-react';
import { api } from '../services/api';
import './UserManagementPage.css';

// ─── COMPLETE CATEGORIZED SYSTEM PERMISSIONS ───
export const PERMISSION_GROUPS = [
  {
    id: 'navigation',
    title: 'منوهای اصلی سامانه (سایدبار)',
    shortTitle: 'منوهای سایدبار',
    description: 'دسترسی به بخش‌ها و صفحات در نوار کناری راست سامانه',
    icon: '🧭',
    color: '#38BDF8',
    permissions: [
      { key: 'dashboard', label: 'داشبورد اصلی', description: 'مشاهده شاخص‌ها، وضعیت پروژه‌ها و آمار کلی', icon: LayoutDashboard },
      { key: 'sprints', label: 'جلسات اسپرینت', description: 'مشاهده تسک‌های اسپرینت فعال و جلسات تیم', icon: Flame },
      { key: 'overall_timeline', label: 'تایم‌لاین پیشرفت کل', description: 'مشاهده گانت‌چارت و تایم‌لاین جامع پروژه‌ها', icon: TrendingUp },
      { key: 'manager_reports', label: 'گزارش مدیر', description: 'مشاهده و چاپ گزارش‌های تحلیلی و ممیزی مدیران', icon: BarChart3 },
      { key: 'waiting_tasks', label: 'تسک‌های منتظر', description: 'بررسی تسک‌های متوقف‌شده و منتظر اقدام', icon: Clock },
      { key: 'database_manager', label: 'مدیریت دیتابیس', description: 'دسترسی به صفحه پایش و مدیریت دیتابیس', icon: Database },
      { key: 'jira_settings', label: 'تنظیمات سامانه', description: 'دسترسی به صفحه تنظیمات و ارتباط با جیرا', icon: Settings },
      { key: 'user_management', label: 'مدیریت کاربران', description: 'تعریف، ویرایش و تخصیص دسترسی کاربران', icon: Users }
    ]
  },
  {
    id: 'jira_settings',
    title: 'تنظیمات و پایش جیرا',
    shortTitle: 'تنظیمات جیرا',
    description: 'کنترل دسترسی به تب‌های تخصصی و عملیات‌های حساس صفحه تنظیمات',
    icon: '⚙️',
    color: '#A855F7',
    permissions: [
      { key: 'jira_config', label: 'پیکربندی اتصال جیرا', description: 'مشاهده و تغییر آدرس، کاربر و توکن جیرا', icon: Sliders },
      { key: 'jira_diagnostics', label: 'پایش و عیب‌یابی ارتباط', description: 'اجرای تست دیاگ و عیب‌یابی ارتباط با جیرا', icon: Activity },
      { key: 'jira_mapping', label: 'نگاشت فیلدها و وضعیت‌ها', description: 'تغییر نگاشت ستون‌ها، وضعیت‌ها و انواع تسک‌ها', icon: GitMerge },
      { key: 'jira_sync_range', label: 'استخراج بازه زمانی', description: 'همگام‌سازی داده‌ها در بازه‌های تاریخی دلخواه', icon: Calendar },
      { key: 'db_rebuild', label: '🚨 بازسازی و پاک‌سازی دیتابیس', description: 'دسترسی حساس به دکمه‌های بازسازی کامل و پاک‌سازی دیتابیس', icon: AlertTriangle, danger: true },
      { key: 'system_tests', label: 'آزمون‌های خودکار سیستم', description: 'اجرا و مشاهده گزارش تست‌های خودکار بک‌اند', icon: FlaskConical },
      { key: 'system_logs', label: 'پایش زنده لاگ‌های سرور', description: 'استریم بلادرنگ لاگ‌ها (tail -f) و دانلود خروجی', icon: Terminal }
    ]
  },
  {
    id: 'database_manager',
    title: 'مدیریت و پایش دیتابیس',
    shortTitle: 'دیتابیس SQLite',
    description: 'کنترل سطح دسترسی به داده‌ها و کنسول دیتابیس SQLite',
    icon: '🗄️',
    color: '#10B981',
    permissions: [
      { key: 'db_explorer', label: 'کاوشگر جداول دیتابیس', description: 'مرور، فیلتر و جستجوی داده‌های جداول tasks و projects', icon: Table },
      { key: 'db_query', label: '⚡ کنسول اجرای مستقیم SQL', description: 'دسترسی سطح بالا جهت اجرای مستقیم کوئری‌های SQL', icon: Code2, danger: true }
    ]
  }
];

// All permission keys flat array
export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

// Role presets templates
const ROLE_PRESETS = [
  {
    name: 'مدیر ارشد (کامل)',
    role: 'admin',
    icon: '👑',
    color: '#EC4899',
    perms: [...ALL_PERMISSION_KEYS]
  },
  {
    name: 'مدیر پروژه',
    role: 'manager',
    icon: '🎯',
    color: '#38BDF8',
    perms: [
      'dashboard', 'sprints', 'overall_timeline', 'manager_reports', 'waiting_tasks',
      'database_manager', 'db_explorer', 'jira_settings', 'jira_sync_range', 'jira_diagnostics'
    ]
  },
  {
    name: 'مشاهده‌کننده',
    role: 'viewer',
    icon: '👁️',
    color: '#10B981',
    perms: ['dashboard', 'sprints', 'overall_timeline', 'manager_reports', 'waiting_tasks']
  },
  {
    name: 'توسعه‌دهنده / DevOps',
    role: 'manager',
    icon: '🛠️',
    color: '#F59E0B',
    perms: [
      'dashboard', 'database_manager', 'db_explorer', 'jira_settings',
      'jira_config', 'jira_diagnostics', 'system_tests', 'system_logs'
    ]
  }
];

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [activePermTab, setActivePermTab] = useState('navigation'); // 'navigation' | 'jira_settings' | 'database_manager' | 'all'
  const [permSearchTerm, setPermSearchTerm] = useState('');

  // New User Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    display_name: '',
    role: 'viewer',
    permissions: ['dashboard', 'sprints', 'overall_timeline', 'manager_reports', 'waiting_tasks']
  });

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error(e);
      showToastMsg('خطا در دریافت لیست کاربران', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToastMsg = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // Toggle single permission
  const handlePermissionToggle = (menuKey, isEdit = false) => {
    if (isEdit && editingUser) {
      const current = editingUser.permissions || [];
      const updated = current.includes(menuKey)
        ? current.filter(k => k !== menuKey)
        : [...current, menuKey];
      setEditingUser({ ...editingUser, permissions: updated });
    } else {
      const current = formData.permissions || [];
      const updated = current.includes(menuKey)
        ? current.filter(k => k !== menuKey)
        : [...current, menuKey];
      setFormData({ ...formData, permissions: updated });
    }
  };

  // Select all in a group
  const handleSelectGroup = (groupKeys, isSelectAll, isEdit = false) => {
    if (isEdit && editingUser) {
      const current = editingUser.permissions || [];
      const next = isSelectAll
        ? Array.from(new Set([...current, ...groupKeys]))
        : current.filter(k => !groupKeys.includes(k));
      setEditingUser({ ...editingUser, permissions: next });
    } else {
      const current = formData.permissions || [];
      const next = isSelectAll
        ? Array.from(new Set([...current, ...groupKeys]))
        : current.filter(k => !groupKeys.includes(k));
      setFormData({ ...formData, permissions: next });
    }
  };

  // Apply Role Preset
  const handleApplyPreset = (preset, isEdit = false) => {
    if (isEdit && editingUser) {
      setEditingUser({
        ...editingUser,
        role: preset.role,
        permissions: [...preset.perms]
      });
    } else {
      setFormData({
        ...formData,
        role: preset.role,
        permissions: [...preset.perms]
      });
    }
    showToastMsg(`الگوی «${preset.name}» اعمال شد.`);
  };

  // On Role Change in Dropdown: automatically suggest/set default permissions
  const handleRoleChange = (newRole, isEdit = false) => {
    const matchedPreset = ROLE_PRESETS.find(p => p.role === newRole);
    if (isEdit && editingUser) {
      setEditingUser({
        ...editingUser,
        role: newRole,
        permissions: matchedPreset ? [...matchedPreset.perms] : editingUser.permissions
      });
    } else {
      setFormData({
        ...formData,
        role: newRole,
        permissions: matchedPreset ? [...matchedPreset.perms] : formData.permissions
      });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      showToastMsg('نام کاربری و کلمه عبور الزامی است.', 'error');
      return;
    }

    try {
      const res = await api.createUser(formData);
      showToastMsg(res.message || 'کاربر جدید با موفقیت ایجاد شد.');
      setShowCreateModal(false);
      setFormData({
        username: '',
        password: '',
        display_name: '',
        role: 'viewer',
        permissions: ['dashboard', 'sprints', 'overall_timeline', 'manager_reports', 'waiting_tasks']
      });
      fetchUsers();
    } catch (err) {
      showToastMsg(err.message || 'خطا در ایجاد کاربر', 'error');
    }
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    try {
      await api.updateUserPermissions(editingUser.id, {
        permissions: editingUser.permissions,
        role: editingUser.role,
        display_name: editingUser.display_name,
        password: editingUser.password
      });
      showToastMsg('اطلاعات و دسترسی‌های کاربر با موفقیت به‌روزرسانی شد.');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToastMsg(err.message || 'خطا در به‌روزرسانی دسترسی‌ها', 'error');
    }
  };

  // Quick Standalone Password Reset
  const handleDirectPasswordReset = async (e) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (!newPasswordInput || newPasswordInput.trim().length === 0) {
      showToastMsg('لطفاً کلمه عبور جدید را وارد فرمایید.', 'error');
      return;
    }

    try {
      setPasswordLoading(true);
      await api.updateUserPermissions(passwordModalUser.id, {
        password: newPasswordInput.trim(),
        role: passwordModalUser.role,
        display_name: passwordModalUser.display_name,
        permissions: passwordModalUser.permissions
      });
      showToastMsg(`کلمه عبور کاربر «${passwordModalUser.username}» با موفقیت تغییر یافت.`);
      setPasswordModalUser(null);
      setNewPasswordInput('');
      fetchUsers();
    } catch (err) {
      showToastMsg(err.message || 'خطا در تغییر کلمه عبور کاربر', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (username === 'admin') {
      showToastMsg('امکان حذف کاربر مدیر اصلی سیستم وجود ندارد.', 'error');
      return;
    }

    if (!window.confirm(`آیا از حذف کاربر "${username}" اطمینان دارید؟`)) return;

    try {
      await api.deleteUser(id);
      showToastMsg('کاربر با موفقیت حذف گردید.');
      fetchUsers();
    } catch (err) {
      showToastMsg(err.message || 'خطا در حذف کاربر', 'error');
    }
  };

  // Helper to render permissions selector component
  const renderPermissionsSelector = (currentPerms, isEdit, userRole) => {
    const term = permSearchTerm.trim().toLowerCase();

    // Determine which groups to show based on active tab
    const visibleGroups = PERMISSION_GROUPS.filter(g => {
      if (activePermTab === 'all') return true;
      return g.id === activePermTab;
    });

    return (
      <div className="ump-perms-container">
        {/* Role Explanation Note */}
        {userRole === 'admin' && (
          <div className="ump-role-infobox admin">
            <Shield size={16} color="#F472B6" />
            <span>
              👑 <strong>توجه به نقش مدیر ارشد:</strong> کاربر با نقش Admin، به صورت پیش‌فرض و نامحدود به تمامی بخش‌ها و عملیات‌های حساس (از جمله بازسازی دیتابیس) دسترسی دارد.
            </span>
          </div>
        )}

        {/* Presets Row */}
        <div className="ump-presets-row">
          <div className="ump-presets-title">
            <Sparkles size={14} color="#F59E0B" />
            <span>الگوهای آماده:</span>
          </div>
          <div className="ump-presets-btns">
            {ROLE_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className="ump-preset-btn"
                onClick={() => handleApplyPreset(p, isEdit)}
                style={{ borderColor: `${p.color}40`, background: `${p.color}12` }}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Input & Category Tab Navigation */}
        <div className="ump-tabs-search-bar">
          {/* Tabs Navigation */}
          <div className="ump-perm-tabs">
            {PERMISSION_GROUPS.map(g => {
              const count = g.permissions.filter(p => currentPerms.includes(p.key)).length;
              const isActive = activePermTab === g.id;

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActivePermTab(g.id)}
                  className={`ump-perm-tab-btn ${isActive ? 'active' : ''}`}
                  style={{
                    borderColor: isActive ? g.color : 'transparent',
                    color: isActive ? g.color : '#94A3B8'
                  }}
                >
                  <span>{g.icon}</span>
                  <span>{g.shortTitle}</span>
                  <span className="ump-tab-count-badge" style={{ background: isActive ? `${g.color}25` : 'rgba(255,255,255,0.06)' }}>
                    {count}/{g.permissions.length}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setActivePermTab('all')}
              className={`ump-perm-tab-btn ${activePermTab === 'all' ? 'active' : ''}`}
              style={{
                borderColor: activePermTab === 'all' ? '#38BDF8' : 'transparent',
                color: activePermTab === 'all' ? '#38BDF8' : '#94A3B8'
              }}
            >
              <Layers size={14} />
              <span>همه بخش‌ها</span>
              <span className="ump-tab-count-badge">
                {currentPerms.length}/{ALL_PERMISSION_KEYS.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="ump-perm-search-box">
            <Search size={14} color="#94A3B8" />
            <input
              type="text"
              value={permSearchTerm}
              onChange={e => setPermSearchTerm(e.target.value)}
              placeholder="جستجو در مجوزها..."
            />
            {permSearchTerm && (
              <button type="button" onClick={() => setPermSearchTerm('')} className="ump-search-clear">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Categorized Groups Inside Tab */}
        <div className="ump-groups-list">
          {visibleGroups.map(group => {
            const filteredPerms = group.permissions.filter(p => {
              if (!term) return true;
              return p.label.toLowerCase().includes(term) || p.description.toLowerCase().includes(term) || p.key.toLowerCase().includes(term);
            });

            if (filteredPerms.length === 0) {
              return (
                <div key={group.id} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748B', fontSize: '0.84rem' }}>
                  هیچ مجوزی در بخش «{group.title}» با عبارت «{permSearchTerm}» یافت نشد.
                </div>
              );
            }

            const groupKeys = group.permissions.map(p => p.key);
            const activeCount = groupKeys.filter(k => currentPerms.includes(k)).length;
            const isAllSelected = activeCount === groupKeys.length;

            return (
              <div key={group.id} className="ump-group-card">
                <div className="ump-group-header">
                  <div className="ump-group-info">
                    <span className="ump-group-icon">{group.icon}</span>
                    <div>
                      <h4 className="ump-group-title" style={{ color: group.color }}>{group.title}</h4>
                      <p className="ump-group-desc">{group.description}</p>
                    </div>
                  </div>

                  <div className="ump-group-actions">
                    <span className="ump-group-badge">
                      {activeCount} از {groupKeys.length} فعال
                    </span>
                    <button
                      type="button"
                      className="ump-group-toggle-btn"
                      onClick={() => handleSelectGroup(groupKeys, !isAllSelected, isEdit)}
                    >
                      {isAllSelected ? 'لغو همه' : 'انتخاب همه'}
                    </button>
                  </div>
                </div>

                <div className="ump-perms-grid">
                  {filteredPerms.map(perm => {
                    const checked = currentPerms.includes(perm.key);
                    const IconComponent = perm.icon || LayoutDashboard;

                    return (
                      <div
                        key={perm.key}
                        className={`ump-perm-card ${checked ? 'active' : ''} ${perm.danger ? 'danger' : ''}`}
                        onClick={() => handlePermissionToggle(perm.key, isEdit)}
                      >
                        <div className="ump-perm-checkbox">
                          <div className={`ump-custom-checkbox ${checked ? 'checked' : ''} ${perm.danger ? 'danger' : ''}`}>
                            {checked && <Check size={13} strokeWidth={3.5} color="#FFFFFF" />}
                          </div>
                        </div>

                        <div className="ump-perm-content">
                          <div className="ump-perm-top">
                            <div className="ump-perm-label-row">
                              <IconComponent size={16} className="ump-perm-icon" />
                              <span className="ump-perm-label">{perm.label}</span>
                            </div>
                            {perm.danger && (
                              <span className="ump-danger-badge">حساس</span>
                            )}
                          </div>
                          <p className="ump-perm-help">{perm.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className="user-management-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="ump-header">
        <div>
          <h1 className="ump-title">
            <Users size={24} className="text-accent-blue" />
            <span>مدیریت کاربران و سطوح دسترسی</span>
          </h1>
          <p className="ump-subtitle">
            تعریف حساب‌های کاربری، تغییر رمز عبور، کنترل دسترسی به منوهای سایدبار و تب‌های دیتابیس و تنظیمات
          </p>
        </div>

        <div className="ump-header-btns">
          <button className="ump-refresh-btn" onClick={fetchUsers} title="به‌روزرسانی لیست کاربران">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>بروزرسانی</span>
          </button>

          <button
            className="ump-add-user-btn"
            onClick={() => {
              setActivePermTab('navigation');
              setPermSearchTerm('');
              setShowCreateModal(true);
            }}
            title="افزودن کاربر جدید به سامانه"
          >
            <UserPlus size={16} />
            <span>کاربر جدید</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            className={`ump-toast ${toast.type}`}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* USERS LIST TABLE */}
      <div className="glass-card ump-table-card">
        {loading ? (
          <div className="ump-loading">
            <RefreshCw size={24} className="spin text-accent-cyan" />
            <span>در حال دریافت لیست کاربران سامانه...</span>
          </div>
        ) : (
          <div className="ump-table-wrapper">
            <table className="ump-table">
              <thead>
                <tr>
                  <th>نام و مشخصات</th>
                  <th>نام کاربری</th>
                  <th>نقش سیستم</th>
                  <th>خلاصه دسترسی‌ها</th>
                  <th style={{ textAlign: 'center' }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const userPerms = Array.isArray(u.permissions) ? u.permissions : [];
                  const isAdmin = u.role === 'admin' || u.username === 'admin';

                  const navCount = PERMISSION_GROUPS[0].permissions.filter(p => userPerms.includes(p.key) || isAdmin).length;
                  const settsCount = PERMISSION_GROUPS[1].permissions.filter(p => userPerms.includes(p.key) || isAdmin).length;
                  const dbCount = PERMISSION_GROUPS[2].permissions.filter(p => userPerms.includes(p.key) || isAdmin).length;
                  const hasDbRebuild = userPerms.includes('db_rebuild') || isAdmin;

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="ump-user-cell">
                          <div className="ump-avatar">{u.display_name ? u.display_name.charAt(0) : u.username.charAt(0)}</div>
                          <div>
                            <strong className="ump-display-name">{u.display_name || u.username}</strong>
                            {isAdmin && <span className="ump-admin-star">★ مدیر ارشد سیستم</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="ump-username-tag">@{u.username}</span>
                      </td>
                      <td>
                        <span className={`ump-role-badge ${u.role}`}>
                          <Shield size={13} />
                          {u.role === 'admin' ? 'مدیر ارشد' : u.role === 'manager' ? 'مدیر پروژه' : 'مشاهده‌کننده'}
                        </span>
                      </td>
                      <td>
                        <div className="ump-perms-summary">
                          <span className="ump-summary-pill nav" title="دسترسی به منوهای اصلی سمت راست">
                            🧭 {navCount} از {PERMISSION_GROUPS[0].permissions.length} منو
                          </span>
                          <span className="ump-summary-pill setts" title="دسترسی به تب‌های تنظیمات جیرا">
                            ⚙️ {settsCount} تنظیمات
                          </span>
                          <span className="ump-summary-pill db" title="دسترسی به بخش مدیریت دیتابیس">
                            🗄️ {dbCount} دیتابیس
                          </span>
                          {hasDbRebuild && (
                            <span className="ump-summary-pill danger" title="دارای مجوز بازسازی کامل دیتابیس">
                              🚨 بازسازی DB
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="ump-actions" style={{ justifyContent: 'center' }}>
                          <button
                            className="ump-action-btn edit"
                            onClick={() => {
                              setActivePermTab('navigation');
                              setPermSearchTerm('');
                              setEditingUser({
                                ...u,
                                password: '',
                                permissions: Array.isArray(u.permissions) ? u.permissions : []
                              });
                            }}
                            title="مدیریت و ویرایش سطوح دسترسی"
                          >
                            <Edit3 size={15} />
                            <span>تخصیص دسترسی</span>
                          </button>

                          <button
                            className="ump-action-btn password"
                            onClick={() => {
                              setPasswordModalUser(u);
                              setNewPasswordInput('');
                            }}
                            title="تغییر کلمه عبور کاربر"
                          >
                            <KeyRound size={15} />
                            <span>تغییر رمز</span>
                          </button>

                          {u.username !== 'admin' && (
                            <button
                              className="ump-action-btn delete"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              title="حذف کاربر"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE NEW USER MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="ump-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <motion.div
              className="glass-card ump-modal-content large"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
            >
              {/* FIXED MODAL HEADER */}
              <div className="ump-modal-header">
                <h3>
                  <UserPlus size={20} className="text-accent-green" />
                  <span>تعریف کاربر جدید و تنظیم دسترسی‌ها</span>
                </h3>
                <button className="ump-close-modal" onClick={() => setShowCreateModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* FORM WRAPPER WITH FIXED FOOTER & SCROLLABLE BODY */}
              <form onSubmit={handleCreateUser} className="ump-form-wrapper">
                {/* SCROLLABLE INNER BODY */}
                <div className="ump-form-scrollable">
                  <div className="ump-form-grid">
                    <div className="ump-input-group">
                      <label>نام و نام خانوادگی:</label>
                      <input
                        type="text"
                        value={formData.display_name}
                        onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                        placeholder="مثال: علی امانی"
                      />
                    </div>

                    <div className="ump-input-group">
                      <label>نام کاربری (جهت ورود به سیستم):</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        placeholder="مثال: amani"
                        required
                      />
                    </div>

                    <div className="ump-input-group">
                      <label>کلمه عبور:</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <div className="ump-input-group">
                      <label>نقش سازمانی در سامانه:</label>
                      <select
                        value={formData.role}
                        onChange={e => handleRoleChange(e.target.value, false)}
                      >
                        <option value="viewer">مشاهده‌کننده (Viewer)</option>
                        <option value="manager">مدیر پروژه (Project Manager)</option>
                        <option value="admin">مدیر ارشد سیستم (Admin)</option>
                      </select>
                    </div>
                  </div>

                  {/* TABBED PERMISSIONS SELECTOR */}
                  {renderPermissionsSelector(formData.permissions || [], false, formData.role)}
                </div>

                {/* PINNED FIXED FOOTER */}
                <div className="ump-modal-footer">
                  <button type="button" className="ump-cancel-btn" onClick={() => setShowCreateModal(false)}>
                    انصراف
                  </button>
                  <button type="submit" className="ump-submit-btn">
                    ایجاد و ذخیره کاربر
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT USER & PERMISSIONS MODAL */}
      <AnimatePresence>
        {editingUser && (
          <div className="ump-modal-overlay" onClick={() => setEditingUser(null)}>
            <motion.div
              className="glass-card ump-modal-content large"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
            >
              {/* FIXED MODAL HEADER */}
              <div className="ump-modal-header">
                <h3>
                  <Edit3 size={20} className="text-accent-blue" />
                  <span>تخصیص و مدیریت دسترسی‌ها برای @{editingUser.username}</span>
                </h3>
                <button className="ump-close-modal" onClick={() => setEditingUser(null)}>
                  <X size={18} />
                </button>
              </div>

              {/* FORM WRAPPER WITH FIXED FOOTER & SCROLLABLE BODY */}
              <div className="ump-form-wrapper">
                {/* SCROLLABLE INNER BODY */}
                <div className="ump-form-scrollable">
                  <div className="ump-form-grid">
                    <div className="ump-input-group">
                      <label>نام و نام خانوادگی:</label>
                      <input
                        type="text"
                        value={editingUser.display_name || ''}
                        onChange={e => setEditingUser({ ...editingUser, display_name: e.target.value })}
                      />
                    </div>

                    <div className="ump-input-group">
                      <label>نقش کاربر در سامانه:</label>
                      <select
                        value={editingUser.role || 'viewer'}
                        onChange={e => handleRoleChange(e.target.value, true)}
                      >
                        <option value="viewer">مشاهده‌کننده (Viewer)</option>
                        <option value="manager">مدیر پروژه (Project Manager)</option>
                        <option value="admin">مدیر ارشد سیستم (Admin)</option>
                      </select>
                    </div>

                    <div className="ump-input-group">
                      <label>تغییر کلمه عبور (اختیاری):</label>
                      <input
                        type="password"
                        placeholder="در صورت عدم تمایل به تغییر، خالی بگذارید"
                        value={editingUser.password || ''}
                        onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {/* TABBED PERMISSIONS SELECTOR */}
                  {renderPermissionsSelector(editingUser.permissions || [], true, editingUser.role)}
                </div>

                {/* PINNED FIXED FOOTER */}
                <div className="ump-modal-footer">
                  <button type="button" className="ump-cancel-btn" onClick={() => setEditingUser(null)}>
                    انصراف
                  </button>
                  <button type="button" className="ump-submit-btn" onClick={handleSavePermissions}>
                    ذخیره تغییرات دسترسی
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔑 DEDICATED QUICK PASSWORD RESET MODAL */}
      <AnimatePresence>
        {passwordModalUser && (
          <div className="ump-modal-overlay" onClick={() => setPasswordModalUser(null)}>
            <motion.div
              className="glass-card ump-modal-content small"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              style={{ maxWidth: '440px' }}
            >
              <div className="ump-modal-header">
                <h3>
                  <KeyRound size={20} className="text-accent-orange" />
                  <span>تغییر کلمه عبور @{passwordModalUser.username}</span>
                </h3>
                <button className="ump-close-modal" onClick={() => setPasswordModalUser(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDirectPasswordReset} className="ump-password-form">
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: '#CBD5E1', lineHeight: '1.5' }}>
                  نام کاربر: <strong>{passwordModalUser.display_name || passwordModalUser.username}</strong>
                  <br />
                  <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>کلمه عبور جدید را وارد فرمایید تا بلافاصله فعال شود.</span>
                </div>

                <div className="ump-input-group" style={{ marginBottom: '1.5rem' }}>
                  <label>کلمه عبور جدید:</label>
                  <input
                    type="password"
                    placeholder="کلمه عبور جدید را وارد کنید..."
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="ump-modal-footer" style={{ borderTop: 'none', padding: 0 }}>
                  <button type="button" className="ump-cancel-btn" onClick={() => setPasswordModalUser(null)}>
                    انصراف
                  </button>
                  <button type="submit" className="ump-submit-btn" disabled={passwordLoading}>
                    {passwordLoading ? 'در حال ثبت...' : 'تغییر و ذخیره رمز'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default UserManagementPage;
