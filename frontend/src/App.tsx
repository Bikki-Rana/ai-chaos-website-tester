import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import RunDetailPage from './pages/RunDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-blue-700 text-white px-6 py-3 flex items-center gap-4 shadow">
          <Link to="/" className="text-xl font-bold tracking-tight hover:text-blue-200">
            AI Chaos Tester
          </Link>
          <span className="text-blue-300 text-sm ml-auto">Phase 2 - Project Management</span>
        </nav>
        <main className="py-6">
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </main>
        <footer className="text-center text-xs text-gray-400 py-4">
          AI Website Chaos Tester - for testing use only
        </footer>
      </div>
    </BrowserRouter>
  )
}