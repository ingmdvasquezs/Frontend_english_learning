import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AliasAlreadyInUseError, UpdateUserProfile, UserProfile } from '../../models/profile.models';
import { ProfileService } from '../../services/profile';

@Component({ selector: 'app-profile', imports: [], templateUrl: './profile.html', styleUrl: './profile.css' })
export class Profile implements OnInit {
  readonly profileService = inject(ProfileService);
  readonly name = signal('');
  readonly alias = signal('');
  readonly age = signal('');
  readonly nativeLanguage = signal('');
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  private populatedProfile: UserProfile | null = null;

  readonly initials = computed(() => this.makeInitials(this.name() || this.profileService.profile()?.name || ''));
  readonly nameError = computed(() => {
    const value = this.name().trim();
    return !value ? 'El nombre es obligatorio.' : value.length > 100 ? 'El nombre no puede superar 100 caracteres.' : null;
  });
  readonly aliasError = computed(() => this.alias().length > 50 ? 'El alias no puede superar 50 caracteres.' : null);
  readonly ageError = computed(() => {
    if (!this.age().trim()) return null;
    const value = Number(this.age());
    return !Number.isInteger(value) || value < 5 || value > 120 ? 'La edad debe estar entre 5 y 120.' : null;
  });
  readonly changed = computed(() => {
    const profile = this.profileService.profile();
    if (!profile) return false;
    const update = this.normalizedUpdate(profile.learningLanguage);
    return update.name !== profile.name || update.alias !== profile.alias || update.age !== profile.age || update.nativeLanguage !== profile.nativeLanguage;
  });
  readonly valid = computed(() => !this.nameError() && !this.aliasError() && !this.ageError());

  constructor() {
    effect(() => {
      const profile = this.profileService.profile();
      if (profile && profile !== this.populatedProfile) {
        this.populate(profile);
        this.populatedProfile = profile;
      }
    });
  }

  ngOnInit(): void { this.profileService.loadProfile(); }
  retry(): void { this.profileService.loadProfile(true); }

  save(): void {
    const profile = this.profileService.profile();
    if (!profile || !this.valid() || !this.changed() || this.saving()) return;
    const update = this.normalizedUpdate(profile.learningLanguage);
    this.saving.set(true); this.saveError.set(null); this.success.set(null);
    this.profileService.updateMyProfile(update).subscribe({
      next: () => { this.saving.set(false); this.success.set('Perfil actualizado'); },
      error: (error) => {
        this.saving.set(false);
        this.saveError.set(error instanceof AliasAlreadyInUseError ? 'Este alias ya está en uso.' : 'No pudimos actualizar tu perfil. Inténtalo de nuevo.');
      },
    });
  }

  onInput(field: 'name' | 'alias' | 'age' | 'nativeLanguage', event: Event): void {
    this[field].set((event.target as HTMLInputElement).value);
    this.success.set(null); this.saveError.set(null);
  }

  private normalizedUpdate(learningLanguage: string): UpdateUserProfile {
    const alias = this.alias().trim();
    const age = this.age().trim();
    const nativeLanguage = this.nativeLanguage().trim();
    return { name: this.name().trim(), alias: alias || null, age: age ? Number(age) : null, nativeLanguage: nativeLanguage || null, learningLanguage };
  }

  private populate(profile: UserProfile): void {
    this.name.set(profile.name); this.alias.set(profile.alias ?? ''); this.age.set(profile.age?.toString() ?? ''); this.nativeLanguage.set(profile.nativeLanguage ?? '');
  }

  private makeInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return words.length ? `${words[0][0]}${words.length > 1 ? words.at(-1)![0] : ''}`.toUpperCase() : '?';
  }
}
