import { Link, useNavigate } from 'react-router-dom'

export default function Nav() {
  const navigate = useNavigate()
  async function logout() {
    localStorage.removeItem('speculo_token')
    await fetch('/auth/logout', { method: 'POST' }).catch(() => {})
    navigate('/login')
  }
  return (
    <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-purple-400">Speculo</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/import" className="text-gray-400 hover:text-white">Import</Link>
          <Link to="/settings/tokens" className="text-gray-400 hover:text-white">Tokens</Link>
          <button onClick={logout} className="text-gray-500 hover:text-white">Logout</button>
        </div>
      </div>
    </nav>
  )
}
