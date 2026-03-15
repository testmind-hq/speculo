import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.js'
import Catalog from './pages/Catalog.js'
import Import from './pages/Import.js'
import Tokens from './pages/Tokens.js'
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateLayout><Catalog /></PrivateLayout>} />
      <Route path="/import" element={<PrivateLayout><Import /></PrivateLayout>} />
      <Route path="/settings/tokens" element={<PrivateLayout><Tokens /></PrivateLayout>} />
    </Routes>
  )
}
