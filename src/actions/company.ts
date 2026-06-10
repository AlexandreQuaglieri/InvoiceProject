'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { companySchema, type CompanyFormData } from '@/lib/validations/company'
import type { Company } from '@/types/database'

export async function getCompany(): Promise<Company | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Pas de company trouvée
      return null
    }
    console.error('Error fetching company:', error)
    return null
  }

  return data
}

export async function createCompany(
  formData: CompanyFormData
): Promise<{ success: boolean; error?: string; data?: Company }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  // Vérifier si l'utilisateur a déjà une entreprise
  const existing = await getCompany()
  if (existing) {
    return { success: false, error: 'Vous avez déjà une entreprise configurée' }
  }

  // Valider les données
  const validation = companySchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  // Créer l'entreprise
  const { data, error } = await supabase
    .from('companies')
    .insert({
      user_id: user.id,
      ...validation.data,
      website: validation.data.website || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating company:', error)
    return { success: false, error: 'Erreur lors de la création de l\'entreprise' }
  }

  revalidatePath('/company')
  return { success: true, data }
}

export async function updateCompany(
  formData: CompanyFormData
): Promise<{ success: boolean; error?: string; data?: Company }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  // Valider les données
  const validation = companySchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  // Mettre à jour l'entreprise
  const { data, error } = await supabase
    .from('companies')
    .update({
      ...validation.data,
      website: validation.data.website || null,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating company:', error)
    return { success: false, error: 'Erreur lors de la mise à jour de l\'entreprise' }
  }

  revalidatePath('/company')
  return { success: true, data }
}

export async function uploadLogo(
  formData: FormData
): Promise<{ success: boolean; error?: string; url?: string; data?: Company }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { success: false, error: 'Aucun fichier fourni' }
  }

  // Vérifier le type de fichier
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: 'Type de fichier non autorisé' }
  }

  // Vérifier la taille (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: 'Le fichier est trop volumineux (max 2MB)' }
  }

  let fileBuffer: Buffer
  let fileName: string
  let contentType: string

  // Convertir en WebP sauf pour les SVG
  if (file.type === 'image/svg+xml') {
    // Garder le SVG tel quel
    const bytes = await file.arrayBuffer()
    fileBuffer = Buffer.from(bytes)
    fileName = `${company.id}/logo.svg`
    contentType = 'image/svg+xml'
  } else {
    // Convertir en WebP avec sharp
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    fileBuffer = await sharp(inputBuffer)
      .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()

    fileName = `${company.id}/logo.webp`
    contentType = 'image/webp'
  }

  // Upload le fichier
  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(fileName, fileBuffer, {
      upsert: true,
      contentType,
    })

  if (uploadError) {
    console.error('Error uploading logo:', uploadError)
    return { success: false, error: 'Erreur lors de l\'upload du logo' }
  }

  // Récupérer l'URL publique
  const {
    data: { publicUrl },
  } = supabase.storage.from('logos').getPublicUrl(fileName)

  // Mettre à jour l'entreprise avec l'URL du logo
  const { data: updated, error: updateError } = await supabase
    .from('companies')
    .update({ logo_url: publicUrl })
    .eq('id', company.id)
    .select()
    .single()

  if (updateError) {
    console.error('Error updating logo URL:', updateError)
    return { success: false, error: 'Erreur lors de la mise à jour du logo' }
  }

  revalidatePath('/company')
  return { success: true, url: publicUrl, data: updated }
}
