import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorialUniverse } from './editorial-universe';

describe('EditorialUniverse', () => {
  let fixture: ComponentFixture<EditorialUniverse>;
  let component: EditorialUniverse;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorialUniverse],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorialUniverse);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the Colombia featured banner with titles and quote', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Universo destacado');
    expect(text).toContain('Colombia');
    expect(text).toContain('Personas extraordinarias');
    expect(text).toContain('Muchas historias. Un lugar increíble.');
  });

  it('renders all Colombia subtopics without fake counts', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Mitos y leyendas');
    expect(text).toContain('Historias reales');
    expect(text).toContain('Historia y memoria');
    expect(text).toContain('Cultura y tradiciones');
    expect(text).toContain('Naturaleza y lugares');

    // Asserts no fake count like "4 historias" is shown in subtopics
    expect(text).not.toContain('4 historias');
    expect(text).not.toContain('6 historias');
  });

  it('renders story preview cards with level badges and topic', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('The Legend of La Llorona');
    expect(text).toContain('The Mohán by the River');
    expect(text).toContain('Próximamente');
  });

  it('shows a notice on story click instead of broken route navigation', () => {
    const card = fixture.nativeElement.querySelector('.colombia-story-card') as HTMLElement;
    expect(fixture.nativeElement.querySelector('.preview-notice-toast')).toBeNull();

    card.click();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.preview-notice-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('formará parte del próximo catálogo editorial');
  });

  it('shows a notice when clicking the Explorar Colombia CTA', () => {
    const cta = fixture.nativeElement.querySelector('.colombia-cta') as HTMLButtonElement;
    expect(cta).toBeTruthy();
    expect(cta.textContent).toContain('Explorar Colombia');

    expect(fixture.nativeElement.querySelector('.preview-notice-toast')).toBeNull();
    cta.click();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.preview-notice-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('colección completa de Colombia');
  });
});
