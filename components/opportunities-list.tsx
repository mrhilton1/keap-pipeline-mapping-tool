"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, DollarSign } from "lucide-react"

interface Opportunity {
  id: string
  opportunity_title: string
  contact?: {
    first_name?: string
    last_name?: string
  }
  projected_revenue_high?: number
  projected_revenue_low?: number
  stage?: {
    name: string
    id: string
  }
  next_action_date?: string
  last_updated?: string
}

export function OpportunitiesList() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        const response = await fetch("/api/opportunities")

        if (!response.ok) {
          throw new Error("Failed to fetch opportunities")
        }

        const data = await response.json()
        setOpportunities(data.opportunities || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchOpportunities()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Opportunities Found</CardTitle>
          <CardDescription>There are no opportunities in your Keap account to migrate.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {opportunities.map((opp) => (
        <Card key={opp.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{opp.opportunity_title}</CardTitle>
                <CardDescription>
                  {opp.contact?.first_name || opp.contact?.last_name
                    ? `${opp.contact.first_name || ""} ${opp.contact.last_name || ""}`.trim()
                    : "No contact"}
                </CardDescription>
              </div>
              {opp.stage && (
                <Badge variant="secondary" className="ml-2">
                  {opp.stage.name}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {(opp.projected_revenue_high || opp.projected_revenue_low) && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span>
                    {opp.projected_revenue_low && opp.projected_revenue_high
                      ? `$${opp.projected_revenue_low.toLocaleString()} - $${opp.projected_revenue_high.toLocaleString()}`
                      : opp.projected_revenue_high
                        ? `$${opp.projected_revenue_high.toLocaleString()}`
                        : `$${opp.projected_revenue_low?.toLocaleString()}`}
                  </span>
                </div>
              )}
              {opp.last_updated && <span>Updated: {new Date(opp.last_updated).toLocaleDateString()}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
