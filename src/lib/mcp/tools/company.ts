import { createClient } from '@/lib/supabase/server'
import type { MCPTool } from './index'

export const companyTools: MCPTool[] = [
  {
    name: 'get_company',
    description: 'Récupère les informations de votre entreprise (nom, SIRET, adresse, régime TVA, coordonnées bancaires, etc.).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_company',
    description: 'Met à jour les informations de votre entreprise. Certains champs comme le SIRET ne sont pas modifiables ici.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Raison sociale',
        },
        trade_name: {
          type: 'string',
          description: 'Nom commercial',
        },
        address: {
          type: 'string',
          description: 'Adresse',
        },
        postal_code: {
          type: 'string',
          description: 'Code postal',
        },
        city: {
          type: 'string',
          description: 'Ville',
        },
        email: {
          type: 'string',
          description: 'Email de contact',
        },
        phone: {
          type: 'string',
          description: 'Téléphone',
        },
        website: {
          type: 'string',
          description: 'Site web',
        },
        iban: {
          type: 'string',
          description: 'IBAN pour les paiements',
        },
        bic: {
          type: 'string',
          description: 'Code BIC/SWIFT',
        },
      },
    },
  },
]

export async function executeCompanyTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const supabase = await createClient()

  switch (name) {
    case 'get_company': {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        throw new Error('Aucune entreprise configurée. Allez dans /company pour configurer votre entreprise.')
      }

      // Formater pour une meilleure lisibilité
      const legalFormLabels: Record<string, string> = {
        auto_entrepreneur: 'Auto-entrepreneur',
        ei: 'Entreprise Individuelle',
        eurl: 'EURL',
        sarl: 'SARL',
        sasu: 'SASU',
        sas: 'SAS',
        sa: 'SA',
        association: 'Association',
        profession_liberale: 'Profession libérale',
      }

      const vatRegimeLabels: Record<string, string> = {
        franchise: 'Franchise en base de TVA (non assujetti)',
        reel_simplifie: 'Réel simplifié',
        reel_normal: 'Réel normal',
      }

      return {
        id: data.id,
        name: data.name,
        trade_name: data.trade_name,
        legal_form: legalFormLabels[data.legal_form] || data.legal_form,
        siret: data.siret,
        siren: data.siren,
        vat_number: data.vat_number,
        vat_regime: vatRegimeLabels[data.vat_regime] || data.vat_regime,
        address: {
          street: data.address,
          postal_code: data.postal_code,
          city: data.city,
          country: data.country,
        },
        contact: {
          email: data.email,
          phone: data.phone,
          website: data.website,
        },
        bank: {
          iban: data.iban,
          bic: data.bic,
        },
        capital: data.capital ? `${data.capital} €` : null,
        rcs: data.rcs,
        has_logo: !!data.logo_url,
      }
    }

    case 'update_company': {
      // Récupérer l'entreprise actuelle
      const { data: currentCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!currentCompany) {
        throw new Error('Aucune entreprise configurée')
      }

      // Champs modifiables
      const allowedFields = [
        'name',
        'trade_name',
        'address',
        'postal_code',
        'city',
        'email',
        'phone',
        'website',
        'iban',
        'bic',
      ]

      const updateData: Record<string, unknown> = {}

      for (const field of allowedFields) {
        if (args[field] !== undefined) {
          updateData[field] = args[field]
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('Aucun champ à mettre à jour')
      }

      const { data, error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', currentCompany.id)
        .eq('user_id', userId)
        .select('name')
        .single()

      if (error) throw new Error(`Erreur lors de la mise à jour: ${error.message}`)

      return {
        success: true,
        message: `Entreprise "${data.name}" mise à jour`,
        updated_fields: Object.keys(updateData),
      }
    }

    default:
      throw new Error(`Outil entreprise inconnu: ${name}`)
  }
}
