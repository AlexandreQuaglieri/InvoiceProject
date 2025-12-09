import { createClient } from '@/lib/supabase/server'
import type { MCPTool } from './index'

export const clientTools: MCPTool[] = [
  {
    name: 'list_clients',
    description: 'Liste tous les clients de votre entreprise. Vous pouvez filtrer par nom ou email.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Recherche par nom ou email (optionnel)',
        },
      },
    },
  },
  {
    name: 'get_client',
    description: 'Récupère les détails complets d\'un client spécifique.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID du client',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_client',
    description: 'Crée un nouveau client. Le nom et l\'adresse sont obligatoires.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nom du client ou raison sociale',
        },
        email: {
          type: 'string',
          description: 'Adresse email',
        },
        phone: {
          type: 'string',
          description: 'Numéro de téléphone',
        },
        address: {
          type: 'string',
          description: 'Adresse postale',
        },
        postal_code: {
          type: 'string',
          description: 'Code postal',
        },
        city: {
          type: 'string',
          description: 'Ville',
        },
        country: {
          type: 'string',
          description: 'Pays (défaut: France)',
        },
        siret: {
          type: 'string',
          description: 'Numéro SIRET (14 chiffres)',
        },
        vat_number: {
          type: 'string',
          description: 'Numéro de TVA intracommunautaire',
        },
        type: {
          type: 'string',
          enum: ['individual', 'professional'],
          description: 'Type de client: individual (particulier) ou professional (entreprise)',
        },
        notes: {
          type: 'string',
          description: 'Notes internes sur le client',
        },
      },
      required: ['name', 'address', 'postal_code', 'city'],
    },
  },
  {
    name: 'update_client',
    description: 'Met à jour les informations d\'un client existant.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID du client à modifier',
        },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        postal_code: { type: 'string' },
        city: { type: 'string' },
        country: { type: 'string' },
        siret: { type: 'string' },
        vat_number: { type: 'string' },
        type: { type: 'string', enum: ['individual', 'professional'] },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_client',
    description: 'Supprime un client. Attention: impossible si des factures ou devis sont liés.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID du client à supprimer',
        },
      },
      required: ['id'],
    },
  },
]

export async function executeClientTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const supabase = await createClient()

  // Récupérer l'entreprise de l'utilisateur
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!company) {
    throw new Error('Aucune entreprise configurée. Veuillez d\'abord configurer votre entreprise.')
  }

  switch (name) {
    case 'list_clients': {
      let query = supabase
        .from('clients')
        .select('*')
        .eq('company_id', company.id)
        .order('name', { ascending: true })

      if (args.search) {
        const search = args.search as string
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) throw new Error(`Erreur lors de la récupération des clients: ${error.message}`)

      return {
        count: data?.length || 0,
        clients: data || [],
      }
    }

    case 'get_client': {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', args.id as string)
        .eq('company_id', company.id)
        .single()

      if (error) throw new Error(`Client non trouvé`)

      return data
    }

    case 'create_client': {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          company_id: company.id,
          name: args.name as string,
          email: (args.email as string) || null,
          phone: (args.phone as string) || null,
          address: args.address as string,
          postal_code: args.postal_code as string,
          city: args.city as string,
          country: (args.country as string) || 'France',
          siret: (args.siret as string) || null,
          vat_number: (args.vat_number as string) || null,
          type: (args.type as string) || 'professional',
          notes: (args.notes as string) || null,
        })
        .select()
        .single()

      if (error) throw new Error(`Erreur lors de la création du client: ${error.message}`)

      return {
        success: true,
        message: `Client "${data.name}" créé avec succès`,
        client: data,
      }
    }

    case 'update_client': {
      const updateData: Record<string, unknown> = {}
      const fields = ['name', 'email', 'phone', 'address', 'postal_code', 'city', 'country', 'siret', 'vat_number', 'type', 'notes']

      for (const field of fields) {
        if (args[field] !== undefined) {
          updateData[field] = args[field]
        }
      }

      const { data, error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', args.id as string)
        .eq('company_id', company.id)
        .select()
        .single()

      if (error) throw new Error(`Erreur lors de la mise à jour du client: ${error.message}`)

      return {
        success: true,
        message: `Client "${data.name}" mis à jour`,
        client: data,
      }
    }

    case 'delete_client': {
      // Vérifier qu'il n'y a pas de factures liées
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', args.id as string)
        .limit(1)

      if (invoices && invoices.length > 0) {
        throw new Error('Impossible de supprimer ce client car il a des factures associées')
      }

      // Vérifier qu'il n'y a pas de devis liés
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id')
        .eq('client_id', args.id as string)
        .limit(1)

      if (quotes && quotes.length > 0) {
        throw new Error('Impossible de supprimer ce client car il a des devis associés')
      }

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', args.id as string)
        .eq('company_id', company.id)

      if (error) throw new Error(`Erreur lors de la suppression: ${error.message}`)

      return {
        success: true,
        message: 'Client supprimé avec succès',
      }
    }

    default:
      throw new Error(`Outil client inconnu: ${name}`)
  }
}
