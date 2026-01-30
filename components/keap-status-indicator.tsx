"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StatusData {
  status: string
  configuration: {
    clientId: string
    clientSecret: string
    redirectUri: {
      active: string
    }
  }
  cookies: {
    hasAccessToken: boolean
    hasRefreshToken: boolean
  }
  tokenVerification?: {
    valid: boolean
    v1Works?: boolean
    v2Works?: boolean
    error?: string
  }
}

export function KeapStatusIndicator() {
  const [status, setStatus] = useState<"loading" | "configured" | "connected" | "error">("loading")
  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const checkStatus = async () => {
    setStatus("loading")
    setError(null)
    
    try {
      const response = await fetch("/api/auth/keap/status")
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data: StatusData = await response.json()
      setStatusData(data)
      
      // Check token verification status
      if (data.cookies.hasAccessToken && data.tokenVerification?.valid) {
        setStatus("connected")
      } else if (data.cookies.hasAccessToken && !data.tokenVerification?.valid) {
        setStatus("error")
        setError(data.tokenVerification?.error || "Token invalid - please re-authenticate")
      } else if (data.configuration.clientId !== "NOT SET" && data.configuration.clientSecret !== "NOT SET") {
        setStatus("configured")
      } else {
        setStatus("error")
        setError("Missing environment variables")
      }
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const getStatusDisplay = () => {
    switch (status) {
      case "loading":
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: "Checking",
          bg: "bg-slate-100 dark:bg-slate-800",
          textColor: "text-slate-600 dark:text-slate-400",
        }
      case "connected":
        return {
          icon: <CheckCircle2 className="w-3 h-3" />,
          text: "Connected",
          bg: "bg-emerald-100 dark:bg-emerald-900/30",
          textColor: "text-emerald-700 dark:text-emerald-400",
        }
      case "configured":
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          text: "Ready",
          bg: "bg-amber-100 dark:bg-amber-900/30",
          textColor: "text-amber-700 dark:text-amber-400",
        }
      case "error":
        return {
          icon: <XCircle className="w-3 h-3" />,
          text: "Error",
          bg: "bg-red-100 dark:bg-red-900/30",
          textColor: "text-red-700 dark:text-red-400",
        }
    }
  }

  const display = getStatusDisplay()

  return (
    <div className="relative">
      <div className="inline-flex items-center gap-1.5">
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer hover:opacity-80 ${display.bg} ${display.textColor}`}
        >
          {display.icon}
          <span>{display.text}</span>
        </button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 rounded-full" 
          onClick={(e) => { e.stopPropagation(); checkStatus(); }}
          disabled={status === "loading"}
        >
          <RefreshCw className={`w-3 h-3 ${status === "loading" ? "animate-spin" : ""}`} />
        </Button>
      </div>
      
      {showTooltip && (
        <div 
          className="absolute right-0 top-full mt-2 w-72 p-3 rounded-lg border bg-popover text-popover-foreground shadow-lg z-50"
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="space-y-2 text-xs">
            {status === "connected" && statusData?.tokenVerification && (
              <div className="space-y-1">
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Successfully authenticated with Keap
                </p>
                <p className="text-muted-foreground">
                  v1 API (Opportunities): {statusData.tokenVerification.v1Works ? "✓" : "✗"}
                </p>
                <p className="text-muted-foreground">
                  v2 API (Pipelines): {statusData.tokenVerification.v2Works ? "✓" : "✗"}
                </p>
              </div>
            )}
            {status === "configured" && (
              <>
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  OAuth configured. Click "Get Started" to connect.
                </p>
                {statusData && (
                  <p className="text-muted-foreground break-all">
                    Redirect: <code className="text-[10px]">{statusData.configuration.redirectUri.active}</code>
                  </p>
                )}
              </>
            )}
            {status === "error" && (
              <>
                <p className="text-red-600 dark:text-red-400 font-medium">Configuration Error</p>
                <p className="text-muted-foreground">{error}</p>
                <p className="text-muted-foreground mt-1">
                  Set in Vercel: KEAP_CLIENT_ID, KEAP_CLIENT_SECRET, KEAP_REDIRECT_URI
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
