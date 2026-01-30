"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Opportunity {
  id: string
  opportunity_title: string
}

interface Pipeline {
  id: string
  name: string
  stages?: Array<{
    id: string
    name: string
  }>
}

interface OpportunityMapping {
  opportunityId: string
  pipelineId: string
  stageId?: string
}

interface MigrationPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mappings: Map<string, OpportunityMapping>
  opportunities: Opportunity[]
  pipelines: Pipeline[]
  onConfirm: () => void
  loading: boolean
  result?: {
    total: number
    successful: number
    failed: number
    errors?: Array<{ opportunityId: string; error: string }>
  }
}

export function MigrationPreviewDialog({
  open,
  onOpenChange,
  mappings,
  opportunities,
  pipelines,
  onConfirm,
  loading,
  result,
}: MigrationPreviewDialogProps) {
  const mappingArray = Array.from(mappings.values())

  const getOpportunityName = (oppId: string) => {
    return opportunities.find((o) => o.id === oppId)?.opportunity_title || "Unknown"
  }

  const getPipelineName = (pipelineId: string) => {
    return pipelines.find((p) => p.id === pipelineId)?.name || "Unknown"
  }

  const getStageName = (pipelineId: string, stageId?: string) => {
    if (!stageId) return null
    const pipeline = pipelines.find((p) => p.id === pipelineId)
    return pipeline?.stages?.find((s) => s.id === stageId)?.name
  }

  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Migration Complete</DialogTitle>
            <DialogDescription>Your opportunities have been migrated to their new pipelines</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className={result.failed === 0 ? "border-green-500" : "border-yellow-500"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Migration Summary</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  <p>
                    <strong>{result.successful}</strong> of <strong>{result.total}</strong> opportunities migrated
                    successfully
                  </p>
                  {result.failed > 0 && (
                    <p className="text-destructive">
                      <strong>{result.failed}</strong> opportunities failed to migrate
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {result.errors && result.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Failed Migrations:</h4>
                <ScrollArea className="h-40 rounded-md border p-4">
                  <div className="space-y-2">
                    {result.errors.map((err) => (
                      <div key={err.opportunityId} className="text-sm">
                        <p className="font-medium">{getOpportunityName(err.opportunityId)}</p>
                        <p className="text-muted-foreground text-xs">{err.error}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Migration</DialogTitle>
          <DialogDescription>
            You are about to migrate {mappingArray.length} opportunities to their new pipelines
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            This action will update your opportunities in Keap. Make sure all mappings are correct before proceeding.
          </AlertDescription>
        </Alert>

        <ScrollArea className="h-96 rounded-md border p-4">
          <div className="space-y-3">
            {mappingArray.map((mapping) => {
              const stageName = getStageName(mapping.pipelineId, mapping.stageId)
              return (
                <div key={mapping.opportunityId} className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
                  <div className="flex-1 font-medium">{getOpportunityName(mapping.opportunityId)}</div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col items-end gap-1">
                    <Badge>{getPipelineName(mapping.pipelineId)}</Badge>
                    {stageName && <Badge variant="outline">{stageName}</Badge>}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Migrating..." : `Migrate ${mappingArray.length} Opportunities`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
