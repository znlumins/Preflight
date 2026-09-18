import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encryption for user-supplied API keys.
 *
 * A key someone pastes in is a live credential against their own Google or Groq
 * account. It is stored encrypted at rest, decrypted only inside a request that
 * is about to spend it, and never sent back to the browser in any form — the UI
 * gets four characters so a person can recognise which key is saved, and
 * nothing more.
 *
 * AES-256-GCM: the auth tag makes tampering a decryption failure rather than a
 * silent wrong answer.
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function secret(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY is missing or too short. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  // Hashing accepts any passphrase length while always yielding 32 bytes.
  return createHash('sha256').update(raw).digest();
}

/** Packs iv + ciphertext + tag into one base64 string. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, secret(), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64');
}

export function decrypt(packed: string): string {
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const body = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);

  const decipher = createDecipheriv(ALGO, secret(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** The only part of a key that is ever allowed back to the browser. */
export function hintOf(apiKey: string): string {
  return apiKey.trim().slice(-4);
}
