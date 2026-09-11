import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../auth/services/auth';
import { authInterceptor } from '../../auth/interceptors/auth.interceptor';
import { ProfileService } from './profile';

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers:[ProfileService,provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting(),{provide:Auth,useValue:{accessToken:()=> 'jwt', logout: () => undefined}}] });
    service=TestBed.inject(ProfileService); http=TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends authenticated getMyProfile without userId', () => {
    service.getMyProfile().subscribe();
    const request=http.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    expect(request.request.body).toContain('<read:getMyProfileRequest/>');
    expect(request.request.body).not.toContain('userId');
    request.flush('<response/>');
  });

  it('parses complete and optional profile fields', () => {
    expect(service.parseProfile(profileXml('<read:alias>AdaPublic</read:alias><read:age>37</read:age><read:nativeLanguage>es-CO</read:nativeLanguage>'))).toEqual({name:'Ada',alias:'AdaPublic',age:37,nativeLanguage:'es-CO',learningLanguage:'en',email:'ada@example.com'});
    expect(service.parseProfile(profileXml(''))).toEqual({name:'Ada',alias:null,age:null,nativeLanguage:null,learningLanguage:'en',email:'ada@example.com'});
  });

  it('serializes all nullable values with xsi:nil and excludes email/userId', () => {
    service.updateMyProfile({name:'Ada & Co',alias:null,age:null,nativeLanguage:null,learningLanguage:'en'}).subscribe();
    const request=http.expectOne('/ws'); const body=request.request.body as string;
    expect(body).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    expect(body).toContain('<read:name>Ada &amp; Co</read:name>');
    expect(body).toContain('<read:alias xsi:nil="true"/>');
    expect(body).toContain('<read:age xsi:nil="true"/>');
    expect(body).toContain('<read:nativeLanguage xsi:nil="true"/>');
    expect(body).toContain('<read:learningLanguage>en</read:learningLanguage>');
    expect(body).not.toContain('email'); expect(body).not.toContain('userId');
    request.flush('<response/>');
  });

  it('serializes present update values and updates shared state', () => {
    service.profile.set(service.parseProfile(profileXml('')));
    service.updateMyProfile({name:'Ada Updated',alias:'Public',age:38,nativeLanguage:'es',learningLanguage:'en'}).subscribe();
    const request=http.expectOne('/ws');
    expect(request.request.body).toContain('<read:alias>Public</read:alias>');
    expect(request.request.body).toContain('<read:age>38</read:age>');
    request.flush('<response/>');
    expect(service.profile()?.alias).toBe('Public');
    expect(service.profile()?.email).toBe('ada@example.com');
  });

  function profileXml(optional:string):string { return `<read:getMyProfileResponse xmlns:read="http://soap.com/english-reading/readings"><read:name>Ada</read:name>${optional}<read:learningLanguage>en</read:learningLanguage><read:email>ada@example.com</read:email></read:getMyProfileResponse>`; }
});
