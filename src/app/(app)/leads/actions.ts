'use server'

import { revalidatePath } from 'next/cache'
import { Lead, LeadStage, LeadSource, Activity } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getLeads(
  filters?: {
    stage?: string
    source?: string
    search?: string
  },
  forceFresh = false
): Promise<Lead[]> {
  const db = await readDB(forceFresh)
  console.log('[getLeads] Total leads in db schema:', db.leads.length, 'Filter stage:', filters?.stage)
  let list = [...db.leads]

  if (filters?.stage && filters.stage !== 'ALL') {
    list = list.filter((l) => l.stage === filters.stage)
  }
  if (filters?.source && filters.source !== 'ALL') {
    list = list.filter((l) => l.source === filters.source)
  }
  if (filters?.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    list = list.filter(
      (l) =>
        l.name.toLowerCase().includes(s) ||
        l.business_name?.toLowerCase().includes(s) ||
        l.phone?.toLowerCase().includes(s)
    )
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getLead(id: string): Promise<Lead | null> {
  const db = await readDB()
  return db.leads.find((l) => l.id === id) || null
}

export async function createLead(formData: {
  name: string
  business_name?: string
  business_type?: string
  phone?: string
  source?: LeadSource
  stage?: LeadStage
  interested_product?: string
  objection?: string
  notes?: string
  next_follow_up_date?: string
}) {
  if (!formData.name?.trim()) throw new Error('Name is required')

  const db = await readDB()
  const newLead: Lead = {
    id: `lead_${Date.now()}`,
    user_id: 'owner',
    name: formData.name.trim(),
    business_name: formData.business_name || null,
    business_type: formData.business_type || null,
    phone: formData.phone || null,
    source: formData.source || 'other',
    stage: formData.stage || 'New',
    interested_product: formData.interested_product || null,
    objection: formData.objection || null,
    notes: formData.notes || null,
    next_follow_up_date: formData.next_follow_up_date || null,
    created_at: new Date().toISOString(),
  }

  db.leads.unshift(newLead)
  db.activities.unshift({
    id: `act_${Date.now()}`,
    user_id: 'owner',
    lead_id: newLead.id,
    customer_id: null,
    type: 'note',
    text: 'Lead created',
    created_at: new Date().toISOString(),
  })

  // If created as Won, automatically create customer record
  if (newLead.stage === 'Won') {
    const newCust = {
      id: `cust_${Date.now()}`,
      user_id: 'owner',
      name: newLead.name,
      business_name: newLead.business_name,
      phone: newLead.phone,
      email: null,
      address: null,
      lead_id: newLead.id,
      notes: newLead.notes,
      created_at: new Date().toISOString(),
    }
    db.customers.unshift(newCust)
    db.activities.unshift({
      id: `act_${Date.now() + 1}`,
      user_id: 'owner',
      customer_id: newCust.id,
      lead_id: null,
      type: 'note',
      text: `Customer created from Won lead (${newLead.name})`,
      created_at: new Date().toISOString(),
    })
  }

  await writeDB(db)
  revalidatePath('/leads')
  revalidatePath('/customers')
  return newLead
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  const db = await readDB()
  const idx = db.leads.findIndex((l) => l.id === id)
  if (idx !== -1) {
    const prev = db.leads[idx]
    db.leads[idx] = { ...prev, ...updates }

    // If updated to Won, ensure a corresponding customer exists
    if (updates.stage === 'Won') {
      const existing = db.customers.find(
        (c) => c.lead_id === id || (prev.phone && c.phone && c.phone.trim() === prev.phone.trim())
      )
      if (!existing) {
        const newCust = {
          id: `cust_${Date.now()}`,
          user_id: 'owner',
          name: updates.name || prev.name,
          business_name: updates.business_name !== undefined ? updates.business_name : prev.business_name,
          phone: updates.phone !== undefined ? updates.phone : prev.phone,
          email: null,
          address: null,
          lead_id: id,
          notes: updates.notes !== undefined ? updates.notes : prev.notes,
          created_at: new Date().toISOString(),
        }
        db.customers.unshift(newCust)
        db.activities.unshift({
          id: `act_${Date.now()}`,
          user_id: 'owner',
          customer_id: newCust.id,
          lead_id: null,
          type: 'note',
          text: `Customer created from Won lead (${newCust.name})`,
          created_at: new Date().toISOString(),
        })
      } else if (!existing.lead_id) {
        existing.lead_id = id
      }
    }

    await writeDB(db)
  }
  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  revalidatePath('/customers')
}

export async function deleteLead(id: string) {
  const db = await readDB()
  db.leads = db.leads.filter((l) => l.id !== id)
  db.activities = db.activities.filter((a) => a.lead_id !== id)
  // Clear any dangling references in customers
  db.customers.forEach((c) => {
    if (c.lead_id === id) c.lead_id = null
  })
  await writeDB(db)
  revalidatePath('/leads')
  revalidatePath('/customers')
}

export async function convertToCustomer(leadId: string): Promise<string> {
  const db = await readDB()
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead) throw new Error('Lead not found')

  // Check if customer already exists for this lead
  const existing = db.customers.find(
    (c) => c.lead_id === leadId || (lead.phone && c.phone && c.phone.trim() === lead.phone.trim())
  )
  if (existing) {
    if (lead.stage !== 'Won') {
      lead.stage = 'Won'
      await writeDB(db)
    }
    return existing.id
  }

  const newCust = {
    id: `cust_${Date.now()}`,
    user_id: 'owner',
    name: lead.name,
    business_name: lead.business_name,
    phone: lead.phone,
    email: null,
    address: null,
    lead_id: lead.id,
    notes: lead.notes,
    created_at: new Date().toISOString(),
  }

  db.customers.unshift(newCust)
  lead.stage = 'Won'

  db.activities.unshift({
    id: `act_${Date.now()}`,
    user_id: 'owner',
    customer_id: newCust.id,
    lead_id: null,
    type: 'note',
    text: `Converted from lead (${lead.name})`,
    created_at: new Date().toISOString(),
  })

  await writeDB(db)
  revalidatePath('/leads')
  revalidatePath('/customers')
  return newCust.id
}

export async function getWonLeadCustomer(leadId: string): Promise<string | null> {
  const db = await readDB()
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead) return null
  const cust = db.customers.find(
    (c) => c.lead_id === leadId || (lead.phone && c.phone && c.phone.trim() === lead.phone.trim())
  )
  return cust ? cust.id : null
}

export async function convertLeadToOrder(leadId: string): Promise<{ customerId: string; lead: Lead }> {
  const db = await readDB()
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead) throw new Error('Lead not found')

  lead.stage = 'Won'

  let cust = db.customers.find(
    (c) => c.lead_id === leadId || (lead.phone && c.phone && c.phone.trim() === lead.phone.trim())
  )

  if (!cust) {
    cust = {
      id: `cust_${Date.now()}`,
      user_id: 'owner',
      name: lead.name,
      business_name: lead.business_name,
      phone: lead.phone,
      email: null,
      address: null,
      lead_id: lead.id,
      notes: lead.notes,
      created_at: new Date().toISOString(),
    }
    db.customers.unshift(cust)
    db.activities.unshift({
      id: `act_${Date.now()}`,
      user_id: 'owner',
      customer_id: cust.id,
      lead_id: null,
      type: 'note',
      text: `Customer created from Won lead (${cust.name})`,
      created_at: new Date().toISOString(),
    })
  } else if (!cust.lead_id) {
    cust.lead_id = lead.id
  }

  await writeDB(db)
  revalidatePath('/leads')
  revalidatePath('/customers')
  revalidatePath('/orders')

  return { customerId: cust.id, lead }
}

export async function getLeadActivities(leadId: string): Promise<Activity[]> {
  const db = await readDB()
  return db.activities
    .filter((a) => a.lead_id === leadId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function addLeadActivity(leadId: string, type: Activity['type'], text: string) {
  const db = await readDB()
  db.activities.unshift({
    id: `act_${Date.now()}`,
    user_id: 'owner',
    lead_id: leadId,
    customer_id: null,
    type,
    text,
    created_at: new Date().toISOString(),
  })
  await writeDB(db)
  revalidatePath(`/leads/${leadId}`)
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let insideQuotes = false
  let current = ''
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' || char === "'") {
      insideQuotes = !insideQuotes
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''))
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''))
  return result
}

export async function importLeadsFromCsv(csvText: string): Promise<{ imported: number; errors: string[] }> {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) return { imported: 0, errors: ['CSV is empty or header-only'] }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
  const nameIdx = header.findIndex((h) => h.includes('name') && !h.includes('business'))
  const bizIdx = header.findIndex((h) => h.includes('business'))
  const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile'))
  const sourceIdx = header.findIndex((h) => h.includes('source'))

  const db = await readDB()
  let count = 0
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const name = nameIdx !== -1 ? cols[nameIdx] : cols[0]
    if (!name) {
      errors.push(`Row ${i + 1}: Name missing`)
      continue
    }

    db.leads.unshift({
      id: `lead_${Date.now()}_${i}`,
      user_id: 'owner',
      name,
      business_name: (bizIdx !== -1 ? cols[bizIdx] : '') || null,
      phone: (phoneIdx !== -1 ? cols[phoneIdx] : '') || null,
      source: ((sourceIdx !== -1 ? cols[sourceIdx]?.toLowerCase() : 'other') as LeadSource) || 'other',
      stage: 'New',
      business_type: null,
      interested_product: null,
      objection: null,
      notes: null,
      next_follow_up_date: null,
      created_at: new Date().toISOString(),
    })
    count++
  }

  await writeDB(db)
  revalidatePath('/leads')
  return { imported: count, errors }
}
