import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReaderToken } from '../../models/reader.models';
import {
  ReaderPopoverPosition,
  ReaderWordPopover,
} from './reader-word-popover';

describe('ReaderWordPopover', () => {
  let fixture: ComponentFixture<ReaderWordPopover>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReaderWordPopover],
    }).compileComponents();

    fixture = TestBed.createComponent(ReaderWordPopover);
    fixture.componentRef.setInput('token', token());
    fixture.componentRef.setInput('position', position());
    fixture.componentRef.setInput('word', {
      word: 'garden',
      normalizedWord: 'garden',
      translation: 'jardín',
      phonetic: '/ˈɡɑː.dən/',
      audioUrl: 'garden.mp3',
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [
            { definition: 'A place where plants grow.', example: 'The garden is quiet.' },
          ],
        },
      ],
    });
    fixture.componentRef.setInput('statuses', ['NEW', 'LEARNING', 'KNOWN', 'IGNORED']);
    fixture.componentRef.setInput('selectedStatus', 'LEARNING');
    fixture.detectChanges();
  });

  it('renders the common lexical hierarchy and all four statuses', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('garden');
    expect(text).toContain('/ˈɡɑː.dən/');
    expect(text).toContain('jardín');
    expect(text).toContain('Ver definiciones');

    const statuses = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-pressed]') as NodeListOf<HTMLButtonElement>
    );
    expect(statuses.map((button) => button.textContent?.trim())).toEqual([
      'NEW',
      'LEARNING',
      'KNOWN',
      'IGNORED',
    ]);
    expect(statuses[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('emits manual audio, status, definitions and close actions from real buttons', () => {
    const audio = vi.fn();
    const status = vi.fn();
    const definitions = vi.fn();
    const close = vi.fn();
    fixture.componentInstance.audioPlayed.subscribe(audio);
    fixture.componentInstance.statusSelected.subscribe(status);
    fixture.componentInstance.definitionsToggled.subscribe(definitions);
    fixture.componentInstance.closed.subscribe(close);

    (fixture.nativeElement.querySelector('button[aria-label="Escuchar pronunciación"]') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelectorAll('button[aria-pressed]')[2] as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('button[aria-expanded="false"]') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('button[aria-label="Cerrar popover"]') as HTMLButtonElement).click();

    expect(audio).toHaveBeenCalledWith('garden.mp3');
    expect(status).toHaveBeenCalledWith('KNOWN');
    expect(definitions).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(['light', 'dark'])('uses the same semantic popover surface in %s mode', (theme) => {
    document.documentElement.dataset['theme'] = theme;
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('.reader-popover') as HTMLElement;
    expect(popover.className).toContain('bg-[var(--app-surface-elevated)]');
    expect(popover.getAttribute('aria-label')).toBe('Información y estado de palabra');
  });

  function token(): ReaderToken {
    return {
      value: 'garden',
      normalizedValue: 'garden',
      type: 'WORD',
      status: 'LEARNING',
    };
  }

  function position(): ReaderPopoverPosition {
    return {
      x: 200,
      y: 240,
      openAbove: false,
      anchorTop: 200,
      anchorBottom: 230,
    };
  }
});

