"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Stage {
  name: string
  order: number
}

export function CreatePipelineDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [stages, setStages] = useState<Stage[]>([
    { name: "Initial Contact", order: 1 },
    { name: "Proposal Sent", order: 2 },
    { name: "Negotiation", order: 3 },
    { name: "Closed Won", order: 4 },
  ])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const addStage = () => {
    setStages([...stages, { name: "", order: stages.length + 1 }])
  }

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index))
  }

  const updateStageName = (index: number, newName: string) => {
    const updated = [...stages]
    updated[index].name = newName
    setStages(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/pipelines/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          stages: stages.map((s) => s.name).filter((n) => n.trim()),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create pipeline")
      }

      toast({
        title: "Pipeline Created",
        description: `Successfully created pipeline "${name}"`,
      })

      setOpen(false)
      setName("")
      setStages([
        { name: "Initial Contact", order: 1 },
        { name: "Proposal Sent", order: 2 },
        { name: "Negotiation", order: 3 },
        { name: "Closed Won", order: 4 },
      ])
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create pipeline. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Pipeline
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Pipeline</DialogTitle>
            <DialogDescription>Create a new pipeline with custom stages for your opportunities</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <Label htmlFor="pipeline-name">Pipeline Name</Label>
              <Input
                id="pipeline-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sales Pipeline, Consulting Projects"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Stages</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStage}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Stage
                </Button>
              </div>

              <div className="space-y-2">
                {stages.map((stage, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground w-8">{index + 1}.</span>
                    <Input
                      value={stage.name}
                      onChange={(e) => updateStageName(index, e.target.value)}
                      placeholder="Stage name"
                      required
                    />
                    {stages.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeStage(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
