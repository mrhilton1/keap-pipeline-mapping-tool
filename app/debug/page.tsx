"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronRight, Play, Copy, Check, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

interface TestResult {
  test: string
  description: string
  success: boolean
  recordCount?: number
  data?: any
  productInterests?: any[]
  products?: any[]
  stageNames?: Record<string, string>
  analysis?: {
    lastUpdate?: string
    outcomeDate?: string
    outcomeType?: string
  }
  summary?: any
  error?: string
  message?: string
  requestXml?: string
  responseXml?: string
}

const TESTS = [
  { id: 'stages', name: 'Stage Table', description: 'Get all stages (ID → Name lookup)' },
  { id: 'products', name: 'Products (Full Chain)', description: 'ProductInterest → Product lookup for opportunity', needsOppId: true },
  { id: 'productinterest', name: 'ProductInterest Only', description: 'Raw ProductInterest records', needsOppId: true },
  { id: 'producttable', name: 'Product Table (All)', description: 'All products with Id, Name, Price, Sku, Status' },
  { id: 'productoptvalue', name: 'ProductOptValue (All)', description: 'All product option values (variations, pricing)' },
  { id: 'productopt', name: 'ProductOpt (All)', description: 'Product options (option types/categories)' },
  { id: 'orderitem', name: 'OrderItem (All)', description: 'All order line items with prices & quantities' },
  { id: 'invoice', name: 'Invoice (All)', description: 'All invoices' },
  { id: 'stagemove', name: 'Stage Moves', description: 'Stage move history with names & analysis', needsOppId: true },
]

export default function DebugPage() {
  const [oppId, setOppId] = useState("2")
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const runTest = async (testId: string) => {
    setLoading(testId)
    try {
      const url = testId === 'stages'
        ? `/api/xmlrpc/debug?test=${testId}`
        : `/api/xmlrpc/debug?test=${testId}&oppId=${oppId}`
      
      const response = await fetch(url)
      const data = await response.json()
      setResults(prev => ({ ...prev, [testId]: data }))
      setExpanded(prev => ({ ...prev, [testId]: true }))
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [testId]: { 
          test: testId, 
          description: '',
          success: false, 
          error: String(error) 
        } 
      }))
    } finally {
      setLoading(null)
    }
  }

  const runAllTests = async () => {
    for (const test of TESTS) {
      await runTest(test.id)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleExpanded = (testId: string) => {
    setExpanded(prev => ({ ...prev, [testId]: !prev[testId] }))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">XML-RPC Debug Console</h1>
              <p className="text-zinc-400 mt-1">Step through individual API calls and see parsed JSON responses</p>
            </div>
          </div>
          <Button 
            onClick={runAllTests} 
            disabled={loading !== null}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="h-4 w-4 mr-2" />
            Run All Tests
          </Button>
        </div>

        {/* Opportunity ID input */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-6">
            <Label htmlFor="oppId" className="text-zinc-300 font-medium whitespace-nowrap">
              Test Opportunity ID:
            </Label>
            <Input
              id="oppId"
              value={oppId}
              onChange={(e) => setOppId(e.target.value)}
              className="w-28 bg-zinc-800 border-zinc-700 text-white text-lg font-mono"
              placeholder="2"
            />
            <span className="text-sm text-zinc-500">
              Used for ProductInterest, Products, and StageMove tests
            </span>
          </div>
        </div>

        {/* Test Cards */}
        <div className="space-y-5">
          {TESTS.map((test, index) => {
            const result = results[test.id]
            const isLoading = loading === test.id
            const isExpanded = expanded[test.id]

            return (
              <Card key={test.id} className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
                <CardHeader className="py-4 px-6 bg-zinc-900/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-600 font-mono text-sm">{index + 1}.</span>
                      <CardTitle className="text-xl font-semibold text-white">{test.name}</CardTitle>
                      {test.needsOppId && (
                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                          Opp #{oppId}
                        </Badge>
                      )}
                      {result && (
                        <Badge 
                          className={result.success 
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                          }
                        >
                          {result.success ? `✓ ${result.recordCount ?? 0} records` : `✗ Failed`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {result && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpanded(test.id)}
                          className="text-zinc-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        onClick={() => runTest(test.id)}
                        disabled={isLoading}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white min-w-[80px]"
                      >
                        {isLoading ? (
                          <span className="animate-pulse">Running...</span>
                        ) : (
                          <>
                            <ChevronRight className="h-4 w-4 mr-1" />
                            Run
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1 ml-8">{test.description}</p>
                </CardHeader>

                {result && isExpanded && (
                  <CardContent className="p-6 space-y-5 border-t border-zinc-800">
                    {/* Error Message */}
                    {result.error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-red-400 font-mono text-sm">{result.error}</p>
                      </div>
                    )}

                    {/* Info Message */}
                    {result.message && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                        <p className="text-amber-400 text-sm">{result.message}</p>
                      </div>
                    )}

                    {/* Analysis (for stagemove) */}
                    {result.analysis && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="text-blue-400 font-semibold mb-2">Analysis</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-zinc-500">Last Update:</span>
                            <span className="ml-2 text-white font-mono">{result.analysis.lastUpdate || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Outcome Date:</span>
                            <span className="ml-2 text-white font-mono">{result.analysis.outcomeDate || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Outcome:</span>
                            <span className={`ml-2 font-semibold ${
                              result.analysis.outcomeType === 'WON' ? 'text-emerald-400' :
                              result.analysis.outcomeType === 'LOST' ? 'text-red-400' : 'text-zinc-400'
                            }`}>
                              {result.analysis.outcomeType || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Summary (for products) */}
                    {result.summary && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                        <h4 className="text-purple-400 font-semibold mb-2">Summary</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {Object.entries(result.summary).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-zinc-500">{key}:</span>
                              <span className="ml-2 text-white font-mono">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stage Names (for stagemove) */}
                    {result.stageNames && Object.keys(result.stageNames).length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Stage Names Lookup</span>
                        </div>
                        <pre className="bg-[#0d0d12] border border-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto text-emerald-400">
{JSON.stringify(result.stageNames, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Products (enriched) */}
                    {result.productInterests && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">
                            Product Interests (Enriched with Product Details)
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-zinc-500 hover:text-white"
                            onClick={() => copyToClipboard(JSON.stringify(result.productInterests, null, 2), `${test.id}-pi`)}
                          >
                            {copied === `${test.id}-pi` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                        <pre className="bg-[#0d0d12] border border-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto max-h-80 text-cyan-400">
{JSON.stringify(result.productInterests, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Main Data with JSON/XML tabs */}
                    {(result.data || result.requestXml || result.responseXml) && (
                      <Tabs defaultValue="json" className="w-full">
                        <TabsList className="bg-zinc-800 border-zinc-700">
                          <TabsTrigger value="json" className="data-[state=active]:bg-zinc-700">
                            Parsed JSON
                          </TabsTrigger>
                          <TabsTrigger value="request" className="data-[state=active]:bg-zinc-700">
                            Request XML
                          </TabsTrigger>
                          <TabsTrigger value="response" className="data-[state=active]:bg-zinc-700">
                            Response XML
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="json" className="mt-4">
                          {result.data && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">
                                  Response Data ({Array.isArray(result.data) ? result.data.length : 1} records)
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-zinc-500 hover:text-white"
                                  onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2), `${test.id}-data`)}
                                >
                                  {copied === `${test.id}-data` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <pre className="bg-[#0d0d12] border border-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto max-h-96 text-amber-300">
{JSON.stringify(result.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="request" className="mt-4">
                          {result.requestXml && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">
                                  Request XML
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-zinc-500 hover:text-white"
                                  onClick={() => copyToClipboard(result.requestXml!, `${test.id}-reqxml`)}
                                >
                                  {copied === `${test.id}-reqxml` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <pre className="bg-[#0d0d12] border border-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto max-h-96 text-green-400 whitespace-pre-wrap">
{result.requestXml}
                              </pre>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="response" className="mt-4">
                          {result.responseXml && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">
                                  Response XML ({result.responseXml.length} chars)
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-zinc-500 hover:text-white"
                                  onClick={() => copyToClipboard(result.responseXml!, `${test.id}-resxml`)}
                                >
                                  {copied === `${test.id}-resxml` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <pre className="bg-[#0d0d12] border border-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto max-h-96 text-cyan-400 whitespace-pre-wrap">
{result.responseXml}
                              </pre>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
