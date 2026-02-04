"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, XCircle, Loader2, LogOut, RefreshCw } from "lucide-react"

interface TestResult {
  success: boolean
  count?: number
  total?: number
  error?: string
  data?: any[]
}

interface XmlRpcTestResult {
  success: boolean
  duration?: number
  message?: string
  error?: string
  tests?: {
    productInterest: { success: boolean; error: string; count: number }
    stageMove: { success: boolean; error: string; count: number }
  }
}

interface TestResults {
  opportunities: TestResult
  pipelines: TestResult
  xmlrpc: XmlRpcTestResult
}

interface DashboardHeaderProps {
  onDataLoaded?: (data: { opportunities: any[]; pipelines: any[] }) => void
}

export function DashboardHeader({ onDataLoaded }: DashboardHeaderProps) {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResults | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<{
    title: string
    success: boolean
    count: number
    total: number
    error?: string
    data?: any[]
  } | null>(null)

  // Run tests on page load
  useEffect(() => {
    runTests()
  }, [])

  const runTests = async () => {
    setTesting(true)
    
    try {
      // Fetch opportunities, pipelines, and test XML-RPC
      const [oppRes, pipeRes, xmlrpcRes] = await Promise.all([
        fetch("/api/opportunities?limit=20"),
        fetch("/api/pipelines"),
        fetch("/api/xmlrpc/test")
      ])
      
      const oppData = await oppRes.json()
      const pipeData = await pipeRes.json()
      const xmlrpcData = await xmlrpcRes.json()
      
      const opportunitiesResult: TestResult = {
        success: oppRes.ok,
        count: oppData.opportunities?.length || 0,
        total: oppData.count || oppData.opportunities?.length || 0,
        error: oppData.error || oppData.details,
        data: oppData.opportunities?.slice(0, 20) || []
      }
      
      const pipelinesResult: TestResult = {
        success: pipeRes.ok,
        count: pipeData.pipelines?.length || 0,
        total: pipeData.pipelines?.length || 0,
        error: pipeData.error || pipeData.details,
        data: pipeData.pipelines || []
      }
      
      const xmlrpcResult: XmlRpcTestResult = {
        success: xmlrpcRes.ok && xmlrpcData.success,
        duration: xmlrpcData.duration,
        message: xmlrpcData.message,
        error: xmlrpcData.error,
        tests: xmlrpcData.tests
      }
      
      setResults({
        opportunities: opportunitiesResult,
        pipelines: pipelinesResult,
        xmlrpc: xmlrpcResult
      })
      
      // Notify parent of loaded data
      if (onDataLoaded) {
        onDataLoaded({
          opportunities: oppData.opportunities || [],
          pipelines: pipeData.pipelines || []
        })
      }
    } catch (err) {
      setResults({
        opportunities: { 
          success: false, 
          error: err instanceof Error ? err.message : "Failed to fetch",
          count: 0,
          total: 0
        },
        pipelines: { 
          success: false, 
          error: err instanceof Error ? err.message : "Failed to fetch",
          count: 0,
          total: 0
        },
        xmlrpc: {
          success: false,
          error: err instanceof Error ? err.message : "Failed to fetch"
        }
      })
    } finally {
      setTesting(false)
    }
  }

  const openModal = (type: "opportunities" | "pipelines" | "xmlrpc") => {
    if (!results) return
    
    if (type === "xmlrpc") {
      const result = results.xmlrpc
      const testData = result.tests ? {
        ProductInterest: result.tests.productInterest,
        StageMove: result.tests.stageMove,
        duration_ms: result.duration,
        status: result.message
      } : { error: result.error }
      
      setModalData({
        title: "XML-RPC API",
        success: result.success,
        count: 0,
        total: 0,
        error: result.error,
        data: [testData]
      })
      setModalOpen(true)
      return
    }
    
    const result = results[type]
    setModalData({
      title: type === "opportunities" ? "Opportunities API (v1)" : "Pipelines API (v2)",
      success: result.success,
      count: result.count || 0,
      total: result.total || 0,
      error: result.error,
      data: result.data
    })
    setModalOpen(true)
  }

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          {/* Left side: Connection status + Test badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Connected to Keap</span>
            </div>
            
            {/* Test badges - clickable */}
            <div className="flex items-center gap-2 ml-2">
              {testing ? (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Testing...
                </Badge>
              ) : results ? (
                <>
                  {/* Opportunities badge */}
                  <Badge 
                    variant={results.opportunities.success ? "default" : "destructive"}
                    className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => openModal("opportunities")}
                  >
                    {results.opportunities.success ? (
                      <>Opportunities: ✓{results.opportunities.total}</>
                    ) : (
                      <>Opportunities: ✗</>
                    )}
                  </Badge>
                  
                  {/* Pipelines badge */}
                  <Badge 
                    variant={results.pipelines.success ? "default" : "destructive"}
                    className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => openModal("pipelines")}
                  >
                    {results.pipelines.success ? (
                      <>Pipelines: ✓{results.pipelines.total}</>
                    ) : (
                      <>Pipelines: ✗</>
                    )}
                  </Badge>
                  
                  {/* XML-RPC badge */}
                  <Badge 
                    variant={results.xmlrpc.success ? "default" : "destructive"}
                    className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => openModal("xmlrpc")}
                  >
                    {results.xmlrpc.success ? (
                      <>XML-RPC: ✓</>
                    ) : (
                      <>XML-RPC: ✗</>
                    )}
                  </Badge>
                </>
              ) : null}
              
              {/* Refresh button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={runTests}
                disabled={testing}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Right side: Disconnect */}
          <a href="/api/auth/logout">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Disconnect
            </Button>
          </a>
        </div>
      </header>

      {/* JSON Data Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalData?.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {modalData?.title}
              {modalData?.success && (
                <Badge variant="secondary" className="ml-2">
                  {modalData.count} shown of {modalData.total} total
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {modalData?.error ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Error</p>
                <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono">
                  {modalData.error}
                </pre>
              </div>
            ) : (
              <div className="space-y-3">
                {modalData?.total && modalData.total > 20 && (
                  <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                    ℹ️ Showing first 20 of {modalData.total} records. The full data is used in the dashboard.
                  </p>
                )}
                <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto max-h-[50vh] font-mono">
                  {JSON.stringify(modalData?.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
