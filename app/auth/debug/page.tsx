"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthDebugPage() {
  const [browserCookies, setBrowserCookies] = useState<string>("")
  const [serverStatus, setServerStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Get browser-visible cookies
    setBrowserCookies(document.cookie || "(none visible - httpOnly cookies hidden)")
  }, [])

  const checkServer = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/keap/status")
      const data = await res.json()
      setServerStatus(data)
    } catch (err) {
      setServerStatus({ error: String(err) })
    }
    setLoading(false)
  }

  const testAuth = () => {
    window.location.href = "/api/auth/keap"
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">🔧 Auth Debug Page</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Browser Cookies (JS-visible)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-auto">
            {browserCookies}
          </pre>
          <p className="text-xs text-muted-foreground mt-2">
            Note: HttpOnly cookies (like our auth tokens) won&apos;t show here - that&apos;s expected.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Server Cookie Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={checkServer} disabled={loading}>
            {loading ? "Checking..." : "Check Server Status"}
          </Button>
          
          {serverStatus && (
            <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(serverStatus, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Authentication Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click below to start the OAuth flow. After completing, come back to this page and check the server status.
          </p>
          <div className="flex gap-2">
            <Button onClick={testAuth}>
              Start OAuth Flow
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/api/auth/logout"}>
              Clear Cookies (Logout)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Check Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>1. Check Network Tab:</strong></p>
          <ul className="list-disc list-inside ml-4 text-muted-foreground">
            <li>Open DevTools → Network tab</li>
            <li>Click &quot;Start OAuth Flow&quot; above</li>
            <li>After redirect, find the <code>callback</code> request</li>
            <li>Check Response Headers for <code>Set-Cookie</code></li>
          </ul>
          
          <p className="mt-4"><strong>2. Check Application Tab:</strong></p>
          <ul className="list-disc list-inside ml-4 text-muted-foreground">
            <li>Open DevTools → Application tab</li>
            <li>Expand Cookies → select this domain</li>
            <li>Look for <code>keap_access_token</code> and <code>keap_refresh_token</code></li>
          </ul>

          <p className="mt-4"><strong>3. Check Cloudflare Logs:</strong></p>
          <ul className="list-disc list-inside ml-4 text-muted-foreground">
            <li>Go to Cloudflare Dashboard → Workers → Your Worker → Logs</li>
            <li>Search for <code>[Keap OAuth Callback]</code></li>
            <li>Look for &quot;Token received!&quot; and &quot;Setting cookies&quot;</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
