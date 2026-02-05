'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Terminal
} from 'lucide-react'

interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'running'
  duration?: number
  error?: string
}

interface TestSuite {
  name: string
  file: string
  tests: TestResult[]
  status: 'idle' | 'running' | 'passed' | 'failed'
  expanded: boolean
}

const TEST_SUITES: Omit<TestSuite, 'status' | 'expanded'>[] = [
  {
    name: 'Authentication',
    file: 'auth.spec.ts',
    tests: [
      { name: 'should show Connect to Keap button when not authenticated', status: 'pending' },
      { name: 'should show disconnected status indicator', status: 'pending' },
      { name: 'should show green status indicator after successful auth', status: 'pending' },
      { name: 'should persist auth across page refreshes', status: 'pending' },
      { name: 'should handle token refresh gracefully', status: 'pending' },
    ]
  },
  {
    name: 'Dashboard Loading',
    file: 'dashboard.spec.ts',
    tests: [
      { name: 'should load opportunities from Keap API', status: 'pending' },
      { name: 'should display opportunity count in header badge', status: 'pending' },
      { name: 'should load pipelines from Keap API', status: 'pending' },
      { name: 'should enrich opportunities with XML-RPC data', status: 'pending' },
      { name: 'should show error state when API fails', status: 'pending' },
    ]
  },
  {
    name: 'Pipeline Builder',
    file: 'pipeline-builder.spec.ts',
    tests: [
      { name: 'should show choice between Build New and Use Existing', status: 'pending' },
      { name: 'should auto-populate stages from opportunity data', status: 'pending' },
      { name: 'should allow drag-and-drop reordering', status: 'pending' },
      { name: 'should create pipeline in Keap when clicking Create', status: 'pending' },
      { name: 'should navigate to Field Mapping after creation', status: 'pending' },
    ]
  },
  {
    name: 'Field Mapping',
    file: 'field-mapping.spec.ts',
    tests: [
      { name: 'should discover all fields from opportunities', status: 'pending' },
      { name: 'should show XML-RPC enriched fields', status: 'pending' },
      { name: 'should allow mapping source to target fields', status: 'pending' },
      { name: 'should show Value (Average) option', status: 'pending' },
      { name: 'should auto-match stages by name', status: 'pending' },
    ]
  },
  {
    name: 'Migration Preview',
    file: 'migration-preview.spec.ts',
    tests: [
      { name: 'should show stage distribution summary', status: 'pending' },
      { name: 'should display correct value calculations', status: 'pending' },
      { name: 'should allow custom migration note', status: 'pending' },
      { name: 'should insert merge fields at cursor', status: 'pending' },
      { name: 'should show currency dropdown', status: 'pending' },
    ]
  },
  {
    name: 'Deal Migration',
    file: 'deal-migration.spec.ts',
    tests: [
      { name: 'should create deals with correct stage', status: 'pending' },
      { name: 'should set deal value from revenue mapping', status: 'pending' },
      { name: 'should preserve contact and owner', status: 'pending' },
      { name: 'should create notes in correct order', status: 'pending' },
      { name: 'should show success/failure counts', status: 'pending' },
    ]
  },
  {
    name: 'XML-RPC Integration',
    file: 'xmlrpc.spec.ts',
    tests: [
      { name: 'should fetch products for opportunities', status: 'pending' },
      { name: 'should handle subscription products', status: 'pending' },
      { name: 'should fetch stage move history', status: 'pending' },
      { name: 'should parse XML-RPC dates correctly', status: 'pending' },
      { name: 'should have debug page accessible', status: 'pending' },
    ]
  },
  {
    name: 'Edge Cases',
    file: 'edge-cases.spec.ts',
    tests: [
      { name: 'should handle opportunities with no stage', status: 'pending' },
      { name: 'should handle API timeouts gracefully', status: 'pending' },
      { name: 'should handle 401 and prompt re-auth', status: 'pending' },
      { name: 'should handle special characters', status: 'pending' },
      { name: 'should handle rapid tab switching', status: 'pending' },
    ]
  },
]

export default function TestsPage() {
  const [suites, setSuites] = useState<TestSuite[]>(
    TEST_SUITES.map(s => ({ ...s, status: 'idle', expanded: false }))
  )
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [output, setOutput] = useState<string>('')

  const getStatusIcon = (status: string) => {
    switch (status) {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const simulateTestRun = async (suiteIndex: number) => {
    // Update suite to running
    setSuites(prev => prev.map((s, i) => 
      i === suiteIndex ? { ...s, status: 'running', expanded: true } : s
    ))

    // Simulate each test
    const suite = suites[suiteIndex]
    for (let testIndex = 0; testIndex < suite.tests.length; testIndex++) {
      // Set test to running
      setSuites(prev => prev.map((s, i) => {
        if (i === suiteIndex) {
          const newTests = [...s.tests]
          newTests[testIndex] = { ...newTests[testIndex], status: 'running' }
          return { ...s, tests: newTests }
        }
        return s
      }))

      // Wait random time
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000))

      // Random pass/fail (90% pass rate for demo)
      const passed = Math.random() > 0.1
      setSuites(prev => prev.map((s, i) => {
        if (i === suiteIndex) {
          const newTests = [...s.tests]
          newTests[testIndex] = { 
            ...newTests[testIndex], 
            status: passed ? 'passed' : 'failed',
            duration: Math.floor(500 + Math.random() * 2000),
            error: passed ? undefined : 'Expected element to be visible'
          }
          return { ...s, tests: newTests }
        }
        return s
      }))
    }

    // Update suite status
    setSuites(prev => prev.map((s, i) => {
      if (i === suiteIndex) {
        const allPassed = s.tests.every(t => t.status === 'passed')
        return { ...s, status: allPassed ? 'passed' : 'failed' }
      }
      return s
    }))
  }

  const runSuite = async (index: number) => {
    setOutput(`Running ${suites[index].name} tests...\n`)
    await simulateTestRun(index)
    setLastRun(new Date())
  }

  const runAllTests = async () => {
    setIsRunningAll(true)
    setOutput('Running all test suites...\n\n')
    
    // Reset all suites
    setSuites(prev => prev.map(s => ({
      ...s,
      status: 'idle',
      tests: s.tests.map(t => ({ ...t, status: 'pending' as const }))
    })))

    for (let i = 0; i < suites.length; i++) {
      setOutput(prev => prev + `\n📦 ${TEST_SUITES[i].name}\n`)
      await simulateTestRun(i)
    }

    setIsRunningAll(false)
    setLastRun(new Date())
    setOutput(prev => prev + '\n✅ All tests completed!')
  }

  const resetTests = () => {
    setSuites(TEST_SUITES.map(s => ({ 
      ...s, 
      status: 'idle', 
      expanded: false,
      tests: s.tests.map(t => ({ ...t, status: 'pending' as const, duration: undefined, error: undefined }))
    })))
    setOutput('')
    setLastRun(null)
  }

  const passedCount = suites.reduce((acc, s) => acc + s.tests.filter(t => t.status === 'passed').length, 0)
  const failedCount = suites.reduce((acc, s) => acc + s.tests.filter(t => t.status === 'failed').length, 0)
  const totalTests = suites.reduce((acc, s) => acc + s.tests.length, 0)

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
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={runAllTests}
              disabled={isRunningAll}
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-white">{totalTests}</div>
              <div className="text-sm text-slate-400">Total Tests</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-400">{passedCount}</div>
              <div className="text-sm text-slate-400">Passed</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-400">{failedCount}</div>
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
                      <div className="text-xs text-slate-500">{suite.file}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(suite.status)}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        runSuite(suiteIndex)
                      }}
                      disabled={suite.status === 'running' || isRunningAll}
                      className="text-slate-400 hover:text-white"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {suite.expanded && (
                  <div className="border-t border-slate-700 bg-slate-900/50">
                    {suite.tests.map((test, testIndex) => (
                      <div 
                        key={testIndex}
                        className="flex items-center justify-between px-6 py-2 border-b border-slate-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(test.status)}
                          <span className="text-sm text-slate-300">{test.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {test.duration && (
                            <span className="text-xs text-slate-500">{test.duration}ms</span>
                          )}
                          {test.error && (
                            <span className="text-xs text-red-400 max-w-[200px] truncate">
                              {test.error}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
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
                <div className="bg-slate-900 rounded-lg p-3 h-[300px] overflow-auto font-mono text-xs text-slate-400">
                  {output || 'Click "Run All Tests" or run individual suites...'}
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
              </CardContent>
            </Card>

            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="text-sm text-blue-300">
                  <strong>Note:</strong> This is a simulated test runner UI. 
                  For actual test execution, run:
                </div>
                <code className="block mt-2 bg-slate-900 p-2 rounded text-xs text-blue-200">
                  pnpm test:ui
                </code>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
