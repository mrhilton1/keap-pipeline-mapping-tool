import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { OpportunityMapper } from "@/components/opportunity-mapper"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("keap_access_token")

  if (!accessToken) {
    redirect("/auth/signin")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Connected to Keap</span>
            </div>
            <h1 className="text-4xl font-bold">Opportunity Migration Dashboard</h1>
            <p className="text-muted-foreground mt-2">Map your opportunities to pipelines and execute the migration</p>
          </div>

          <OpportunityMapper />
        </div>
      </div>
    </div>
  )
}
