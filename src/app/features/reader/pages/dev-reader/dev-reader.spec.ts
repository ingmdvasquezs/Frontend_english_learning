import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LibraryService } from '../../../library/services/library';
import { ReaderService } from '../../services/reader';
import { DevReader } from './dev-reader';

describe('DevReader', () => {
  let component: DevReader;
  let fixture: ComponentFixture<DevReader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DevReader],
      providers: [
        { provide: LibraryService, useValue: {} },
        { provide: ReaderService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DevReader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
