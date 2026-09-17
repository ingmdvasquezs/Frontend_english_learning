import { VocabularyFitTone } from '../../../../shared/utils/reading-metrics';

export type LibraryContentType = 'USER' | 'EPUB' | 'PDF' | 'PLATFORM';

export interface LibraryCardItem {
  id: string;
  type: LibraryContentType;
  title: string;
  subtitle?: string | null;
  badge: string;
  isPlatformLevel?: boolean;
  category?: string | null;
  coverUrl?: string | null;
  coverFitMode?: 'cover' | 'contain';
  coverFallbackUrl?: string | null;
  coverAlt: string;
  routerLink: any[] | string | null;
  isUnavailable?: boolean;
  unavailableLabel?: string | null;
  vocabularyFitPercentage?: number | null;
  vocabularyFitTone?: VocabularyFitTone;
  progressStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | null;
  progressPercentage?: number | null;
  statusLabel: string;
  ctaLabel?: string | null;
  actionKey?: string | null;
  canDelete?: boolean;
}
