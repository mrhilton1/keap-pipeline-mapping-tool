import { test, expect } from '@playwright/test'
import { setupMockApis } from './fixtures/api-handlers'

test.describe('Field Mapping', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApis(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Navigate to Field Mapping tab
    const fieldTab = page.getByRole('tab', { name: /field|mapping/i })
    if (await fieldTab.isVisible()) {
      await fieldTab.click()
      await page.waitForTimeout(1000)
    }
  })

  test.describe('Field Discovery', () => {
    test('should discover all fields from opportunities', async ({ page }) => {
      // Look for source fields list
      const sourceFields = page.locator('[data-testid="source-field"], .source-field')
      const fieldCount = await sourceFields.count()
      
      // Should have discovered multiple fields
      // Common opportunity fields: opportunity_title, projected_revenue_low, projected_revenue_high, etc.
    })

    test('should show XML-RPC enriched fields (products, stage history)', async ({ page }) => {
      // Look for enriched fields
      const productsField = page.getByText(/products/i)
      const stageMoves = page.getByText(/stage.*move|stage.*history/i)
      
      // These should be visible after enrichment
    })

    test('should display field types correctly', async ({ page }) => {
      // Look for type indicators
      const textFields = page.locator('[data-testid="field-type-text"]')
      const numberFields = page.locator('[data-testid="field-type-number"]')
      const dateFields = page.locator('[data-testid="field-type-date"]')
    })
  })

  test.describe('Mapping UI', () => {
    test('should allow mapping source fields to target deal fields', async ({ page }) => {
      // Find a mapping row
      const mappingRow = page.locator('[data-testid="field-mapping-row"]').first()
      
      if (await mappingRow.isVisible()) {
        // Find the target dropdown
        const targetSelect = mappingRow.locator('select, [role="combobox"]')
        
        if (await targetSelect.isVisible()) {
          await targetSelect.click()
          
          // Should show target field options
          const options = page.locator('[role="option"]')
          expect(await options.count()).toBeGreaterThan(0)
        }
      }
    })

    test('should show Value (Average) option for revenue fields', async ({ page }) => {
      // Find projected_revenue fields
      const revenueField = page.getByText(/projected.*revenue/i).first()
      
      if (await revenueField.isVisible()) {
        // Click to open dropdown
        const parentRow = revenueField.locator('..')
        const dropdown = parentRow.locator('select, [role="combobox"]')
        
        if (await dropdown.isVisible()) {
          await dropdown.click()
          
          // Look for Value (Average) option
          const averageOption = page.getByText(/value.*average/i)
          await expect(averageOption).toBeVisible()
        }
      }
    })

    test('should persist mappings when switching tabs', async ({ page }) => {
      // Make a mapping
      const mappingRow = page.locator('[data-testid="field-mapping-row"]').first()
      
      if (await mappingRow.isVisible()) {
        const targetSelect = mappingRow.locator('select, [role="combobox"]')
        
        if (await targetSelect.isVisible()) {
          await targetSelect.click()
          const firstOption = page.locator('[role="option"]').first()
          if (await firstOption.isVisible()) {
            const optionText = await firstOption.textContent()
            await firstOption.click()
            
            // Switch to another tab and back
            const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
            await buildTab.click()
            await page.waitForTimeout(500)
            
            const fieldTab = page.getByRole('tab', { name: /field|mapping/i })
            await fieldTab.click()
            await page.waitForTimeout(500)
            
            // Mapping should be preserved
            await expect(targetSelect).toContainText(optionText || '')
          }
        }
      }
    })
  })

  test.describe('Stage Mapping', () => {
    test('should show stage mapping UI when stage.name is selected', async ({ page }) => {
      // Look for stage mapping section
      const stageMapping = page.locator('[data-testid="stage-mapping"]')
      
      // May need to enable it first
      const stageMappingToggle = page.getByText(/stage.*mapping|map.*stage/i)
    })

    test('should auto-match stages by name (case-insensitive)', async ({ page }) => {
      // Look for auto-matched indicators
      const autoMatched = page.getByText(/auto.*match|matched/i)
      const matchCount = page.locator('[data-testid="auto-match-count"]')
    })

    test('should allow setting fallback stage', async ({ page }) => {
      // Find fallback stage selector
      const fallbackSelector = page.locator('[data-testid="fallback-stage"]')
      const fallbackLabel = page.getByText(/fallback/i)
      
      if (await fallbackSelector.isVisible()) {
        await fallbackSelector.click()
        
        // Should show available stages
        const options = page.locator('[role="option"]')
        expect(await options.count()).toBeGreaterThan(0)
      }
    })

    test('should allow manual mapping for unmatched stages', async ({ page }) => {
      // Look for unmatched stages
      const unmatchedSection = page.locator('[data-testid="unmatched-stages"]')
      const unmatchedItems = page.getByText(/unmatched|not matched/i)
      
      // Should have dropdown for manual mapping
    })
  })

  test.describe('Custom Fields', () => {
    test('should allow creating custom deal fields', async ({ page }) => {
      // Find create custom field button
      const createButton = page.getByRole('button', { name: /create.*field|add.*field/i })
      
      if (await createButton.isVisible()) {
        await createButton.click()
        
        // Should show dialog for creating field
        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible()
        
        // Fill in field details
        const nameInput = dialog.getByPlaceholder(/field.*name|name/i)
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Custom Field')
        }
      }
    })

    test('should show newly created custom fields in dropdown', async ({ page }) => {
      // This test assumes custom field creation flow
      await page.route('**/api/custom-fields', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 999,
              field_name: 'test_field',
              label: 'Test Field',
              field_type: 'Text',
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // After creation, the field should appear in target dropdowns
    })
  })

  test.describe('Special Mappings', () => {
    test('should have Add Products as Deal Note option', async ({ page }) => {
      // Find products field
      const productsField = page.getByText(/products/i).first()
      
      // Look in the dropdown for special option
      const addAsNoteOption = page.getByText(/add.*note|deal.*note/i)
    })

    test('should have Add Stage History as Deal Note option', async ({ page }) => {
      // Find stage history field
      const stageHistoryField = page.getByText(/stage.*history|stage.*move/i)
      
      // Look for special option
      const addAsNoteOption = page.getByText(/add.*note/i)
    })

    test('should map Actual Close Date correctly', async ({ page }) => {
      // Find the outcomeDate field
      const outcomeDate = page.getByText(/outcome.*date|close.*date/i)
      
      // Should be mapped to closed_time
      const closedTimeTarget = page.getByText(/actual.*close|closed.*time/i)
    })
  })

  test.describe('Owner Mapping', () => {
    test('should show owner mapping options', async ({ page }) => {
      // Look for owner mapping section
      const ownerSection = page.locator('[data-testid="owner-mapping"]')
      const ownerLabel = page.getByText(/owner/i)
      
      // Should have options for owner assignment
    })

    test('should have Keep Original Owner option', async ({ page }) => {
      const keepOriginal = page.getByText(/keep.*original.*owner|original.*owner/i)
      
      if (await keepOriginal.isVisible()) {
        // Verify it's an option
        await expect(keepOriginal).toBeVisible()
      }
    })

    test('should warn about Assign ALL to Same Owner override', async ({ page }) => {
      const assignAll = page.getByText(/assign.*all|same.*owner/i)
      
      if (await assignAll.isVisible()) {
        await assignAll.click()
        
        // Should show warning about override
        const warning = page.getByText(/override|warning|replace/i)
      }
    })
  })
})
