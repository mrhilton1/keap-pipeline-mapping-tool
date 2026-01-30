import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function SignInPage() {
  const keapAuthUrl = `/api/auth/keap`

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Connect to Keap</CardTitle>
            <CardDescription>Authenticate with your Keap account to start migrating your opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            <a href={keapAuthUrl}>
              <Button className="w-full" size="lg">
                Sign in with Keap
              </Button>
            </a>
            <p className="text-xs text-muted-foreground text-center mt-4">
              We&apos;ll securely connect to your Keap account using OAuth 2.0. We only request the permissions needed
              to read and manage your pipelines and opportunities.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
