import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { InvoiceWithRelations, Company, VatRegime } from '@/types/database'

// Styles pour le PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  logo: {
    maxWidth: 120,
    maxHeight: 60,
    objectFit: 'contain',
  },
  companyInfo: {
    textAlign: 'right',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 4,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  parties: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 40,
  },
  partyBlock: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
  },
  partyTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textTransform: 'uppercase',
  },
  partyName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  partyText: {
    marginBottom: 2,
    color: '#444',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  colDescription: { width: '40%' },
  colQuantity: { width: '15%', textAlign: 'right' },
  colUnitPrice: { width: '15%', textAlign: 'right' },
  colVat: { width: '10%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right' },
  totals: {
    marginLeft: 'auto',
    width: 250,
    marginBottom: 30,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  totalLabel: {
    color: '#666',
  },
  totalValue: {
    fontWeight: 'bold',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#333',
    color: '#fff',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  notes: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  notesText: {
    color: '#444',
  },
  bankInfo: {
    marginBottom: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
  },
  bankTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bankRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bankLabel: {
    width: 60,
    color: '#666',
  },
  bankValue: {
    flex: 1,
  },
  legalMentions: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legalText: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
})

// Formateur de prix - formatage manuel pour éviter les problèmes d'encodage dans react-pdf
const formatCurrency = (amount: number) => {
  const fixed = amount.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  // Ajouter les espaces pour les milliers
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${formatted},${decPart} €`
}

// Formateur de date
const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
  }).format(new Date(date))
}

// Mentions légales selon le régime TVA
const getLegalMentions = (vatRegime: VatRegime, company: Company): string[] => {
  const mentions: string[] = []

  // Mention TVA selon régime
  if (vatRegime === 'franchise') {
    mentions.push('TVA non applicable, article 293 B du Code général des impôts.')
  }

  // Mentions de pénalités de retard (obligatoires)
  mentions.push(
    'En cas de retard de paiement, une pénalité de 3 fois le taux d\'intérêt légal sera appliquée, ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement.'
  )

  // SIRET
  mentions.push(`SIRET : ${company.siret}`)

  // RCS si applicable
  if (company.rcs) {
    mentions.push(`RCS ${company.rcs}`)
  }

  // TVA intracommunautaire si applicable
  if (company.vat_number) {
    mentions.push(`N° TVA : ${company.vat_number}`)
  }

  return mentions
}

interface InvoiceTemplateProps {
  invoice: InvoiceWithRelations
  company: Company
}

export function InvoiceTemplate({ invoice, company }: InvoiceTemplateProps) {
  const legalMentions = getLegalMentions(company.vat_regime, company)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête avec logo et infos entreprise */}
        <View style={styles.header}>
          <View>
            {company.logo_url && (
              <Image
                src={company.logo_url}
                style={styles.logo}
              />
            )}
            <Text style={styles.companyName}>{company.name}</Text>
            {company.trade_name && (
              <Text style={styles.partyText}>{company.trade_name}</Text>
            )}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.partyText}>{company.address}</Text>
            <Text style={styles.partyText}>
              {company.postal_code} {company.city}
            </Text>
            <Text style={styles.partyText}>{company.email}</Text>
            {company.phone && <Text style={styles.partyText}>{company.phone}</Text>}
          </View>
        </View>

        {/* Titre FACTURE */}
        <Text style={styles.invoiceTitle}>FACTURE</Text>

        {/* Informations de la facture */}
        <View style={styles.invoiceInfo}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>N° FACTURE</Text>
            <Text style={styles.infoValue}>{invoice.number}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>DATE D'ÉMISSION</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.issue_date)}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>DATE D'ÉCHÉANCE</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.due_date)}</Text>
          </View>
        </View>

        {/* Émetteur et Destinataire */}
        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyTitle}>Émetteur</Text>
            <Text style={styles.partyName}>{company.name}</Text>
            <Text style={styles.partyText}>{company.address}</Text>
            <Text style={styles.partyText}>
              {company.postal_code} {company.city}
            </Text>
            <Text style={styles.partyText}>SIRET : {company.siret}</Text>
            {company.vat_number && (
              <Text style={styles.partyText}>TVA : {company.vat_number}</Text>
            )}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyTitle}>Facturé à</Text>
            {invoice.client && (
              <>
                <Text style={styles.partyName}>{invoice.client.name}</Text>
                <Text style={styles.partyText}>{invoice.client.address}</Text>
                <Text style={styles.partyText}>
                  {invoice.client.postal_code} {invoice.client.city}
                </Text>
                {invoice.client.siret && (
                  <Text style={styles.partyText}>SIRET : {invoice.client.siret}</Text>
                )}
                {invoice.client.vat_number && (
                  <Text style={styles.partyText}>TVA : {invoice.client.vat_number}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Tableau des prestations */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQuantity}>Quantité</Text>
            <Text style={styles.colUnitPrice}>Prix unit. HT</Text>
            <Text style={styles.colVat}>TVA</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {invoice.items?.map((item, index) => (
            <View
              key={item.id}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQuantity}>{item.quantity}</Text>
              <Text style={styles.colUnitPrice}>{formatCurrency(item.unit_price)}</Text>
              <Text style={styles.colVat}>{item.vat_rate}%</Text>
              <Text style={styles.colTotal}>{formatCurrency(item.total_ht)}</Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.total_ht)}</Text>
          </View>
          {!!invoice.discount_value && invoice.discount_value > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Remise{' '}
                {invoice.discount_type === 'percentage'
                  ? `(${invoice.discount_value}%)`
                  : ''}
              </Text>
              <Text style={styles.totalValue}>
                -{' '}
                {invoice.discount_type === 'amount'
                  ? formatCurrency(invoice.discount_value)
                  : ''}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total TVA</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.total_vat)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total TTC</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(invoice.total_ttc)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Coordonnées bancaires */}
        {(company.iban || company.bic) && (
          <View style={styles.bankInfo}>
            <Text style={styles.bankTitle}>Coordonnées bancaires</Text>
            {company.iban && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>IBAN :</Text>
                <Text style={styles.bankValue}>{company.iban}</Text>
              </View>
            )}
            {company.bic && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>BIC :</Text>
                <Text style={styles.bankValue}>{company.bic}</Text>
              </View>
            )}
          </View>
        )}

        {/* Conditions de paiement */}
        {invoice.payment_terms && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Conditions de paiement</Text>
            <Text style={styles.notesText}>{invoice.payment_terms}</Text>
          </View>
        )}

        {/* Mentions légales */}
        <View style={styles.legalMentions}>
          {legalMentions.map((mention, index) => (
            <Text key={index} style={styles.legalText}>
              {mention}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  )
}
