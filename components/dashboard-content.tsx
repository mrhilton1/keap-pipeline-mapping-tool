"use client"

import { DashboardHeader } from "./dashboard-header"
import { MigrationDashboard } from "./migration-dashboard"

export function DashboardContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Minimalistic Header with Test Badges */}
      <DashboardHeader />

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Pipeline Migration Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Analyze opportunities, build pipelines with AI, and migrate deals
            </p>
          </div>

          <MigrationDashboard />
        </div>
      </div>
    </div>
  )
}
