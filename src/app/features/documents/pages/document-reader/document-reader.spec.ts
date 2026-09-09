import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DictionaryService } from '../../../../shared/services/dictionary';
import { ReaderService } from '../../../reader/services/reader';
import { DocumentService } from '../../services/document';
import { DocumentReader } from './document-reader';

describe('DocumentReader', () => {
  let fixture: ComponentFixture<DocumentReader>; let component: DocumentReader;
  let documents: Record<string, ReturnType<typeof vi.fn>>; let reader: { setVocabularyStatus: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    documents = {
      getDocument:vi.fn(() => of(document())), getProgress:vi.fn(() => of(progress())),
      getStructure:vi.fn(() => of({ documentId:'doc',firstUnitId:'unit-1',sections:[],totalUnits:2 })),
      getUnit:vi.fn((_documentId:string,unitId:string) => of(unit(unitId))), updateProgress:vi.fn((_documentId:string,request:{currentUnitId:string}) => of({ ...progress(),status:'IN_PROGRESS',currentUnitId:request.currentUnitId,version:1 })),
    };
    reader = { setVocabularyStatus:vi.fn(() => of('<ok/>')) };
    await TestBed.configureTestingModule({ imports:[DocumentReader],providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{paramMap:{get:()=> 'doc'}}}},{provide:DocumentService,useValue:documents},{provide:ReaderService,useValue:reader},{provide:DictionaryService,useValue:{lookupWord:vi.fn(() => of('<xml/>')),parseLookupWordResponse:vi.fn(() => ({word:'hello',normalizedWord:'hello',translation:'hola',phonetic:null,audioUrl:null,meanings:[]}))}}] }).compileComponents();
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

  it('fails safely when firstUnitId is null', () => {
    documents['getStructure'].mockReturnValue(of({documentId:'doc',firstUnitId:null,sections:[],totalUnits:0}));
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('No pudimos encontrar contenido'); expect(documents['getUnit']).not.toHaveBeenCalled();
  });

  it('resumes IN_PROGRESS from currentUnitId without loading structure', () => {
    documents['getProgress'].mockReturnValue(of({...progress(),status:'IN_PROGRESS',currentUnitId:'unit-2',version:3}));
    fixture.detectChanges(); expect(documents['getUnit']).toHaveBeenCalledWith('doc','unit-2'); expect(documents['getStructure']).not.toHaveBeenCalled();
  });

  it('resumes COMPLETED from currentUnitId and keeps completion visible', () => {
    documents['getProgress'].mockReturnValue(of({...progress(),status:'COMPLETED',currentUnitId:'unit-2',version:4}));
    fixture.detectChanges(); expect(documents['getUnit']).toHaveBeenCalledWith('doc','unit-2'); expect(documents['getStructure']).not.toHaveBeenCalled();
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

  function document() { return {documentId:'doc',title:'Book',author:null,language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:false,coverUrl:null,progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07'}; }
  function progress() { return {documentId:'doc',status:'NOT_STARTED',currentUnitId:null,version:0,startedAt:null,completedAt:null}; }
  function unit(unitId:string) { return {documentId:'doc',sectionId:'section',sectionTitle:'Chapter 1',sectionOrdinal:1,totalSections:1,unitId,sectionUnitOrdinal:unitId==='unit-1'?1:2,sectionUnitCount:2,globalOrdinal:unitId==='unit-1'?1:2,totalUnits:2,tokens:[{value:'Hello',normalizedValue:'hello',type:'WORD' as const,status:null}],previousUnitId:unitId==='unit-1'?null:'unit-1',nextUnitId:unitId==='unit-1'?'unit-2':null,progressStatus:'IN_PROGRESS' as const}; }
  function word(value:string,normalizedValue:string,status:'NEW'|'LEARNING'|'KNOWN'|'IGNORED') { return {value,normalizedValue,type:'WORD' as const,status}; }
  function wordClick(): MouseEvent { const element=globalThis.document.createElement('button'); element.getBoundingClientRect=()=>({left:100,right:160,top:200,bottom:230,width:60,height:30} as DOMRect); return {stopPropagation:vi.fn(),currentTarget:element} as unknown as MouseEvent; }
});
