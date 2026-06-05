// Service Clients — logique métier unique (create/update/delete + résolution par nom).
import { type DbClient, type Ctx, type ServiceResult, ok, err } from './core'
import type { Client, ClientType } from '@/types/database'

export type CreateClientInput = {
  name: string
  type?: ClientType
  address: string
  postal_code: string
  city: string
  country?: string
  email?: string | null
  phone?: string | null
  siret?: string | null
  vat_number?: string | null
  notes?: string | null
}

export type UpdateClientPatch = Partial<CreateClientInput>

export async function create(
  supabase: DbClient,
  ctx: Ctx,
  input: CreateClientInput
): Promise<ServiceResult<Client>> {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      company_id: ctx.companyId,
      type: input.type ?? 'professional',
      name: input.name,
      address: input.address,
      postal_code: input.postal_code,
      city: input.city,
      country: input.country || 'France',
      email: input.email ?? null,
      phone: input.phone ?? null,
      siret: input.siret ?? null,
      vat_number: input.vat_number ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (error) return err(error.message)
  return ok(data as Client)
}

// Résout un client par nom (recherche partielle, premier résultat). Utilisé par
// l'assistant IA qui manipule des noms ; les routes ID-based passent directement l'ID.
export async function findByName(
  supabase: DbClient,
  ctx: Ctx,
  name: string
): Promise<ServiceResult<{ id: string; name: string }>> {
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('company_id', ctx.companyId)
    .ilike('name', `%${name}%`)
    .limit(1)

  if (!data || data.length === 0) {
    return err(`Client "${name}" non trouvé.`)
  }
  return ok(data[0] as { id: string; name: string })
}

export async function update(
  supabase: DbClient,
  ctx: Ctx,
  clientId: string,
  patch: UpdateClientPatch
): Promise<ServiceResult<{ id: string; name: string; updatedFields: string[] }>> {
  const updateData: Record<string, unknown> = {}
  if (patch.name !== undefined) updateData.name = patch.name
  if (patch.type !== undefined) updateData.type = patch.type
  if (patch.address !== undefined) updateData.address = patch.address
  if (patch.postal_code !== undefined) updateData.postal_code = patch.postal_code
  if (patch.city !== undefined) updateData.city = patch.city
  if (patch.country !== undefined) updateData.country = patch.country
  if (patch.email !== undefined) updateData.email = patch.email
  if (patch.phone !== undefined) updateData.phone = patch.phone
  if (patch.siret !== undefined) updateData.siret = patch.siret
  if (patch.vat_number !== undefined) updateData.vat_number = patch.vat_number

  if (Object.keys(updateData).length === 0) {
    return err('Aucune modification spécifiée.')
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', clientId)
    .eq('company_id', ctx.companyId)
    .select('id, name')
    .single()

  if (error) return err(error.message)
  return ok({ id: data.id, name: data.name, updatedFields: Object.keys(updateData) })
}

// Supprime un client (refus si des factures ou devis y sont liés).
export async function remove(
  supabase: DbClient,
  ctx: Ctx,
  clientId: string
): Promise<ServiceResult<{ name: string }>> {
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!client) return err('Client non trouvé.')

  const { count: invoiceCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
  const { count: quoteCount } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if ((invoiceCount || 0) > 0 || (quoteCount || 0) > 0) {
    return err(
      `Impossible de supprimer "${client.name}": ${invoiceCount || 0} facture(s) et ${quoteCount || 0} devis liés.`
    )
  }

  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) return err(error.message)
  return ok({ name: client.name })
}

// ---- Lecture ----

export type ClientListItem = {
  id: string
  name: string
  email: string | null
  city: string
  type: ClientType
}

export async function list(
  supabase: DbClient,
  ctx: Ctx,
  opts: { search?: string; limit?: number } = {}
): Promise<ServiceResult<ClientListItem[]>> {
  let query = supabase
    .from('clients')
    .select('id, name, email, city, type')
    .eq('company_id', ctx.companyId)
    .order('name')

  if (opts.search) {
    query = query.or(`name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`)
  }
  if (opts.limit) query = query.limit(opts.limit)

  const { data, error } = await query
  if (error) return err(error.message)
  return ok((data ?? []) as ClientListItem[])
}

export async function getById(
  supabase: DbClient,
  ctx: Ctx,
  clientId: string
): Promise<ServiceResult<Client>> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (error) return err(error.message)
  if (!data) return err('Client non trouvé.')
  return ok(data as Client)
}
