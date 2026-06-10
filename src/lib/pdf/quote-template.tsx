import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { QuoteWithRelations, Company } from '@/types/database'

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
  quoteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  quoteInfo: {
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
})

const formatCurrency = (amount: number) => {
  const fixed = amount.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${formatted},${decPart} EUR`
}

const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(date))
}

interface QuoteTemplateProps {
  quote: QuoteWithRelations
  company: Company
}

export function QuoteTemplate({ quote, company }: QuoteTemplateProps) {
  const legalMentions: string[] = []

  if (company.vat_regime === 'franchise') {
    legalMentions.push('TVA non applicable, article 293 B du Code general des impots.')
  }
  legalMentions.push(
    "En cas de retard de paiement, une penalite de 3 fois le taux d'interet legal sera appliquee, ainsi qu'une indemnite forfaitaire de 40 EUR pour frais de recouvrement."
  )
  legalMentions.push(`SIRET : ${company.siret}`)
  if (company.rcs) legalMentions.push(`RCS ${company.rcs}`)
  if (company.vat_number) legalMentions.push(`N° TVA : ${company.vat_number}`)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            {company.logo_url && (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (pas un élément DOM, pas de prop alt)
              <Image src={company.logo_url} style={styles.logo} />
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

        {/* Titre */}
        <Text style={styles.quoteTitle}>DEVIS</Text>

        {/* Infos devis */}
        <View style={styles.quoteInfo}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>N° DEVIS</Text>
            <Text style={styles.infoValue}>{quote.quote_number}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>DATE D&apos;EMISSION</Text>
            <Text style={styles.infoValue}>{formatDate(quote.issue_date)}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>VALABLE JUSQU&apos;AU</Text>
            <Text style={styles.infoValue}>{formatDate(quote.validity_date)}</Text>
          </View>
        </View>

        {/* Émetteur et Destinataire */}
        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyTitle}>Emetteur</Text>
            <Text style={styles.partyName}>{company.name}</Text>
            <Text style={styles.partyText}>{company.address}</Text>
            <Text style={styles.partyText}>
              {company.postal_code} {company.city}
            </Text>
            <Text style={styles.partyText}>SIRET : {company.siret}</Text>
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyTitle}>Devis pour</Text>
            {quote.client && (
              <>
                <Text style={styles.partyName}>{quote.client.name}</Text>
                <Text style={styles.partyText}>{quote.client.address}</Text>
                <Text style={styles.partyText}>
                  {quote.client.postal_code} {quote.client.city}
                </Text>
                {quote.client.siret && (
                  <Text style={styles.partyText}>SIRET : {quote.client.siret}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Tableau des lignes */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQuantity}>Quantite</Text>
            <Text style={styles.colUnitPrice}>Prix unit. HT</Text>
            <Text style={styles.colVat}>TVA</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {quote.items?.map((item, index) => (
            <View
              key={item.id}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQuantity}>{item.quantity}</Text>
              <Text style={styles.colUnitPrice}>{formatCurrency(item.unit_price)}</Text>
              <Text style={styles.colVat}>{item.tax_rate}%</Text>
              <Text style={styles.colTotal}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total TVA</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.tax_amount)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total TTC</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(quote.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{quote.notes}</Text>
          </View>
        )}

        {/* Conditions */}
        {quote.terms && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Conditions</Text>
            <Text style={styles.notesText}>{quote.terms}</Text>
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
