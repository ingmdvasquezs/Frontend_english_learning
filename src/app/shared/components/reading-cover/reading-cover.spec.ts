import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReadingCover } from './reading-cover';

describe('ReadingCover', () => {
  let fixture: ComponentFixture<ReadingCover>;
  let component: ReadingCover;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadingCover],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadingCover);
    component = fixture.componentInstance;
  });

  it('renders an image when a valid coverKey is provided', () => {
    fixture.componentRef.setInput('coverKey', 'el-dorado');
    fixture.componentRef.setInput('title', 'El Dorado');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/assets/reading-covers/el-dorado.webp');
    expect(img.getAttribute('alt')).toBe('Portada de El Dorado');
    expect(fixture.nativeElement.querySelector('.cover-fallback')).toBeNull();
  });

  it('renders elegant fallback when coverKey is null or undefined', () => {
    fixture.componentRef.setInput('coverKey', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    const fallback = fixture.nativeElement.querySelector('.cover-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain('ERP');
  });

  it('switches to fallback when image load fails (HTTP 404 error)', () => {
    fixture.componentRef.setInput('coverKey', 'non-existent-cover');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    const fallback = fixture.nativeElement.querySelector('.cover-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain('ERP');
  });

  it('resolves user text cover when origin is USER', () => {
    fixture.componentRef.setInput('origin', 'USER');
    fixture.componentRef.setInput('readingId', 'user-reading-123');
    fixture.componentRef.setInput('title', 'Mi texto');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('/assets/reading-covers/user-text/');
  });
});
