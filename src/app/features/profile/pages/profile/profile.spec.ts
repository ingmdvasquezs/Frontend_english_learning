import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, throwError } from 'rxjs';
import { AliasAlreadyInUseError, UserProfile } from '../../models/profile.models';
import { ProfileService } from '../../services/profile';
import { Profile } from './profile';

describe('Profile page', () => {
  let fixture: ComponentFixture<Profile>;
  let component: Profile;
  let updateResponse: Subject<string>;
  let service: any;
  const profile: UserProfile = { name:'Ada Lovelace', alias:'AdaPublic', age:37, nativeLanguage:'es-CO', learningLanguage:'en', email:'ada@example.com' };

  beforeEach(async () => {
    updateResponse=new Subject<string>();
    service={ profile:signal<UserProfile|null>(null), loading:signal(false), loadError:signal<string|null>(null), loadProfile:vi.fn(), updateMyProfile:vi.fn(()=>updateResponse.asObservable()) };
    await TestBed.configureTestingModule({imports:[Profile],providers:[{provide:ProfileService,useValue:service}]}).compileComponents();
    fixture=TestBed.createComponent(Profile); component=fixture.componentInstance;
  });

  it('loads and shows initial loading', () => {
    service.loading.set(true); fixture.detectChanges();
    expect(service.loadProfile).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Cargando perfil');
  });

  it('shows load error and retries', () => {
    service.loadError.set('failed'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar tu perfil');
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(service.loadProfile).toHaveBeenCalledWith(true);
  });

  it('renders values, initials and readonly account fields', () => {
    service.profile.set(profile); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('AL');
    expect((fixture.nativeElement.querySelector('#profile-name') as HTMLInputElement).value).toBe('Ada Lovelace');
    expect((fixture.nativeElement.querySelector('#profile-email') as HTMLInputElement).readOnly).toBe(true);
    expect((fixture.nativeElement.querySelector('#profile-learning-language') as HTMLInputElement).readOnly).toBe(true);
  });

  it('validates required name, alias length and age range', () => {
    service.profile.set(profile); fixture.detectChanges();
    component.name.set(' '); expect(component.nameError()).toContain('obligatorio');
    component.name.set('Ada'); component.alias.set('a'.repeat(51)); expect(component.aliasError()).toContain('50');
    component.alias.set('ok'); component.age.set('4'); expect(component.ageError()).toContain('5 y 120');
    component.age.set('121'); expect(component.valid()).toBe(false);
  });

  it('normalizes optional fields, submits once and shows success', () => {
    service.profile.set(profile); fixture.detectChanges();
    component.name.set(' Ada Updated '); component.alias.set(''); component.age.set(''); component.nativeLanguage.set('');
    component.save(); component.save();
    expect(service.updateMyProfile).toHaveBeenCalledOnce();
    expect(service.updateMyProfile).toHaveBeenCalledWith({name:'Ada Updated',alias:null,age:null,nativeLanguage:null,learningLanguage:'en'});
    expect(component.saving()).toBe(true);
    updateResponse.next('<response/>'); fixture.detectChanges();
    expect(component.success()).toBe('Perfil actualizado');
  });

  it('localizes duplicate alias and preserves edited form on save error', () => {
    service.updateMyProfile.mockReturnValue(throwError(() => new AliasAlreadyInUseError()));
    service.profile.set(profile); fixture.detectChanges();
    component.alias.set('Taken'); component.save(); fixture.detectChanges();
    expect(component.saveError()).toBe('Este alias ya está en uso.');
    expect(component.alias()).toBe('Taken');
    expect(component.saving()).toBe(false);
  });
});
