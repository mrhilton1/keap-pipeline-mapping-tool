"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Play, Copy, Check, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface TestResult {
  test: string
  tableName: string
  oppId?: string
  fields: string[]
  success: boolean
  httpStatus?: number
  fault?: string
  recordCount: number
  requestXml: string
  responseXml: string
  curlCommand: string
  error?: string
}

const TESTS = [
  { id: 'stages', name: 'Stage Table', description: 'Get all stages (ID → Name lookup)' },
  { id: 'products', name: 'Product Table', description: 'Get all products (ID → Name/Price lookup)' },
  { id: 'productinterest', name: 'ProductInterest', description: 'Get products for specific opportunity', needsOppId: true },
  { id: 'stagemove', name: 'StageMove', description: 'Get stage move history for opportunity', needsOppId: true },
]

export default function DebugPage() {
  const [oppId, setOppId] = useState("2")
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const runTest = async (testId: string) => {
    setLoading(testId)
    try {
      const url = testId.includes('opp') || testId === 'productinterest' || testId === 'stagemove'
        ? `/api/xmlrpc/debug?test=${testId}&oppId=${oppId}`
        : `/api/xmlrpc/debug?test=${testId}`
      
      const response = await fetch(url)
      const data = await response.json()
      setResults(prev => ({ ...prev, [testId]: data }))
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [testId]: { 
          test: testId, 
          tableName: '', 
          fields: [], 
          success: false, 
          recordCount: 0, 
          requestXml: '', 
          responseXml: '', 
          curlCommand: '',
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">XML-RPC Debug Console</h1>
              <p className="text-zinc-400">Step through individual API calls</p>
            </div>
          </div>
          <Button onClick={runAllTests} disabled={loading !== null}>
            <Play className="h-4 w-4 mr-2" />
            Run All Tests
          </Button>
        </div>

        {/* Opportunity ID input */}
        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="oppId" className="text-zinc-300 whitespace-nowrap">
                Test Opportunity ID:
              </Label>
              <Input
                id="oppId"
                value={oppId}
                onChange={(e) => setOppId(e.target.value)}
                className="w-32 bg-zinc-800 border-zinc-700"
                placeholder="2"
              />
              <span className="text-xs text-zinc-500">
                Used for ProductInterest and StageMove tests
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Test Cards */}
        <div className="space-y-4">
          {TESTS.map((test) => {
            const result = results[test.id]
            const isLoading = loading === test.id

            return (
              <Card key={test.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{test.name}</CardTitle>
                      {test.needsOppId && (
                        <Badge variant="outline" className="text-xs">
                          Opp #{oppId}
                        </Badge>
                      )}
                      {result && (
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {result.success ? `✓ ${result.recordCount} records` : `✗ Failed`}
                        </Badge>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => runTest(test.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <>
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Run
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-zinc-400">{test.description}</p>
                </CardHeader>

                {result && (
                  <CardContent className="pt-0 space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-zinc-500">Table:</span>
                        <span className="ml-2 font-mono">{result.tableName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">HTTP:</span>
                        <span className={`ml-2 font-mono ${result.httpStatus === 200 ? 'text-green-400' : 'text-red-400'}`}>
                          {result.httpStatus}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Records:</span>
                        <span className="ml-2 font-mono">{result.recordCount}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Fields:</span>
                        <span className="ml-2 font-mono text-xs">{result.fields.join(', ')}</span>
                      </div>
                    </div>

                    {/* Error/Fault */}
                    {(result.fault || result.error) && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-red-400 text-sm font-mono">
                        {result.fault || result.error}
                      </div>
                    )}

                    {/* Request XML */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500 uppercase">Request XML</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(result.requestXml, `${test.id}-req`)}
                        >
                          {copied === `${test.id}-req` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs font-mono overflow-x-auto max-h-32 text-zinc-300">
                        {result.requestXml}
                      </pre>
                    </div>

                    {/* Response XML */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500 uppercase">
                          Response XML ({result.responseXml?.length || 0} chars)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(result.responseXml, `${test.id}-res`)}
                        >
                          {copied === `${test.id}-res` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs font-mono overflow-x-auto max-h-48 text-zinc-300">
                        {result.responseXml?.substring(0, 3000) || 'No response'}
                        {result.responseXml?.length > 3000 && '\n... truncated'}
                      </pre>
                    </div>

                    {/* cURL command */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500 uppercase">cURL Command</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(result.curlCommand, `${test.id}-curl`)}
                        >
                          {copied === `${test.id}-curl` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs font-mono overflow-x-auto max-h-24 text-green-400">
                        {result.curlCommand}
                      </pre>
                    </div>
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
