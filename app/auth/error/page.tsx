"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, X } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get("message") || "An error occurred during authentication"
  const [isPopup, setIsPopup] = useState(false)

  useEffect(() => {
    // Check if this is a popup window
    if (window.opener && !window.opener.closed) {
      setIsPopup(true)
      // Notify opener of error
      window.opener.postMessage({ type: 'KEAP_AUTH_ERROR', message }, window.location.origin)
    }
  }, [message])

  const handleClose = () => {
    window.close()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <CardTitle>Authentication Failed</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isPopup ? (
            <Button className="w-full" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Close Window
            </Button>
          ) : (
            <>
              <Link href="/auth/signin">
                <Button className="w-full">Try Again</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full bg-transparent">
                  Back to Home
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
