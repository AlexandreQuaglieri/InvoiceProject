const SANDBOX_TOKEN_URL = 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token'
const PROD_TOKEN_URL = 'https://oauth.piste.gouv.fr/api/oauth/token'
const SANDBOX_API_URL = 'https://sandbox-api.piste.gouv.fr/cpro'
const PROD_API_URL = 'https://api.piste.gouv.fr/cpro'

export interface ChorusProCredentials {
  clientId: string
  clientSecret: string
  login: string
  password: string
  sandbox: boolean
}

export interface DepotFluxResult {
  numeroFluxDepot: string
  dateDepot: string
  codeRetour?: string
  libelle?: string
}

async function getToken(credentials: ChorusProCredentials): Promise<string> {
  const tokenUrl = credentials.sandbox ? SANDBOX_TOKEN_URL : PROD_TOKEN_URL

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: 'openid',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Authentification PISTE échouée (${response.status}): ${body}`)
  }

  const data = await response.json()
  return data.access_token as string
}

/**
 * Soumet un flux Factur-X (XML CII) à Chorus Pro via PISTE.
 * Retourne le numéro de flux de dépôt.
 */
export async function deposerFluxFacturX(
  credentials: ChorusProCredentials,
  xmlContent: string,
  invoiceNumber: string
): Promise<DepotFluxResult> {
  const token = await getToken(credentials)
  const apiBase = credentials.sandbox ? SANDBOX_API_URL : PROD_API_URL

  const cpAccount = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')
  const xmlBase64 = Buffer.from(xmlContent, 'utf-8').toString('base64')
  const fileName = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.xml`

  const response = await fetch(`${apiBase}/factures/v1/deposer/flux`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'cpro-account': cpAccount,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idUtilisateurCourant: 0,
      fichierFlux: xmlBase64,
      nomFichier: fileName,
      syntaxeFlux: 'IN_DP_E2_CII_FACTURX',
      avecSignature: false,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Chorus Pro refus (${response.status}): ${body}`)
  }

  return response.json() as Promise<DepotFluxResult>
}
