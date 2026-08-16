import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MotionProvider } from './context/MotionContext';
import Layout from './components/Layout/Layout';
import LoginPage from './components/Auth/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectPage from './pages/ProjectPage';
import WaitingTasksPage from './pages/WaitingTasksPage';
import OverallTimelinePage from './pages/OverallTimelinePage';
import SprintsPage from './pages/SprintsPage';
import UserManagementPage from './pages/UserManagementPage';
import JiraSettingsPage from './pages/JiraSettingsPage';
import ManagerReportPage from './pages/ManagerReportPage';
import DatabaseManagerPage from './pages/DatabaseManagerPage';

import ErrorBoundary from './components/common/ErrorBoundary';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <div className="loading-screen">در حال بارگذاری...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return (
    <ErrorBoundary>
      <Layout>{children}</Layout>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/project/:id" 
              element={
                <ProtectedRoute>
                  <ProjectPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sprints" 
              element={
                <ProtectedRoute>
                  <SprintsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/waiting-tasks" 
              element={
                <ProtectedRoute>
                  <WaitingTasksPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/overall-timeline" 
              element={
                <ProtectedRoute>
                  <OverallTimelinePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/user-management" 
              element={
                <ProtectedRoute>
                  <UserManagementPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/manager-reports" 
              element={
                <ProtectedRoute>
                  <ManagerReportPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/jira-settings" 
              element={
                <ProtectedRoute>
                  <JiraSettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/database-manager" 
              element={
                <ProtectedRoute>
                  <DatabaseManagerPage />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </MotionProvider>
  </ThemeProvider>
  );
}

export default App;
