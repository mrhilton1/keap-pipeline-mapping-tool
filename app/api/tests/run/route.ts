import { NextRequest } from 'next/server'
import { spawn } from 'child_process'

export const maxDuration = 300 // 5 minutes max for tests

export async function POST(request: NextRequest) {
  const { suite } = await request.json()
  
  // Build the playwright command
  const args = ['exec', 'playwright', 'test', '--reporter=json']
  
  if (suite && suite !== 'all') {
    args.push(`e2e/${suite}`)
  }

  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      let jsonOutput = ''
      let hasError = false
      
      const proc = spawn('pnpm', args, {
        cwd: process.cwd(),
        env: { ...process.env, CI: 'true' },
      })

      proc.stdout.on('data', (data) => {
        jsonOutput += data.toString()
      })

      proc.stderr.on('data', (data) => {
        const message = data.toString()
        // Send progress updates
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message })}\n\n`))
      })

      proc.on('error', (error) => {
        hasError = true
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`))
        controller.close()
      })

      proc.on('close', (code) => {
        try {
          // Try to parse JSON output
          const results = JSON.parse(jsonOutput)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'results', data: results, exitCode: code })}\n\n`))
        } catch {
          // If JSON parsing fails, send raw output
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'raw', output: jsonOutput, exitCode: code })}\n\n`))
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', exitCode: code })}\n\n`))
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export async function GET() {
  // Return available test suites
  const suites = [
    { file: 'auth.spec.ts', name: 'Authentication', description: 'OAuth flow, session persistence' },
    { file: 'dashboard.spec.ts', name: 'Dashboard Loading', description: 'Data loading, badges, navigation' },
    { file: 'pipeline-builder.spec.ts', name: 'Pipeline Builder', description: 'Create pipelines, stages, DnD' },
    { file: 'field-mapping.spec.ts', name: 'Field Mapping', description: 'Map fields, stage matching' },
    { file: 'migration-preview.spec.ts', name: 'Migration Preview', description: 'Preview, merge fields' },
    { file: 'deal-migration.spec.ts', name: 'Deal Migration', description: 'Create deals, notes' },
    { file: 'xmlrpc.spec.ts', name: 'XML-RPC Integration', description: 'Products, stage moves' },
    { file: 'edge-cases.spec.ts', name: 'Edge Cases', description: 'Error handling, edge cases' },
  ]
  
  return Response.json({ suites })
}
