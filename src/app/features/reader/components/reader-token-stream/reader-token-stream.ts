import { Component, input, output } from '@angular/core';
import { ReaderToken } from '../../models/reader.models';

export interface ReaderWordSelection {
  token: ReaderToken;
  event: MouseEvent;
}

@Component({
  selector: 'app-reader-token-stream',
  templateUrl: './reader-token-stream.html',
})
export class ReaderTokenStream {
  readonly tokens = input.required<readonly ReaderToken[]>();
  readonly wordSelected = output<ReaderWordSelection>();

  select(token: ReaderToken, event: MouseEvent): void {
    this.wordSelected.emit({ token, event });
  }
}
