import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { DictionaryService } from '../../../../shared/services/dictionary';
import { ReaderService } from '../../../reader/services/reader';
import { DocumentService } from '../../services/document';
import { DocumentReader } from './document-reader';
import { NarrationService } from '../../../../shared/narration/narration.service';

describe('DocumentReader', () => {
  let fixture: ComponentFixture<DocumentReader>; let component: DocumentReader;
  let documents: Record<string, ReturnType<typeof vi.fn>>; let reader: { setVocabularyStatus: ReturnType<typeof vi.fn> };
  let narration: { available:ReturnType<typeof signal<boolean>>;state:ReturnType<typeof signal<'IDLE'|'PLAYING'|'PAUSED'>>;rate:ReturnType<typeof signal<0.75|1|1.25|1.5>>;currentCharacterIndex:ReturnType<typeof signal<number|null>>;followAlongAvailable:ReturnType<typeof signal<boolean>>;play:ReturnType<typeof vi.fn>;pause:ReturnType<typeof vi.fn>;resume:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;restart:ReturnType<typeof vi.fn>;setRate:ReturnType<typeof vi.fn> };
  let parseLookupWordResponse: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    documents = {
      getDocument:vi.fn(() => of(document())), getProgress:vi.fn(() => of(progress())),
      getStructure:vi.fn(() => of({ documentId:'doc',firstUnitId:'unit-1',sections:[],totalUnits:2 })),
      getUnit:vi.fn((_documentId:string,unitId:string) => of(unit(unitId))), updateProgress:vi.fn((_documentId:string,request:{currentUnitId:string}) => of({ ...progress(),status:'IN_PROGRESS',currentUnitId:request.currentUnitId,version:1 })),
    };
    reader = { setVocabularyStatus:vi.fn(() => of('<ok/>')) };
    const currentCharacterIndex=signal<number|null>(null);
    const narrationState=signal<'IDLE'|'PLAYING'|'PAUSED'>('IDLE');
    narration={available:signal(true),state:narrationState,rate:signal(1),currentCharacterIndex,followAlongAvailable:signal(false),play:vi.fn(),pause:vi.fn(),resume:vi.fn(),stop:vi.fn(()=>{currentCharacterIndex.set(null);narrationState.set('IDLE');}),restart:vi.fn(),setRate:vi.fn()};
    parseLookupWordResponse=vi.fn(() => ({word:'hello',normalizedWord:'hello',translation:'hola',phonetic:null,audioUrl:null,meanings:[]}));
    await TestBed.configureTestingModule({ imports:[DocumentReader],providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{paramMap:{get:()=> 'doc'}}}},{provide:DocumentService,useValue:documents},{provide:ReaderService,useValue:reader},{provide:NarrationService,useValue:narration},{provide:DictionaryService,useValue:{lookupWord:vi.fn(() => of('<xml/>')),parseLookupWordResponse}}] }).compileComponents();
    fixture=TestBed.createComponent(DocumentReader); component=fixture.componentInstance;
  });

  it('opens NOT_STARTED through structure.firstUnitId and starts progress', () => {
    const scroll=vi.spyOn(component,'scrollReaderToTopAfterRender');
    fixture.detectChanges();
    expect(documents['getStructure']).toHaveBeenCalledWith('doc'); expect(documents['getUnit']).toHaveBeenCalledWith('doc','unit-1');
    expect(documents['updateProgress']).toHaveBeenCalledWith('doc',{currentUnitId:'unit-1',completed:false,expectedVersion:0});
    expect(fixture.nativeElement.textContent).toContain('1 de 2');
    expect(scroll).toHaveBeenCalledOnce();
  });

  it('opens a READY PDF through the same structure, unit and progress flow', () => {
    documents['getDocument'].mockReturnValue(of({ ...document(), format:'PDF' }));

    fixture.detectChanges();

    expect(documents['getStructure']).toHaveBeenCalledWith('doc');
    expect(documents['getUnit']).toHaveBeenCalledWith('doc','unit-1');
    expect(documents['updateProgress']).toHaveBeenCalledWith('doc',{currentUnitId:'unit-1',completed:false,expectedVersion:0});
    expect(fixture.nativeElement.textContent).toContain('Chapter 1');
  });

  it.each(['EPUB','PDF'])('narrates only the visible %s unit without autoplay', (format) => {
    documents['getDocument'].mockReturnValue(of({...document(),format}));
    fixture.detectChanges();
    expect(narration.play).not.toHaveBeenCalled();
    const play = fixture.nativeElement.querySelector('.narration-launch') as HTMLButtonElement;
    expect(play.getAttribute('aria-label')).toBe('Escuchar parte');
    play.click();
    expect(narration.play).toHaveBeenCalledWith('Hello','en');
    narration.currentCharacterIndex.set(0); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('article button') as HTMLButtonElement).classList.contains('narration-current')).toBe(true);
  });

  it('stops before next, previous and TOC jumps and never autoplays the new unit', () => {
    const sections=[section('one',1,'One','unit-1',1),section('two',2,'Two','unit-2',1)];
    documents['getStructure'].mockReturnValue(of(structure(sections)));
    fixture.detectChanges();
    narration.currentCharacterIndex.set(0);
    component.navigateTo('unit-2');
    expect(narration.currentCharacterIndex()).toBeNull();
    narration.currentCharacterIndex.set(0);
    component.navigateTo('unit-1');
    expect(narration.currentCharacterIndex()).toBeNull();
    narration.currentCharacterIndex.set(0);
    component.navigateToSection(sections[1]);
    expect(narration.currentCharacterIndex()).toBeNull();
    expect(narration.stop).toHaveBeenCalledTimes(3);
    expect(narration.play).not.toHaveBeenCalled();
  });

  it('stops narration on destroy', () => {
    fixture.detectChanges(); narration.currentCharacterIndex.set(0); fixture.destroy();
    expect(narration.stop).toHaveBeenCalledOnce();
    expect(narration.currentCharacterIndex()).toBeNull();
  });

  it('fails safely when firstUnitId is null', () => {
    documents['getStructure'].mockReturnValue(of({documentId:'doc',firstUnitId:null,sections:[],totalUnits:0}));
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('No pudimos encontrar contenido'); expect(documents['getUnit']).not.toHaveBeenCalled();
  });

  it('resumes IN_PROGRESS from currentUnitId while loading structure once for navigation', () => {
    documents['getProgress'].mockReturnValue(of({...progress(),status:'IN_PROGRESS',currentUnitId:'unit-2',version:3}));
    fixture.detectChanges(); expect(documents['getUnit']).toHaveBeenCalledWith('doc','unit-2'); expect(documents['getStructure']).toHaveBeenCalledOnce();
  });

  it('resumes COMPLETED from currentUnitId and keeps completion visible', () => {
    documents['getProgress'].mockReturnValue(of({...progress(),status:'COMPLETED',currentUnitId:'unit-2',version:4}));
    fixture.detectChanges(); expect(documents['getUnit']).toHaveBeenCalledWith('doc','unit-2'); expect(documents['getStructure']).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Lectura finalizada'); expect(fixture.nativeElement.textContent).toContain('Chapter 1');
  });

  it('navigates previous/next, updates global vocabulary, and completes the last unit', () => {
    fixture.detectChanges(); component.navigateTo('unit-2');
    expect(documents['getUnit']).toHaveBeenCalledWith('doc','unit-2');
    component.selectWord(component.unit()!.tokens[0], wordClick()); component.saveStatus('KNOWN');
    expect(reader.setVocabularyStatus).toHaveBeenCalledWith('Hello','en','KNOWN'); expect(component.unit()!.tokens[0].status).toBe('KNOWN');
    component.finish(); expect(documents['updateProgress']).toHaveBeenLastCalledWith('doc',expect.objectContaining({currentUnitId:'unit-2',completed:true}));
  });

  it('uses the shared token stream and anchored reader popover presentation', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-reader-token-stream')).toBeTruthy();
    const word = fixture.nativeElement.querySelector('article button') as HTMLButtonElement;
    word.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-reader-word-popover')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.reader-popover')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('hola');
    expect(fixture.nativeElement.querySelector('button[aria-label="Cambiar estado de Hello"]')).toBeTruthy();
  });

  it('stops full narration before playing an individual word pronunciation', () => {
    class AudioMock { currentTime=0; pause():void {} play(): Promise<void> { return Promise.resolve(); } }
    vi.stubGlobal('Audio',AudioMock);
    fixture.detectChanges(); narration.currentCharacterIndex.set(0);
    component.playAudio('https://audio.example/hello.mp3');
    expect(narration.stop).toHaveBeenCalledOnce();
    expect(narration.currentCharacterIndex()).toBeNull();
    vi.unstubAllGlobals();
  });

  it.each(['EPUB','PDF'] as const)('autoplays one word pronunciation in %s and does not resume full narration', (format) => {
    const play=vi.fn(() => Promise.resolve());
    class AudioMock { currentTime=0; readonly play=play; readonly pause=vi.fn(); }
    vi.stubGlobal('Audio',AudioMock);
    parseLookupWordResponse.mockReturnValue({word:'hello',normalizedWord:'hello',translation:'hola',phonetic:'/həˈləʊ/',audioUrl:'hello.mp3',meanings:[]});
    fixture.detectChanges();
    component.document.update((current) => current ? { ...current,format } : current);
    narration.currentCharacterIndex.set(4); narration.state.set('PLAYING');

    component.selectWord(component.unit()!.tokens[0],wordClick());

    expect(narration.stop).toHaveBeenCalledOnce();
    expect(narration.currentCharacterIndex()).toBeNull();
    expect(narration.state()).toBe('IDLE');
    expect(play).toHaveBeenCalledOnce();
    expect(narration.resume).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('renders every status delivered by a document unit', () => {
    fixture.detectChanges();
    component.unit.set({
      ...unit('unit-1'),
      tokens: [
        word('New', 'new', 'NEW'),
        word('Learning', 'learning', 'LEARNING'),
        word('Known', 'known', 'KNOWN'),
        word('Ignored', 'ignored', 'IGNORED'),
      ],
    });
    fixture.detectChanges();
    const words = fixture.nativeElement.querySelectorAll('article button') as NodeListOf<HTMLButtonElement>;
    expect(words[0].className).toContain('bg-[#29445a]');
    expect(words[1].className).toContain('bg-[#4a3a22]');
    expect(words[2].className).not.toContain('bg-[#29445a]');
    expect(words[3].className).toContain('text-[#70757b]');
  });

  it('updates every occurrence sharing the normalized word after SOAP succeeds', () => {
    fixture.detectChanges();
    component.unit.set({
      ...unit('unit-1'),
      tokens: [word('Remember', 'remember', 'NEW'), word('remember', 'remember', 'NEW'), word('REMEMBER', 'remember', 'NEW')],
    });
    component.selectWord(component.unit()!.tokens[0], wordClick());
    component.saveStatus('KNOWN');
    expect(component.unit()!.tokens.map((token) => token.status)).toEqual(['KNOWN', 'KNOWN', 'KNOWN']);
  });

  it('emits a popover status action, shows saving, updates state and becomes interactive again', () => {
    const response=new Subject<string>(); reader.setVocabularyStatus.mockReturnValue(response);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('article button') as HTMLButtonElement).click(); fixture.detectChanges();
    const learning=Array.from(fixture.nativeElement.querySelectorAll('button[aria-pressed]') as NodeListOf<HTMLButtonElement>).find((button)=>button.textContent?.trim()==='LEARNING')!;
    learning.click(); fixture.detectChanges();
    expect(reader.setVocabularyStatus).toHaveBeenCalledWith('Hello','en','LEARNING');
    expect(component.savingStatus()).toBe(true); expect(fixture.nativeElement.textContent).toContain('Guardando...');
    response.next('<saved/>'); fixture.detectChanges();
    expect(component.savingStatus()).toBe(false); expect(component.selectedToken()?.status).toBe('LEARNING');
    expect(component.unit()?.tokens[0].status).toBe('LEARNING'); expect(fixture.nativeElement.textContent).not.toContain('Guardando...');
    expect(fixture.nativeElement.querySelector('button[aria-pressed="true"]')?.textContent.trim()).toBe('LEARNING');
  });

  it('recovers from mutation failure and clears stale popup when changing unit', () => {
    reader.setVocabularyStatus.mockReturnValueOnce(throwError(()=>new Error('SOAP'))).mockReturnValueOnce(of('<saved/>'));
    fixture.detectChanges(); component.selectWord(component.unit()!.tokens[0],wordClick());
    component.saveStatus('KNOWN'); fixture.detectChanges();
    expect(component.savingStatus()).toBe(false); expect(component.statusError()).toContain('No pudimos actualizar');
    component.saveStatus('IGNORED'); expect(component.selectedToken()?.status).toBe('IGNORED');
    component.navigateTo('unit-2');
    expect(component.selectedToken()).toBeNull(); expect(component.popoverPosition()).toBeNull();
  });

  it('refreshes progress after a 409 conflict', () => {
    documents['updateProgress'].mockReturnValue(throwError(() => new HttpErrorResponse({status:409})));
    documents['getProgress'].mockReturnValueOnce(of(progress())).mockReturnValueOnce(of({...progress(),status:'IN_PROGRESS',currentUnitId:'server-unit',version:4}));
    fixture.detectChanges(); expect(documents['getProgress']).toHaveBeenCalledTimes(2); expect(component.progress()?.version).toBe(4); expect(component.unit()?.unitId).toBe('unit-1');
  });

  it('scrolls after successful next and previous navigation and preserves progress updates', () => {
    fixture.detectChanges();
    const scroll=vi.spyOn(component,'scrollReaderToTopAfterRender');
    component.navigateTo('unit-2');
    expect(component.unit()?.unitId).toBe('unit-2'); expect(scroll).toHaveBeenCalledOnce();
    expect(documents['updateProgress']).toHaveBeenLastCalledWith('doc',expect.objectContaining({currentUnitId:'unit-2',completed:false}));
    component.navigateTo('unit-1');
    expect(component.unit()?.unitId).toBe('unit-1'); expect(scroll).toHaveBeenCalledTimes(2);
    expect(documents['updateProgress']).toHaveBeenLastCalledWith('doc',expect.objectContaining({currentUnitId:'unit-1',completed:false}));
  });

  it.each(['unit-2','unit-previous'])('does not scroll when navigation to %s fails', (target) => {
    fixture.detectChanges();
    const scroll=vi.spyOn(component,'scrollReaderToTopAfterRender');
    documents['getUnit'].mockReturnValueOnce(throwError(()=>new Error('REST')));
    component.navigateTo(target);
    expect(scroll).not.toHaveBeenCalled(); expect(component.unit()?.unitId).toBe('unit-1');
  });

  it('does not scroll for lookup or vocabulary status changes', () => {
    fixture.detectChanges();
    const scroll=vi.spyOn(component,'scrollReaderToTopAfterRender');
    component.selectWord(component.unit()!.tokens[0],wordClick());
    component.saveStatus('KNOWN');
    expect(scroll).not.toHaveBeenCalled();
  });

  it('shows a flat EPUB table of contents, highlights by sectionId and hides empty sections', () => {
    documents['getStructure'].mockReturnValue(of(structure([
      section('act-1',1,'Act I','unit-1',2),
      section('scene-1',2,'Scene I','unit-3',2),
      section('empty',3,'id-idp123',null,0),
    ])));
    documents['getUnit'].mockImplementation((_documentId:string,unitId:string) => of({ ...unit(unitId),sectionId:'act-1',sectionTitle:'Act I' }));
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.document-toc-trigger') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    trigger.click(); fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.document-toc-list button') as NodeListOf<HTMLButtonElement>;
    expect(Array.from(items).map((item) => item.textContent?.replace(/\s+/g,'').trim())).toEqual(['ActI2partesActual','SceneI2partes']);
    expect(items[0].getAttribute('aria-current')).toBe('location');
    expect(fixture.nativeElement.textContent).not.toContain('id-idp123');
  });

  it('hides Contenido for zero or one navigable section', () => {
    documents['getStructure'].mockReturnValue(of(structure([
      section('only',1,'Only section','unit-1',2),
      section('empty',2,null,null,0),
    ])));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.document-toc-trigger')).toBeFalsy();
  });

  it('shows singular/plural part metadata in the TOC and local progress below the section title', () => {
    documents['getStructure'].mockReturnValue(of(structure([
      section('one',1,'Opening','unit-1',1), section('two',2,'Long chapter','unit-2',5),
    ])));
    fixture.detectChanges(); component.openToc(); fixture.detectChanges();
    const text = fixture.nativeElement.textContent.replace(/\s+/g,'');
    expect(text).toContain('Opening1parte');
    expect(text).toContain('Longchapter5partes');
    expect(text).toContain('Chapter1');
    expect(text).toContain('Parte1de2');

    component.unit.set({ ...unit('unit-2'),sectionUnitOrdinal:2,sectionUnitCount:5,sectionTitle:'Long chapter' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Parte 2 de 5');
  });

  it('scrolls only the current TOC item into view after the drawer renders', async () => {
    documents['getStructure'].mockReturnValue(of(structure([
      section('one',1,'One','unit-1',1), section('section',2,'Current','unit-2',2), section('three',3,'Three','unit-4',1),
    ])));
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const readerScroll = vi.spyOn(component,'scrollReaderToTopAfterRender');
    fixture.detectChanges();
    readerScroll.mockClear();
    component.openToc(); fixture.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const current = fixture.nativeElement.querySelector('[data-section-id="section"]') as HTMLElement;
    expect(current.scrollIntoView).toHaveBeenCalledWith({behavior:'auto',block:'center'});
    expect(readerScroll).not.toHaveBeenCalled();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('uses safe PDF and EPUB labels without exposing technical identifiers', () => {
    documents['getDocument'].mockReturnValue(of({ ...document(),format:'PDF' }));
    documents['getStructure'].mockReturnValue(of(structure([
      section('id-idp-page-1',1,null,'unit-1',1),
      section('id-idp-page-2',2,null,'unit-2',1),
    ])));
    fixture.detectChanges(); component.openToc(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Página 1');
    expect(fixture.nativeElement.textContent).toContain('Página 2');
    expect(fixture.nativeElement.textContent).not.toContain('id-idp');

    component.document.update((current) => current ? { ...current,format:'EPUB' } : current);
    expect(component.sectionLabel(section('htmltoc',4,null,'unit-4',1))).toBe('Sección 4');
  });

  it('opens and closes the panel by trigger, backdrop and Escape while restoring focus', () => {
    documents['getStructure'].mockReturnValue(of(structure([
      section('one',1,'One','unit-1',1), section('two',2,'Two','unit-2',1),
    ])));
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('.document-toc-trigger') as HTMLButtonElement;
    trigger.click(); fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(globalThis.document.body.style.overflow).toBe('hidden');
    expect(narration.stop).not.toHaveBeenCalled();

    (fixture.nativeElement.querySelector('.document-toc-backdrop') as HTMLElement).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#document-toc')).toBeFalsy();

    trigger.click(); fixture.detectChanges();
    globalThis.document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#document-toc')).toBeFalsy();
    expect(globalThis.document.activeElement).toBe(trigger);
    expect(globalThis.document.body.style.overflow).toBe('');
  });

  it('jumps to firstUnitId, closes popup and TOC, saves progress and scrolls', () => {
    const sections = [section('one',1,'One','unit-1',1),section('two',2,'Two','unit-3',2)];
    documents['getStructure'].mockReturnValue(of(structure(sections)));
    documents['getUnit'].mockImplementation((_documentId:string,unitId:string) => of({
      ...unit(unitId),sectionId:unitId === 'unit-3' ? 'two' : 'one',sectionTitle:unitId === 'unit-3' ? 'Two' : 'One',
    }));
    fixture.detectChanges();
    const scroll = vi.spyOn(component,'scrollReaderToTopAfterRender');
    component.selectWord(component.unit()!.tokens[0],wordClick());
    component.openToc(); component.navigateToSection(sections[1]); fixture.detectChanges();

    expect(documents['getUnit']).toHaveBeenLastCalledWith('doc','unit-3');
    expect(component.unit()?.unitId).toBe('unit-3');
    expect(component.selectedToken()).toBeNull();
    expect(component.tocOpen()).toBe(false);
    expect(documents['updateProgress']).toHaveBeenLastCalledWith('doc',{currentUnitId:'unit-3',completed:false,expectedVersion:1});
    expect(scroll).toHaveBeenCalledOnce();
  });

  it('keeps the current unit and progress unchanged when a section unit fails to load', () => {
    const sections = [section('one',1,'One','unit-1',1),section('two',2,'Two','missing',1)];
    documents['getStructure'].mockReturnValue(of(structure(sections)));
    fixture.detectChanges();
    const previous = component.unit();
    const progressCalls = documents['updateProgress'].mock.calls.length;
    const scroll = vi.spyOn(component,'scrollReaderToTopAfterRender');
    documents['getUnit'].mockReturnValueOnce(throwError(()=>new Error('REST')));
    component.openToc(); component.navigateToSection(sections[1]); fixture.detectChanges();

    expect(component.unit()).toBe(previous);
    expect(documents['updateProgress']).toHaveBeenCalledTimes(progressCalls);
    expect(scroll).not.toHaveBeenCalled();
    expect(component.progressError()).toContain('No pudimos abrir');
    expect(component.loadingUnit()).toBe(false);
  });

  it('uses existing 409 reconciliation and sequential navigation after a TOC jump', () => {
    const sections = [section('one',1,'One','unit-1',1),section('two',2,'Two','unit-2',1)];
    documents['getStructure'].mockReturnValue(of(structure(sections)));
    documents['updateProgress'].mockReturnValue(throwError(()=>new HttpErrorResponse({status:409})));
    documents['getProgress'].mockReturnValueOnce(of(progress())).mockReturnValueOnce(of({...progress(),currentUnitId:'unit-2',version:7,status:'IN_PROGRESS'}));
    fixture.detectChanges();
    component.navigateToSection(sections[1]);
    expect(documents['getProgress']).toHaveBeenCalledTimes(2);
    expect(component.progress()?.version).toBe(7);
    component.navigateTo(component.unit()?.previousUnitId ?? null);
    expect(documents['getUnit']).toHaveBeenLastCalledWith('doc','unit-1');
  });

  function document() { return {documentId:'doc',title:'Book',author:null,language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:false,coverUrl:null,progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07'}; }
  function progress() { return {documentId:'doc',status:'NOT_STARTED',currentUnitId:null,version:0,startedAt:null,completedAt:null}; }
  function structure(sections: ReturnType<typeof section>[]) { return {documentId:'doc',firstUnitId:'unit-1',sections,totalUnits:sections.reduce((sum,item)=>sum+item.unitCount,0)}; }
  function section(id:string,ordinal:number,title:string|null,firstUnitId:string|null,unitCount:number) { return {id,ordinal,title,firstUnitId,unitCount}; }
  function unit(unitId:string) { return {documentId:'doc',sectionId:'section',sectionTitle:'Chapter 1',sectionOrdinal:1,totalSections:1,unitId,sectionUnitOrdinal:unitId==='unit-1'?1:2,sectionUnitCount:2,globalOrdinal:unitId==='unit-1'?1:2,totalUnits:2,tokens:[{value:'Hello',normalizedValue:'hello',type:'WORD' as const,status:null}],previousUnitId:unitId==='unit-1'?null:'unit-1',nextUnitId:unitId==='unit-1'?'unit-2':null,progressStatus:'IN_PROGRESS' as const}; }
  function word(value:string,normalizedValue:string,status:'NEW'|'LEARNING'|'KNOWN'|'IGNORED') { return {value,normalizedValue,type:'WORD' as const,status}; }
  function wordClick(): MouseEvent { const element=globalThis.document.createElement('button'); element.getBoundingClientRect=()=>({left:100,right:160,top:200,bottom:230,width:60,height:30} as DOMRect); return {stopPropagation:vi.fn(),currentTarget:element} as unknown as MouseEvent; }
});
