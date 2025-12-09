import { clientTools, executeClientTool } from './clients'
import { invoiceTools, executeInvoiceTool } from './invoices'
import { quoteTools, executeQuoteTool } from './quotes'
import { companyTools, executeCompanyTool } from './company'

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

// Combiner tous les outils
export function getMCPTools(): MCPTool[] {
  return [...clientTools, ...invoiceTools, ...quoteTools, ...companyTools]
}

// Router vers le bon exécuteur d'outil
export async function executeMCPTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  // Outils clients
  if (name.startsWith('list_clients') || name.startsWith('get_client') || name.startsWith('create_client') || name.startsWith('update_client') || name.startsWith('delete_client')) {
    return executeClientTool(name, args, userId)
  }

  // Outils factures
  if (name.startsWith('list_invoices') || name.startsWith('get_invoice') || name.startsWith('create_invoice') || name.startsWith('update_invoice') || name.startsWith('delete_invoice') || name === 'get_invoice_stats') {
    return executeInvoiceTool(name, args, userId)
  }

  // Outils devis
  if (name.startsWith('list_quotes') || name.startsWith('get_quote') || name.startsWith('create_quote') || name.startsWith('update_quote') || name.startsWith('delete_quote') || name === 'convert_quote_to_invoice') {
    return executeQuoteTool(name, args, userId)
  }

  // Outils entreprise
  if (name === 'get_company' || name === 'update_company') {
    return executeCompanyTool(name, args, userId)
  }

  throw new Error(`Unknown tool: ${name}`)
}
