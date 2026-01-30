"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
}

export function KeapStatusIndicator() {
  const [status, setStatus] = useState<"loading" | "configured" | "connected" | "error">("loading")
  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = async () => {
    setStatus("loading")
    setError(null)
    
    try {
      const response = await fetch("/api/auth/keap/status")
      if (!response.ok) throw new Error("Failed to fetch status")
      
      const data: StatusData = await response.json()
      setStatusData(data)
      
      // Determine status
      if (data.cookies.hasAccessToken) {
        setStatus("connected")
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
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          text: "Checking...",
          variant: "secondary" as const,
          color: "text-muted-foreground",
        }
      case "connected":
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          text: "Connected",
          variant: "default" as const,
          color: "text-green-600 dark:text-green-400",
        }
      case "configured":
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          text: "Ready to Connect",
          variant: "outline" as const,
          color: "text-amber-600 dark:text-amber-400",
        }
      case "error":
        return {
          icon: <XCircle className="w-3.5 h-3.5" />,
          text: "Not Configured",
          variant: "destructive" as const,
          color: "text-red-600 dark:text-red-400",
        }
    }
  }

  const display = getStatusDisplay()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2">
            <Badge 
              variant={display.variant} 
              className={`gap-1.5 px-2.5 py-1 cursor-help ${display.color}`}
            >
              {display.icon}
              <span className="text-xs font-medium">Keap: {display.text}</span>
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={checkStatus}
              disabled={status === "loading"}
            >
              <RefreshCw className={`w-3 h-3 ${status === "loading" ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="space-y-2 text-xs">
            {status === "connected" && (
              <p className="text-green-600 dark:text-green-400 font-medium">
                ✓ Successfully authenticated with Keap
              </p>
            )}
            {status === "configured" && (
              <>
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  OAuth credentials are set up. Click "Get Started" to connect.
                </p>
                {statusData && (
                  <p className="text-muted-foreground">
                    Redirect URI: <code className="bg-muted px-1 rounded text-[10px]">{statusData.configuration.redirectUri.active}</code>
                  </p>
                )}
              </>
            )}
            {status === "error" && (
              <>
                <p className="text-red-600 dark:text-red-400 font-medium">
                  Missing configuration
                </p>
                <p className="text-muted-foreground">
                  {error || "Check environment variables: KEAP_CLIENT_ID, KEAP_CLIENT_SECRET"}
                </p>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
