/**
 * TEMPORARY VISUAL PREVIEW.
 * Replace with backend editorial collections when available.
 *
 * Este dataset es una previsualización de frontend para maquetar el universo
 * temático de Colombia y sus historias culturales. No debe introducirse
 * en flujos de backend, recomendaciones ni progreso.
 */

export interface EditorialTopic {
  id: string;
  name: string;
  icon?: string;
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

export interface ColombiaEditorialUniverse {
  key: string;
  name: string;
  subtitle: string;
  tagline: string;
  quote: string;
  topics: EditorialTopic[];
  stories: EditorialStoryPreview[];
}

export const COLOMBIA_EDITORIAL_PREVIEW: ColombiaEditorialUniverse = {
  key: 'colombia',
  name: 'Colombia',
  subtitle: 'Personas extraordinarias. Lugares inolvidables. Historias que trascienden el tiempo.',
  tagline: 'Historias, lugares, mitos y tradiciones para aprender inglés leyendo.',
  quote: 'Muchas historias. Un lugar increíble.',
  topics: [
    { id: 'myths', name: 'Mitos y leyendas', icon: '🌙' },
    { id: 'real-stories', name: 'Historias reales', icon: '👥' },
    { id: 'history', name: 'Historia y memoria', icon: '🏛️' },
    { id: 'culture', name: 'Cultura y tradiciones', icon: '👒' },
    { id: 'nature', name: 'Naturaleza y lugares', icon: '⛰️' },
  ],
  stories: [
    {
      id: 'col-story-1',
      title: 'The Legend of La Llorona',
      topicId: 'myths',
      topicName: 'Mitos y leyendas',
      editorialLevel: 'A2',
      summary: 'A mother, a river, and an unforgettable story passed down through generations.',
      coverKey: 'the-grammar-of-tides',
      statusBadge: 'Próximamente',
    },
    {
      id: 'col-story-2',
      title: 'The Mohán by the River',
      topicId: 'myths',
      topicName: 'Mitos y leyendas',
      editorialLevel: 'A2',
      summary: 'A mysterious figure, a flowing river, and a quiet warning from the water.',
      coverKey: 'a-boat-for-the-little-island',
      statusBadge: 'Próximamente',
    },
    {
      id: 'col-story-3',
      title: 'The Patasola in the Forest',
      topicId: 'myths',
      topicName: 'Mitos y leyendas',
      editorialLevel: 'B1',
      summary: 'Beauty, danger, and a deep shadow moving between the mountain trees.',
      coverKey: 'the-garden-behind-the-school',
      statusBadge: 'Próximamente',
    },
    {
      id: 'col-story-4',
      title: 'The Sombrerón at Night',
      topicId: 'myths',
      topicName: 'Mitos y leyendas',
      editorialLevel: 'A2',
      summary: 'A small man, a wide hat, and a nighttime lesson no traveler ever forgot.',
      coverKey: 'the-camera-on-platform-three',
      statusBadge: 'Próximamente',
    },
  ],
};
