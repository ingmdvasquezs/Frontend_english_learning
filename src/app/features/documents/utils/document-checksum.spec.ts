import { describe, it, expect } from 'vitest';
import { calculateFileSha256 } from './document-checksum';

describe('document-checksum (calculateFileSha256)', () => {
  // F01: SHA-256 correcto
  it('F01: calculates correct SHA-256 digest for known content', async () => {
    // "hello world" -> b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    const hash = await calculateFileSha256(file);
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');

    // empty file -> e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
    const emptyHash = await calculateFileSha256(emptyFile);
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  // F02: SHA-256 64-char lowercase
  it('F02: returns exactly a 64-character lowercase hexadecimal string', async () => {
    const file = new File(['The quick brown fox jumps over the lazy dog'], 'fox.txt');
    const hash = await calculateFileSha256(file);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hash.toLowerCase());
  });
});
