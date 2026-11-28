'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const sidebarItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/customers', label: 'Customers' },
  { href: '/orders', label: 'Orders' },
  { href: '/products', label: 'Products' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/settings', label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card min-h-screen">
      {/* Brand */}
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-black border border-lime flex items-center justify-center font-black text-sm text-lime shadow-sm shrink-0">
          dt
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none">
            <span className="text-lime">Double</span> Tap
          </h1>
          <p className="text-xs text-muted mt-1">Create. Code. Connect.</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {sidebarItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-lime/10 text-lime'
                  : 'text-muted hover:text-foreground hover:bg-card-hover'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-border text-[11px] text-muted">
        Double Tap NFC · Calicut
      </div>
    </aside>
  )
}
