/**
 * Calculates SHA-256 checksum of a File using Web Crypto API (crypto.subtle.digest).
 * Returns a 64-character lowercase hexadecimal string.
 *
 * For the project's ~50 MiB limit, this processes the full ArrayBuffer in memory
 * without requiring external heavy cryptographic libraries.
 */
export async function calculateFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}
