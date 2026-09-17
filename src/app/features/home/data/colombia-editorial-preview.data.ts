/**
 * Configuración editorial del universo temático.
 * Diseñado para ser genérico y reutilizable para cualquier país o región.
 */

export interface EditorialTopic {
  id: string;
  name: string;
  icon?: string;
  collectionKey?: string;
}

export interface EditorialStoryPreview {
  id: string;
  title: string;
  topicId: string;
  topicName: string;
  editorialLevel: 'A1' | 'A2' | 'B1' | 'B2';
  summary: string;
  coverKey?: string | null;
  statusBadge: string;
}

export interface EditorialHeroImage {
  src: string;
  location?: string;
  alt?: string;
}

export interface EditorialUniverseData {
  key: string;
  name: string;
  subtitle: string;
  tagline: string;
  quote: string;
  topics: EditorialTopic[];
  stories?: EditorialStoryPreview[];
  heroImages?: EditorialHeroImage[];
}

export type ColombiaEditorialUniverse = EditorialUniverseData;

export const COLOMBIA_EDITORIAL_PREVIEW: EditorialUniverseData = {
  key: 'colombia',
  name: 'Colombia',
  subtitle: 'Personas extraordinarias. Lugares inolvidables. Historias que trascienden el tiempo.',
  tagline: 'Historias, lugares, mitos y tradiciones para aprender inglés leyendo.',
  quote: 'Muchas historias. Un lugar increíble.',
  heroImages: [
    {
      src: '/assets/editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp',
      location: 'Villa de Leyva, Boyacá',
      alt: 'Villa de Leyva, Boyacá',
    },
    {
      src: '/assets/editorial/heroes/colombia/hero-colombia-valle-de-cocora.webp',
      location: 'Valle de Cocora, Quindío',
      alt: 'Valle de Cocora, Quindío',
    },
  ],
  topics: [
    { id: 'myths', name: 'Mitos y leyendas', icon: '🌙', collectionKey: 'colombian-myths-legends' },
    { id: 'real-stories', name: 'Historias reales', icon: '👥' },
    { id: 'history', name: 'Historia y memoria', icon: '🏛️' },
    { id: 'culture', name: 'Cultura y tradiciones', icon: '👒' },
    { id: 'nature', name: 'Naturaleza y lugares', icon: '⛰️' },
  ],
};
