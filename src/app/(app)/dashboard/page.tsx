import Link from 'next/link'
import Header from '@/components/layout/Header'
import { formatDate, isOverdue, isDueToday, waLink } from '@/lib/utils'
import { readDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const db = await readDB()

  // 1. Leads summary
  const leads = db.leads
  const activeLeads = leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost')
  const leadsByStage: Record<string, number> = {}
  activeLeads.forEach((l) => {
    leadsByStage[l.stage] = (leadsByStage[l.stage] || 0) + 1
  })

  // Follow-ups due today or overdue
  const todayStr = new Date().toISOString().split('T')[0]
  const followUpsDue = leads
    .filter((l) => l.next_follow_up_date && l.next_follow_up_date <= todayStr && l.stage !== 'Won' && l.stage !== 'Lost')
    .sort((a, b) => (a.next_follow_up_date! > b.next_follow_up_date! ? 1 : -1))

  // 2. Orders summary
  const orders = db.orders.map((o) => {
    const customer = db.customers.find((c) => c.id === o.customer_id)
    return {
      ...o,
      customer: customer ? { name: customer.name, business_name: customer.business_name || '', phone: customer.phone || '' } : undefined,
    }
  })

  const recentOrders = orders.filter((o) => o.status !== 'Cancelled').slice(0, 5)

  const now = new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthOrders = orders.filter((o) => o.order_date?.startsWith(currentYearMonth) && o.status !== 'Cancelled')

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Metric Cards (Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Active Orders */}
          <Link href="/orders" className="p-4 bg-card border border-border hover:border-lime/40 rounded-xl transition-colors block">
            <span className="text-xs text-muted font-medium block">Active Orders</span>
            <span className="text-2xl font-bold text-lime font-mono block mt-1">
              {orders.filter((o) => o.status !== 'Cancelled' && o.status !== 'Closed').length}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              {thisMonthOrders.length} order{thisMonthOrders.length === 1 ? '' : 's'} this month
            </span>
          </Link>

          {/* Active Leads */}
          <Link href="/leads" className="p-4 bg-card border border-border hover:border-lime/40 rounded-xl transition-colors block">
            <span className="text-xs text-muted font-medium block">Active Leads</span>
            <span className="text-2xl font-bold text-foreground font-mono block mt-1">
              {activeLeads.length}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              In sales pipeline
            </span>
          </Link>

          {/* Follow-ups Due */}
          <div className="p-4 bg-card border border-border rounded-xl block">
            <span className="text-xs text-muted font-medium block">Follow-ups Due</span>
            <span
              className={`text-2xl font-bold font-mono block mt-1 ${followUpsDue.length > 0 ? 'text-warning' : 'text-foreground'}`}
            >
              {followUpsDue.length}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              {followUpsDue.length === 0 ? 'All caught up 🎉' : 'Due today or overdue'}
            </span>
          </div>
        </div>

        {/* Action Alert: Follow-ups Due */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Follow-ups Due</span>
              {followUpsDue.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/20 text-danger border border-danger/40">
                  {followUpsDue.length}
                </span>
              )}
            </div>
            <Link href="/leads" className="text-xs text-lime hover:underline">
              View all leads →
            </Link>
          </div>

          {followUpsDue.length === 0 ? (
            <p className="text-xs text-muted py-3 text-center">No follow-ups due 🎉</p>
          ) : (
            <div className="space-y-2">
              {followUpsDue.map((lead) => {
                const overdue = isOverdue(lead.next_follow_up_date)
                const today = isDueToday(lead.next_follow_up_date)

                return (
                  <div
                    key={lead.id}
                    className="p-3 bg-black/60 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/leads/${lead.id}`} className="font-semibold text-foreground hover:underline">
                          {lead.name}
                        </Link>
                        {lead.business_name && (
                          <span className="text-muted text-[11px]">({lead.business_name})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`font-semibold text-[10px] ${overdue ? 'text-danger' : today ? 'text-warning' : 'text-muted'
                            }`}
                        >
                          Due: {formatDate(lead.next_follow_up_date)}
                          {overdue ? ' (Overdue)' : today ? ' (Today)' : ''}
                        </span>
                        <span className="text-[10px] text-muted">· Stage: {lead.stage}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {lead.phone && (
                        <a
                          href={waLink(lead.phone, `Hi ${lead.name}, this is Muhammed from Double Tap.`)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-[#25D366] text-black font-semibold rounded text-[11px] hover:bg-[#20ba5a]"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      <Link
                        href={`/leads/${lead.id}`}
                        className="px-2.5 py-1 bg-card border border-border text-foreground rounded text-[11px] hover:bg-card-hover"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Two Columns: Recent Orders & Leads Pipeline */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Recent Orders */}
          <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-foreground">Recent Orders</h2>
              <Link href="/orders" className="text-xs text-lime hover:underline">
                View all orders →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="text-xs text-muted py-6 text-center">No orders yet</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="p-3 bg-black/60 border border-border rounded-lg flex justify-between items-center hover:border-lime/40 text-xs block"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{o.order_no}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border text-muted">
                          {o.status}
                        </span>
                      </div>
                      <span className="text-muted block text-xs mt-0.5">{o.customer?.name}</span>
                      <span className="block text-[10px] text-muted mt-0.5">{formatDate(o.order_date)}</span>
                    </div>
                    <span className="text-muted hover:text-lime text-[11px] font-semibold flex items-center gap-1 transition-colors">
                      View →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Active Leads by Stage */}
          <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-foreground">
                Active Leads Pipeline ({activeLeads.length})
              </h2>
              <Link href="/leads" className="text-xs text-lime hover:underline">
                Kanban view →
              </Link>
            </div>

            {Object.keys(leadsByStage).length === 0 ? (
              <p className="text-xs text-muted py-6 text-center">No active leads</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(leadsByStage).map(([stage, count]) => (
                  <div
                    key={stage}
                    className="flex justify-between items-center p-2.5 bg-black/50 border border-border/60 rounded-lg text-xs"
                  >
                    <span className="text-foreground font-medium">{stage}</span>
                    <span className="px-2 py-0.5 bg-card border border-border rounded font-mono text-lime font-bold">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
