"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

export default function AuthSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)
  const [hasTokens, setHasTokens] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkTokens() {
      try {
        const res = await fetch("/api/auth/keap/status")
        const data = await res.json()
        setHasTokens(data.cookies?.hasAccessToken || false)
        if (!data.cookies?.hasAccessToken) {
          setError("Tokens were not saved. Please try again.")
        }
      } catch (err) {
        setError("Failed to verify authentication")
      } finally {
        setChecking(false)
      }
    }
    
    checkTokens()
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {hasTokens ? (
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          )}
          <CardTitle>
            {hasTokens ? "Authentication Successful!" : "Authentication Failed"}
          </CardTitle>
          <CardDescription>
            {hasTokens 
              ? "Your Keap account is now connected."
              : error || "Something went wrong during authentication."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {hasTokens ? (
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button onClick={() => router.push("/api/auth/keap")} className="w-full">
                Try Again
              </Button>
              <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                Back to Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
