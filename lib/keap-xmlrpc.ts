/**
 * Keap XML-RPC API Client
 * 
 * Uses the same OAuth access token as REST API - no separate API key needed!
 * 
 * Table schemas from: https://developer.infusionsoft.com/docs/table-schema/
 * 
 * ProductInterest - links opportunities to products via ObjectId
 * Product - product details (ProductName, ProductPrice)
 * StageMove - stage transition history (MoveToStage, MoveFromStage are IDs)
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

    return valueXml.trim()
  }

  const faultMatch = xml.match(/<fault>\s*<value>([\s\S]*?)<\/value>\s*<\/fault>/i)
  if (faultMatch) {
    const fault = parseValue(faultMatch[1])
    throw new Error(`XML-RPC Fault: ${fault.faultString || JSON.stringify(fault)}`)
  }

  const paramMatch = xml.match(/<params>\s*<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>\s*<\/params>/i)
  if (paramMatch) {
    return parseValue(paramMatch[1])
  }

  throw new Error('Invalid XML-RPC response')
}

// Interfaces based on ACTUAL Keap table schema
export interface ProductInterest {
  Id: number
  ObjectId: number      // Links to Opportunity Id
  ObjType?: string      // 'Product' or 'CProgram'
  ProductId: number     // Links to Product table
  ProductType?: string
  Qty?: number
  DiscountPercent?: number
}

export interface Product {
  Id: number
  ProductName: string
  ProductPrice: number
  ShortDescription?: string
  Sku?: string
  Status?: number
}

export interface StageMove {
  Id: number
  OpportunityId: number
  MoveDate: string
  MoveToStage: number    // Stage ID moved TO
  MoveFromStage?: number // Stage ID moved FROM
  UserId?: number
  DateCreated?: string
}

export class KeapXmlRpcClient {
  private accessToken: string
  private endpoint: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
    this.endpoint = 'https://api.infusionsoft.com/crm/xmlrpc/v1'
  }

  private async call(method: string, params: any[]): Promise<any> {
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
   * Get ALL ProductInterest records
   * Uses ObjectId field which links to Opportunity Id
   */
  async getAllProductInterests(): Promise<ProductInterest[]> {
    console.log('[XML-RPC] Fetching ALL ProductInterest records')
    
    const allInterests: ProductInterest[] = []
    let page = 0
    const limit = 1000
    
    // Fields from actual schema: Id, ObjectId, ProductId, Qty, DiscountPercent
    // Use Id > 0 filter to get ALL records (empty queryData may not work)
    while (true) {
      const result = await this.query<ProductInterest>(
        'ProductInterest',
        limit,
        page,
        { Id: '~>~0' }, // Id greater than 0 = ALL records
        ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent']
      )
      
      // Handle non-array responses (empty result returns {} not [])
      const batch = Array.isArray(result) ? result : []
      
      console.log(`[XML-RPC] ProductInterest page ${page}: ${batch.length} records`)
      
      if (batch.length === 0) break
      allInterests.push(...batch)
      
      if (batch.length < limit) break
      page++
    }
    
    console.log(`[XML-RPC] Found ${allInterests.length} total ProductInterest records`)
    
    // Filter to only those with an ObjectId (which is the Opportunity Id)
    const withOppId = allInterests.filter(pi => pi.ObjectId != null && pi.ObjectId > 0)
    console.log(`[XML-RPC] ${withOppId.length} have ObjectId (Opportunity link)`)
    
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
        ['Id', 'ProductName', 'ProductPrice', 'ShortDescription', 'Sku', 'Status']
      )
      return results.length > 0 ? results[0] : null
    } catch (err) {
      console.error(`[XML-RPC] Failed to fetch product ${productId}:`, err)
      return null
    }
  }

  /**
   * Get ALL StageMove records
   * Uses MoveToStage and MoveFromStage (IDs, not names)
   */
  async getAllStageMoves(): Promise<StageMove[]> {
    console.log('[XML-RPC] Fetching ALL StageMove records')
    
    const allMoves: StageMove[] = []
    let page = 0
    const limit = 1000
    
    // Fields from actual schema: Id, OpportunityId, MoveDate, MoveToStage, MoveFromStage
    // Use Id > 0 filter to get ALL records (empty queryData may not work)
    while (true) {
      const result = await this.query<StageMove>(
        'StageMove',
        limit,
        page,
        { Id: '~>~0' }, // Id greater than 0 = ALL records
        ['Id', 'OpportunityId', 'MoveDate', 'MoveToStage', 'MoveFromStage', 'UserId']
      )
      
      // Handle non-array responses (empty result returns {} not [])
      const batch = Array.isArray(result) ? result : []
      
      console.log(`[XML-RPC] StageMove page ${page}: ${batch.length} records`)
      
      if (batch.length === 0) break
      allMoves.push(...batch)
      
      if (batch.length < limit) break
      page++
    }
    
    console.log(`[XML-RPC] Found ${allMoves.length} total StageMove records`)
    return allMoves
  }

  /**
   * Analyze stage moves to find:
   * - MAX date (last updated) per opportunity
   * - The most recent stage move (with MoveToStage ID)
   * 
   * Note: MoveToStage is an ID, not a name. Caller needs to map to stage names
   * using the REST API pipeline stages data.
   */
  analyzeOpportunityStageMoves(
    moves: StageMove[],
    stageIdToName?: Map<number, string>
  ): {
    lastUpdated: string | null
    latestStageId: number | null
    latestStageName: string | null
    outcomeDate: string | null
    outcome: 'WON' | 'LOST' | null
  } {
    if (moves.length === 0) {
      return { lastUpdated: null, latestStageId: null, latestStageName: null, outcomeDate: null, outcome: null }
    }

    // Sort by MoveDate descending (most recent first)
    const sortedByDate = [...moves].sort((a, b) => 
      new Date(b.MoveDate).getTime() - new Date(a.MoveDate).getTime()
    )
    
    const latestMove = sortedByDate[0]
    const lastUpdated = latestMove.MoveDate
    const latestStageId = latestMove.MoveToStage
    const latestStageName = stageIdToName?.get(latestStageId) || null

    // Find WON or LOST move by checking stage names
    let outcomeDate: string | null = null
    let outcome: 'WON' | 'LOST' | null = null

    if (stageIdToName) {
      for (const move of sortedByDate) {
        const stageName = stageIdToName.get(move.MoveToStage)?.toUpperCase() || ''
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

    return { lastUpdated, latestStageId, latestStageName, outcomeDate, outcome }
  }

  /**
   * Build a map of ObjectId (Opportunity Id) -> Products with full product details
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
    
    // Build result map grouped by ObjectId (which is Opportunity Id)
    const result = new Map<number, Array<ProductInterest & { product: Product | null }>>()
    
    for (const pi of productInterests) {
      if (!pi.ObjectId) continue
      
      const oppProducts = result.get(pi.ObjectId) || []
      oppProducts.push({
        ...pi,
        product: productMap.get(pi.ProductId) || null
      })
      result.set(pi.ObjectId, oppProducts)
    }
    
    console.log(`[XML-RPC] Built product map for ${result.size} opportunities`)
    return result
  }

  /**
   * Build a map of OpportunityId -> Stage move analysis
   */
  async buildOpportunityStageMoveMap(
    stageIdToName?: Map<number, string>
  ): Promise<Map<number, {
    moves: StageMove[]
    lastUpdated: string | null
    latestStageId: number | null
    latestStageName: string | null
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
      latestStageId: number | null
      latestStageName: string | null
      outcomeDate: string | null
      outcome: 'WON' | 'LOST' | null
    }>()
    
    for (const [oppId, moves] of grouped.entries()) {
      const analysis = this.analyzeOpportunityStageMoves(moves, stageIdToName)
      result.set(oppId, { moves, ...analysis })
    }
    
    console.log(`[XML-RPC] Built stage move map for ${result.size} opportunities`)
    return result
  }
}
