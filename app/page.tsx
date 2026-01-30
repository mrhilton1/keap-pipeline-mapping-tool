import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, GitBranch, Zap } from "lucide-react"
import { KeapStatusIndicator } from "@/components/keap-status-indicator"
import { SigninModal } from "@/components/signin-modal"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Status Bar */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Pipeline Migration Tool</span>
          <KeapStatusIndicator />
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4 text-balance">Keap Opportunity Migration Tool</h1>
            <p className="text-xl text-muted-foreground mb-8 text-pretty">
              Seamlessly migrate your Keap Opportunities to multiple Pipelines with our intelligent mapping tool
            </p>
            <SigninModal />
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Card>
              <CardHeader>
                <GitBranch className="w-10 h-10 mb-4 text-primary" />
                <CardTitle>Create Pipelines</CardTitle>
                <CardDescription>Build new pipelines and custom deal fields directly from the tool</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Database className="w-10 h-10 mb-4 text-primary" />
                <CardTitle>Smart Mapping</CardTitle>
                <CardDescription>Map opportunities individually or in bulk to your new pipelines</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="w-10 h-10 mb-4 text-primary" />
                <CardTitle>Safe Migration</CardTitle>
                <CardDescription>Preview changes before migrating with confidence and control</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    1
                  </span>
                  <div>
                    <h3 className="font-semibold mb-1">Connect to Keap</h3>
                    <p className="text-muted-foreground text-sm">
                      Securely authenticate with your Keap account using OAuth
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    2
                  </span>
                  <div>
                    <h3 className="font-semibold mb-1">Smart Mapping</h3>
                    <p className="text-muted-foreground text-sm">
                      View all opportunities and create mappings to your target pipelines
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    3
                  </span>
                  <div>
                    <h3 className="font-semibold mb-1">Create Pipelines</h3>
                    <p className="text-muted-foreground text-sm">
                      Build new pipelines and custom fields to match your opportunity structure
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    4
                  </span>
                  <div>
                    <h3 className="font-semibold mb-1">Execute Migration</h3>
                    <p className="text-muted-foreground text-sm">
                      Review your mappings and migrate opportunities with one click
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
