import type { Company, InvoiceWithRelations } from '@/types/database'

function esc(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

function fmt(amount: number): string {
  return amount.toFixed(2)
}

// Convertit un nom de pays en code ISO 3166-1 alpha-2
function toCountryCode(country: string): string {
  const map: Record<string, string> = {
    france: 'FR',
    'france métropolitaine': 'FR',
    belgique: 'BE',
    suisse: 'CH',
    luxembourg: 'LU',
    allemagne: 'DE',
    espagne: 'ES',
    italie: 'IT',
    'royaume-uni': 'GB',
    'united kingdom': 'GB',
    'états-unis': 'US',
    'united states': 'US',
  }
  const lower = country.toLowerCase().trim()
  return map[lower] ?? (country.length === 2 ? country.toUpperCase() : 'FR')
}

export function generateFacturXXml(
  invoice: InvoiceWithRelations,
  company: Company
): string {
  const isFranchise = company.vat_regime === 'franchise'

  // Regrouper les lignes par taux de TVA pour le récapitulatif
  const vatGroups = invoice.items.reduce(
    (acc, item) => {
      const rate = item.vat_rate
      if (!acc[rate]) acc[rate] = { rate, base: 0, tax: 0 }
      acc[rate].base += item.total_ht
      acc[rate].tax += item.total_vat
      return acc
    },
    {} as Record<number, { rate: number; base: number; tax: number }>
  )

  const lineItems = invoice.items
    .map(
      (item, i) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${fmt(item.unit_price)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${isFranchise ? 'E' : 'S'}</ram:CategoryCode>
          <ram:RateApplicablePercent>${item.vat_rate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${fmt(item.total_ht)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    )
    .join('')

  const vatSummary = Object.values(vatGroups)
    .map(
      (g) => `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${fmt(g.tax)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      ${isFranchise ? '<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>' : ''}
      <ram:BasisAmount>${fmt(g.base)}</ram:BasisAmount>
      <ram:CategoryCode>${isFranchise ? 'E' : 'S'}</ram:CategoryCode>
      <ram:RateApplicablePercent>${g.rate}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`
    )
    .join('')

  const sellerCountry = toCountryCode(company.country)
  const buyerCountry = toCountryCode(invoice.client.country)

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:qualified:UnqualifiedDataType:100"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDate(invoice.issue_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoice.notes ? `<ram:IncludedNote><ram:Content>${esc(invoice.notes)}</ram:Content></ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    ${lineItems}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(company.name)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0009">${esc(company.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(company.postal_code)}</ram:PostcodeCode>
          <ram:LineOne>${esc(company.address)}</ram:LineOne>
          <ram:CityName>${esc(company.city)}</ram:CityName>
          <ram:CountryID>${sellerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${company.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(company.email)}</ram:URIID></ram:URIUniversalCommunication>` : ''}
        ${
          company.vat_number
            ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(company.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>`
            : `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(company.siret)}</ram:ID></ram:SpecifiedTaxRegistration>`
        }
      </ram:SellerTradeParty>

      <ram:BuyerTradeParty>
        <ram:Name>${esc(invoice.client.name)}</ram:Name>
        ${
          invoice.client.siret
            ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0009">${esc(invoice.client.siret)}</ram:ID></ram:SpecifiedLegalOrganization>`
            : ''
        }
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(invoice.client.postal_code)}</ram:PostcodeCode>
          <ram:LineOne>${esc(invoice.client.address)}</ram:LineOne>
          <ram:CityName>${esc(invoice.client.city)}</ram:CityName>
          <ram:CountryID>${buyerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${invoice.client.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(invoice.client.email)}</ram:URIID></ram:URIUniversalCommunication>` : ''}
        ${invoice.client.vat_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(invoice.client.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${
        company.iban
          ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(company.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>`
          : ''
      }
      ${vatSummary}
      <ram:SpecifiedTradePaymentTerms>
        ${invoice.payment_terms ? `<ram:Description>${esc(invoice.payment_terms)}</ram:Description>` : ''}
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDate(invoice.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt(invoice.total_ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt(invoice.total_ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmt(invoice.total_vat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt(invoice.total_ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt(invoice.total_ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
}
