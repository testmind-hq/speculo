import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.js'
import Catalog from './pages/Catalog.js'
import Import from './pages/Import.js'
import Tokens from './pages/Tokens.js'
import AdminTeams from './pages/admin/Teams.js'
import TeamMembers from './pages/admin/TeamMembers.js'
import TeamServices from './pages/admin/TeamServices.js'
import TeamGrants from './pages/admin/TeamGrants.js'
import AdminUsers from './pages/admin/Users.js'
import Nav from './components/Nav.js'

function PrivateLayout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('speculo_token')
  if (!token) return <Navigate to="/login" replace />
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('speculo_token')
  const role = localStorage.getItem('speculo_role')
  if (!token) return <Navigate to="/login" replace />
  if (role !== 'super_admin' && role !== 'team_owner') return <Navigate to="/" replace />
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateLayout><Catalog /></PrivateLayout>} />
      <Route path="/import" element={<PrivateLayout><Import /></PrivateLayout>} />
      <Route path="/settings/tokens" element={<PrivateLayout><Tokens /></PrivateLayout>} />
      <Route path="/admin/teams" element={<AdminLayout><AdminTeams /></AdminLayout>} />
      <Route path="/admin/teams/:id/members" element={<AdminLayout><TeamMembers /></AdminLayout>} />
      <Route path="/admin/teams/:id/services" element={<AdminLayout><TeamServices /></AdminLayout>} />
      <Route path="/admin/teams/:id/grants" element={<AdminLayout><TeamGrants /></AdminLayout>} />
      <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
    </Routes>
  )
}
