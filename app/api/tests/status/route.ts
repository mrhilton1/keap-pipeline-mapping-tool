import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Check if Playwright is installed
    const { stdout: playwrightVersion } = await execAsync('pnpm exec playwright --version').catch(() => ({ stdout: '' }))
    
    // Check if browsers are installed
    let browsersInstalled = false
    try {
      await execAsync('pnpm exec playwright install --dry-run chromium')
      browsersInstalled = true
    } catch {
      browsersInstalled = false
    }

    // Count test files
    const { stdout: testFiles } = await execAsync('ls -1 e2e/*.spec.ts 2>/dev/null | wc -l').catch(() => ({ stdout: '0' }))
    
    return Response.json({
      playwrightInstalled: playwrightVersion.trim().length > 0,
      playwrightVersion: playwrightVersion.trim() || 'Not installed',
      browsersInstalled,
      testFileCount: parseInt(testFiles.trim()) || 0,
      ready: playwrightVersion.trim().length > 0 && browsersInstalled,
    })
  } catch (error) {
    return Response.json({
      playwrightInstalled: false,
      playwrightVersion: 'Error checking',
      browsersInstalled: false,
      testFileCount: 0,
      ready: false,
      error: String(error),
    })
  }
}
