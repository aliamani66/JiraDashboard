import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          padding: '2rem',
          textAlign: 'center',
          color: '#F87171'
        }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)'
          }}>
            <AlertTriangle size={48} style={{ color: '#EF4444', marginBottom: '1rem' }} />
            <h2 style={{ color: '#F87171', marginBottom: '0.75rem', fontSize: '1.4rem' }}>
              خطا در بارگذاری بخش مورد نظر
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              {this.state.error?.message || 'یک خطای غیرمنتظره در اجرای برنامه‌ رخ داده است.'}
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '10px',
                  border: '1px solid #38BDF8',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38BDF8',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} />
                تلاش مجدد (Reload)
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#F8FAFC',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                <Home size={16} />
                بازگشت به صفحه اصلی
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
