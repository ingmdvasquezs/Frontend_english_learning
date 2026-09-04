import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
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

  it('renders the title, textarea, character counter and cancel navigation', () => {
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Añadir a mi biblioteca');
    expect(root.querySelector('input#title')).toBeTruthy();
    expect(root.querySelector('textarea#content')).toBeTruthy();
    expect(root.textContent).toContain('0 caracteres');
    expect(root.querySelector('a[href="/library"]')?.textContent).toContain('Cancelar');

    component.content.set('English');
    fixture.detectChanges();
    expect(root.textContent).toContain('7 caracteres');
  });

  it('disables invalid submissions and prevents a second submit while saving', () => {
    const pending = new Subject<string>();
    service.registerReading.mockReturnValue(pending.asObservable());
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    component.title.set('My reading');
    component.content.set('English content');
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();
    expect(button.textContent).toContain('Guardando');
    expect(button.disabled).toBe(true);
    component.createReading();
    expect(service.registerReading).toHaveBeenCalledOnce();
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
