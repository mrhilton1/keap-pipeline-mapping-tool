"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Loader2, FlaskConical, AlertTriangle } from "lucide-react"

interface TestResults {
  cookies: { 
    hasAccessToken: boolean
    hasRefreshToken: boolean
    allCookieNames?: string[]
    tokenLength?: number
  }
  opportunities: { success: boolean; count?: number; error?: string; raw?: string }
  legacyStages: { success: boolean; count?: number; error?: string; raw?: string }
  pipelinesV2: { success: boolean; count?: number; error?: string; raw?: string }
  error?: string
}

export function ApiTestPanel() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResults | null>(null)
  const [expanded, setExpanded] = useState(false)

  const runTests = async () => {
    setTesting(true)
    setResults(null)
    
    try {
      const res = await fetch("/api/test")
      const data = await res.json()
      setResults(data)
      setExpanded(true)
    } catch (err) {
      setResults({
        cookies: { hasAccessToken: false, hasRefreshToken: false },
        opportunities: { success: false, error: "Failed to run tests" },
        legacyStages: { success: false, error: "Failed to run tests" },
        pipelinesV2: { success: false, error: "Failed to run tests" },
        error: err instanceof Error ? err.message : "Unknown error"
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="mb-6 border-dashed">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">API Connection Test</span>
            {results && (
              <div className="flex gap-2 ml-2">
                <Badge variant={results.opportunities.success ? "default" : "destructive"} className="text-xs">
                  Opportunities: {results.opportunities.success ? `✓ ${results.opportunities.count}` : "✗"}
                </Badge>
                <Badge variant={results.pipelinesV2.success ? "default" : "secondary"} className="text-xs">
                  Pipelines v2: {results.pipelinesV2.success ? `✓ ${results.pipelinesV2.count}` : "✗ 401"}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {results && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Hide Details" : "Show Details"}
              </Button>
            )}
            <Button size="sm" onClick={runTests} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test APIs"
              )}
            </Button>
          </div>
        </div>

        {expanded && results && (
          <div className="mt-4 space-y-3 text-sm">
            {/* Cookies Status */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {results.cookies.hasAccessToken ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium">Access Token: {results.cookies.hasAccessToken ? "Present" : "Missing"}</span>
                {results.cookies.hasRefreshToken && (
                  <Badge variant="outline" className="text-xs">+ Refresh Token</Badge>
                )}
                {results.cookies.tokenLength && (
                  <Badge variant="secondary" className="text-xs">{results.cookies.tokenLength} chars</Badge>
                )}
              </div>
              {results.cookies.allCookieNames && results.cookies.allCookieNames.length > 0 && (
                <details>
                  <summary className="text-xs text-muted-foreground cursor-pointer">All cookies ({results.cookies.allCookieNames.length})</summary>
                  <pre className="text-xs mt-1 p-2 bg-background rounded">{results.cookies.allCookieNames.join(", ")}</pre>
                </details>
              )}
              {results.error && (
                <p className="text-xs text-red-600 mt-2 font-mono">{results.error}</p>
              )}
            </div>

            {/* Opportunities API */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                {results.opportunities.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium">Opportunities API (v1)</span>
                {results.opportunities.success && (
                  <Badge variant="secondary" className="text-xs">{results.opportunities.count} found</Badge>
                )}
              </div>
              {results.opportunities.error && (
                <p className="text-xs text-red-600 mt-1 font-mono break-all">{results.opportunities.error}</p>
              )}
              {results.opportunities.raw && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer font-medium">Raw response</summary>
                  <pre className="text-xs mt-1 p-2 bg-background rounded overflow-auto max-h-32 whitespace-pre-wrap">
                    {results.opportunities.raw}
                  </pre>
                </details>
              )}
            </div>

            {/* Legacy Stages API */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-1">
                {results.legacyStages.success ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium">Legacy Opportunity Stages (v1)</span>
                {results.legacyStages.success && (
                  <Badge variant="secondary" className="text-xs">{results.legacyStages.count} stages</Badge>
                )}
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
                ⚠️ These are OLD opportunity stages, NOT your actual pipelines
              </p>
              {results.legacyStages.error && (
                <p className="text-xs text-red-600 mt-1 font-mono break-all">{results.legacyStages.error}</p>
              )}
              {results.legacyStages.raw && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer font-medium">Raw response</summary>
                  <pre className="text-xs mt-1 p-2 bg-background rounded overflow-auto max-h-32 whitespace-pre-wrap">
                    {results.legacyStages.raw}
                  </pre>
                </details>
              )}
            </div>

            {/* Pipelines v2 API */}
            <div className={`p-3 rounded-lg ${results.pipelinesV2.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                {results.pipelinesV2.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium">Pipelines API (v2) - NEW</span>
                {results.pipelinesV2.success && (
                  <Badge variant="secondary" className="text-xs">{results.pipelinesV2.count} pipelines</Badge>
                )}
              </div>
              <p className={`text-xs mb-2 ${results.pipelinesV2.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {results.pipelinesV2.success 
                  ? "✓ This is your actual pipelines data!" 
                  : "✗ This API requires additional Keap permissions. See error below."}
              </p>
              {results.pipelinesV2.error && (
                <p className="text-xs text-red-600 mt-1 font-mono break-all">{results.pipelinesV2.error}</p>
              )}
              {results.pipelinesV2.raw && (
                <details className="mt-2" open={!results.pipelinesV2.success}>
                  <summary className="text-xs text-muted-foreground cursor-pointer font-medium">Raw response</summary>
                  <pre className="text-xs mt-1 p-2 bg-background rounded overflow-auto max-h-32 whitespace-pre-wrap">
                    {results.pipelinesV2.raw}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
