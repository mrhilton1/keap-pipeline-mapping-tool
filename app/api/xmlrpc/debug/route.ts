import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Debug endpoint to test individual XML-RPC queries
 * Shows raw request/response for troubleshooting
 * 
 * GET ?test=stages - Test Stage table lookup
 * GET ?test=products - Test Product table lookup  
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

  // Build the XML request based on test type
  let tableName = ''
  let queryData = ''
  let fields: string[] = []
  
  switch (test) {
    case 'stages':
      tableName = 'Stage'
      queryData = '<struct><member><name>Id</name><value><string>~&gt;~0</string></value></member></struct>'
      fields = ['Id', 'StageName']
      break
    case 'products':
      tableName = 'Product'
      queryData = '<struct><member><name>Id</name><value><string>~&gt;~0</string></value></member></struct>'
      fields = ['Id', 'ProductName', 'ProductPrice']
      break
    case 'productinterest':
      tableName = 'ProductInterest'
      queryData = `<struct><member><name>ObjectId</name><value><int>${oppId}</int></value></member></struct>`
      fields = ['Id', 'ObjectId', 'ProductId', 'Qty']
      break
    case 'stagemove':
      tableName = 'StageMove'
      queryData = `<struct><member><name>OpportunityId</name><value><int>${oppId}</int></value></member></struct>`
      fields = ['Id', 'OpportunityId', 'MoveDate', 'MoveToStage', 'MoveFromStage']
      break
    default:
      return NextResponse.json({ error: `Unknown test: ${test}` }, { status: 400 })
  }

  const fieldsXml = fields.map(f => `<value><string>${f}</string></value>`).join('')
  
  const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>DataService.query</methodName>
  <params>
    <param><value><string></string></value></param>
    <param><value><string>${tableName}</string></value></param>
    <param><value><int>100</int></value></param>
    <param><value><int>0</int></value></param>
    <param><value>${queryData}</value></param>
    <param><value><array><data>${fieldsXml}</data></array></value></param>
  </params>
</methodCall>`

  console.log(`[XML-RPC Debug] Test: ${test}, Table: ${tableName}`)
  console.log(`[XML-RPC Debug] Request XML:\n${xmlRequest}`)

  try {
    const response = await fetch('https://api.infusionsoft.com/crm/xmlrpc/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: xmlRequest
    })

    const responseText = await response.text()
    console.log(`[XML-RPC Debug] Response status: ${response.status}`)
    console.log(`[XML-RPC Debug] Response:\n${responseText.substring(0, 2000)}`)

    // Try to parse the response to count records
    let recordCount = 0
    let parsedData: any = null
    
    // Simple regex to find struct elements (each record is a struct)
    const structMatches = responseText.match(/<struct>/g)
    if (structMatches) {
      recordCount = structMatches.length
    }

    // Check for fault
    const faultMatch = responseText.match(/<faultString>([^<]+)<\/faultString>/)
    const hasFault = !!faultMatch

    return NextResponse.json({
      test,
      tableName,
      oppId: test.includes('opp') ? oppId : null,
      fields,
      success: response.ok && !hasFault,
      httpStatus: response.status,
      fault: faultMatch ? faultMatch[1] : null,
      recordCount,
      requestXml: xmlRequest,
      responseXml: responseText,
      curlCommand: `curl -X POST "https://api.infusionsoft.com/crm/xmlrpc/v1" \\
  -H "Content-Type: application/xml" \\
  -H "Authorization: Bearer ${accessToken}" \\
  -d '${xmlRequest.replace(/\n/g, '').replace(/'/g, "\\'")}'`
    })
  } catch (error) {
    console.error(`[XML-RPC Debug] Error:`, error)
    return NextResponse.json({
      test,
      tableName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      requestXml: xmlRequest
    }, { status: 500 })
  }
}
