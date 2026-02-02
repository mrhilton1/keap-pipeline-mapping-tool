import { NextResponse } from "next/server"

export async function GET() {
  const version = {
    deployedAt: new Date().toISOString(),
    commit: "f6ccfa7", // Update this with each deploy
    features: [
      "v1 pipelines fallback",
      "auth debug page", 
      "cookie fix with native Response",
      "api test panel"
    ]
  }
  
  console.log("[Version API] Checked - commit:", version.commit)
  
  return NextResponse.json(version)
}
