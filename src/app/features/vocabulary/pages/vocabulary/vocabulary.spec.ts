import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { ReaderWordInteraction } from '../../../reader/services/reader-word-interaction';
import { UserVocabularyPage } from '../../models/vocabulary.models';
import { VocabularyService } from '../../services/vocabulary.service';
import { Vocabulary } from './vocabulary';

describe('Vocabulary Component', () => {
  let component: Vocabulary;
  let fixture: ComponentFixture<Vocabulary>;
  let vocabularyServiceMock: {
    listUserVocabulary: ReturnType<typeof vi.fn>;
    setVocabularyStatus: ReturnType<typeof vi.fn>;
  };
  let wordInteractionMock: {
    selectWord: ReturnType<typeof vi.fn>;
    saveStatus: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    playAudio: ReturnType<typeof vi.fn>;
    toggleDefinitions: ReturnType<typeof vi.fn>;
    popoverPosition: ReturnType<typeof vi.fn>;
    selectedToken: ReturnType<typeof vi.fn>;
    dictionaryWord: ReturnType<typeof vi.fn>;
    lookupLoading: ReturnType<typeof vi.fn>;
    lookupUnavailable: ReturnType<typeof vi.fn>;
    savingStatus: ReturnType<typeof vi.fn>;
    statusError: ReturnType<typeof vi.fn>;
    audioError: ReturnType<typeof vi.fn>;
    definitionsOpen: ReturnType<typeof vi.fn>;
    selectedStatus: ReturnType<typeof vi.fn>;
    statuses: readonly VocabularyStatus[];
  };

  const samplePageData: UserVocabularyPage = {
    page: 0,
    size: 10,
    totalElements: 2,
    summary: {
      totalCount: 30,
      newCount: 5,
      learningCount: 10,
      knownCount: 12,
      ignoredCount: 3,
    },
    entries: [
      {
        entryId: 'e-1',
        wordId: 'w-1',
        word: 'serendipity',
        language: 'en',
        status: 'LEARNING',
        firstSeenAt: '2026-09-01T12:00:00Z',
      },
      {
        entryId: 'e-2',
        wordId: 'w-2',
        word: 'ephemeral',
        language: 'en',
        status: 'KNOWN',
        firstSeenAt: '2026-09-02T15:30:00Z',
      },
    ],
  };

  beforeEach(async () => {
    vocabularyServiceMock = {
      listUserVocabulary: vi.fn(() => of(samplePageData)),
      setVocabularyStatus: vi.fn(() => of('LEARNING')),
    };

    wordInteractionMock = {
      selectWord: vi.fn(),
      saveStatus: vi.fn(),
      close: vi.fn(),
      playAudio: vi.fn(),
      toggleDefinitions: vi.fn(),
      popoverPosition: vi.fn(() => null),
      selectedToken: vi.fn(() => null),
      dictionaryWord: vi.fn(() => null),
      lookupLoading: vi.fn(() => false),
      lookupUnavailable: vi.fn(() => false),
      savingStatus: vi.fn(() => false),
      statusError: vi.fn(() => null),
      audioError: vi.fn(() => null),
      definitionsOpen: vi.fn(() => false),
      selectedStatus: vi.fn(() => null),
      statuses: ['NEW', 'LEARNING', 'KNOWN', 'IGNORED'],
    };

    await TestBed.configureTestingModule({
      imports: [Vocabulary],
      providers: [
        provideRouter([]),
        { provide: VocabularyService, useValue: vocabularyServiceMock },
      ],
    })
      .overrideComponent(Vocabulary, {
        set: {
          providers: [
            { provide: ReaderWordInteraction, useValue: wordInteractionMock },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Vocabulary);
    component = fixture.componentInstance;
  });

  it('initializes and loads vocabulary page data', () => {
    fixture.detectChanges();

    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalledWith(
      0,
      10,
      'LEARNING',
      ''
    );
    expect(component.loading()).toBe(false);
    expect(component.entries().length).toBe(2);
    expect(component.summary().totalCount).toBe(30);
    expect(component.totalElements()).toBe(2);
    expect(component.totalPages()).toBe(1);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Mi vocabulario');
    expect(root.textContent).toContain('serendipity');
    expect(root.textContent).toContain('ephemeral');
  });

  it('updates search and resets page to 0 with debounce', async () => {
    vi.useFakeTimers();
    fixture.detectChanges();
    vocabularyServiceMock.listUserVocabulary.mockClear();

    component.searchControl.setValue('seren');
    await vi.advanceTimersByTimeAsync(100);
    expect(vocabularyServiceMock.listUserVocabulary).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);
    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalledWith(
      0,
      10,
      'LEARNING',
      'seren'
    );
    expect(component.activeSearchTerm()).toBe('seren');
    vi.useRealTimers();
  });

  it('filters by status and resets page to 0', () => {
    fixture.detectChanges();
    vocabularyServiceMock.listUserVocabulary.mockClear();

    component.selectFilter('KNOWN');

    expect(component.selectedFilter()).toBe('KNOWN');
    expect(component.page()).toBe(0);
    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalledWith(
      0,
      10,
      'KNOWN',
      ''
    );
  });

  it('does not re-fetch if the same filter is clicked again', () => {
    fixture.detectChanges();
    vocabularyServiceMock.listUserVocabulary.mockClear();

    component.selectFilter('LEARNING');

    expect(vocabularyServiceMock.listUserVocabulary).not.toHaveBeenCalled();
  });

  it('paginates forward and backward', () => {
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        ...samplePageData,
        totalElements: 45,
      })
    );
    fixture.detectChanges();
    vocabularyServiceMock.listUserVocabulary.mockClear();

    component.nextPage();
    expect(component.page()).toBe(1);
    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalledWith(
      1,
      10,
      'LEARNING',
      ''
    );

    vocabularyServiceMock.listUserVocabulary.mockClear();
    component.prevPage();
    expect(component.page()).toBe(0);
    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalledWith(
      0,
      10,
      'LEARNING',
      ''
    );
  });

  it('does not paginate past limits', () => {
    component.totalElements.set(10);
    fixture.detectChanges();
    vocabularyServiceMock.listUserVocabulary.mockClear();

    component.prevPage();
    expect(component.page()).toBe(0);
    expect(vocabularyServiceMock.listUserVocabulary).not.toHaveBeenCalled();

    component.nextPage();
    expect(component.page()).toBe(0);
    expect(vocabularyServiceMock.listUserVocabulary).not.toHaveBeenCalled();
  });

  it('falls back to previous page if page exceeds maxPages when elements exist', () => {
    component.page.set(2);
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        ...samplePageData,
        page: 2,
        totalElements: 10, // maxPages = 1 (page 0)
        entries: [],
      })
    );

    component.loadVocabulary();

    expect(component.page()).toBe(0);
  });

  it('displays global empty state when totalCount is 0 without filters', () => {
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        page: 0,
        size: 10,
        totalElements: 0,
        summary: {
          totalCount: 0,
          newCount: 0,
          learningCount: 0,
          knownCount: 0,
          ignoredCount: 0,
        },
        entries: [],
      })
    );

    fixture.detectChanges();

    expect(component.isGlobalEmpty()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Aún no tienes palabras en tu vocabulario');
    expect(root.querySelector('a[href="/library"]')).toBeTruthy();
  });

  it('displays filter empty state and resets filters upon action', () => {
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        page: 0,
        size: 10,
        totalElements: 0,
        summary: {
          totalCount: 15,
          newCount: 0,
          learningCount: 10,
          knownCount: 5,
          ignoredCount: 0,
        },
        entries: [],
      })
    );

    component.selectedFilter.set('KNOWN');
    fixture.detectChanges();

    expect(component.isFilterEmpty()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No se encontraron palabras');

    vocabularyServiceMock.listUserVocabulary.mockClear();
    component.resetFilters();

    expect(component.selectedFilter()).toBe('LEARNING');
    expect(component.activeSearchTerm()).toBe('');
    expect(component.searchControl.value).toBe('');
    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalledWith(
      0,
      10,
      'LEARNING',
      ''
    );
  });

  it('displays error card and retries upon clicking retry button', () => {
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      throwError(() => new Error('SOAP Failure'))
    );

    fixture.detectChanges();

    expect(component.error()).toContain('No pudimos cargar tu vocabulario');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No pudimos cargar tu vocabulario');

    vocabularyServiceMock.listUserVocabulary.mockReturnValue(of(samplePageData));
    const retryBtn = root.querySelector('.retry-btn') as HTMLButtonElement;
    retryBtn.click();

    expect(component.error()).toBeNull();
    expect(component.entries().length).toBe(2);
  });

  it('triggers word popover when a word is clicked', () => {
    fixture.detectChanges();

    const mouseEvent = new MouseEvent('click');
    const entry = samplePageData.entries[0];

    component.openWordPopover(entry, mouseEvent);

    expect(wordInteractionMock.selectWord).toHaveBeenCalledWith(
      {
        value: 'serendipity',
        normalizedValue: 'serendipity',
        type: 'WORD',
        status: 'LEARNING',
      },
      mouseEvent
    );
  });

  it('handles status change and reloads vocabulary', () => {
    fixture.detectChanges();
    vocabularyServiceMock.listUserVocabulary.mockClear();
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        ...samplePageData,
        entries: [
          { ...samplePageData.entries[0], status: 'KNOWN' },
          samplePageData.entries[1],
        ],
      })
    );

    wordInteractionMock.selectedToken.mockReturnValue({
      value: 'serendipity',
      normalizedValue: 'serendipity',
      type: 'WORD',
      status: 'LEARNING',
    });

    wordInteractionMock.saveStatus.mockImplementation(
      (newStatus, lang, callback) => {
        callback(
          {
            value: 'serendipity',
            normalizedValue: 'serendipity',
            type: 'WORD',
            status: 'LEARNING',
          },
          newStatus
        );
      }
    );

    component.onStatusSelected('KNOWN');

    expect(wordInteractionMock.saveStatus).toHaveBeenCalledWith(
      'KNOWN',
      'en',
      expect.any(Function)
    );
    expect(component.entries()[0].status).toBe('KNOWN');
    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalled();
  });

  it('returns proper labels and classes for statuses', () => {
    expect(component.getStatusLabel('NEW')).toBe('Nueva');
    expect(component.getStatusLabel('LEARNING')).toBe('Aprendiendo');
    expect(component.getStatusLabel('KNOWN')).toBe('Conocida');
    expect(component.getStatusLabel('IGNORED')).toBe('Ignorada');

    expect(component.getStatusBadgeClass('NEW')).toBe('badge-new');
    expect(component.getStatusBadgeClass('LEARNING')).toBe('badge-learning');
    expect(component.getStatusBadgeClass('KNOWN')).toBe('badge-known');
    expect(component.getStatusBadgeClass('IGNORED')).toBe('badge-ignored');
  });

  it('enables review CTA when totalCount > 0', () => {
    fixture.detectChanges();
    expect(component.reviewAvailable()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    const reviewLink = compiled.querySelector('a.btn-review');
    expect(reviewLink).toBeTruthy();
    expect(reviewLink?.getAttribute('href')).toBe('/vocabulary/review');
  });

  it('disables review CTA when totalCount === 0', () => {
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        ...samplePageData,
        summary: {
          totalCount: 0,
          newCount: 0,
          learningCount: 0,
          knownCount: 0,
          ignoredCount: 0,
        },
      })
    );

    component.loadVocabulary();
    fixture.detectChanges();

    expect(component.reviewAvailable()).toBe(false);
    const compiled = fixture.nativeElement as HTMLElement;
    const disabledBtn = compiled.querySelector('button.btn-review');
    expect(disabledBtn).toBeTruthy();
    expect(disabledBtn?.hasAttribute('disabled')).toBe(true);
    expect(disabledBtn?.textContent).toContain('Repasar palabras');
  });

  it('displays learning empty state with CTA to view new words when newCount > 0', () => {
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        page: 0,
        size: 10,
        totalElements: 0,
        summary: {
          totalCount: 5,
          newCount: 5,
          learningCount: 0,
          knownCount: 0,
          ignoredCount: 0,
        },
        entries: [],
      })
    );

    component.selectedFilter.set('LEARNING');
    fixture.detectChanges();

    expect(component.isLearningEmpty()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No tienes palabras en aprendizaje');
    expect(compiled.textContent).toContain('Ver nuevas');

    vocabularyServiceMock.listUserVocabulary.mockClear();
    component.selectFilter('NEW');
    expect(component.selectedFilter()).toBe('NEW');
  });

  it('displays new empty state when selectedFilter is NEW and entries is empty', () => {
    vocabularyServiceMock.listUserVocabulary.mockReturnValue(
      of({
        page: 0,
        size: 10,
        totalElements: 0,
        summary: {
          totalCount: 10,
          newCount: 0,
          learningCount: 5,
          knownCount: 5,
          ignoredCount: 0,
        },
        entries: [],
      })
    );

    component.selectedFilter.set('NEW');
    fixture.detectChanges();

    expect(component.isNewEmpty()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No tienes palabras nuevas guardadas.');
  });

  it('calls setVocabularyStatus and reloads vocabulary on quickChangeStatus', () => {
    fixture.detectChanges();
    vocabularyServiceMock.listUserVocabulary.mockClear();

    const entry = samplePageData.entries[0];
    const event = new MouseEvent('click');
    vi.spyOn(event, 'stopPropagation');

    component.quickChangeStatus(entry, 'KNOWN', event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(vocabularyServiceMock.setVocabularyStatus).toHaveBeenCalledWith(
      'serendipity',
      'en',
      'KNOWN'
    );
    expect(vocabularyServiceMock.listUserVocabulary).toHaveBeenCalled();
  });
});
