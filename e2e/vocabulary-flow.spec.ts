import { test, expect } from '@playwright/test';

test.describe('Browser Integration: Vocabulary Flow', () => {
  test('navigates to /vocabulary -> renders summary & words -> inspects & changes word status via popover', async ({ page }) => {
    let capturedWord = '';
    let capturedStatus = '';

    await page.route('**/ws', async (route) => {
      const postData = route.request().postData() || '';

      if (postData.includes('getMyProfileRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:getMyProfileResponse>
                  <read:email>testuser@example.com</read:email>
                  <read:name>Test User</read:name>
                </read:getMyProfileResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('listUserVocabularyRequest')) {
        if (postData.includes('<read:search>ephem</read:search>')) {
          return route.fulfill({
            status: 200,
            contentType: 'text/xml',
            body: `
              <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
                <soapenv:Body>
                  <read:listUserVocabularyResponse>
                    <read:page>0</read:page>
                    <read:size>20</read:size>
                    <read:totalElements>1</read:totalElements>
                    <read:summary>
                      <read:totalCount>2</read:totalCount>
                      <read:newCount>0</read:newCount>
                      <read:learningCount>1</read:learningCount>
                      <read:knownCount>1</read:knownCount>
                      <read:ignoredCount>0</read:ignoredCount>
                    </read:summary>
                    <read:entries>
                      <read:entryId>e-2</read:entryId>
                      <read:wordId>w-2</read:wordId>
                      <read:word>ephemeral</read:word>
                      <read:language>en</read:language>
                      <read:status>KNOWN</read:status>
                      <read:firstSeenAt>2026-09-02T15:30:00Z</read:firstSeenAt>
                    </read:entries>
                  </read:listUserVocabularyResponse>
                </soapenv:Body>
              </soapenv:Envelope>
            `,
          });
        }

        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:listUserVocabularyResponse>
                  <read:page>0</read:page>
                  <read:size>20</read:size>
                  <read:totalElements>2</read:totalElements>
                  <read:summary>
                    <read:totalCount>2</read:totalCount>
                    <read:newCount>0</read:newCount>
                    <read:learningCount>1</read:learningCount>
                    <read:knownCount>1</read:knownCount>
                    <read:ignoredCount>0</read:ignoredCount>
                  </read:summary>
                  <read:entries>
                    <read:entryId>e-1</read:entryId>
                    <read:wordId>w-1</read:wordId>
                    <read:word>serendipity</read:word>
                    <read:language>en</read:language>
                    <read:status>LEARNING</read:status>
                    <read:firstSeenAt>2026-09-01T12:00:00Z</read:firstSeenAt>
                  </read:entries>
                  <read:entries>
                    <read:entryId>e-2</read:entryId>
                    <read:wordId>w-2</read:wordId>
                    <read:word>ephemeral</read:word>
                    <read:language>en</read:language>
                    <read:status>KNOWN</read:status>
                    <read:firstSeenAt>2026-09-02T15:30:00Z</read:firstSeenAt>
                  </read:entries>
                </read:listUserVocabularyResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('lookupWordRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:lookupWordResponse>
                  <read:word>serendipity</read:word>
                  <read:normalizedWord>serendipity</read:normalizedWord>
                  <read:translation>hallazgo afortunado</read:translation>
                </read:lookupWordResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('setVocabularyStatusRequest')) {
        const wordMatch = postData.match(/<read:word>(.*?)<\/read:word>/);
        const statusMatch = postData.match(/<read:status>(.*?)<\/read:status>/);
        if (wordMatch) capturedWord = wordMatch[1];
        if (statusMatch) capturedStatus = statusMatch[1];

        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:setVocabularyStatusResponse>
                  <read:word>${capturedWord}</read:word>
                  <read:language>en</read:language>
                  <read:status>${capturedStatus}</read:status>
                </read:setVocabularyStatusResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      return route.continue();
    });

    await page.addInitScript(() => {
      sessionStorage.setItem('accessToken', 'mock-test-token-123');
      sessionStorage.setItem('onboardingCompleted', 'true');
    });

    await page.goto('/vocabulary');

    // 1. Verify Page & Summary Metrics
    await expect(page.getByRole('heading', { name: 'Mi vocabulario' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver todas las palabras' })).toContainText('2');
    await expect(page.getByRole('button', { name: 'Filtrar palabras aprendiendo' })).toContainText('1');

    // 2. Verify Table Rows
    const serendipityBtn = page.getByRole('button', { name: 'Consultar detalles de serendipity' });
    await expect(serendipityBtn).toBeVisible();
    await expect(page.getByRole('button', { name: 'Consultar detalles de ephemeral' })).toBeVisible();

    // 3. Open Word Popover
    await serendipityBtn.click();
    const popover = page.locator('.reader-popover');
    await expect(popover).toBeVisible();
    await expect(popover.locator('h2')).toContainText('serendipity');

    // 4. Change Status in Popover to KNOWN
    const knownButton = popover.getByRole('button', { name: 'KNOWN', exact: true });
    await expect(knownButton).toBeVisible();
    await knownButton.click();

    expect(capturedWord).toBe('serendipity');
    expect(capturedStatus).toBe('KNOWN');

    // Close popover
    await popover.getByRole('button', { name: 'Cerrar popover' }).click();
    await expect(popover).not.toBeVisible();

    // 5. Test Search Box
    const searchInput = page.getByRole('searchbox', { name: 'Buscar palabra en vocabulario' });
    await searchInput.fill('ephem');

    // Verify filtered table shows only ephemeral
    await expect(page.getByRole('button', { name: 'Consultar detalles de ephemeral' })).toBeVisible();
    await expect(serendipityBtn).not.toBeVisible();
  });
});
