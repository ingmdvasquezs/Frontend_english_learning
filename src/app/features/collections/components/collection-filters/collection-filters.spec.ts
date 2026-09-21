import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionFilters } from './collection-filters';

describe('CollectionFilters', () => {
  let fixture: ComponentFixture<CollectionFilters>;
  let component: CollectionFilters;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionFilters],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionFilters);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders all canonical CEFR level pills', () => {
    const levelPills = fixture.nativeElement.querySelectorAll('.filter-group-levels .filter-pill');
    expect(levelPills.length).toBe(7); // Todos + 6 CEFR levels
    expect(levelPills[0].textContent).toContain('Todos');
    expect(levelPills[1].textContent).toContain('A1');
    expect(levelPills[6].textContent).toContain('C2');
  });

  it('emits levelChange when a level pill is clicked', () => {
    let emittedLevel: string | null = 'not-called';
    component.levelChange.subscribe((lvl) => (emittedLevel = lvl));

    const b1Pill = Array.from(
      fixture.nativeElement.querySelectorAll('.filter-group-levels .filter-pill')
    ).find((el: any) => el.textContent.includes('B1')) as HTMLButtonElement;

    b1Pill.click();
    expect(emittedLevel).toBe('B1');
  });

  it('renders only backend country pills (without "Todos") when showCountryFilter is true', () => {
    fixture.componentRef.setInput('showCountryFilter', true);
    fixture.componentRef.setInput('countries', [
      { code: 'CO', name: 'Colombia' },
      { code: 'PE', name: 'Perú' },
    ]);
    fixture.detectChanges();

    const countryPills = fixture.nativeElement.querySelectorAll('.filter-group-countries .filter-pill');
    expect(countryPills.length).toBe(2); // Exactly CO and PE, no Todos
    expect(countryPills[0].textContent).toContain('Colombia');
    expect(countryPills[1].textContent).toContain('Perú');
  });

  it('renders topic pills and emits topicChange when clicked', () => {
    fixture.componentRef.setInput('showTopicFilter', true);
    fixture.componentRef.setInput('topics', [
      { key: 'MYTHS_AND_LEGENDS', name: 'Mitos y leyendas' },
      { key: 'REAL_STORIES', name: 'Historias reales' },
    ]);
    fixture.componentRef.setInput('selectedTopic', 'MYTHS_AND_LEGENDS');
    fixture.detectChanges();

    const topicPills = fixture.nativeElement.querySelectorAll('.filter-group-topics .filter-pill');
    expect(topicPills.length).toBe(2);
    expect(topicPills[0].textContent).toContain('Mitos y leyendas');
    expect(topicPills[0].classList).toContain('active');
    expect(topicPills[1].textContent).toContain('Historias reales');
    expect(topicPills[1].classList).not.toContain('active');

    let emittedTopic: string | null = null;
    component.topicChange.subscribe((t) => (emittedTopic = t));

    topicPills[1].click();
    expect(emittedTopic).toBe('REAL_STORIES');
  });

  it('shows clear filters button only when level is selected or topic differs from default', () => {
    fixture.componentRef.setInput('showTopicFilter', true);
    fixture.componentRef.setInput('topics', [
      { key: 'MYTHS_AND_LEGENDS', name: 'Mitos y leyendas' },
      { key: 'REAL_STORIES', name: 'Historias reales' },
    ]);
    fixture.componentRef.setInput('selectedTopic', 'MYTHS_AND_LEGENDS');
    fixture.componentRef.setInput('selectedLevel', null);
    fixture.detectChanges();

    // In default state: clear button not visible
    expect(fixture.nativeElement.querySelector('.filter-clear-btn')).toBeNull();

    // When topic is non-default: clear button is visible
    fixture.componentRef.setInput('selectedTopic', 'REAL_STORIES');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-clear-btn')).not.toBeNull();

    // When level is selected: clear button is visible
    fixture.componentRef.setInput('selectedTopic', 'MYTHS_AND_LEGENDS');
    fixture.componentRef.setInput('selectedLevel', 'B1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-clear-btn')).not.toBeNull();
  });
});
