'use server'

import { revalidatePath } from 'next/cache'
import { Lead, LeadStage, LeadSource, Activity } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getLeads(filters?: {
  stage?: string
  source?: string
  search?: string
}): Promise<Lead[]> {
  const db = await readDB()
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

  await writeDB(db)
  revalidatePath('/leads')
  return newLead
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  const db = await readDB()
  const idx = db.leads.findIndex((l) => l.id === id)
  if (idx !== -1) {
    db.leads[idx] = { ...db.leads[idx], ...updates }
    await writeDB(db)
  }
  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
}

export async function deleteLead(id: string) {
  const db = await readDB()
  db.leads = db.leads.filter((l) => l.id !== id)
  db.activities = db.activities.filter((a) => a.lead_id !== id)
  await writeDB(db)
  revalidatePath('/leads')
}

export async function convertToCustomer(leadId: string): Promise<string> {
  const db = await readDB()
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead) throw new Error('Lead not found')

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

export async function importLeadsFromCsv(csvText: string): Promise<{ imported: number; errors: string[] }> {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) return { imported: 0, errors: ['CSV is empty or header-only'] }

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''))
  const nameIdx = header.findIndex((h) => h.includes('name') && !h.includes('business'))
  const bizIdx = header.findIndex((h) => h.includes('business'))
  const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile'))
  const sourceIdx = header.findIndex((h) => h.includes('source'))

  const db = await readDB()
  let count = 0
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''))
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
