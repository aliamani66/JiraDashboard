import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Shield, CheckSquare, Trash2, Edit3, Lock, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import './UserManagementPage.css';

const menuOptions = [
  { key: 'dashboard', label: 'داشبورد اصلی', icon: '🌐' },
  { key: 'overall_timeline', label: 'تایم‌لاین پیشرفت کل', icon: '📈' },
  { key: 'waiting_tasks', label: 'تسک‌های منتظر', icon: '⏳' },
  { key: 'user_management', label: 'مدیریت کاربران و دسترسی‌ها', icon: '👥' },
  { key: 'jira_settings', label: 'تنظیمات و پایش جیرا', icon: '⚙️' },
];

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // New User Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    display_name: '',
    role: 'viewer',
    permissions: ['dashboard', 'overall_timeline', 'waiting_tasks']
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
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

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
        permissions: ['dashboard', 'overall_timeline', 'waiting_tasks']
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
        display_name: editingUser.display_name
      });
      showToastMsg('دسترسی‌های کاربر به‌روزرسانی شد.');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToastMsg('خطا در به‌روزرسانی دسترسی‌ها', 'error');
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
      showToastMsg('خطا در حذف کاربر', 'error');
    }
  };

  return (
    <motion.div 
      className="user-management-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="ump-header">
        <div>
          <h1 className="ump-title">
            <Users size={24} className="text-accent-blue" />
            <span>مدیریت کاربران</span>
          </h1>
        </div>

        <div className="ump-header-btns" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="ump-refresh-btn" onClick={fetchUsers} title="به‌روزرسانی لیست کاربران">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>بروزرسانی</span>
          </button>
          
          <button className="ump-add-user-btn" onClick={() => setShowCreateModal(true)} title="افزودن کاربر جدید به سامانه">
            <UserPlus size={16} />
            <span>کاربر جدید</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`ump-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* USERS LIST TABLE */}
      <div className="glass-card ump-table-card">
        {loading ? (
          <div className="ump-loading">در حال دریافت لیست کاربران...</div>
        ) : (
          <div className="ump-table-wrapper">
            <table className="ump-table">
              <thead>
                <tr>
                  <th>نام و کاربر</th>
                  <th>نام کاربری</th>
                  <th>نقش سیستم</th>
                  <th>دسترسی‌های فعال منو</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="ump-user-cell">
                        <div className="ump-avatar">{u.display_name ? u.display_name.charAt(0) : u.username.charAt(0)}</div>
                        <strong className="ump-display-name">{u.display_name || u.username}</strong>
                      </div>
                    </td>
                    <td><span className="ump-username-tag">@{u.username}</span></td>
                    <td>
                      <span className={`ump-role-badge ${u.role}`}>
                        <Shield size={13} />
                        {u.role === 'admin' ? 'مدیر ارشد' : u.role === 'manager' ? 'مدیر پروژه' : 'مشاهده‌کننده'}
                      </span>
                    </td>
                    <td>
                      <div className="ump-perms-list">
                        {menuOptions.map(m => {
                          const hasAccess = (u.permissions || []).includes(m.key);
                          if (!hasAccess) return null;
                          return (
                            <span key={m.key} className="ump-perm-pill">
                              {m.icon} {m.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="ump-actions">
                        <button 
                          className="ump-action-btn edit"
                          onClick={() => setEditingUser(u)}
                          title="ویرایش دسترسی‌های منو"
                        >
                          <Edit3 size={15} />
                          <span>ویرایش دسترسی</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE NEW USER MODAL */}
      {showCreateModal && (
        <div className="ump-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="glass-card ump-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ump-modal-header">
              <h3><UserPlus size={20} className="text-accent-green" /> تعریف کاربر جدید در سیستم</h3>
              <button className="ump-close-modal" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateUser} className="ump-form">
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
                  <label>نام کاربری (جهت ورود):</label>
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
                  <label>نقش سازمانی:</label>
                  <select 
                    value={formData.role} 
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="viewer">کاربر مشاهده‌کننده (Viewer)</option>
                    <option value="manager">مدیر پروژه (Project Manager)</option>
                    <option value="admin">مدیر ارشد سیستم (Admin)</option>
                  </select>
                </div>
              </div>

              {/* PERMISSIONS CHECKBOX SECTION */}
              <div className="ump-perms-section">
                <label className="ump-perms-title">تخصیص دسترسی‌های منوی سمت راست:</label>
                <div className="ump-perms-checkboxes">
                  {menuOptions.map(m => {
                    const checked = (formData.permissions || []).includes(m.key);
                    return (
                      <label key={m.key} className={`ump-checkbox-card ${checked ? 'active' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={checked} 
                          onChange={() => handlePermissionToggle(m.key, false)}
                        />
                        <span className="cb-icon">{m.icon}</span>
                        <span className="cb-label">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="ump-modal-footer">
                <button type="button" className="ump-cancel-btn" onClick={() => setShowCreateModal(false)}>انصراف</button>
                <button type="submit" className="ump-submit-btn">ایجاد و ثبت کاربر</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PERMISSIONS MODAL */}
      {editingUser && (
        <div className="ump-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="glass-card ump-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ump-modal-header">
              <h3><Edit3 size={20} className="text-accent-blue" /> مدیریت دسترسی‌های منو برای @{editingUser.username}</h3>
              <button className="ump-close-modal" onClick={() => setEditingUser(null)}><X size={18} /></button>
            </div>

            <div className="ump-form">
              <div className="ump-input-group">
                <label>نام و نام خانوادگی:</label>
                <input 
                  type="text" 
                  value={editingUser.display_name || ''} 
                  onChange={e => setEditingUser({ ...editingUser, display_name: e.target.value })}
                />
              </div>

              <div className="ump-input-group">
                <label>نقش کاربر:</label>
                <select 
                  value={editingUser.role || 'viewer'} 
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  <option value="viewer">کاربر مشاهده‌کننده (Viewer)</option>
                  <option value="manager">مدیر پروژه (Project Manager)</option>
                  <option value="admin">مدیر ارشد سیستم (Admin)</option>
                </select>
              </div>

              <div className="ump-perms-section">
                <label className="ump-perms-title">منوهای مجاز جهت نمایش در سمت راست:</label>
                <div className="ump-perms-checkboxes">
                  {menuOptions.map(m => {
                    const checked = (editingUser.permissions || []).includes(m.key);
                    return (
                      <label key={m.key} className={`ump-checkbox-card ${checked ? 'active' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={checked} 
                          onChange={() => handlePermissionToggle(m.key, true)}
                        />
                        <span className="cb-icon">{m.icon}</span>
                        <span className="cb-label">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="ump-modal-footer">
                <button type="button" className="ump-cancel-btn" onClick={() => setEditingUser(null)}>انصراف</button>
                <button type="button" className="ump-submit-btn" onClick={handleSavePermissions}>ذخیره تغییرات دسترسی</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default UserManagementPage;
