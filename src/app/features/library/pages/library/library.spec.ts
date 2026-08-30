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
    expect(fixture.nativeElement.textContent).toContain('10 palabras por aprender');
    expect(fixture.nativeElement.textContent).toContain('En progreso');
    expect(fixture.nativeElement.textContent).toContain('Continuar lectura');
    expect(fixture.nativeElement.textContent).not.toContain('2026-08-29T');
    expect(
      fixture.nativeElement.querySelector('.grid')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('a[href="/reading/reading-1"]')
    ).toBeTruthy();
  });

  it.each([
    [null, 'Abrir lectura'],
    ['COMPLETED', 'Releer'],
  ] as const)('renders %s progress semantics', (progressStatus, cta) => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'r',title:'Stateful',language:'en',createdAt:null,uniqueWords:0,knownWords:0,learningWords:0,explicitNewWords:0,ignoredWords:0,unclassifiedWords:0,progressStatus }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(cta);
    if (progressStatus === 'COMPLETED') expect(fixture.nativeElement.textContent).toContain('✓ Leída');
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
      'Todavía no tienes lecturas'
    );
    expect(fixture.nativeElement.textContent).toContain('Crear primera lectura');
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
