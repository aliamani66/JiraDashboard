import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TerminalSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const result = await login(username, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'نام کاربری یا رمز عبور اشتباه است');
      }
    } catch (err) {
      setError('خطا در برقراری ارتباط با سرور');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>
      
      <div className="glass-card login-card">
        <div className="login-header">
          <div className="login-logo">
            <TerminalSquare size={48} />
          </div>
          <h2>داشبورد ویترین عملیات 1 🚀</h2>
          <p>سامانه مدیریت پروژه‌های تحقیق و توسعه</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <input 
              type="text" 
              id="username" 
              required 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="username">نام کاربری</label>
          </div>
          
          <div className="input-group">
            <input 
              type="password" 
              id="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="password">رمز عبور</label>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'در حال ورود...' : 'ورود به سیستم'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
