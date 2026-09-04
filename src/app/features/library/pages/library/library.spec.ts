import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { LibraryService } from '../../services/library';
import { Library } from './library';

describe('Library', () => {
  let fixture: ComponentFixture<Library>;
  let response: Subject<string>;
  let service: {
    listUserReadings: ReturnType<typeof vi.fn>;
    parseUserReadings: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    response = new Subject<string>();
    service = {
      listUserReadings: vi.fn(() => response.asObservable()),
      parseUserReadings: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Library],
      providers: [
        provideRouter([]),
        { provide: LibraryService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Library);
  });

  it('shows loading while listUserReadings is pending', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando tus lecturas');
  });

  it('keeps the Add reading action linked to the existing creation route', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a[href="/library/new"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Añadir lectura');
  });

  it('shows readings returned by the backend', () => {
    service.parseUserReadings.mockReturnValue({
      page: 0,
      size: 20,
      totalElements: 1,
      readings: [
        {
          readingId: 'reading-1',
          title: 'A short story',
          language: 'en',
          createdAt: '2026-08-29',
          uniqueWords: 20, knownWords: 5, learningWords: 2,
          explicitNewWords: 1, ignoredWords: 3, unclassifiedWords: 9,
          progressStatus: 'IN_PROGRESS',
        },
      ],
    });
    fixture.detectChanges();
    response.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('A short story');
    expect(fixture.nativeElement.textContent).toContain('25% de vocabulario conocido');
    expect(fixture.nativeElement.textContent).toContain('10 por aprender');
    expect(fixture.nativeElement.textContent).toContain('En progreso');
    expect(fixture.nativeElement.textContent).toContain('Continuar lectura');
    expect(fixture.nativeElement.textContent).toContain('TEXTO');
    expect(fixture.nativeElement.textContent).not.toContain('2026-08-29T');
    expect(
      fixture.nativeElement.querySelector('.library-grid')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('a[href="/reading/reading-1"]')
    ).toBeTruthy();
  });

  it.each([
    [null, 'Sin empezar', 'Abrir lectura'],
    ['NOT_STARTED', 'Sin empezar', 'Abrir lectura'],
    ['IN_PROGRESS', 'En progreso', 'Continuar lectura'],
    ['COMPLETED', 'Leída', 'Releer'],
  ] as const)('renders %s progress semantics', (progressStatus, status, cta) => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'r',title:'Stateful',language:'en',createdAt:null,uniqueWords:0,knownWords:0,learningWords:0,explicitNewWords:0,ignoredWords:0,unclassifiedWords:0,progressStatus }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(status);
    expect(fixture.nativeElement.textContent).toContain(cta);
  });

  it('keeps detailed metrics in a desktop reveal without a fake progress bar or menu', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'r',title:'Metrics',language:'en',createdAt:null,uniqueWords:20,knownWords:5,learningWords:2,explicitNewWords:1,ignoredWords:3,unclassifiedWords:9,progressStatus:null }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.library-card') as HTMLElement;
    const reveal = card.querySelector('.library-card-metrics') as HTMLElement;
    expect(reveal.textContent).toContain('5 conocidas');
    expect(reveal.textContent).toContain('2 aprendiendo');
    expect(reveal.textContent).toContain('10 por aprender');
    expect(card.querySelector('[role="progressbar"]')).toBeFalsy();
    expect(card.querySelector('button')).toBeFalsy();
    expect(card.getAttribute('href')).toBe('/reading/r');
  });

  it('clamps long titles while preserving their full text and navigation', () => {
    const title = 'A deliberately very long title that must remain intact even when the card displays only two visual lines';
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'long',title,language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.library-card-title').textContent).toBe(title);
    expect(fixture.nativeElement.querySelector('a[href="/reading/long"]')).toBeTruthy();
  });

  it('shows a clear empty state', () => {
    service.parseUserReadings.mockReturnValue({
      page: 0,
      size: 20,
      totalElements: 0,
      readings: [],
    });
    fixture.detectChanges();
    response.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Tu biblioteca está vacía'
    );
    expect(fixture.nativeElement.textContent).toContain('Añadir primera lectura');
    expect(fixture.nativeElement.querySelector('a[href="/library/new"]')).toBeTruthy();
  });

  it('shows an error when listUserReadings fails', () => {
    fixture.detectChanges();
    response.error(new Error('SOAP error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudieron cargar tus lecturas'
    );
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });
});
