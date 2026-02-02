"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Loader2, FlaskConical } from "lucide-react"

interface TestResults {
  cookies: { hasAccessToken: boolean; hasRefreshToken: boolean }
  opportunities: { success: boolean; count?: number; error?: string; raw?: string }
  pipelines: { success: boolean; count?: number; error?: string; raw?: string }
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
        pipelines: { success: false, error: "Failed to run tests" },
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
                <Badge variant={results.pipelines.success ? "default" : "destructive"} className="text-xs">
                  Pipelines: {results.pipelines.success ? `✓ ${results.pipelines.count}` : "✗"}
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
            <div className="flex items-center gap-2">
              {results.cookies.hasAccessToken ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span>Access Token: {results.cookies.hasAccessToken ? "Present" : "Missing"}</span>
              {results.cookies.hasRefreshToken && (
                <Badge variant="outline" className="text-xs">+ Refresh Token</Badge>
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
                <span className="font-medium">v1 Opportunities API</span>
                {results.opportunities.success && (
                  <Badge variant="secondary" className="text-xs">{results.opportunities.count} found</Badge>
                )}
              </div>
              {results.opportunities.error && (
                <p className="text-xs text-red-600 mt-1 font-mono">{results.opportunities.error}</p>
              )}
              {results.opportunities.raw && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Raw response</summary>
                  <pre className="text-xs mt-1 p-2 bg-background rounded overflow-auto max-h-32">
                    {results.opportunities.raw}
                  </pre>
                </details>
              )}
            </div>

            {/* Pipelines API */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                {results.pipelines.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium">v2 Pipelines API</span>
                {results.pipelines.success && (
                  <Badge variant="secondary" className="text-xs">{results.pipelines.count} found</Badge>
                )}
              </div>
              {results.pipelines.error && (
                <p className="text-xs text-red-600 mt-1 font-mono">{results.pipelines.error}</p>
              )}
              {results.pipelines.raw && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Raw response</summary>
                  <pre className="text-xs mt-1 p-2 bg-background rounded overflow-auto max-h-32">
                    {results.pipelines.raw}
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
