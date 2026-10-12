import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useInRouterContext, useParams } from 'react-router-dom';
import Sidebar, { TopNav } from './components/Sidebar';
import SignInRequired from './components/SignInRequired';
import { EmptyState } from './components/States';
import { AuthProvider, RequireAuth } from './lib/auth';
import { isDraftId } from './lib/drafts';
import AuthPage from './pages/AuthPage';
import DraftProjectPage from './pages/DraftProjectPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
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

// Guest projects open freely; saved projects belong to an account.
function ProjectRoute() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  if (isDraftId(projectId)) return <DraftProjectPage />;
  return (
    <RequireAuth>
      <ProjectDetailPage />
    </RequireAuth>
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to={paths.projects} replace />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectRoute />} />
        <Route
          path="/runs"
          element={
            <RequireAuth>
              <RunsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/runs/:runId"
          element={
            <RequireAuth>
              <RunDetailPage />
            </RequireAuth>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/sign-in-required" element={<SignInRequired />} />
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