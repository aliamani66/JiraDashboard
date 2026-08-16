import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <div className="loading-screen">در حال بارگذاری...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return (
    <ErrorBoundary>
      <Layout>
        <Outlet />
      </Layout>
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
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/project/:id" element={<ProjectPage />} />
                <Route path="/sprints" element={<SprintsPage />} />
                <Route path="/waiting-tasks" element={<WaitingTasksPage />} />
                <Route path="/overall-timeline" element={<OverallTimelinePage />} />
                <Route path="/user-management" element={<UserManagementPage />} />
                <Route path="/manager-reports" element={<ManagerReportPage />} />
                <Route path="/jira-settings" element={<JiraSettingsPage />} />
                <Route path="/database-manager" element={<DatabaseManagerPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}

export default App;
