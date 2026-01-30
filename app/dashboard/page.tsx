import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { CheckCircle2, LogOut } from "lucide-react"
import { MigrationDashboard } from "@/components/migration-dashboard"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("keap_access_token")

  if (!accessToken) {
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
          <Link href="/api/auth/logout">
            <Button variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Pipeline Migration Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Analyze opportunities, build pipelines with AI, and migrate deals
            </p>
          </div>

          <MigrationDashboard />
        </div>
      </div>
    </div>
  )
}
