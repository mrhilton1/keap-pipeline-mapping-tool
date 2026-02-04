/**
 * Keap XML-RPC API Client
 * 
 * Uses the same OAuth access token as REST API - no separate API key needed!
 * 
 * Used for accessing legacy tables not available in REST API:
 * - Lead (ProductInterest) - links opportunities to products
 * - Product - product details
 * - StageMove - stage transition history
 * 
 * Documentation: https://developer.infusionsoft.com/docs/table-schema/
 */

// XML-RPC method call builder
function buildMethodCall(method: string, params: any[]): string {
  const serializeValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '<value><nil/></value>'
    }
    if (typeof value === 'boolean') {
      return `<value><boolean>${value ? 1 : 0}</boolean></value>`
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return `<value><int>${value}</int></value>`
      }
      return `<value><double>${value}</double></value>`
    }
    if (typeof value === 'string') {
      // Escape XML special characters
      const escaped = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<value><string>${escaped}</string></value>`
    }
    if (Array.isArray(value)) {
      const items = value.map(v => serializeValue(v)).join('')
      return `<value><array><data>${items}</data></array></value>`
    }
    if (typeof value === 'object') {
      const members = Object.entries(value)
        .map(([k, v]) => `<member><name>${k}</name>${serializeValue(v)}</member>`)
        .join('')
      return `<value><struct>${members}</struct></value>`
    }
    return `<value><string>${String(value)}</string></value>`
  }

  const paramXml = params.map(p => `<param>${serializeValue(p)}</param>`).join('')
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>${paramXml}</params>
</methodCall>`
}

// Parse XML-RPC response
function parseResponse(xml: string): any {
  // Simple XML parser for XML-RPC responses
  const getTagContent = (xml: string, tag: string): string | null => {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')
    const match = xml.match(regex)
    return match ? match[1] : null
  }

  const parseValue = (valueXml: string): any => {
    // Check for different value types
    const stringMatch = valueXml.match(/<string>([^<]*)<\/string>/i)
    if (stringMatch) return stringMatch[1]

    const intMatch = valueXml.match(/<(?:int|i4)>([^<]*)<\/(?:int|i4)>/i)
    if (intMatch) return parseInt(intMatch[1], 10)

    const doubleMatch = valueXml.match(/<double>([^<]*)<\/double>/i)
    if (doubleMatch) return parseFloat(doubleMatch[1])

    const boolMatch = valueXml.match(/<boolean>([^<]*)<\/boolean>/i)
    if (boolMatch) return boolMatch[1] === '1'

    const dateMatch = valueXml.match(/<dateTime\.iso8601>([^<]*)<\/dateTime\.iso8601>/i)
    if (dateMatch) return dateMatch[1]

    const nilMatch = valueXml.match(/<nil\s*\/?>/i)
    if (nilMatch) return null

    // Array
    const arrayMatch = valueXml.match(/<array>\s*<data>([\s\S]*?)<\/data>\s*<\/array>/i)
    if (arrayMatch) {
      const values: any[] = []
      const valueRegex = /<value>([\s\S]*?)<\/value>/gi
      let match
      while ((match = valueRegex.exec(arrayMatch[1])) !== null) {
        values.push(parseValue(match[1]))
      }
      return values
    }

    // Struct
    const structMatch = valueXml.match(/<struct>([\s\S]*?)<\/struct>/i)
    if (structMatch) {
      const obj: Record<string, any> = {}
      const memberRegex = /<member>\s*<name>([^<]*)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/gi
      let match
      while ((match = memberRegex.exec(structMatch[1])) !== null) {
        obj[match[1]] = parseValue(match[2])
      }
      return obj
    }

    // Default: return as string
    return valueXml.trim()
  }

  // Check for fault
  const faultMatch = xml.match(/<fault>\s*<value>([\s\S]*?)<\/value>\s*<\/fault>/i)
  if (faultMatch) {
    const fault = parseValue(faultMatch[1])
    throw new Error(`XML-RPC Fault: ${fault.faultString || JSON.stringify(fault)}`)
  }

  // Get params
  const paramMatch = xml.match(/<params>\s*<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>\s*<\/params>/i)
  if (paramMatch) {
    return parseValue(paramMatch[1])
  }

  throw new Error('Invalid XML-RPC response')
}

export interface ProductInterest {
  Id: number
  ObjectId: number  // Links to opportunity or order
  ProductId: number
}

export interface Product {
  Id: number
  ProductName: string
  ProductPrice: number
  ProductDesc?: string
  Sku?: string
  ShortDescription?: string
  Status?: number
}

export interface StageMove {
  Id: number
  OpportunityId: number
  MoveDate: string
}

export class KeapXmlRpcClient {
  private accessToken: string
  private endpoint: string

  /**
   * Create XML-RPC client using OAuth access token
   * Token is passed in Authorization header, not as method parameter
   */
  constructor(accessToken: string) {
    this.accessToken = accessToken
    // XML-RPC endpoint for OAuth
    this.endpoint = 'https://api.infusionsoft.com/crm/xmlrpc/v1'
  }

  private async call(method: string, params: any[]): Promise<any> {
    // With OAuth, token goes in Authorization header (not as first param)
    // First param should be the "private key" which is empty string for OAuth
    const fullParams = ['', ...params]
    const body = buildMethodCall(method, fullParams)

    console.log(`[XML-RPC] Calling ${method}`)
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error(`[XML-RPC] HTTP Error ${response.status}:`, responseText.substring(0, 500))
      throw new Error(`XML-RPC HTTP error: ${response.status}`)
    }

    try {
      return parseResponse(responseText)
    } catch (err) {
      console.error(`[XML-RPC] Parse error:`, err, responseText.substring(0, 500))
      throw err
    }
  }

  /**
   * Query a table using DataService.query
   * @param table - Table name (e.g., 'Lead', 'Product', 'StageMove')
   * @param limit - Max records to return (max 1000)
   * @param page - Page number (0-indexed)
   * @param queryData - Field criteria (e.g., { OpportunityId: 123 })
   * @param selectedFields - Fields to return
   */
  async query<T>(
    table: string,
    limit: number,
    page: number,
    queryData: Record<string, any>,
    selectedFields: string[]
  ): Promise<T[]> {
    return this.call('DataService.query', [table, limit, page, queryData, selectedFields])
  }

  /**
   * Get products linked to an opportunity via the ProductInterest table
   * Note: ProductInterest links to opportunities via ObjectId (when ObjType='Opportunity')
   */
  async getOpportunityProducts(opportunityId: number): Promise<Array<ProductInterest & { product?: Product }>> {
    console.log(`[XML-RPC] Getting products for opportunity ${opportunityId}`)
    
    // Query ProductInterest table - links to opportunities via ObjectId
    // Only query fields that actually exist in the table
    const productInterests = await this.query<ProductInterest>(
      'ProductInterest',
      100,
      0,
      { ObjectId: opportunityId },
      ['Id', 'ObjectId', 'ProductId']  // Minimal fields that exist
    )

    if (productInterests.length === 0) {
      return []
    }

    // Get unique product IDs
    const productIds = [...new Set(productInterests.map(pi => pi.ProductId))]
    
    // Fetch product details
    const products: Product[] = []
    for (const productId of productIds) {
      try {
        const productResults = await this.query<Product>(
          'Product',
          1,
          0,
          { Id: productId },
          ['Id', 'ProductName', 'ProductPrice', 'ProductDesc', 'Sku', 'ShortDescription', 'Status']
        )
        if (productResults.length > 0) {
          products.push(productResults[0])
        }
      } catch (err) {
        console.error(`[XML-RPC] Failed to fetch product ${productId}:`, err)
      }
    }

    // Merge product info into product interests
    const productMap = new Map(products.map(p => [p.Id, p]))
    return productInterests.map(pi => ({
      ...pi,
      product: productMap.get(pi.ProductId)
    }))
  }

  /**
   * Get stage moves for an opportunity
   */
  async getOpportunityStageMoves(opportunityId: number): Promise<StageMove[]> {
    console.log(`[XML-RPC] Getting stage moves for opportunity ${opportunityId}`)
    
    // Only query fields that actually exist in the table
    return this.query<StageMove>(
      'StageMove',
      100,
      0,
      { OpportunityId: opportunityId },
      ['Id', 'OpportunityId', 'MoveDate']  // Minimal fields that exist
    )
  }

  /**
   * Get the WON or LOST date for an opportunity (if any)
   * Note: Requires stage ID -> name mapping from the pipeline stages
   * @param stageIdToName - Map of stage IDs to stage names (from REST API)
   */
  async getOpportunityOutcomeDate(
    opportunityId: number, 
    stageIdToName?: Map<number, string>
  ): Promise<{ date: string; outcome: 'WON' | 'LOST'; stageId: number } | null> {
    const stageMoves = await this.getOpportunityStageMoves(opportunityId)
    
    // If no stage mapping provided, just return the most recent stage move with a potential outcome
    // (We check if stageId is in a "won/lost" looking stage via the caller)
    for (const move of stageMoves) {
      if (stageIdToName && stageIdToName.has(move.StageId)) {
        const stageName = stageIdToName.get(move.StageId)!.toUpperCase()
        if (stageName.includes('WON') || stageName.includes('CLOSED WON')) {
          return { date: move.MoveDate, outcome: 'WON', stageId: move.StageId }
        }
        if (stageName.includes('LOST') || stageName.includes('CLOSED LOST')) {
          return { date: move.MoveDate, outcome: 'LOST', stageId: move.StageId }
        }
      }
    }
    
    // Return latest stage move if we have them (caller can determine outcome)
    if (stageMoves.length > 0) {
      const latestMove = stageMoves[stageMoves.length - 1]
      return { date: latestMove.MoveDate, outcome: 'WON', stageId: latestMove.StageId } // Caller should verify
    }
    
    return null
  }

  /**
   * Batch fetch products for multiple opportunities
   */
  async batchGetOpportunityProducts(opportunityIds: number[]): Promise<Map<number, Array<ProductInterest & { product?: Product }>>> {
    const results = new Map<number, Array<ProductInterest & { product?: Product }>>()
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 10
    for (let i = 0; i < opportunityIds.length; i += batchSize) {
      const batch = opportunityIds.slice(i, i + batchSize)
      await Promise.all(batch.map(async (oppId) => {
        try {
          const products = await this.getOpportunityProducts(oppId)
          results.set(oppId, products)
        } catch (err) {
          console.error(`[XML-RPC] Failed to get products for opportunity ${oppId}:`, err)
          results.set(oppId, [])
        }
      }))
    }
    
    return results
  }

  /**
   * Batch fetch stage moves for multiple opportunities
   * Returns raw stage moves - caller can map stage IDs to names
   */
  async batchGetStageMoves(opportunityIds: number[]): Promise<Map<number, StageMove[]>> {
    const results = new Map<number, StageMove[]>()
    
    const batchSize = 10
    for (let i = 0; i < opportunityIds.length; i += batchSize) {
      const batch = opportunityIds.slice(i, i + batchSize)
      await Promise.all(batch.map(async (oppId) => {
        try {
          const moves = await this.getOpportunityStageMoves(oppId)
          results.set(oppId, moves)
        } catch (err) {
          console.error(`[XML-RPC] Failed to get stage moves for opportunity ${oppId}:`, err)
          results.set(oppId, [])
        }
      }))
    }
    
    return results
  }
}
