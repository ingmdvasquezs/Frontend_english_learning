import { PreparedReviewEntry, PreparedReviewSession } from '../models/vocabulary.models';
import { buildReviewQueues } from './review-queue-builder';

describe('review-queue-builder', () => {
  const createEntry = (
    wordId: string,
    word: string,
    pendingQueueSequence: number | null = null,
    baseOrder: number | null = null,
    extra: Partial<PreparedReviewEntry> = {}
  ): PreparedReviewEntry => ({
    wordId,
    word,
    language: 'en',
    status: 'LEARNING',
    srsState: 'LEARNING',
    pendingQueueSequence,
    baseOrder,
    ...extra,
  });

  // Section 30.A: entries C seq3 due + learnAhead B seq2 future => first pending card B
  it('A: orders pending cards by pendingQueueSequence ASC across entries and learnAheadEntries', () => {
    const session: PreparedReviewSession = {
      dueCount: 1,
      totalReviewableCount: 2,
      entries: [createEntry('w-c', 'C', 3, null)], // C is in entries, seq=3
      learnAheadEntries: [createEntry('w-b', 'B', 2, null)], // B is in learnAhead, seq=2
    };

    const result = buildReviewQueues(session);

    expect(result.baseQueue.length).toBe(0);
    expect(result.pendingQueue.length).toBe(2);
    expect(result.pendingQueue[0].word).toBe('B');
    expect(result.pendingQueue[1].word).toBe('C');
  });

  // Section 30.B: B seq2, C seq3, A seq4 => B, C, A
  it('B: preserves FIFO order [B, C, A] from pendingQueueSequence [2, 3, 4]', () => {
    const session: PreparedReviewSession = {
      dueCount: 0,
      totalReviewableCount: 3,
      entries: [
        createEntry('w-a', 'A', 4, null),
        createEntry('w-c', 'C', 3, null),
        createEntry('w-b', 'B', 2, null),
      ],
    };

    const result = buildReviewQueues(session);

    expect(result.pendingQueue.map((e) => e.word)).toEqual(['B', 'C', 'A']);
  });

  // Section 30.E: baseOrder controls unintroduced base cards
  it('E: separates base cards by baseOrder ASC into baseQueue', () => {
    const session: PreparedReviewSession = {
      dueCount: 3,
      totalReviewableCount: 3,
      entries: [
        createEntry('w-2', 'second-base', null, 2),
        createEntry('w-1', 'first-base', null, 1),
        createEntry('w-3', 'third-base', null, 3),
      ],
    };

    const result = buildReviewQueues(session);

    expect(result.baseQueue.map((e) => e.word)).toEqual([
      'first-base',
      'second-base',
      'third-base',
    ]);
    expect(result.pendingQueue.length).toBe(0);
  });

  // Section 5: Deduplicates by wordId, keeping richer metadata
  it('deduplicates duplicate wordId across entries and learnAheadEntries preferring richer metadata', () => {
    const duplicateInEntries = createEntry('w-dup', 'dupe', null, null); // bare
    const duplicateInLearnAhead = createEntry('w-dup', 'dupe', 5, null, {
      nextReviewAt: '2026-09-19T18:40:00Z',
      ratingOptions: [{ rating: 'AGAIN', intervalSeconds: 600 }],
    }); // rich

    const session: PreparedReviewSession = {
      dueCount: 1,
      totalReviewableCount: 1,
      entries: [duplicateInEntries],
      learnAheadEntries: [duplicateInLearnAhead],
    };

    const result = buildReviewQueues(session);

    expect(result.baseQueue.length).toBe(0);
    expect(result.pendingQueue.length).toBe(1);
    expect(result.pendingQueue[0].pendingQueueSequence).toBe(5);
    expect(result.pendingQueue[0].ratingOptions?.length).toBe(1);
  });
});
