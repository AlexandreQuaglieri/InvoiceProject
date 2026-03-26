import { AFRelationship, PDFDocument, PDFName } from 'pdf-lib'

/**
 * Embarque le XML Factur-X dans le PDF et ajoute les métadonnées XMP PDF/A-3.
 * Le fichier résultant est reconnu comme Factur-X EN16931 par les PDP et Chorus Pro.
 */
export async function embedFacturX(
  pdfBuffer: Buffer,
  xmlContent: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { updateMetadata: false })

  // 1. Embarquer le XML en tant que pièce jointe avec la relation "Alternative"
  const xmlBytes = new TextEncoder().encode(xmlContent)
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Factur-X',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Alternative,
  })

  // 2. Ajouter les métadonnées XMP pour conformité PDF/A-3
  const now = new Date().toISOString()
  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:MetadataDate>${now}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

  const xmpBytes = new TextEncoder().encode(xmp)
  const metadataStream = pdfDoc.context.stream(xmpBytes, {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
    Length: xmpBytes.length,
  })
  const metadataRef = pdfDoc.context.register(metadataStream)
  pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef)

  const result = await pdfDoc.save()
  return Buffer.from(result)
}
