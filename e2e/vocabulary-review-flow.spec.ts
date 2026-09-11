import { test, expect } from '@playwright/test';

test.describe('Browser Integration: Vocabulary Review Flow (Fase 2.1)', () => {
  test('navigates to /vocabulary -> clicks Repasar palabras -> size selector -> reviews with FORGOT feedback -> reinforcement card -> completes session', async ({
    page,
  }) => {
    const capturedMutations: { wordId: string; assessment: string }[] = [];

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
                    <read:newCount>1</read:newCount>
                    <read:learningCount>1</read:learningCount>
                    <read:knownCount>0</read:knownCount>
                    <read:ignoredCount>0</read:ignoredCount>
                  </read:summary>
                  <read:entries>
                    <read:entryId>e-1</read:entryId>
                    <read:wordId>w-1</read:wordId>
                    <read:word>journey</read:word>
                    <read:language>en</read:language>
                    <read:status>LEARNING</read:status>
                    <read:firstSeenAt>2026-09-01T10:00:00Z</read:firstSeenAt>
                  </read:entries>
                  <read:entries>
                    <read:entryId>e-2</read:entryId>
                    <read:wordId>w-2</read:wordId>
                    <read:word>resilience</read:word>
                    <read:language>en</read:language>
                    <read:status>NEW</read:status>
                    <read:firstSeenAt>2026-09-02T10:00:00Z</read:firstSeenAt>
                  </read:entries>
                </read:listUserVocabularyResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('prepareVocabularyReviewRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:prepareVocabularyReviewResponse>
                  <read:dueCount>2</read:dueCount>
                  <read:totalReviewableCount>2</read:totalReviewableCount>
                  <read:entries>
                    <read:wordId>w-1</read:wordId>
                    <read:word>journey</read:word>
                    <read:language>en</read:language>
                    <read:status>LEARNING</read:status>
                  </read:entries>
                  <read:entries>
                    <read:wordId>w-2</read:wordId>
                    <read:word>resilience</read:word>
                    <read:language>en</read:language>
                    <read:status>LEARNING</read:status>
                  </read:entries>
                </read:prepareVocabularyReviewResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('lookupWordRequest')) {
        const wordMatch = postData.match(/<read:word>(.*?)<\/read:word>/);
        const word = wordMatch ? wordMatch[1] : '';
        const isJourney = word === 'journey';

        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:lookupWordResponse>
                  <read:word>${word}</read:word>
                  <read:normalizedWord>${word}</read:normalizedWord>
                  <read:translation>${isJourney ? 'viaje o trayecto' : 'resiliencia'}</read:translation>
                  <read:phonetic>${isJourney ? 'ˈdʒɜːrni' : 'rɪˈzɪliəns'}</read:phonetic>
                  <read:audioUrl>https://example.com/audio/${word}.mp3</read:audioUrl>
                  <read:meanings>
                    <read:partOfSpeech>noun</read:partOfSpeech>
                    <read:definitions>
                      <read:definition>${isJourney ? 'An act of traveling.' : 'Ability to recover.'}</read:definition>
                      <read:example>${isJourney ? 'A long journey.' : 'Great inner resilience.'}</read:example>
                      <read:exampleTranslation>${isJourney ? 'Un largo viaje.' : 'Gran resiliencia interior.'}</read:exampleTranslation>
                    </read:definitions>
                  </read:meanings>
                </read:lookupWordResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('recordVocabularyReviewRequest')) {
        const wordMatch = postData.match(/<read:wordId>(.*?)<\/read:wordId>/);
        const assessMatch = postData.match(/<read:assessment>(.*?)<\/read:assessment>/);
        if (wordMatch && assessMatch) {
          capturedMutations.push({ wordId: wordMatch[1], assessment: assessMatch[1] });
        }

        const targetStatus = assessMatch && assessMatch[1] === 'REMEMBERED' ? 'KNOWN' : 'LEARNING';

        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:recordVocabularyReviewResponse>
                  <read:wordId>${wordMatch ? wordMatch[1] : ''}</read:wordId>
                  <read:status>${targetStatus}</read:status>
                </read:recordVocabularyReviewResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      return route.continue();
    });

    // 1. Setup authenticated session
    await page.addInitScript(() => {
      sessionStorage.setItem('accessToken', 'mock-review-token');
      sessionStorage.setItem('onboardingCompleted', 'true');
      sessionStorage.setItem('userEmail', 'testuser@example.com');
    });

    // 2. Navigate to /vocabulary
    await page.goto('/vocabulary');
    await expect(page.locator('h1')).toHaveText('Mi vocabulario');

    // 3. CTA "Repasar palabras" should be visible and clickable
    const reviewCta = page.locator('a.btn-review');
    await expect(reviewCta).toBeVisible();
    await reviewCta.click();

    // 4. Arrive at /vocabulary/review -> Size Selector screen
    await expect(page).toHaveURL('/vocabulary/review');
    await expect(page.locator('text=¿Cuántas palabras quieres repasar?')).toBeVisible();

    // Select size 10 (default active) and start review
    const startBtn = page.locator('button:has-text("Comenzar repaso")');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // 5. Active card 1: "journey"
    await expect(page.locator('#current-word-title')).toHaveText('journey');
    await expect(page.locator('.revealed-content')).not.toBeVisible();

    // 6. Reveal meaning
    await page.locator('button.btn-reveal').click();
    await expect(page.locator('.revealed-content')).toBeVisible();
    await expect(page.locator('text=viaje o trayecto')).toBeVisible();
    await expect(page.locator('text=A long journey.')).toBeVisible();
    await expect(page.locator('text=Un largo viaje.')).toBeVisible();

    // 7. Click assessment "No la recordé" (FORGOT)
    await page.locator('button.btn-forgot').click();

    // Verify recordVocabularyReview was dispatched
    expect(capturedMutations.some((m) => m.wordId === 'w-1' && m.assessment === 'FORGOT')).toBe(true);

    // 8. FORGOT immediate feedback displayed and auto-advances
    await expect(page.locator('text=No la recordaste. No pasa nada.')).toBeVisible();
    await expect(page.locator('text=Volveremos a repasarla más adelante en esta sesión.')).toBeVisible();

    // 9. Card 2: "resilience" (auto-advanced after ~1000ms)
    await expect(page.locator('#current-word-title')).toHaveText('resilience', { timeout: 3000 });
    await page.locator('button.btn-reveal').click();
    await expect(page.getByText('resiliencia', { exact: true })).toBeVisible();

    // Assessment "La recordé" (REMEMBERED)
    await page.locator('button.btn-remembered').click();
    expect(capturedMutations.some((m) => m.wordId === 'w-2' && m.assessment === 'REMEMBERED')).toBe(true);

    // 10. Reinforcement card for "journey" appears!
    await expect(page.locator('#current-word-title')).toHaveText('journey');
    await expect(page.locator('text=¿La recuerdas ahora?')).toBeVisible();
    await expect(page.locator('.badge-reinforcement')).toBeVisible();

    // Reveal reinforcement meaning
    await page.locator('button.btn-reveal').click();
    await expect(page.locator('text=viaje o trayecto')).toBeVisible();

    // Click local feedback "Sí, ahora sí"
    const reinforcementYes = page.locator('button.btn-reinforcement-yes');
    await expect(reinforcementYes).toBeVisible();
    await reinforcementYes.click();

    // Verify reinforcement did NOT trigger another backend mutation (only 2 total)
    expect(capturedMutations.length).toBe(2);

    // 11. Session Completed summary
    await expect(page.locator('text=Sesión completada')).toBeVisible();
    await expect(page.locator('text=Has repasado 2 palabras.')).toBeVisible();
    await expect(page.getByText('No la recordé', { exact: true })).toBeVisible();
    await expect(page.getByText('La recordé', { exact: true })).toBeVisible();

    // 12. Return to vocabulary
    await page.locator('.btn-primary:has-text("Volver a Mi vocabulario")').click();
    await expect(page).toHaveURL('/vocabulary');
    await expect(page.locator('h1')).toHaveText('Mi vocabulario');
  });

  test('handles partial lookup where translation is empty (e.g. "would") without global error', async ({
    page,
  }) => {
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

      if (postData.includes('prepareVocabularyReviewRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:prepareVocabularyReviewResponse>
                  <read:dueCount>1</read:dueCount>
                  <read:totalReviewableCount>1</read:totalReviewableCount>
                  <read:entries>
                    <read:wordId>w-would</read:wordId>
                    <read:word>would</read:word>
                    <read:language>en</read:language>
                    <read:status>LEARNING</read:status>
                  </read:entries>
                </read:prepareVocabularyReviewResponse>
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
                  <read:word>would</read:word>
                  <read:normalizedWord>would</read:normalizedWord>
                  <read:translation></read:translation>
                  <read:phonetic>wʊd</read:phonetic>
                  <read:audioUrl>https://example.com/audio/would.mp3</read:audioUrl>
                  <read:meanings>
                    <read:partOfSpeech>verb</read:partOfSpeech>
                    <read:definitions>
                      <read:definition>Used to indicate condition or wish.</read:definition>
                      <read:example>I would like to travel next year.</read:example>
                      <read:exampleTranslation>Me gustaría viajar el próximo año.</read:exampleTranslation>
                    </read:definitions>
                  </read:meanings>
                </read:lookupWordResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      return route.continue();
    });

    await page.addInitScript(() => {
      sessionStorage.setItem('accessToken', 'mock-review-token');
      sessionStorage.setItem('onboardingCompleted', 'true');
      sessionStorage.setItem('userEmail', 'testuser@example.com');
    });

    await page.goto('/vocabulary/review');
    await page.locator('button:has-text("Comenzar repaso")').click();

    await expect(page.locator('#current-word-title')).toHaveText('would');
    await page.locator('button.btn-reveal').click();

    // Partial lookup: NO error shown, definition and example present
    await expect(page.locator('text=No pudimos cargar el significado.')).not.toBeVisible();
    await expect(page.locator('text=Used to indicate condition or wish.')).toBeVisible();
    await expect(page.locator('text=I would like to travel next year.')).toBeVisible();
    await expect(page.locator('text=Me gustaría viajar el próximo año.')).toBeVisible();
  });
});
