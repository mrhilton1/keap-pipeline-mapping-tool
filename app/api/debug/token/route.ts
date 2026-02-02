import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// DEBUG ONLY - Remove in production
// Returns the current access token for manual API testing
export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("keap_access_token")
  const refreshToken = cookieStore.get("keap_refresh_token")

  if (!accessToken?.value) {
    return NextResponse.json({ 
      error: "No access token found",
      help: "Please authenticate first at /api/auth/keap"
    }, { status: 401 })
  }

  // Generate curl commands for testing
  const v1OpportunitiesCurl = `curl -X GET "https://api.infusionsoft.com/crm/rest/v1/opportunities?limit=5" -H "Authorization: Bearer ${accessToken.value}"`
  
  const v1StagesCurl = `curl -X GET "https://api.infusionsoft.com/crm/rest/v1/opportunity/stage_pipeline" -H "Authorization: Bearer ${accessToken.value}"`
  
  const v2PipelinesCurl = `curl -X GET "https://slaapi.keapapis.com/v2/pipelines?page_size=10" -H "Authorization: Bearer ${accessToken.value}" -H "Content-Type: application/json"`

  return NextResponse.json({
    warning: "⚠️ DEBUG ONLY - Do not share these tokens!",
    accessToken: accessToken.value,
    hasRefreshToken: !!refreshToken?.value,
    tokenLength: accessToken.value.length,
    curlCommands: {
      v1Opportunities: v1OpportunitiesCurl,
      v1Stages: v1StagesCurl,
      v2Pipelines: v2PipelinesCurl
    }
  })
}
