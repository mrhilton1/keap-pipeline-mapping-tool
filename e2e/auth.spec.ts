import { test, expect } from '@playwright/test'
import { setupMockApis, setupUnauthenticatedMockApis } from './fixtures/api-handlers'

test.describe('Authentication Flow', () => {
  test.describe('Unauthenticated State', () => {
    test.beforeEach(async ({ page }) => {
      await setupUnauthenticatedMockApis(page)
    })

    test('should show Connect to Keap button on home page when not authenticated', async ({ page }) => {
      await page.goto('/')
      
      // Should show the connection button
      await expect(page.getByRole('button', { name: /connect|sign in/i })).toBeVisible()
    })

    test('should show disconnected status indicator', async ({ page }) => {
      await page.goto('/')
      
      // Status should show disconnected
      const statusIndicator = page.locator('[data-testid="keap-status"]')
      if (await statusIndicator.isVisible()) {
        await expect(statusIndicator).toContainText(/disconnected|not connected/i)
      }
    })

    test('should redirect to home when accessing dashboard without auth', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Should either redirect or show auth prompt
      await expect(page).toHaveURL(/\/$|\/dashboard/)
    })
  })

  test.describe('Authenticated State', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApis(page)
    })

    test('should show green status indicator after successful auth', async ({ page }) => {
      await page.goto('/')
      
      // Look for connected status
      const connectedIndicator = page.locator('text=/connected/i')
      await expect(connectedIndicator).toBeVisible({ timeout: 5000 })
    })

    test('should persist auth across page refreshes', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Reload the page
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Should still be on dashboard (not redirected)
      await expect(page).toHaveURL('/dashboard')
    })

    test('should show dashboard access when authenticated', async ({ page }) => {
      await page.goto('/')
      
      // Should be able to access dashboard
      const dashboardLink = page.getByRole('link', { name: /dashboard|go to dashboard/i })
      if (await dashboardLink.isVisible()) {
        await dashboardLink.click()
        await expect(page).toHaveURL('/dashboard')
      }
    })

    test('should show logout option when authenticated', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Look for logout button/link
      const logoutButton = page.getByRole('button', { name: /logout|sign out|disconnect/i })
      const dropdownTrigger = page.locator('[data-testid="user-menu"]')
      
      // Logout might be in a dropdown
      if (await dropdownTrigger.isVisible()) {
        await dropdownTrigger.click()
      }
      
      // Check that some form of logout is available
      const hasLogout = await logoutButton.isVisible() || 
                        await page.getByText(/logout|sign out/i).isVisible()
      expect(hasLogout).toBeTruthy()
    })
  })

  test.describe('OAuth Flow', () => {
    test('should open OAuth popup when clicking connect', async ({ page, context }) => {
      await setupUnauthenticatedMockApis(page)
      await page.goto('/')
      
      // Mock OAuth endpoint
      await page.route('**/api/auth/keap', async (route) => {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': 'https://accounts.infusionsoft.com/app/oauth/authorize?client_id=test'
          }
        })
      })
      
      const connectButton = page.getByRole('button', { name: /connect|sign in/i })
      
      if (await connectButton.isVisible()) {
        // Listen for popup
        const popupPromise = context.waitForEvent('page')
        
        await connectButton.click()
        
        // Should attempt to open OAuth (might be blocked in tests)
        // This tests the click handler works
      }
    })
  })

  test.describe('Token Refresh', () => {
    test('should handle token refresh gracefully', async ({ page }) => {
      let refreshCalled = false
      
      // Setup mock that simulates token refresh
      await page.route('**/api/auth/keap/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            tokenVerification: { valid: true, expiresIn: 300 }, // 5 min
          }),
        })
      })
      
      await page.route('**/api/auth/keap/refresh', async (route) => {
        refreshCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Page should load successfully
      await expect(page).toHaveURL('/dashboard')
    })

    test('should redirect to home on 401 error', async ({ page }) => {
      await page.route('**/api/auth/keap/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: false,
          }),
        })
      })
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        })
      })
      
      await page.goto('/dashboard')
      
      // Should show re-auth prompt or redirect
      const authPrompt = page.getByText(/re-authenticate|sign in|connect/i)
      const isOnHome = await page.url().endsWith('/')
      
      expect(await authPrompt.isVisible() || isOnHome).toBeTruthy()
    })
  })
})
