import Link from 'next/link'
import Header from '@/components/layout/Header'
import { formatINR, formatDate, isOverdue, isDueToday, waLink } from '@/lib/utils'
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
    const orderItems = db.order_items.filter((it) => it.order_id === o.id)
    const itemsTotal = orderItems.reduce((sum, it) => sum + (it.qty * it.unit_price), 0)
    const total_amount = Math.max(0, itemsTotal + (o.delivery_charge || 0) - (o.discount || 0))
    const isClosedOrReceived = o.status === 'Closed' || Boolean(o.balance_received)
    const balance_due = isClosedOrReceived ? 0 : Math.max(0, total_amount - (o.advance_amount || 0))
    const profit = orderItems.reduce((sum, it) => {
      const prod = db.products.find((p) => p.id === it.product_id)
      const cost = prod ? prod.my_cost : 0
      return sum + (it.qty * (it.unit_price - cost))
    }, 0) - (o.discount || 0)
    const customer = db.customers.find((c) => c.id === o.customer_id)
    return {
      ...o,
      balance_received: isClosedOrReceived,
      total_amount,
      balance_due,
      profit,
      customer: customer ? { name: customer.name, business_name: customer.business_name || '', phone: customer.phone || '' } : undefined,
    }
  })

  const unpaidOrders = orders.filter((o) => o.status !== 'Cancelled' && o.status !== 'Closed' && (o.balance_due || 0) > 0)
  const totalUnpaidBalances = unpaidOrders.reduce((sum, o) => sum + (o.balance_due || 0), 0)
  const recentOrders = orders.filter((o) => o.status !== 'Cancelled').slice(0, 5)

  const now = new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthOrders = orders.filter((o) => o.order_date?.startsWith(currentYearMonth) && o.status !== 'Cancelled')
  const thisMonthSales = thisMonthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const thisMonthProfit = thisMonthOrders.reduce((sum, o) => sum + (o.profit || 0), 0)

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Metric Cards (Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Month Sales */}
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted font-medium block">This Month Sales</span>
            <span className="text-2xl font-bold text-lime font-mono block mt-1">
              {formatINR(thisMonthSales)}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              {thisMonthOrders.length} order{thisMonthOrders.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Month Profit */}
          <div className="p-4 bg-black border border-lime/30 rounded-xl">
            <span className="text-xs text-lime font-medium flex items-center gap-1">
              <span>🔒</span> This Month Profit
            </span>
            <span className="text-2xl font-bold text-lime font-mono block mt-1">
              {formatINR(thisMonthProfit)}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              Margin: {thisMonthSales > 0 ? `${((thisMonthProfit / thisMonthSales) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>

          {/* Unpaid Balances */}
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted font-medium block">Unpaid Balances</span>
            <span
              className={`text-2xl font-bold font-mono block mt-1 ${totalUnpaidBalances > 0 ? 'text-danger' : 'text-foreground'
                }`}
            >
              {formatINR(totalUnpaidBalances)}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              {unpaidOrders.length} order{unpaidOrders.length === 1 ? '' : 's'} pending
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
                    <span className="font-bold text-lime font-mono">
                      {formatINR(o.total_amount || 0)}
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

        {/* Recent Orders */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-foreground">Recent Orders</h2>
            <Link href="/orders" className="text-xs text-lime hover:underline">
              All Orders →
            </Link>
          </div>

          {orders.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">No orders recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 5).map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="p-3 bg-black/50 border border-border rounded-lg flex justify-between items-center hover:border-lime/40 transition-colors text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-foreground mr-2">{o.order_no}</span>
                    <span className="text-muted">{o.customer?.name}</span>
                    <span className="text-[10px] text-muted block sm:inline sm:ml-2">
                      {formatDate(o.order_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-card border border-border text-foreground">
                      {o.status}
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {formatINR(o.total_amount || 0)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
