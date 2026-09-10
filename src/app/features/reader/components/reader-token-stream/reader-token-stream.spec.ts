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

  it('adds narration-current only to the active word without replacing vocabulary state', () => {
    fixture.componentRef.setInput('tokens', [
      token('New','new','NEW'),
      {value:' ',normalizedValue:null,type:'WHITESPACE',status:null},
      token('Known','known','KNOWN'),
    ]);
    fixture.detectChanges();
    const words=fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    words[1].getBoundingClientRect=()=>({top:250,bottom:280,left:0,right:80,width:80,height:30} as DOMRect);
    words[1].scrollIntoView=vi.fn();
    fixture.componentRef.setInput('activeNarrationTokenIndex',2);
    fixture.detectChanges();

    expect(words[0].classList.contains('narration-current')).toBe(false);
    expect(words[1].classList.contains('narration-current')).toBe(true);
    expect(words[0].className).toContain('bg-[#29445a]');
    expect(words[1].className).not.toContain('bg-[#29445a]');
  });

  it('does not scroll when the active word is inside the safe viewport zone', () => {
    const word=prepareSingleWord();
    word.getBoundingClientRect=()=>({top:250,bottom:280,left:0,right:80,width:80,height:30} as DOMRect);
    word.scrollIntoView=vi.fn();
    fixture.componentRef.setInput('activeNarrationTokenIndex',0); fixture.detectChanges();
    expect(word.scrollIntoView).not.toHaveBeenCalled();
  });

  it('smoothly follows a word outside the viewport', () => {
    const word=prepareSingleWord();
    word.getBoundingClientRect=()=>({top:1200,bottom:1230,left:0,right:80,width:80,height:30} as DOMRect);
    word.scrollIntoView=vi.fn();
    fixture.componentRef.setInput('activeNarrationTokenIndex',0); fixture.detectChanges();
    expect(word.scrollIntoView).toHaveBeenCalledWith({behavior:'smooth',block:'center',inline:'nearest'});
  });

  it('does not fight manual scrolling while the active word remains visible', () => {
    fixture.componentRef.setInput('tokens',[token('One','one','NEW'),{value:' ',normalizedValue:null,type:'WHITESPACE',status:null},token('Two','two','NEW')]);
    fixture.detectChanges();
    const words=fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    words[0].getBoundingClientRect=()=>({top:250,bottom:280,left:0,right:60,width:60,height:30} as DOMRect);
    words[1].getBoundingClientRect=()=>({top:25,bottom:55,left:0,right:60,width:60,height:30} as DOMRect);
    words[1].scrollIntoView=vi.fn();
    fixture.componentRef.setInput('activeNarrationTokenIndex',0); fixture.detectChanges();
    fixture.componentInstance.suspendAutoFollow();
    fixture.componentRef.setInput('activeNarrationTokenIndex',2); fixture.detectChanges();
    expect(words[1].scrollIntoView).not.toHaveBeenCalled();
  });

  function prepareSingleWord(): HTMLButtonElement {
    fixture.componentRef.setInput('tokens',[token('Hello','hello','NEW')]);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  function token(value:string, normalizedValue:string, status:ReaderToken['status']):ReaderToken {
    return { value, normalizedValue, type:'WORD', status };
  }
});
