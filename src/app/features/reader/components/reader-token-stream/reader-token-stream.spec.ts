import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReaderToken } from '../../models/reader.models';
import { ReaderTokenStream } from './reader-token-stream';

describe('ReaderTokenStream', () => {
  let fixture: ComponentFixture<ReaderTokenStream>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReaderTokenStream] }).compileComponents();
    fixture = TestBed.createComponent(ReaderTokenStream);
  });

  it('renders all shared vocabulary states without depending on content origin', () => {
    fixture.componentRef.setInput('tokens', [
      token('New', 'new', 'NEW'),
      token('Learning', 'learning', 'LEARNING'),
      token('Known', 'known', 'KNOWN'),
      token('Ignored', 'ignored', 'IGNORED'),
    ]);
    fixture.detectChanges();

    const words = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(words[0].className).toContain('bg-[#29445a]');
    expect(words[1].className).toContain('bg-[#4a3a22]');
    expect(words[2].className).not.toContain('bg-[#29445a]');
    expect(words[2].className).not.toContain('bg-[#4a3a22]');
    expect(words[3].className).toContain('text-[#70757b]');
  });

  function token(value:string, normalizedValue:string, status:ReaderToken['status']):ReaderToken {
    return { value, normalizedValue, type:'WORD', status };
  }
});
