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

// SIREN (9 chiffres) d'une partie : colonne dédiée, sinon préfixe du SIRET,
// sinon extrait du n° TVA FR (FRkk + SIREN). C'est l'identifiant pivot de la
// réforme : l'annuaire (0225:SIREN) et le contrôle vendeur des PDP comparent
// LITTÉRALEMENT au SIREN — un SIRET 14 chiffres est rejeté.
function toSiren(ids: {
  siren?: string | null
  siret?: string | null
  vat?: string | null
}): string | null {
  const siren = (ids.siren ?? '').replace(/\s/g, '')
  if (/^\d{9}$/.test(siren)) return siren
  const siret = (ids.siret ?? '').replace(/\s/g, '')
  if (/^\d{14}$/.test(siret)) return siret.slice(0, 9)
  const vat = (ids.vat ?? '').replace(/\s/g, '').toUpperCase()
  if (/^FR[0-9A-Z]{2}\d{9}$/.test(vat)) return vat.slice(4)
  return null
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

  // Remise globale — EN 16931 impose des montants de lignes BRUTS (BT-106 = Σ BT-131)
  // et porte la remise en allowance de document (BT-92), ventilée par catégorie de
  // TVA, sinon rejet BR-CO-10 à la validation. Tous les totaux d'en-tête sont donc
  // recalculés ici à partir des lignes pour garantir la cohérence interne du XML.
  const round2 = (n: number) => Math.round(n * 100) / 100
  const lineTotal = round2(invoice.items.reduce((sum, item) => sum + item.total_ht, 0))
  const discountValue = Number(invoice.discount_value ?? 0)
  const discountTotal =
    discountValue > 0
      ? invoice.discount_type === 'percentage'
        ? round2((lineTotal * discountValue) / 100)
        : Math.min(round2(discountValue), lineTotal)
      : 0

  // Ventilation de la remise par groupe de TVA (au prorata des bases, le dernier
  // groupe absorbe le reliquat d'arrondi) puis bases/taxes après remise.
  const rawGroups = Object.values(vatGroups)
  let allocated = 0
  const groups = rawGroups.map((g, i) => {
    const alloc =
      i === rawGroups.length - 1
        ? round2(discountTotal - allocated)
        : round2((discountTotal * g.base) / (lineTotal || 1))
    allocated = round2(allocated + alloc)
    const basis = round2(g.base - alloc)
    const tax = discountTotal > 0 ? round2((basis * g.rate) / 100) : round2(g.tax)
    return { rate: g.rate, alloc, basis, tax }
  })
  const taxBasisTotal = round2(lineTotal - discountTotal)
  const taxTotal = round2(groups.reduce((sum, g) => sum + g.tax, 0))
  const grandTotal = round2(taxBasisTotal + taxTotal)

  const vatSummary = groups
    .map(
      (g) => `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${fmt(g.tax)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      ${isFranchise ? '<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>' : ''}
      <ram:BasisAmount>${fmt(g.basis)}</ram:BasisAmount>
      <ram:CategoryCode>${isFranchise ? 'E' : 'S'}</ram:CategoryCode>
      <ram:RateApplicablePercent>${g.rate}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`
    )
    .join('')

  const allowances =
    discountTotal > 0
      ? groups
          .filter((g) => g.alloc > 0)
          .map(
            (g) => `
      <ram:SpecifiedTradeAllowanceCharge>
        <ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>
        <ram:ActualAmount>${fmt(g.alloc)}</ram:ActualAmount>
        <ram:Reason>Remise commerciale</ram:Reason>
        <ram:CategoryTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${isFranchise ? 'E' : 'S'}</ram:CategoryCode>
          <ram:RateApplicablePercent>${g.rate}</ram:RateApplicablePercent>
        </ram:CategoryTradeTax>
      </ram:SpecifiedTradeAllowanceCharge>`
          )
          .join('')
      : ''

  const sellerCountry = toCountryCode(company.country)
  const buyerCountry = toCountryCode(invoice.client.country)
  const sellerSiren = toSiren({
    siren: company.siren,
    siret: company.siret,
    vat: company.vat_number,
  })
  const buyerSiren = toSiren({ siret: invoice.client.siret, vat: invoice.client.vat_number })

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
    <ram:IncludedNote><ram:Content>Pas d'escompte pour paiement anticipé.</ram:Content><ram:SubjectCode>AAB</ram:SubjectCode></ram:IncludedNote>
    <ram:IncludedNote><ram:Content>Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.</ram:Content><ram:SubjectCode>PMT</ram:SubjectCode></ram:IncludedNote>
    <ram:IncludedNote><ram:Content>Pénalités de retard : trois fois le taux d'intérêt légal annuel.</ram:Content><ram:SubjectCode>PMD</ram:SubjectCode></ram:IncludedNote>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    ${lineItems}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(company.name)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          ${
            sellerSiren
              ? `<ram:ID schemeID="0002">${sellerSiren}</ram:ID>`
              : `<ram:ID schemeID="0009">${esc(company.siret)}</ram:ID>`
          }
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(company.postal_code)}</ram:PostcodeCode>
          <ram:LineOne>${esc(company.address)}</ram:LineOne>
          <ram:CityName>${esc(company.city)}</ram:CityName>
          <ram:CountryID>${sellerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${
          sellerSiren
            ? `<ram:URIUniversalCommunication><ram:URIID schemeID="0225">${sellerSiren}</ram:URIID></ram:URIUniversalCommunication>`
            : company.email
              ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(company.email)}</ram:URIID></ram:URIUniversalCommunication>`
              : ''
        }
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
        ${
          buyerSiren
            ? `<ram:URIUniversalCommunication><ram:URIID schemeID="0225">${buyerSiren}</ram:URIID></ram:URIUniversalCommunication>`
            : invoice.client.email
              ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(invoice.client.email)}</ram:URIID></ram:URIUniversalCommunication>`
              : ''
        }
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
      ${allowances}
      <ram:SpecifiedTradePaymentTerms>
        ${invoice.payment_terms ? `<ram:Description>${esc(invoice.payment_terms)}</ram:Description>` : ''}
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDate(invoice.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt(lineTotal)}</ram:LineTotalAmount>
        ${discountTotal > 0 ? `<ram:AllowanceTotalAmount>${fmt(discountTotal)}</ram:AllowanceTotalAmount>` : ''}
        <ram:TaxBasisTotalAmount>${fmt(taxBasisTotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmt(taxTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt(grandTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt(grandTotal)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
}
