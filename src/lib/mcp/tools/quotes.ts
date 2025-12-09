import { createClient } from '@/lib/supabase/server'
import type { MCPTool } from './index'

export const quoteTools: MCPTool[] = [
  {
    name: 'list_quotes',
    description: 'Liste tous vos devis. Filtrez par statut si nécessaire.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'],
          description: 'Filtrer par statut: draft, sent, accepted, rejected, expired, converted',
        },
      },
    },
  },
  {
    name: 'get_quote',
    description: 'Récupère un devis complet avec ses lignes et les informations du client.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID du devis',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_quote',
    description: 'Crée un nouveau devis pour un client.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'ID du client',
        },
        validity_days: {
          type: 'number',
          description: 'Durée de validité en jours (défaut: 30)',
        },
        items: {
          type: 'array',
          description: 'Lignes du devis',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description de la prestation',
              },
              quantity: {
                type: 'number',
                description: 'Quantité',
              },
              unit_price: {
                type: 'number',
                description: 'Prix unitaire HT en euros',
              },
              tax_rate: {
                type: 'number',
                description: 'Taux de TVA en % (défaut: 20)',
              },
            },
            required: ['description', 'quantity', 'unit_price'],
          },
        },
        notes: {
          type: 'string',
          description: 'Notes sur le devis',
        },
        terms: {
          type: 'string',
          description: 'Conditions générales',
        },
      },
      required: ['client_id', 'items'],
    },
  },
  {
    name: 'update_quote_status',
    description: 'Change le statut d\'un devis (ex: marquer comme envoyé, accepté ou refusé).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID du devis',
        },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
          description: 'Nouveau statut',
        },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'convert_quote_to_invoice',
    description: 'Convertit un devis accepté en facture.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID du devis à convertir',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_quote',
    description: 'Supprime un devis. Impossible si déjà converti en facture.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID du devis à supprimer',
        },
      },
      required: ['id'],
    },
  },
]

export async function executeQuoteTool(
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
    case 'list_quotes': {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, name, email)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (args.status) {
        query = query.eq('status', args.status as string)
      }

      const { data, error } = await query

      if (error) throw new Error(`Erreur lors de la récupération des devis: ${error.message}`)

      const quotes = (data || []).map((q) => ({
        id: q.id,
        number: q.quote_number,
        client: q.client?.name || 'N/A',
        status: q.status,
        issue_date: q.issue_date,
        validity_date: q.validity_date,
        total: `${q.total.toFixed(2)} €`,
      }))

      return {
        count: quotes.length,
        quotes,
      }
    }

    case 'get_quote': {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(*),
          items:quote_items(*)
        `)
        .eq('id', args.id as string)
        .eq('user_id', userId)
        .single()

      if (error) throw new Error(`Devis non trouvé`)

      return data
    }

    case 'create_quote': {
      // Générer le numéro de devis
      const { data: lastQuote } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      const currentYear = new Date().getFullYear()
      let nextNum = 1

      if (lastQuote && lastQuote.length > 0) {
        const match = lastQuote[0].quote_number.match(/D-\d{4}-(\d+)/)
        if (match) {
          nextNum = parseInt(match[1], 10) + 1
        }
      }

      const quoteNumber = `D-${currentYear}-${String(nextNum).padStart(3, '0')}`

      // Calculer les totaux
      const items = args.items as Array<{
        description: string
        quantity: number
        unit_price: number
        tax_rate?: number
      }>

      const validityDays = (args.validity_days as number) || 30
      const validityDate = new Date()
      validityDate.setDate(validityDate.getDate() + validityDays)

      let subtotal = 0
      let taxAmount = 0

      const quoteItems = items.map((item, index) => {
        const taxRate = item.tax_rate ?? 20
        const lineTotal = item.quantity * item.unit_price
        const lineTax = lineTotal * (taxRate / 100)

        subtotal += lineTotal
        taxAmount += lineTax

        return {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: taxRate,
          total: lineTotal,
          position: index,
        }
      })

      const total = subtotal + taxAmount

      // Créer le devis
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          user_id: userId,
          company_id: company.id,
          client_id: args.client_id as string,
          quote_number: quoteNumber,
          status: 'draft',
          issue_date: new Date().toISOString().split('T')[0],
          validity_date: validityDate.toISOString().split('T')[0],
          subtotal,
          tax_amount: taxAmount,
          total,
          notes: (args.notes as string) || null,
          terms: (args.terms as string) || null,
        })
        .select()
        .single()

      if (quoteError) throw new Error(`Erreur lors de la création du devis: ${quoteError.message}`)

      // Créer les lignes
      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(
          quoteItems.map((item) => ({
            quote_id: quote.id,
            ...item,
          }))
        )

      if (itemsError) {
        await supabase.from('quotes').delete().eq('id', quote.id)
        throw new Error(`Erreur lors de la création des lignes: ${itemsError.message}`)
      }

      return {
        success: true,
        message: `Devis ${quoteNumber} créé avec succès`,
        quote: {
          id: quote.id,
          number: quoteNumber,
          total: `${total.toFixed(2)} €`,
          validity_date: validityDate.toISOString().split('T')[0],
          status: 'draft',
        },
      }
    }

    case 'update_quote_status': {
      const newStatus = args.status as string

      const { data, error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', args.id as string)
        .eq('user_id', userId)
        .select('quote_number')
        .single()

      if (error) throw new Error(`Erreur lors de la mise à jour: ${error.message}`)

      const statusLabels: Record<string, string> = {
        draft: 'brouillon',
        sent: 'envoyé',
        accepted: 'accepté',
        rejected: 'refusé',
        expired: 'expiré',
      }

      return {
        success: true,
        message: `Devis ${data.quote_number} marqué comme ${statusLabels[newStatus] || newStatus}`,
      }
    }

    case 'convert_quote_to_invoice': {
      // Récupérer le devis
      const { data: quote } = await supabase
        .from('quotes')
        .select(`
          *,
          items:quote_items(*)
        `)
        .eq('id', args.id as string)
        .eq('user_id', userId)
        .single()

      if (!quote) throw new Error('Devis non trouvé')

      if (quote.status === 'converted') {
        throw new Error('Ce devis a déjà été converti en facture')
      }

      // Récupérer le prochain numéro de facture
      const { data: settings } = await supabase
        .from('user_settings')
        .select('invoice_next_number')
        .eq('user_id', userId)
        .single()

      const nextNumber = settings?.invoice_next_number || 1
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const invoiceNumber = `${year}${month}${day}-${String(nextNumber).padStart(2, '0')}`

      // Créer la facture
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          company_id: company.id,
          client_id: quote.client_id,
          number: invoiceNumber,
          status: 'draft',
          issue_date: now.toISOString().split('T')[0],
          due_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: quote.notes,
          total_ht: quote.subtotal,
          total_vat: quote.tax_amount,
          total_ttc: quote.total,
        })
        .select()
        .single()

      if (invoiceError) throw new Error(`Erreur lors de la création de la facture: ${invoiceError.message}`)

      // Créer les lignes de facture
      const quoteItems = quote.items as Array<{
        description: string
        quantity: number
        unit_price: number
        tax_rate: number
        total: number
        position: number
      }>

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(
          quoteItems.map((item) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            vat_rate: item.tax_rate,
            total_ht: item.quantity * item.unit_price,
            total_vat: item.quantity * item.unit_price * (item.tax_rate / 100),
            total_ttc: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
            position: item.position,
          }))
        )

      if (itemsError) {
        await supabase.from('invoices').delete().eq('id', invoice.id)
        throw new Error(`Erreur lors de la création des lignes: ${itemsError.message}`)
      }

      // Mettre à jour le devis
      await supabase
        .from('quotes')
        .update({
          status: 'converted',
          converted_invoice_id: invoice.id,
        })
        .eq('id', quote.id)

      // Incrémenter le numéro de facture
      await supabase
        .from('user_settings')
        .update({ invoice_next_number: nextNumber + 1 })
        .eq('user_id', userId)

      return {
        success: true,
        message: `Devis ${quote.quote_number} converti en facture ${invoiceNumber}`,
        invoice: {
          id: invoice.id,
          number: invoiceNumber,
        },
      }
    }

    case 'delete_quote': {
      const { data: quote } = await supabase
        .from('quotes')
        .select('status, quote_number')
        .eq('id', args.id as string)
        .eq('user_id', userId)
        .single()

      if (!quote) throw new Error('Devis non trouvé')

      if (quote.status === 'converted') {
        throw new Error('Impossible de supprimer un devis converti en facture')
      }

      // Supprimer les lignes puis le devis
      await supabase.from('quote_items').delete().eq('quote_id', args.id as string)

      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', args.id as string)
        .eq('user_id', userId)

      if (error) throw new Error(`Erreur lors de la suppression: ${error.message}`)

      return {
        success: true,
        message: `Devis ${quote.quote_number} supprimé`,
      }
    }

    default:
      throw new Error(`Outil devis inconnu: ${name}`)
  }
}
