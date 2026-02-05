'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Terminal,
  AlertTriangle,
  Download
} from 'lucide-react'

interface TestCase {
  title: string
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'running'
  duration?: number
  error?: string
}

interface TestSuite {
  file: string
  name: string
  description: string
  tests: TestCase[]
  status: 'idle' | 'running' | 'passed' | 'failed'
  expanded: boolean
  duration?: number
}

interface TestStatus {
  playwrightInstalled: boolean
  playwrightVersion: string
  browsersInstalled: boolean
  testFileCount: number
  ready: boolean
  error?: string
}

interface PlaywrightResult {
  suites?: Array<{
    title: string
    file: string
    specs: Array<{
      title: string
      ok: boolean
      tests: Array<{
        status: string
        duration: number
        errors?: Array<{ message: string }>
      }>
    }>
  }>
  stats?: {
    expected: number
    unexpected: number
    skipped: number
    duration: number
  }
}

export default function TestsPage() {
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [runningSuite, setRunningSuite] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [output, setOutput] = useState<string>('')
  const [status, setStatus] = useState<TestStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const outputRef = useRef<HTMLDivElement>(null)

  // Load test status and suites on mount
  useEffect(() => {
    loadStatus()
    loadSuites()
  }, [])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const loadStatus = async () => {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/tests/status')
      const data = await res.json()
      setStatus(data)
    } catch (error) {
      setStatus({
        playwrightInstalled: false,
        playwrightVersion: 'Error',
        browsersInstalled: false,
        testFileCount: 0,
        ready: false,
        error: String(error)
      })
    }
    setStatusLoading(false)
  }

  const loadSuites = async () => {
    try {
      const res = await fetch('/api/tests/run')
      const data = await res.json()
      setSuites(data.suites.map((s: { file: string; name: string; description: string }) => ({
        ...s,
        tests: [],
        status: 'idle',
        expanded: false,
      })))
    } catch {
      // Fallback to hardcoded suites
      setSuites([
        { file: 'auth.spec.ts', name: 'Authentication', description: 'OAuth flow, session persistence', tests: [], status: 'idle', expanded: false },
        { file: 'dashboard.spec.ts', name: 'Dashboard Loading', description: 'Data loading, badges', tests: [], status: 'idle', expanded: false },
        { file: 'pipeline-builder.spec.ts', name: 'Pipeline Builder', description: 'Create pipelines, stages', tests: [], status: 'idle', expanded: false },
        { file: 'field-mapping.spec.ts', name: 'Field Mapping', description: 'Map fields, stage matching', tests: [], status: 'idle', expanded: false },
        { file: 'migration-preview.spec.ts', name: 'Migration Preview', description: 'Preview, merge fields', tests: [], status: 'idle', expanded: false },
        { file: 'deal-migration.spec.ts', name: 'Deal Migration', description: 'Create deals, notes', tests: [], status: 'idle', expanded: false },
        { file: 'xmlrpc.spec.ts', name: 'XML-RPC Integration', description: 'Products, stage moves', tests: [], status: 'idle', expanded: false },
        { file: 'edge-cases.spec.ts', name: 'Edge Cases', description: 'Error handling', tests: [], status: 'idle', expanded: false },
      ])
    }
  }

  const getStatusIcon = (testStatus: string) => {
    switch (testStatus) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (suiteStatus: string) => {
    switch (suiteStatus) {
      case 'passed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Passed</Badge>
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Failed</Badge>
      case 'running':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Running</Badge>
      default:
        return <Badge variant="outline">Idle</Badge>
    }
  }

  const toggleSuite = (index: number) => {
    setSuites(prev => prev.map((s, i) => 
      i === index ? { ...s, expanded: !s.expanded } : s
    ))
  }

  const parseResults = (results: PlaywrightResult) => {
    const updatedSuites: Record<string, { tests: TestCase[], status: 'passed' | 'failed', duration: number }> = {}
    
    if (results.suites) {
      for (const suite of results.suites) {
        const fileName = suite.file.split('/').pop() || suite.file
        const tests: TestCase[] = []
        let suiteHasFailed = false
        let suiteDuration = 0
        
        for (const spec of suite.specs) {
          for (const test of spec.tests) {
            const testPassed = test.status === 'passed' || test.status === 'expected'
            if (!testPassed) suiteHasFailed = true
            suiteDuration += test.duration || 0
            
            tests.push({
              title: spec.title,
              status: testPassed ? 'passed' : 'failed',
              duration: test.duration,
              error: test.errors?.[0]?.message,
            })
          }
        }
        
        updatedSuites[fileName] = {
          tests,
          status: suiteHasFailed ? 'failed' : 'passed',
          duration: suiteDuration,
        }
      }
    }
    
    return updatedSuites
  }

  const runTests = async (suiteFile?: string) => {
    const isRunningSpecific = !!suiteFile
    
    if (isRunningSpecific) {
      setRunningSuite(suiteFile)
      setSuites(prev => prev.map(s => 
        s.file === suiteFile ? { ...s, status: 'running', tests: [] } : s
      ))
    } else {
      setIsRunningAll(true)
      setSuites(prev => prev.map(s => ({ ...s, status: 'running', tests: [] })))
    }
    
    setOutput(prev => prev + `\n🚀 Starting ${isRunningSpecific ? suiteFile : 'all tests'}...\n`)

    try {
      const response = await fetch('/api/tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite: suiteFile || 'all' }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(line => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            
            if (data.type === 'log') {
              setOutput(prev => prev + data.message + '\n')
            } else if (data.type === 'results') {
              const parsed = parseResults(data.data)
              
              setSuites(prev => prev.map(s => {
                const result = parsed[s.file]
                if (result) {
                  return {
                    ...s,
                    tests: result.tests,
                    status: result.status,
                    duration: result.duration,
                    expanded: true,
                  }
                }
                return { ...s, status: 'idle' }
              }))
              
              setOutput(prev => prev + `\n✅ Tests completed (exit code: ${data.exitCode})\n`)
            } else if (data.type === 'raw') {
              setOutput(prev => prev + `\n📄 Raw output:\n${data.output}\n`)
            } else if (data.type === 'error') {
              setOutput(prev => prev + `\n❌ Error: ${data.message}\n`)
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (error) {
      setOutput(prev => prev + `\n❌ Failed to run tests: ${error}\n`)
      setSuites(prev => prev.map(s => ({ ...s, status: 'idle' })))
    }

    setIsRunningAll(false)
    setRunningSuite(null)
    setLastRun(new Date())
  }

  const resetTests = () => {
    setSuites(prev => prev.map(s => ({ 
      ...s, 
      status: 'idle', 
      expanded: false,
      tests: [],
      duration: undefined,
    })))
    setOutput('')
    setLastRun(null)
  }

  const passedCount = suites.reduce((acc, s) => acc + s.tests.filter(t => t.status === 'passed').length, 0)
  const failedCount = suites.reduce((acc, s) => acc + s.tests.filter(t => t.status === 'failed').length, 0)
  const totalTests = suites.reduce((acc, s) => acc + s.tests.length, 0)
  const isRunning = isRunningAll || runningSuite !== null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              E2E Test Runner
            </h1>
            <p className="text-slate-400 mt-1">
              Keap Pipeline Mapping Tool - Playwright Tests
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={resetTests}
              disabled={isRunning}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={() => runTests()}
              disabled={isRunning || !status?.ready}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              {isRunningAll ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run All Tests
            </Button>
          </div>
        </div>

        {/* Status Alert */}
        {statusLoading ? (
          <Alert className="mb-6 bg-slate-800/50 border-slate-700">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertTitle>Checking Playwright status...</AlertTitle>
          </Alert>
        ) : !status?.ready ? (
          <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/30">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-400">Setup Required</AlertTitle>
            <AlertDescription className="text-yellow-300/80">
              <p className="mb-2">Playwright needs to be set up before running tests:</p>
              <code className="block bg-slate-900 p-2 rounded text-sm mb-2">
                pnpm exec playwright install chromium
              </code>
              <p className="text-xs">
                Playwright: {status?.playwrightVersion || 'Not detected'} | 
                Browsers: {status?.browsersInstalled ? 'Installed' : 'Not installed'} |
                Test files: {status?.testFileCount || 0}
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6 bg-green-500/10 border-green-500/30">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-400">Ready to Run</AlertTitle>
            <AlertDescription className="text-green-300/80">
              Playwright {status.playwrightVersion} | {status.testFileCount} test files | Browsers installed
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-white">{totalTests || '-'}</div>
              <div className="text-sm text-slate-400">Total Tests</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-400">{passedCount || '-'}</div>
              <div className="text-sm text-slate-400">Passed</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-400">{failedCount || '-'}</div>
              <div className="text-sm text-slate-400">Failed</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-300">
                {lastRun ? lastRun.toLocaleTimeString() : '--:--'}
              </div>
              <div className="text-sm text-slate-400">Last Run</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Test Suites */}
          <div className="col-span-2 space-y-4">
            {suites.map((suite, suiteIndex) => (
              <Card key={suite.file} className="bg-slate-800/50 border-slate-700 overflow-hidden">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => toggleSuite(suiteIndex)}
                >
                  <div className="flex items-center gap-3">
                    {suite.expanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    {getStatusIcon(suite.status)}
                    <div>
                      <div className="font-medium text-white">{suite.name}</div>
                      <div className="text-xs text-slate-500">
                        {suite.file}
                        {suite.duration && ` • ${Math.round(suite.duration)}ms`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {suite.tests.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {suite.tests.filter(t => t.status === 'passed').length}/{suite.tests.length}
                      </span>
                    )}
                    {getStatusBadge(suite.status)}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        runTests(suite.file)
                      }}
                      disabled={isRunning || !status?.ready}
                      className="text-slate-400 hover:text-white"
                    >
                      {runningSuite === suite.file ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {suite.expanded && suite.tests.length > 0 && (
                  <div className="border-t border-slate-700 bg-slate-900/50">
                    {suite.tests.map((test, testIndex) => (
                      <div 
                        key={testIndex}
                        className="flex items-center justify-between px-6 py-2 border-b border-slate-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(test.status)}
                          <span className="text-sm text-slate-300">{test.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {test.duration !== undefined && (
                            <span className="text-xs text-slate-500">{Math.round(test.duration)}ms</span>
                          )}
                          {test.error && (
                            <span className="text-xs text-red-400 max-w-[200px] truncate" title={test.error}>
                              {test.error.split('\n')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {suite.expanded && suite.tests.length === 0 && suite.status === 'idle' && (
                  <div className="border-t border-slate-700 bg-slate-900/50 p-4 text-center text-slate-500 text-sm">
                    Click play to run this test suite
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Output Panel */}
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                  <Terminal className="h-4 w-4" />
                  Output
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={outputRef}
                  className="bg-slate-900 rounded-lg p-3 h-[300px] overflow-auto font-mono text-xs text-slate-400 whitespace-pre-wrap"
                >
                  {output || 'Click "Run All Tests" or run individual suites to see output...'}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => window.open('/dashboard', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => window.open('/debug', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Debug Page
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => window.open('/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Home Page
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={loadStatus}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Terminal Commands</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="bg-slate-900 p-2 rounded">
                  <code className="text-blue-300">pnpm test:ui</code>
                  <span className="text-slate-500 ml-2">Interactive UI</span>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <code className="text-blue-300">pnpm test:headed</code>
                  <span className="text-slate-500 ml-2">Watch browser</span>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <code className="text-blue-300">pnpm test:debug</code>
                  <span className="text-slate-500 ml-2">Debug mode</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
