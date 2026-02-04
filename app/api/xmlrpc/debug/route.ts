import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"

// Parse XML-RPC response to JSON using fast-xml-parser
function parseXmlRpcResponse(xml: string): any {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
  })

  try {
    const parsed = parser.parse(xml)
    
    // Check for fault
    if (parsed?.methodResponse?.fault) {
      const faultValue = extractValue(parsed.methodResponse.fault.value)
      return { __fault: faultValue }
    }
    
    // Get the response data
    const params = parsed?.methodResponse?.params?.param
    if (params) {
      return extractValue(params.value)
    }
    
    return null
  } catch (err) {
    console.error('[XML-RPC Parse] Error:', err)
    return null
  }
}

// Extract value from XML-RPC value structure
function extractValue(value: any): any {
  if (value === null || value === undefined) return null
  
  // Handle different XML-RPC types
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  
  // String
  if (value.string !== undefined) return String(value.string)
  
  // Integer
  if (value.int !== undefined) return parseInt(value.int, 10)
  if (value.i4 !== undefined) return parseInt(value.i4, 10)
  
  // Double
  if (value.double !== undefined) return parseFloat(value.double)
  
  // Boolean  
  if (value.boolean !== undefined) return value.boolean === 1 || value.boolean === '1'
  
  // DateTime
  if (value['dateTime.iso8601'] !== undefined) return value['dateTime.iso8601']
  
  // Nil
  if (value.nil !== undefined) return null
  
  // Array
  if (value.array) {
    const data = value.array.data
    if (!data || !data.value) return []
    const values = Array.isArray(data.value) ? data.value : [data.value]
    return values.map(extractValue)
  }
  
  // Struct
  if (value.struct) {
    const obj: Record<string, any> = {}
    const members = value.struct.member
    if (!members) return obj
    const memberArray = Array.isArray(members) ? members : [members]
    for (const member of memberArray) {
      if (member.name && member.value !== undefined) {
        obj[member.name] = extractValue(member.value)
      }
    }
    return obj
  }
  
  // If value has a direct text content
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return ''
  }
  
  return value
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Make XML-RPC call and return parsed JSON
async function xmlRpcCall(
  accessToken: string,
  table: string,
  limit: number,
  queryData: Record<string, any>,
  fields: string[]
): Promise<{ success: boolean; data: any; error?: string; rawXml?: string; requestXml?: string }> {
  
  const serializeQueryData = (data: Record<string, any>): string => {
    const members = Object.entries(data).map(([key, value]) => {
      let valueXml: string
      if (typeof value === 'number') {
        valueXml = `<value><int>${value}</int></value>`
      } else {
        // Escape special XML characters (important for ~>~0 queries)
        valueXml = `<value><string>${escapeXml(String(value))}</string></value>`
      }
      return `<member><name>${key}</name>${valueXml}</member>`
    }).join('')
    return `<struct>${members}</struct>`
  }

  const fieldsXml = fields.map(f => `<value><string>${f}</string></value>`).join('')
  const queryDataXml = Object.keys(queryData).length > 0 
    ? serializeQueryData(queryData)
    : '<struct></struct>'

  const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>DataService.query</methodName>
  <params>
    <param><value><string></string></value></param>
    <param><value><string>${table}</string></value></param>
    <param><value><int>${limit}</int></value></param>
    <param><value><int>0</int></value></param>
    <param><value>${queryDataXml}</value></param>
    <param><value><array><data>${fieldsXml}</data></array></value></param>
  </params>
</methodCall>`

  console.log(`[XML-RPC] Request to ${table}:\n${xmlRequest}`)

  const response = await fetch('https://api.infusionsoft.com/crm/xmlrpc/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: xmlRequest
  })

  const responseText = await response.text()
  console.log(`[XML-RPC] Response from ${table} (${responseText.length} chars): ${responseText.substring(0, 500)}`)
  
  const parsed = parseXmlRpcResponse(responseText)
  
  if (parsed?.__fault) {
    return { 
      success: false, 
      data: null, 
      error: parsed.__fault.faultString || JSON.stringify(parsed.__fault), 
      rawXml: responseText,
      requestXml: xmlRequest 
    }
  }

  return { 
    success: true, 
    data: Array.isArray(parsed) ? parsed : [], 
    rawXml: responseText,
    requestXml: xmlRequest 
  }
}

/**
 * Debug endpoint to test individual XML-RPC queries
 * Returns parsed JSON (not raw XML)
 * 
 * GET ?test=stages - Test Stage table lookup
 * GET ?test=products&oppId=2 - Get products for opportunity (ProductInterest + Product lookup)
 * GET ?test=productinterest&oppId=2 - Test ProductInterest for specific opp
 * GET ?test=stagemove&oppId=2 - Test StageMove for specific opp
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const test = url.searchParams.get('test') || 'stages'
  const oppId = url.searchParams.get('oppId') || '2'
  
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("keap_access_token")?.value

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const numericOppId = parseInt(oppId, 10)

  try {
    switch (test) {
      case 'stages': {
        const result = await xmlRpcCall(accessToken, 'Stage', 1000, { Id: '~>~0' }, ['Id', 'StageName'])
        return NextResponse.json({
          test: 'stages',
          description: 'All stages (ID → Name lookup)',
          success: result.success,
          recordCount: result.data?.length || 0,
          data: result.data,
          error: result.error,
          requestXml: result.requestXml,
          responseXml: result.rawXml
        })
      }

      case 'products': {
        // Step 1: Get ProductInterest for this opportunity
        const piResult = await xmlRpcCall(
          accessToken, 
          'ProductInterest', 
          100, 
          { ObjectId: numericOppId }, 
          ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent']
        )
        
        if (!piResult.success) {
          return NextResponse.json({
            test: 'products',
            description: `Products for Opportunity #${oppId}`,
            success: false,
            step: 'ProductInterest query failed',
            error: piResult.error,
            requestXml: piResult.requestXml,
            responseXml: piResult.rawXml
          })
        }

        const productInterests = piResult.data || []
        
        if (productInterests.length === 0) {
          return NextResponse.json({
            test: 'products',
            description: `Products for Opportunity #${oppId}`,
            success: true,
            recordCount: 0,
            productInterests: [],
            products: [],
            message: 'No ProductInterest records found for this opportunity',
            requestXml: piResult.requestXml,
            responseXml: piResult.rawXml
          })
        }

        // Step 2: Get unique product IDs
        const productIds = [...new Set(productInterests.map((pi: any) => pi.ProductId))].filter((id: any) => id > 0)
        
        // Step 3: Lookup each product
        const products: any[] = []
        for (const productId of productIds) {
          const prodResult = await xmlRpcCall(
            accessToken,
            'Product',
            1,
            { Id: productId as number },
            ['Id', 'ProductName', 'ProductPrice', 'Sku']
          )
          if (prodResult.success && prodResult.data?.length > 0) {
            products.push(prodResult.data[0])
          }
        }

        // Step 4: Enrich ProductInterest with product details
        const productMap = new Map(products.map(p => [p.Id, p]))
        const enrichedProducts = productInterests.map((pi: any) => ({
          ...pi,
          Product: productMap.get(pi.ProductId) || null
        }))

        return NextResponse.json({
          test: 'products',
          description: `Products for Opportunity #${oppId}`,
          success: true,
          recordCount: productInterests.length,
          productInterests: enrichedProducts,
          products: products,
          summary: {
            productInterestCount: productInterests.length,
            uniqueProductIds: productIds,
            productsFound: products.length
          },
          requestXml: piResult.requestXml,
          responseXml: piResult.rawXml
        })
      }

      case 'productinterest': {
        const result = await xmlRpcCall(
          accessToken, 
          'ProductInterest', 
          100, 
          { ObjectId: numericOppId }, 
          ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent']
        )
        return NextResponse.json({
          test: 'productinterest',
          description: `ProductInterest for Opportunity #${oppId}`,
          success: result.success,
          recordCount: result.data?.length || 0,
          data: result.data,
          error: result.error,
          requestXml: result.requestXml,
          responseXml: result.rawXml
        })
      }

      case 'stagemove': {
        // First get stage moves
        const smResult = await xmlRpcCall(
          accessToken, 
          'StageMove', 
          100, 
          { OpportunityId: numericOppId }, 
          ['Id', 'OpportunityId', 'MoveDate', 'MoveToStage', 'MoveFromStage']
        )

        if (!smResult.success) {
          return NextResponse.json({
            test: 'stagemove',
            description: `Stage moves for Opportunity #${oppId}`,
            success: false,
            error: smResult.error,
            requestXml: smResult.requestXml,
            responseXml: smResult.rawXml
          })
        }

        const stageMoves = smResult.data || []

        // Get stage IDs to lookup
        const stageIds = new Set<number>()
        stageMoves.forEach((sm: any) => {
          if (sm.MoveToStage) stageIds.add(sm.MoveToStage)
          if (sm.MoveFromStage) stageIds.add(sm.MoveFromStage)
        })

        // Lookup stage names
        const stageMap = new Map<number, string>()
        for (const stageId of stageIds) {
          const stageResult = await xmlRpcCall(accessToken, 'Stage', 1, { Id: stageId }, ['Id', 'StageName'])
          if (stageResult.success && stageResult.data?.length > 0) {
            stageMap.set(stageId, stageResult.data[0].StageName)
          }
        }

        // Enrich stage moves with names
        const enrichedMoves = stageMoves.map((sm: any) => ({
          ...sm,
          MoveToStageName: stageMap.get(sm.MoveToStage) || null,
          MoveFromStageName: sm.MoveFromStage ? stageMap.get(sm.MoveFromStage) : null
        }))

        // Find outcome date (WON/LOST)
        let outcomeDate = null
        let outcomeType = null
        for (const move of enrichedMoves) {
          const stageName = (move.MoveToStageName || '').toUpperCase()
          if (stageName.includes('WON') || stageName.includes('CLOSED WON')) {
            outcomeDate = move.MoveDate
            outcomeType = 'WON'
            break
          }
          if (stageName.includes('LOST') || stageName.includes('CLOSED LOST')) {
            outcomeDate = move.MoveDate
            outcomeType = 'LOST'
            break
          }
        }

        // Find last update (max date)
        const lastUpdate = stageMoves.length > 0 
          ? stageMoves.reduce((max: string, sm: any) => sm.MoveDate > max ? sm.MoveDate : max, stageMoves[0].MoveDate)
          : null

        return NextResponse.json({
          test: 'stagemove',
          description: `Stage moves for Opportunity #${oppId}`,
          success: true,
          recordCount: stageMoves.length,
          data: enrichedMoves,
          stageNames: Object.fromEntries(stageMap),
          analysis: {
            lastUpdate,
            outcomeDate,
            outcomeType
          },
          requestXml: smResult.requestXml,
          responseXml: smResult.rawXml
        })
      }

      default:
        return NextResponse.json({ error: `Unknown test: ${test}` }, { status: 400 })
    }
  } catch (error) {
    console.error(`[XML-RPC Debug] Error:`, error)
    return NextResponse.json({
      test,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
