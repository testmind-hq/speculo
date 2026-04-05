import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  Upload,
  GitCompare,
  Users,
  ScrollText,
  Webhook,
  Sun,
  Moon,
  ChevronUp,
  KeyRound,
  LogOut,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/components/ThemeProvider'
import { api } from '@/lib/api'

type NavItem = {
  icon: React.ReactNode
  label: string
  to: string
  match?: (path: string) => boolean
}

const NAV_MAIN: NavItem[] = [
  { icon: <LayoutGrid size={14} />, label: '服务目录', to: '/' },
  { icon: <Upload size={14} />, label: '导入 Spec', to: '/import' },
  { icon: <GitCompare size={14} />, label: '版本对比', to: '/diff' },
]

const NAV_ADMIN_OWNER: NavItem[] = [
  { icon: <Users size={14} />, label: '团队 & 用户', to: '/admin/teams', match: p => p.startsWith('/admin/teams') || p.startsWith('/admin/users') },
]

const NAV_ADMIN_SUPER: NavItem[] = [
  { icon: <ScrollText size={14} />, label: '审计日志', to: '/admin/audit-logs' },
  { icon: <Webhook size={14} />, label: 'Webhooks', to: '/admin/webhooks' },
]

function NavLink({ item, activePath }: { item: NavItem; activePath: string }) {
  const active = item.match ? item.match(activePath) : activePath === item.to
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-violet-950/60 text-violet-300 font-medium'
          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300'
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const isSuperAdmin = role === 'super_admin'
  const isTeamOwner = role === 'team_owner'
  const hasAdminSection = isSuperAdmin || isTeamOwner

  useEffect(() => {
    api.me().then(me => { setEmail(me.email); setRole(me.role ?? '') }).catch(() => {})
  }, [])

  async function logout() {
    localStorage.removeItem('speculo_token')
    localStorage.removeItem('speculo_role')
    await fetch('/auth/logout', { method: 'POST' }).catch(() => {})
    navigate('/login')
  }

  return (
    <aside className="flex h-screen w-[210px] shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-700 text-xs font-bold text-white shrink-0">
          S
        </div>
        <span className="text-sm font-semibold text-foreground">Speculo</span>
      </div>

      <Separator />

      {/* Nav items */}
      <nav className="flex-1 overflow-hidden px-2 py-3 space-y-0.5">
        {NAV_MAIN.map(item => <NavLink key={item.to} item={item} activePath={location.pathname} />)}

        {hasAdminSection && (
          <>
            <div className="px-2.5 pt-4 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                管理
              </p>
            </div>
            {(isSuperAdmin || isTeamOwner) && NAV_ADMIN_OWNER.map(item => (
              <NavLink key={item.to} item={item} activePath={location.pathname} />
            ))}
            {isSuperAdmin && NAV_ADMIN_SUPER.map(item => (
              <NavLink key={item.to} item={item} activePath={location.pathname} />
            ))}
          </>
        )}
      </nav>

      {/* Theme toggle */}
      <div className="px-2 pb-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>

      <Separator />

      {/* User footer */}
      <div className="px-2 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-zinc-800/60 transition-colors">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-900 text-xs font-semibold text-violet-300 shrink-0">
                {email ? email[0].toUpperCase() : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{email || '…'}</p>
                <p className="truncate text-[10px] text-muted-foreground">{role}</p>
              </div>
              <ChevronUp size={12} className="text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[190px]">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-foreground truncate">{email}</p>
              <p className="text-[10px] text-muted-foreground">{role}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings/tokens')}>
              <KeyRound size={13} className="mr-2" />
              MCP Tokens
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut size={13} className="mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
