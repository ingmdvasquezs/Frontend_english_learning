import { Component, input, output } from '@angular/core';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { DictionaryWord } from '../../../../shared/services/dictionary';
import { ReaderToken } from '../../models/reader.models';

export interface ReaderPopoverPosition {
  x: number;
  y: number;
  openAbove: boolean;
  anchorTop: number;
  anchorBottom: number;
}

@Component({
  selector: 'app-reader-word-popover',
  templateUrl: './reader-word-popover.html',
  styleUrl: './reader-word-popover.css',
})
export class ReaderWordPopover {
  readonly token = input.required<ReaderToken>();
  readonly position = input.required<ReaderPopoverPosition>();
  readonly word = input<DictionaryWord | null>(null);
  readonly lookupLoading = input(false);
  readonly lookupUnavailable = input(false);
  readonly savingStatus = input(false);
  readonly statusError = input<string | null>(null);
  readonly audioError = input<string | null>(null);
  readonly definitionsOpen = input(false);
  readonly selectedStatus = input<VocabularyStatus | null>(null);
  readonly statuses = input.required<readonly VocabularyStatus[]>();

  readonly closed = output<void>();
  readonly audioPlayed = output<string>();
  readonly definitionsToggled = output<MouseEvent>();
  readonly statusSelected = output<VocabularyStatus>();

  getStatusLabel(status: VocabularyStatus): string {
    const labels: Record<VocabularyStatus, string> = {
      KNOWN: 'I KNOW IT',
      LEARNING: 'I WANT TO LEARN IT',
      NEW: 'NEW TO ME',
      IGNORED: 'NOT INTERESTED',
    };
    return labels[status] ?? status;
  }
}
