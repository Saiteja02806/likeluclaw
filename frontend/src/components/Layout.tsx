import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Key,
  ShoppingBag,
  CreditCard,
  ScrollText,
  Settings,
  Menu,
  X,
  LogOut,
  Plug,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  // { to: '/chat', label: 'Integration Chat', icon: Plug }, // Disabled — focusing on Telegram bot
  { to: '/settings/api-keys', label: 'API Keys', icon: Key },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/integrations', label: 'Integrations', icon: Plug },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/logs', label: 'Logs', icon: ScrollText },
];

const bottomNavItems = [
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || '??';

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-black/[0.06]">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <img src="/logo.svg?v=3" alt="LikelyClaw" className="h-8 w-auto" />
          <span className="text-[15px] font-bold tracking-tight text-[#0a0a0a]">LikelyClaw</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-orange-50 text-orange-600 border-l-2 border-orange-500 pl-[10px]'
                  : 'text-gray-500 hover:text-[#0a0a0a] hover:bg-black/[0.04]'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-black/[0.06] space-y-2">
        {bottomNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-orange-50 text-orange-600 border-l-2 border-orange-500 pl-[10px]'
                  : 'text-gray-500 hover:text-[#0a0a0a] hover:bg-black/[0.04]'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600 shrink-0">
            {initials}
          </div>
          <span className="text-[12px] text-gray-400 truncate flex-1">{user?.email}</span>
          <button onClick={() => signOut()} className="text-gray-400 hover:text-[#0a0a0a] transition-colors cursor-pointer" aria-label="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#fffdfa]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden cursor-default border-none p-0"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-[220px] bg-white border-r border-black/[0.06] text-[#0a0a0a] flex flex-col shrink-0
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-black/[0.06] shadow-sm">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/logo.svg?v=3" alt="LikelyClaw" className="h-7 w-auto" />
            <span className="font-bold text-sm text-[#0a0a0a]">LikelyClaw</span>
          </Link>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-[#0a0a0a] cursor-pointer p-1">
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        <main className={`flex-1 flex flex-col ${location.pathname === '/chat' ? 'overflow-hidden' : 'overflow-auto'}`}>
          {location.pathname === '/chat' ? (
            <div key={location.pathname} className="flex-1 flex flex-col min-h-0 animate-page-enter">
              <Outlet />
            </div>
          ) : (
            <div key={location.pathname} className="max-w-[1100px] mx-auto px-4 py-6 md:px-8 md:py-8 animate-page-enter w-full">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
