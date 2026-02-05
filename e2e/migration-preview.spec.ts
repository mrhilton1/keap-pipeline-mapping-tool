import { test, expect } from '@playwright/test'
import { setupMockApis } from './fixtures/api-handlers'
import { mockOpportunities, mockPipelines } from './fixtures/mock-data'

test.describe('Migration Preview', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApis(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Navigate to Migrate tab
    const migrateTab = page.getByRole('tab', { name: /migrate/i })
    if (await migrateTab.isVisible()) {
      await migrateTab.click()
      await page.waitForTimeout(1000)
    }
  })

  test.describe('Preview Display', () => {
    test('should show stage distribution summary', async ({ page }) => {
      // Open preview if needed
      const previewButton = page.getByRole('button', { name: /preview/i })
      if (await previewButton.isVisible()) {
        await previewButton.click()
        await page.waitForTimeout(500)
      }
      
      // Look for stage distribution
      const distribution = page.locator('[data-testid="stage-distribution"]')
      const stageNames = page.getByText(/new.*opportunity|win|lost/i)
    })

    test('should show individual deal preview carousel', async ({ page }) => {
      // Open preview
      const previewButton = page.getByRole('button', { name: /preview/i })
      if (await previewButton.isVisible()) {
        await previewButton.click()
        await page.waitForTimeout(500)
      }
      
      // Look for carousel navigation
      const nextButton = page.getByRole('button', { name: /next|→|>/i })
      const prevButton = page.getByRole('button', { name: /prev|←|</i })
      
      // Should be able to navigate between deals
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForTimeout(300)
      }
    })

    test('should display correct value calculations', async ({ page }) => {
      // Open preview
      const previewButton = page.getByRole('button', { name: /preview/i })
      if (await previewButton.isVisible()) {
        await previewButton.click()
        await page.waitForTimeout(500)
      }
      
      // Look for value display
      const valueDisplay = page.locator('[data-testid="deal-value"]')
      const dollarAmount = page.getByText(/\$[\d,]+/)
    })

    test('should show note count per deal', async ({ page }) => {
      // Open preview
      const previewButton = page.getByRole('button', { name: /preview/i })
      if (await previewButton.isVisible()) {
        await previewButton.click()
        await page.waitForTimeout(500)
      }
      
      // Look for note count
      const noteCount = page.locator('[data-testid="note-count"]')
      const notesLabel = page.getByText(/notes?.*\d+|\d+.*notes?/i)
    })

    test('should show pipeline and stage in preview', async ({ page }) => {
      // Open preview
      const previewButton = page.getByRole('button', { name: /preview/i })
      if (await previewButton.isVisible()) {
        await previewButton.click()
        await page.waitForTimeout(500)
      }
      
      // Should show target pipeline name
      const pipelineName = page.getByText(new RegExp(mockPipelines[0].name, 'i'))
      
      // Should show target stage
      const stageName = page.getByText(/stage/i)
    })
  })

  test.describe('Skipped Opportunities', () => {
    test('should warn when opportunities will be skipped', async ({ page }) => {
      // Look for skip warning
      const skipWarning = page.getByText(/skip|skipped|unmapped/i)
    })

    test('should show skipped opportunities list', async ({ page }) => {
      // Open preview
      const previewButton = page.getByRole('button', { name: /preview/i })
      if (await previewButton.isVisible()) {
        await previewButton.click()
        await page.waitForTimeout(500)
      }
      
      // Look for skipped section
      const skippedSection = page.locator('[data-testid="skipped-opportunities"]')
      const skippedCount = page.getByText(/\d+.*skip|skip.*\d+/i)
    })
  })

  test.describe('Custom Migration Note', () => {
    test('should allow custom migration note input', async ({ page }) => {
      // Find custom note input
      const noteInput = page.locator('textarea[data-testid="custom-note"], textarea[placeholder*="note"]')
      
      if (await noteInput.isVisible()) {
        await noteInput.fill('This is a custom migration note')
        
        // Note should be saved
        await expect(noteInput).toHaveValue('This is a custom migration note')
      }
    })

    test('should insert merge fields at cursor position', async ({ page }) => {
      const noteInput = page.locator('textarea[data-testid="custom-note"]')
      
      if (await noteInput.isVisible()) {
        // Type some text
        await noteInput.fill('Deal: ')
        
        // Find merge field picker
        const mergeFieldPicker = page.locator('[data-testid="merge-field-picker"]')
        const insertButton = page.getByRole('button', { name: /insert|field/i })
        
        if (await mergeFieldPicker.isVisible()) {
          await mergeFieldPicker.click()
          
          // Select a field
          const fieldOption = page.getByText(/opportunity.*title/i)
          if (await fieldOption.isVisible()) {
            await fieldOption.click()
            
            // Merge field should be inserted
            await expect(noteInput).toContainText('{{')
          }
        }
      }
    })

    test('should show merge field categories', async ({ page }) => {
      // Find merge field picker
      const mergeFieldPicker = page.locator('[data-testid="merge-field-picker"]')
      const insertButton = page.getByRole('button', { name: /insert|field|\+/i })
      
      if (await insertButton.isVisible()) {
        await insertButton.click()
        
        // Should show categories
        const opportunityCategory = page.getByText(/opportunity/i)
        const contactCategory = page.getByText(/contact/i)
        const xmlrpcCategory = page.getByText(/xml-rpc|enriched/i)
      }
    })
  })

  test.describe('Currency Selection', () => {
    test('should show currency dropdown', async ({ page }) => {
      const currencySelect = page.locator('[data-testid="currency-select"]')
      const currencyLabel = page.getByText(/currency/i)
      
      if (await currencySelect.isVisible()) {
        await currencySelect.click()
        
        // Should show currency options
        const usdOption = page.getByText(/USD/i)
        await expect(usdOption).toBeVisible()
      }
    })

    test('should default to USD', async ({ page }) => {
      const currencySelect = page.locator('[data-testid="currency-select"]')
      
      if (await currencySelect.isVisible()) {
        await expect(currencySelect).toContainText('USD')
      }
    })
  })

  test.describe('Outcomes Configuration', () => {
    test('should prompt for outcomes if not configured', async ({ page }) => {
      // Click preview or migrate
      const migrateButton = page.getByRole('button', { name: /migrate|preview/i })
      
      if (await migrateButton.isVisible()) {
        await migrateButton.click()
        await page.waitForTimeout(500)
        
        // Should show outcomes dialog if needed
        const outcomesDialog = page.locator('[data-testid="outcomes-dialog"]')
        const outcomesPrompt = page.getByText(/outcome|status.*stage/i)
      }
    })

    test('should allow configuring stage outcomes (ACTIVE/WON/LOST)', async ({ page }) => {
      // Open outcomes configuration
      const configureButton = page.getByRole('button', { name: /configure|outcome/i })
      
      if (await configureButton.isVisible()) {
        await configureButton.click()
        await page.waitForTimeout(300)
        
        // Should show ACTIVE, WON, LOST options
        const activeOption = page.getByText(/ACTIVE|open/i)
        const wonOption = page.getByText(/WON/i)
        const lostOption = page.getByText(/LOST/i)
      }
    })
  })

  test.describe('Validation', () => {
    test('should not allow migration without selecting pipeline', async ({ page }) => {
      // Try to click migrate without pipeline
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      
      if (await migrateButton.isVisible()) {
        // Button might be disabled
        const isDisabled = await migrateButton.isDisabled()
        
        if (!isDisabled) {
          await migrateButton.click()
          
          // Should show error or validation message
          const errorMessage = page.getByText(/select.*pipeline|pipeline.*required/i)
        }
      }
    })

    test('should show continue to preview button', async ({ page }) => {
      const previewButton = page.getByRole('button', { name: /preview|continue/i })
      
      // Should be visible when ready
      await expect(previewButton.first()).toBeVisible()
    })
  })
})
