"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, GitBranch } from "lucide-react"

interface PipelineStage {
  id: string
  name: string
  order: number
}

interface Pipeline {
  id: string
  name: string
  stages?: PipelineStage[]
  active?: boolean
}

export function PipelinesList() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPipelines() {
      try {
        const response = await fetch("/api/pipelines")

        if (!response.ok) {
          throw new Error("Failed to fetch pipelines")
        }

        const data = await response.json()
        setPipelines(data.pipelines || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchPipelines()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3 mt-2" />
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

  if (pipelines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Pipelines Found</CardTitle>
          <CardDescription>Create your first pipeline to start organizing your opportunities.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {pipelines.map((pipeline) => (
        <Card key={pipeline.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{pipeline.name}</CardTitle>
              </div>
              {pipeline.active !== undefined && (
                <Badge variant={pipeline.active ? "default" : "secondary"}>
                  {pipeline.active ? "Active" : "Inactive"}
                </Badge>
              )}
            </div>
            {pipeline.stages && pipeline.stages.length > 0 && (
              <CardDescription>{pipeline.stages.length} stages</CardDescription>
            )}
          </CardHeader>
          {pipeline.stages && pipeline.stages.length > 0 && (
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {pipeline.stages
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <Badge key={stage.id} variant="outline">
                      {stage.name}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
