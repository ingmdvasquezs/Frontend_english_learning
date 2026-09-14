import { Component, computed, signal } from '@angular/core';
import { COLOMBIA_EDITORIAL_PREVIEW, ColombiaEditorialUniverse, EditorialStoryPreview } from '../../data/colombia-editorial-preview.data';
import { coverUrl } from '../../utils/cover-url';

@Component({
  selector: 'app-editorial-universe',
  templateUrl: './editorial-universe.html',
  styleUrl: './editorial-universe.css',
})
export class EditorialUniverse {
  readonly universe: ColombiaEditorialUniverse = COLOMBIA_EDITORIAL_PREVIEW;
  readonly selectedTopicId = signal<string>('myths');
  readonly previewNotice = signal<string | null>(null);

  readonly filteredStories = computed<EditorialStoryPreview[]>(() => {
    const topic = this.selectedTopicId();
    if (!topic) return this.universe.stories;
    const matched = this.universe.stories.filter((s) => s.topicId === topic);
    return matched.length ? matched : this.universe.stories;
  });

  selectTopic(topicId: string): void {
    this.selectedTopicId.set(topicId);
  }

  coverUrl(key?: string | null): string | null {
    return coverUrl(key);
  }

  onStoryClick(story: EditorialStoryPreview): void {
    this.previewNotice.set(`"${story.title}" formará parte del próximo catálogo editorial.`);
    setTimeout(() => {
      if (this.previewNotice()?.includes(story.title)) {
        this.previewNotice.set(null);
      }
    }, 3500);
  }

  dismissNotice(): void {
    this.previewNotice.set(null);
  }

  onExploreColombia(): void {
    this.previewNotice.set('La colección completa de Colombia formará parte del próximo catálogo editorial.');
    setTimeout(() => {
      if (this.previewNotice()?.includes('colección completa')) {
        this.previewNotice.set(null);
      }
    }, 3500);
  }
}
