import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LibraryReadingCard } from './library-reading-card';
import { LibraryCardItem } from './library-reading-card.models';

@Component({ template: '' })
class DummyComponent {}

describe('LibraryReadingCard', () => {
  let fixture: ComponentFixture<LibraryReadingCard>;
  let component: LibraryReadingCard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryReadingCard],
      providers: [
        provideRouter([
          { path: 'reading/:readingId', component: DummyComponent },
          { path: 'documents/:documentId/read', component: DummyComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryReadingCard);
    component = fixture.componentInstance;
  });

  const baseUserItem: LibraryCardItem = {
    id: 'user-1',
    type: 'USER',
    title: 'My Personal Story',
    subtitle: 'Añadida el 10 sep 2026',
    badge: 'LECTURA',
    isPlatformLevel: false,
    coverUrl: '/assets/reading-covers/user-text/text-cover-01.svg',
    coverFitMode: 'cover',
    coverAlt: 'Portada de My Personal Story',
    routerLink: ['/reading', 'user-1'],
    isUnavailable: false,
    vocabularyFitPercentage: 83,
    vocabularyFitTone: 'mature',
    progressStatus: 'IN_PROGRESS',
    progressPercentage: null,
    statusLabel: 'En progreso',
    ctaLabel: 'Continuar →',
    actionKey: 'reading:user-1',
    canDelete: true,
  };

  it('renders USER TEXT card with LECTURA badge, vocab fit indicator, and ⋯ menu', () => {
    fixture.componentRef.setInput('item', baseUserItem);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.library-card-type-badge')?.textContent?.trim()).toBe('LECTURA');
    expect(root.querySelector('.library-card-title')?.textContent?.trim()).toBe('My Personal Story');
    expect(root.querySelector('.library-card-subtitle')?.textContent?.trim()).toBe('Añadida el 10 sep 2026');
    expect(root.querySelector('app-vocabulary-fit-indicator')).toBeTruthy();
    expect(root.textContent).toContain('83% vocab fit');
    expect(root.querySelector('.library-card-status-label')?.textContent?.trim()).toBe('En progreso');
    expect(root.querySelector('.library-card-cta')?.textContent?.trim()).toBe('Continuar →');
    expect(root.querySelector('.document-actions-trigger')).toBeTruthy();
  });

  it('renders EPUB card with EPUB badge, author, contain cover, and CTA', () => {
    const epubItem: LibraryCardItem = {
      id: 'doc-epub-1',
      type: 'EPUB',
      title: 'Moby Dick',
      subtitle: 'Por Herman Melville',
      badge: 'EPUB',
      isPlatformLevel: false,
      coverUrl: 'blob:http://localhost/cover-blob',
      coverFitMode: 'contain',
      coverFallbackUrl: '/assets/reading-covers/documents/epub-fallback.svg',
      coverAlt: 'Portada de Moby Dick',
      routerLink: ['/documents', 'doc-epub-1', 'read'],
      isUnavailable: false,
      vocabularyFitPercentage: null,
      progressStatus: 'NOT_STARTED',
      statusLabel: 'Sin empezar',
      ctaLabel: 'Leer →',
      actionKey: 'document:doc-epub-1',
      canDelete: true,
    };

    fixture.componentRef.setInput('item', epubItem);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.library-card-type-badge')?.textContent?.trim()).toBe('EPUB');
    expect(root.querySelector('.library-card-title')?.textContent?.trim()).toBe('Moby Dick');
    expect(root.querySelector('.library-card-subtitle')?.textContent?.trim()).toBe('Por Herman Melville');
    expect(root.querySelector('.library-cover-img-contain')).toBeTruthy();
    expect(root.querySelector('app-vocabulary-fit-indicator')).toBeFalsy();
    expect(root.querySelector('.library-card-status-label')?.textContent?.trim()).toBe('Sin empezar');
    expect(root.querySelector('.library-card-cta')?.textContent?.trim()).toBe('Leer →');
  });

  it('renders PDF card with PDF badge, editorial fallback, and author', () => {
    const pdfItem: LibraryCardItem = {
      id: 'doc-pdf-1',
      type: 'PDF',
      title: 'Research Paper on Linguistics',
      subtitle: 'Por Dr. Smith',
      badge: 'PDF',
      isPlatformLevel: false,
      coverUrl: null,
      coverFallbackUrl: '/assets/reading-covers/documents/pdf-fallback.svg',
      coverAlt: 'Portada de Research Paper on Linguistics',
      routerLink: ['/documents', 'doc-pdf-1', 'read'],
      isUnavailable: false,
      progressStatus: 'COMPLETED',
      statusLabel: '✓ Leída',
      ctaLabel: 'Releer →',
      actionKey: 'document:doc-pdf-1',
      canDelete: true,
    };

    fixture.componentRef.setInput('item', pdfItem);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.library-card-type-badge')?.textContent?.trim()).toBe('PDF');
    expect(root.querySelector('.library-card-title')?.textContent?.trim()).toBe('Research Paper on Linguistics');
    const img = root.querySelector('.library-cover-img-fallback') as HTMLImageElement;
    expect(img.src).toContain('/assets/reading-covers/documents/pdf-fallback.svg');
    expect(root.querySelector('.library-card-status-label')?.textContent?.trim()).toBe('✓ Leída');
    expect(root.querySelector('.library-card-cta')?.textContent?.trim()).toBe('Releer →');
  });

  it('renders PLATFORM card with CEFR badge, category, canonical cover, and no ⋯ menu', () => {
    const platItem: LibraryCardItem = {
      id: 'plat-1',
      type: 'PLATFORM',
      title: 'The Candileja',
      badge: 'B1',
      isPlatformLevel: true,
      category: 'Culture, Arts & Fiction',
      coverUrl: '/assets/reading-covers/candileja-llanos.webp',
      coverFitMode: 'cover',
      coverAlt: 'Portada de The Candileja',
      routerLink: ['/reading', 'plat-1'],
      isUnavailable: false,
      progressStatus: 'IN_PROGRESS',
      statusLabel: 'En progreso',
      ctaLabel: 'Continuar →',
      actionKey: null,
      canDelete: false,
    };

    fixture.componentRef.setInput('item', platItem);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.library-card-level-badge')?.textContent?.trim()).toBe('B1');
    expect(root.querySelector('.library-card-cat')?.textContent?.trim()).toBe('Culture, Arts & Fiction');
    expect(root.querySelector('.library-card-title')?.textContent?.trim()).toBe('The Candileja');
    expect(root.querySelector('.document-actions-trigger')).toBeFalsy();
    expect(root.querySelector('.library-card-cta')?.textContent?.trim()).toBe('Continuar →');
  });

  it('clicking ⋯ triggers menuToggled and does NOT navigate or bubble', () => {
    fixture.componentRef.setInput('item', baseUserItem);
    fixture.detectChanges();

    let emittedKey: string | null = null;
    component.menuToggled.subscribe((key) => (emittedKey = key));

    const trigger = fixture.nativeElement.querySelector('.document-actions-trigger') as HTMLButtonElement;
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    vi.spyOn(clickEvent, 'stopPropagation');
    vi.spyOn(clickEvent, 'preventDefault');

    trigger.dispatchEvent(clickEvent);

    expect(emittedKey).toBe('reading:user-1');
    expect(clickEvent.stopPropagation).toHaveBeenCalled();
    expect(clickEvent.preventDefault).toHaveBeenCalled();
  });

  it('clicking delete button triggers deleteRequested and stops propagation', () => {
    fixture.componentRef.setInput('item', baseUserItem);
    fixture.componentRef.setInput('isMenuOpen', true);
    fixture.detectChanges();

    let deletedItem: LibraryCardItem | null = null;
    component.deleteRequested.subscribe((item) => (deletedItem = item));

    const deleteBtn = fixture.nativeElement.querySelector('.document-actions-menu button') as HTMLButtonElement;
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    vi.spyOn(clickEvent, 'stopPropagation');
    vi.spyOn(clickEvent, 'preventDefault');

    deleteBtn.dispatchEvent(clickEvent);

    expect(deletedItem).toEqual(baseUserItem);
    expect(clickEvent.stopPropagation).toHaveBeenCalled();
  });

  it('renders progress bar when progressPercentage is present and hides when null', () => {
    const itemWithProgress: LibraryCardItem = {
      ...baseUserItem,
      progressPercentage: 67,
    };
    fixture.componentRef.setInput('item', itemWithProgress);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.library-card-progress-label')?.textContent?.trim()).toBe('67% de avance');
    const track = root.querySelector('.library-card-progress-track') as HTMLElement;
    expect(track).toBeTruthy();
    expect(track.getAttribute('role')).toBe('progressbar');
    expect(track.getAttribute('aria-valuenow')).toBe('67');
    const fill = root.querySelector('.library-card-progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('67%');

    // Change to null
    fixture.componentRef.setInput('item', { ...baseUserItem, progressPercentage: null });
    fixture.detectChanges();
    expect(root.querySelector('.library-card-progress-block')).toBeFalsy();
    expect(root.querySelector('[role="progressbar"]')).toBeFalsy();
  });

  it('handles isUnavailable for processing / failed documents without enabling navigation', () => {
    const processingDoc: LibraryCardItem = {
      ...baseUserItem,
      id: 'doc-proc',
      isUnavailable: true,
      unavailableLabel: 'Procesando…',
      statusLabel: 'Procesando…',
      ctaLabel: null,
      canDelete: false,
    };
    fixture.componentRef.setInput('item', processingDoc);
    fixture.detectChanges();

    const cardLink = fixture.nativeElement.querySelector('.library-card') as HTMLAnchorElement;
    expect(cardLink.classList.contains('is-unavailable')).toBe(true);
    expect(cardLink.getAttribute('aria-disabled')).toBe('true');
    expect(fixture.nativeElement.querySelector('.library-card-cta')).toBeFalsy();

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    vi.spyOn(clickEvent, 'preventDefault');
    cardLink.dispatchEvent(clickEvent);
    expect(clickEvent.preventDefault).toHaveBeenCalled();
  });
});
