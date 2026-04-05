import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import Sidebar from './components/Sidebar.js'
import Login from './pages/Login.js'
import Catalog from './pages/Catalog.js'
import Import from './pages/Import.js'
import Tokens from './pages/Tokens.js'
import Diff from './pages/Diff.js'
import AdminTeams from './pages/admin/Teams.js'
import TeamMembers from './pages/admin/TeamMembers.js'
import TeamServices from './pages/admin/TeamServices.js'
import TeamGrants from './pages/admin/TeamGrants.js'
import AdminUsers from './pages/admin/Users.js'
import AuditLogs from './pages/admin/AuditLogs.js'
import Webhooks from './pages/admin/Webhooks.js'

function PrivateLayout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('speculo_token')
  if (!token) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}

/** Verifies role server-side via /api/me before rendering admin pages. */
function AdminLayout({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const token = localStorage.getItem('speculo_token')
  const [role, setRole] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!token) { setChecked(true); return }
    let mounted = true
    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: any) => { if (mounted) setRole(data?.role ?? null) })
      .catch(() => { if (mounted) setRole(null) })
      .finally(() => { if (mounted) setChecked(true) })
    return () => { mounted = false }
  }, [token])

  if (!token) return <Navigate to="/login" replace />
  if (!checked) return null

  const allowed = requiredRole
    ? role === requiredRole
    : role === 'super_admin' || role === 'team_owner'
  if (!allowed) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateLayout><Catalog /></PrivateLayout>} />
        <Route path="/import" element={<PrivateLayout><Import /></PrivateLayout>} />
        <Route path="/settings/tokens" element={<PrivateLayout><Tokens /></PrivateLayout>} />
        <Route path="/diff" element={<PrivateLayout><Diff /></PrivateLayout>} />
        <Route path="/admin/teams" element={<AdminLayout requiredRole="super_admin"><AdminTeams /></AdminLayout>} />
        <Route path="/admin/teams/:id/members" element={<AdminLayout><TeamMembers /></AdminLayout>} />
        <Route path="/admin/teams/:id/services" element={<AdminLayout><TeamServices /></AdminLayout>} />
        <Route path="/admin/teams/:id/grants" element={<AdminLayout><TeamGrants /></AdminLayout>} />
        <Route path="/admin/users" element={<AdminLayout requiredRole="super_admin"><AdminUsers /></AdminLayout>} />
        <Route path="/admin/audit-logs" element={<AdminLayout requiredRole="super_admin"><AuditLogs /></AdminLayout>} />
        <Route path="/admin/webhooks" element={<AdminLayout requiredRole="super_admin"><Webhooks /></AdminLayout>} />
      </Routes>
      <Toaster />
    </>
  )
}
