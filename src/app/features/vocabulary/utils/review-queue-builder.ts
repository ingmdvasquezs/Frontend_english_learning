import { PreparedReviewEntry, PreparedReviewSession } from '../models/vocabulary.models';

export interface ReviewQueuesResult {
  baseQueue: PreparedReviewEntry[];
  pendingQueue: PreparedReviewEntry[];
}

/**
 * Calculates a completeness score for review entry metadata
 * to deterministically resolve duplicate entries across arrays.
 */
function getMetadataScore(entry: PreparedReviewEntry): number {
  let score = 0;
  if (entry.pendingQueueSequence != null) score += 10;
  if (entry.ratingOptions && entry.ratingOptions.length > 0) score += 5;
  if (entry.nextReviewAt != null) score += 3;
  if (entry.baseOrder != null) score += 1;
  return score;
}

/**
 * Central pure function that builds the two distinct session queues:
 * 1. Base queue: unintroduced base cards (pendingQueueSequence == null), ordered by baseOrder ASC.
 * 2. Pending queue: active learning/relearning cards, ordered strictly FIFO by pendingQueueSequence ASC.
 *
 * It merges entries and learnAheadEntries and deduplicates by wordId.
 * SOAP array source (entries vs learnAheadEntries) NEVER determines the order of pending cards.
 */
export function buildReviewQueues(session: PreparedReviewSession): ReviewQueuesResult {
  const entries = session.entries ?? [];
  const learnAhead = session.learnAheadEntries ?? [];

  // Deduplicate by wordId, preferring the version with richer SRS metadata
  const deduplicatedMap = new Map<string, PreparedReviewEntry>();

  for (const entry of [...entries, ...learnAhead]) {
    const existing = deduplicatedMap.get(entry.wordId);
    if (!existing) {
      deduplicatedMap.set(entry.wordId, entry);
    } else {
      const existingScore = getMetadataScore(existing);
      const newScore = getMetadataScore(entry);
      if (newScore > existingScore) {
        deduplicatedMap.set(entry.wordId, entry);
      }
    }
  }

  const allItems = Array.from(deduplicatedMap.values());

  // Phase A: Base Cards (pendingQueueSequence == null)
  const baseQueue = allItems
    .filter((entry) => entry.pendingQueueSequence == null)
    .sort((a, b) => {
      const orderA = a.baseOrder ?? 999999;
      const orderB = b.baseOrder ?? 999999;
      return orderA - orderB;
    });

  // Phase B: Pending Learning (pendingQueueSequence != null)
  // Sorted EXCLUSIVELY by pendingQueueSequence ASC (FIFO)
  const pendingQueue = allItems
    .filter((entry) => entry.pendingQueueSequence != null)
    .sort((a, b) => {
      const seqA = a.pendingQueueSequence ?? 999999;
      const seqB = b.pendingQueueSequence ?? 999999;
      return seqA - seqB;
    });

  return {
    baseQueue,
    pendingQueue,
  };
}
