import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LibraryService } from '../../services/library';
import { NewReading } from './new-reading';

describe('NewReading', () => {
  let component: NewReading;
  let fixture: ComponentFixture<NewReading>;
  let service: {
    registerReading: ReturnType<typeof vi.fn>;
    parseRegisteredReadingResponse: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    service = {
      registerReading: vi.fn(() => of('<response/>')),
      parseRegisteredReadingResponse: vi.fn(() => ({
        readingId: 'reading-1',
        title: 'My reading',
        language: 'en',
        createdAt: '2026-08-29T15:00:00Z',
      })),
    };

    await TestBed.configureTestingModule({
      imports: [NewReading],
      providers: [
        provideRouter([]),
        { provide: LibraryService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewReading);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  it('registers a reading and returns to the library', () => {
    component.title.set('My reading');
    component.content.set('English content');

    component.createReading();

    expect(service.registerReading).toHaveBeenCalledWith(
      'My reading',
      'English content',
      'en'
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/library');
  });

  it('keeps the form visible when registration fails', () => {
    service.registerReading.mockReturnValue(
      throwError(() => new Error('SOAP error'))
    );
    component.title.set('My reading');
    component.content.set('English content');

    component.createReading();

    expect(component.error()).toBe('No se pudo registrar la lectura');
    expect(component.loading()).toBe(false);
  });

  it('does not submit values outside the XSD title restriction', () => {
    component.title.set('a'.repeat(201));
    component.content.set('English content');

    component.createReading();

    expect(component.canSubmit()).toBe(false);
    expect(service.registerReading).not.toHaveBeenCalled();
  });
});
