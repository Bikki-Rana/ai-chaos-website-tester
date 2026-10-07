import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useInRouterContext } from 'react-router-dom';
import Sidebar, { TopNav } from './components/Sidebar';
import { EmptyState } from './components/States';
import { AuthProvider, RequireAuth } from './lib/auth';
import AuthPage from './pages/AuthPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import RunDetailPage from './pages/RunDetailPage';
import RunsPage from './pages/RunsPage';
import SettingsPage from './pages/SettingsPage';
import { paths } from './lib/routes';

function NotFound() {
  return (
    <div className="ct-page">
      <EmptyState
        title="Page not found"
        description="The page you requested does not exist."
        action={
          <Link className="ct-btn" to={paths.projects}>
            Go to projects
          </Link>
        }
      />
    </div>
  );
}

function Shell() {
  return (
    <div className="ct-shell">
      <Sidebar />
      <div className="ct-content">
        <TopNav />
        <main className="ct-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to={paths.projects} replace />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  // Works whether or not main.tsx already wraps the app in a router.
  const inRouter = useInRouterContext();
  const content = (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
  return inRouter ? content : <BrowserRouter>{content}</BrowserRouter>;
}

export default App;