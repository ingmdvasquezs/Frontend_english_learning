export interface UserProfile {
  name: string;
  alias: string | null;
  age: number | null;
  nativeLanguage: string | null;
  learningLanguage: string;
  email: string;
}

export type UpdateUserProfile = Omit<UserProfile, 'email'>;

export class AliasAlreadyInUseError extends Error {}
