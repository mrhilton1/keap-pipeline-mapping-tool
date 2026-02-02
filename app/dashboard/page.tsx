import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { CheckCircle2, LogOut, AlertCircle } from "lucide-react"
import { MigrationDashboard } from "@/components/migration-dashboard"
import { ApiTestPanel } from "@/components/api-test-panel"
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
  console.log("[Dashboard] Access token present:", !!accessToken?.value)
  console.log("[Dashboard] Just authenticated:", justAuthenticated)

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium">Connected to Keap</span>
          </div>
          <a href="/api/auth/logout">
            <Button variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </a>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Pipeline Migration Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Analyze opportunities, build pipelines with AI, and migrate deals
            </p>
          </div>

          {/* API Test Panel */}
          <ApiTestPanel />

          <MigrationDashboard />
        </div>
      </div>
    </div>
  )
}
