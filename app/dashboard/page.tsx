import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { DashboardContent } from "@/components/dashboard-content"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>
}) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("keap_access_token")
  const params = await searchParams
  const justAuthenticated = params.auth === "success"

  // Debug: log cookie status on server

  if (!accessToken) {
    // If just authenticated but no token, show error instead of redirect
    if (justAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Authentication completed but cookies were not saved. This may be a browser or security issue.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <a href="/api/auth/keap">
                <Button className="w-full">Try Again</Button>
              </a>
              <a href="/">
                <Button variant="outline" className="w-full">Back to Home</Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Make sure cookies are enabled and you&apos;re not in incognito mode.
            </p>
          </div>
        </div>
      )
    }
    redirect("/auth/signin")
  }

  return <DashboardContent />
}
