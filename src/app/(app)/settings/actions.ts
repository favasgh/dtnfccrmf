'use server'

import { revalidatePath } from 'next/cache'
import { Settings, WhatsAppTemplate } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getSettings(): Promise<Settings['data']> {
  const db = await readDB()
  return db.settings
}

export async function updateSettings(settingsData: Settings['data']) {
  const db = await readDB()
  db.settings = { ...db.settings, ...settingsData }
  await writeDB(db)
  revalidatePath('/settings')
}

export async function getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const db = await readDB()
  return db.whatsapp_templates
}

export async function createWhatsAppTemplate(name: string, template: string) {
  const db = await readDB()
  db.whatsapp_templates.push({
    id: `tpl_${Date.now()}`,
    user_id: 'owner',
    name: name.trim(),
    template: template.trim(),
    created_at: new Date().toISOString(),
  })
  await writeDB(db)
  revalidatePath('/settings')
}

export async function updateWhatsAppTemplate(id: string, name: string, template: string) {
  const db = await readDB()
  const idx = db.whatsapp_templates.findIndex((t) => t.id === id)
  if (idx !== -1) {
    db.whatsapp_templates[idx] = {
      ...db.whatsapp_templates[idx],
      name: name.trim(),
      template: template.trim(),
    }
    await writeDB(db)
  }
  revalidatePath('/settings')
}

export async function deleteWhatsAppTemplate(id: string) {
  const db = await readDB()
  db.whatsapp_templates = db.whatsapp_templates.filter((t) => t.id !== id)
  await writeDB(db)
  revalidatePath('/settings')
}
