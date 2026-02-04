/**
 * Keap XML-RPC API Client
 * 
 * Uses the same OAuth access token as REST API - no separate API key needed!
 * 
 * Used for accessing legacy tables not available in REST API:
 * - ProductInterest - links opportunities to products
 * - Product - product details (name, price)
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

// Interfaces based on Keap table schema
export interface ProductInterest {
  Id: number
  OpportunityId?: number
  ProductId: number
}

export interface Product {
  Id: number
  ProductName: string
  ProductPrice?: number
}

export interface StageMove {
  Id: number
  OpportunityId: number
  MoveDate: string
  Stage?: string  // Stage name (text field)
}

export class KeapXmlRpcClient {
  private accessToken: string
  private endpoint: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
    this.endpoint = 'https://api.infusionsoft.com/crm/xmlrpc/v1'
  }

  private async call(method: string, params: any[]): Promise<any> {
    // With OAuth, first param is empty string, token goes in header
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
   * Get ALL ProductInterest records, then filter for those with OpportunityId
   * This approach avoids field existence issues by getting all records first
   */
  async getAllProductInterests(): Promise<ProductInterest[]> {
    console.log('[XML-RPC] Fetching ALL ProductInterest records')
    
    const allInterests: ProductInterest[] = []
    let page = 0
    const limit = 1000
    
    try {
      // Query with just Id and ProductId (these definitely exist)
      // Then fetch OpportunityId separately or accept whatever fields come back
      while (true) {
        const batch = await this.query<ProductInterest>(
          'ProductInterest',
          limit,
          page,
          {}, // No filter - get ALL
          ['Id', 'ProductId', 'OpportunityId'] // Try these fields
        )
        
        if (batch.length === 0) break
        allInterests.push(...batch)
        
        if (batch.length < limit) break // Last page
        page++
      }
    } catch (err: any) {
      // If OpportunityId doesn't work, try without it
      if (err.message?.includes('OpportunityId')) {
        console.log('[XML-RPC] OpportunityId field not available, trying ObjectId...')
        page = 0
        while (true) {
          const batch = await this.query<any>(
            'ProductInterest',
            limit,
            page,
            {},
            ['Id', 'ProductId', 'ObjectId']
          )
          
          if (batch.length === 0) break
          // Map ObjectId to OpportunityId for consistency
          allInterests.push(...batch.map((b: any) => ({
            Id: b.Id,
            ProductId: b.ProductId,
            OpportunityId: b.ObjectId
          })))
          
          if (batch.length < limit) break
          page++
        }
      } else {
        throw err
      }
    }
    
    console.log(`[XML-RPC] Found ${allInterests.length} total ProductInterest records`)
    
    // Filter to only those with an OpportunityId
    const withOppId = allInterests.filter(pi => pi.OpportunityId != null && pi.OpportunityId > 0)
    console.log(`[XML-RPC] ${withOppId.length} have OpportunityId`)
    
    return withOppId
  }

  /**
   * Get Product details by ID
   */
  async getProduct(productId: number): Promise<Product | null> {
    try {
      const results = await this.query<Product>(
        'Product',
        1,
        0,
        { Id: productId },
        ['Id', 'ProductName', 'ProductPrice']
      )
      return results.length > 0 ? results[0] : null
    } catch (err) {
      console.error(`[XML-RPC] Failed to fetch product ${productId}:`, err)
      return null
    }
  }

  /**
   * Get ALL StageMove records for a specific opportunity
   */
  async getOpportunityStageMoves(opportunityId: number): Promise<StageMove[]> {
    console.log(`[XML-RPC] Getting stage moves for opportunity ${opportunityId}`)
    
    try {
      // Try with Stage field first
      return await this.query<StageMove>(
        'StageMove',
        100,
        0,
        { OpportunityId: opportunityId },
        ['Id', 'OpportunityId', 'MoveDate', 'Stage']
      )
    } catch (err: any) {
      // If Stage doesn't exist, try without it
      if (err.message?.includes('Stage')) {
        console.log('[XML-RPC] Stage field not available, querying without it')
        return await this.query<StageMove>(
          'StageMove',
          100,
          0,
          { OpportunityId: opportunityId },
          ['Id', 'OpportunityId', 'MoveDate']
        )
      }
      throw err
    }
  }

  /**
   * Get ALL StageMove records (for batch analysis)
   */
  async getAllStageMoves(): Promise<StageMove[]> {
    console.log('[XML-RPC] Fetching ALL StageMove records')
    
    const allMoves: StageMove[] = []
    let page = 0
    const limit = 1000
    
    try {
      while (true) {
        const batch = await this.query<StageMove>(
          'StageMove',
          limit,
          page,
          {},
          ['Id', 'OpportunityId', 'MoveDate', 'Stage']
        )
        
        if (batch.length === 0) break
        allMoves.push(...batch)
        
        if (batch.length < limit) break
        page++
      }
    } catch (err: any) {
      // If Stage doesn't exist, try without it
      if (err.message?.includes('Stage')) {
        console.log('[XML-RPC] Stage field not available, querying without it')
        page = 0
        while (true) {
          const batch = await this.query<StageMove>(
            'StageMove',
            limit,
            page,
            {},
            ['Id', 'OpportunityId', 'MoveDate']
          )
          
          if (batch.length === 0) break
          allMoves.push(...batch)
          
          if (batch.length < limit) break
          page++
        }
      } else {
        throw err
      }
    }
    
    console.log(`[XML-RPC] Found ${allMoves.length} total StageMove records`)
    return allMoves
  }

  /**
   * Analyze stage moves to find:
   * - MAX date (last updated) per opportunity
   * - WON/LOST date (if stage name contains WON or LOST)
   */
  getOutcomeFromStageMoves(moves: StageMove[]): {
    lastUpdated: string | null
    outcomeDate: string | null
    outcome: 'WON' | 'LOST' | null
  } {
    if (moves.length === 0) {
      return { lastUpdated: null, outcomeDate: null, outcome: null }
    }

    // Find MAX date (most recent move)
    const sortedByDate = [...moves].sort((a, b) => 
      new Date(b.MoveDate).getTime() - new Date(a.MoveDate).getTime()
    )
    const lastUpdated = sortedByDate[0]?.MoveDate || null

    // Find WON or LOST move
    let outcomeDate: string | null = null
    let outcome: 'WON' | 'LOST' | null = null

    for (const move of sortedByDate) {
      if (move.Stage) {
        const stageName = move.Stage.toUpperCase()
        if (stageName.includes('WON') || stageName.includes('CLOSED WON')) {
          outcomeDate = move.MoveDate
          outcome = 'WON'
          break
        }
        if (stageName.includes('LOST') || stageName.includes('CLOSED LOST')) {
          outcomeDate = move.MoveDate
          outcome = 'LOST'
          break
        }
      }
    }

    return { lastUpdated, outcomeDate, outcome }
  }

  /**
   * Build a map of OpportunityId -> Products with full product details
   */
  async buildOpportunityProductMap(): Promise<Map<number, Array<ProductInterest & { product: Product | null }>>> {
    const productInterests = await this.getAllProductInterests()
    
    // Get unique product IDs
    const productIds = [...new Set(productInterests.map(pi => pi.ProductId))]
    console.log(`[XML-RPC] Fetching details for ${productIds.length} unique products`)
    
    // Fetch all product details
    const productMap = new Map<number, Product>()
    for (const productId of productIds) {
      const product = await this.getProduct(productId)
      if (product) {
        productMap.set(productId, product)
      }
    }
    
    // Build result map grouped by OpportunityId
    const result = new Map<number, Array<ProductInterest & { product: Product | null }>>()
    
    for (const pi of productInterests) {
      if (!pi.OpportunityId) continue
      
      const oppProducts = result.get(pi.OpportunityId) || []
      oppProducts.push({
        ...pi,
        product: productMap.get(pi.ProductId) || null
      })
      result.set(pi.OpportunityId, oppProducts)
    }
    
    console.log(`[XML-RPC] Built product map for ${result.size} opportunities`)
    return result
  }

  /**
   * Build a map of OpportunityId -> Stage move analysis
   */
  async buildOpportunityStageMoveMap(): Promise<Map<number, {
    moves: StageMove[]
    lastUpdated: string | null
    outcomeDate: string | null
    outcome: 'WON' | 'LOST' | null
  }>> {
    const allMoves = await this.getAllStageMoves()
    
    // Group by OpportunityId
    const grouped = new Map<number, StageMove[]>()
    for (const move of allMoves) {
      const moves = grouped.get(move.OpportunityId) || []
      moves.push(move)
      grouped.set(move.OpportunityId, moves)
    }
    
    // Analyze each group
    const result = new Map<number, {
      moves: StageMove[]
      lastUpdated: string | null
      outcomeDate: string | null
      outcome: 'WON' | 'LOST' | null
    }>()
    
    for (const [oppId, moves] of grouped.entries()) {
      const analysis = this.getOutcomeFromStageMoves(moves)
      result.set(oppId, { moves, ...analysis })
    }
    
    console.log(`[XML-RPC] Built stage move map for ${result.size} opportunities`)
    return result
  }
}
