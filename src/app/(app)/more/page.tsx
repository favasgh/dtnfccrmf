// "More" page — mobile menu for items not in the bottom nav
import Link from 'next/link'
import Header from '@/components/layout/Header'

const moreItems = [
  { href: '/customers', label: 'Customers', desc: 'View and manage customers' },
  { href: '/products', label: 'Products', desc: 'Edit prices and costs' },
  { href: '/accounts', label: 'Accounts & Cash Flow', desc: 'Track expenses, Printo bills, income & cash balance' },
  { href: '/settings', label: 'Settings', desc: 'Business details, payment info, templates' },
]

export default function MorePage() {
  return (
    <>
      <Header title="More" />
      <div className="p-4 space-y-2">
        {moreItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block p-4 bg-card rounded-lg border border-border
                       hover:bg-card-hover transition-colors"
          >
            <p className="font-semibold">{item.label}</p>
            <p className="text-sm text-muted mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
