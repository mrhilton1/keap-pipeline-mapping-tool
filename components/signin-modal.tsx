"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowRight, KeyRound, Shield, Loader2, ExternalLink, CheckCircle2 } from "lucide-react"

interface SigninModalProps {
  trigger?: React.ReactNode
  children?: React.ReactNode
}

export function SigninModal({ trigger, children }: SigninModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [authSuccess, setAuthSuccess] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)

  // Listen for messages from popup window
  const handleMessage = useCallback((event: MessageEvent) => {
    // Verify origin for security
    if (event.origin !== window.location.origin) return
    
    if (event.data?.type === "KEAP_AUTH_SUCCESS") {
      setIsLoading(false)
      setAuthSuccess(true)
      // Redirect to dashboard after short delay to show success
      setTimeout(() => {
        window.location.href = "/dashboard?auth=success"
      }, 1000)
    } else if (event.data?.type === "KEAP_AUTH_ERROR") {
      setIsLoading(false)
      setAuthSuccess(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  const handleSignIn = () => {
    setIsLoading(true)
    setPopupBlocked(false)
    
    // Calculate popup position (centered)
    const width = 500
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    
    // Open popup window
    const popup = window.open(
      "/api/auth/keap?popup=true",
      "keap_auth",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    )
    
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      // Popup was blocked - fall back to redirect
      setPopupBlocked(true)
      setIsLoading(false)
    } else {
      // Poll to check if popup was closed without completing auth
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup)
          // Give a moment for the message to arrive
          setTimeout(() => {
            if (!authSuccess) {
              setIsLoading(false)
            }
          }, 500)
        }
      }, 500)
    }
  }

  const handleRedirectSignIn = () => {
    setIsLoading(true)
    window.location.href = "/api/auth/keap"
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || children || (
          <Button size="lg" className="gap-2">
            Get Started <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className={`mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center ${
            authSuccess ? "bg-green-100" : "bg-primary/10"
          }`}>
            {authSuccess ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <KeyRound className="h-6 w-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-xl">
            {authSuccess ? "Connected!" : "Connect to Keap"}
          </DialogTitle>
          <DialogDescription className="text-balance">
            {authSuccess 
              ? "Authentication successful. Redirecting to dashboard..."
              : "Securely authenticate with your Keap account to start migrating your opportunities to pipelines."
            }
          </DialogDescription>
        </DialogHeader>
        
        {!authSuccess && (
          <div className="space-y-4 py-4">
            <Button 
              className="w-full h-11 text-base" 
              onClick={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Waiting for authentication...
                </>
              ) : (
                <>
                  Sign in with Keap
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            
            {popupBlocked && (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 text-center">
                  Popup was blocked by your browser.
                </p>
                <Button 
                  variant="outline"
                  className="w-full" 
                  onClick={handleRedirectSignIn}
                >
                  Continue with redirect instead
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                A secure popup will open for Keap authentication. We only request permissions needed to read and manage your pipelines and opportunities.
              </p>
            </div>
          </div>
        )}
        
        {authSuccess && (
          <div className="py-4 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
