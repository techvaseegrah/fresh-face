// /src/lib/crypto.ts - THE FINAL, CORRECTED AND ROBUST VERSION

import { createCipheriv, createDecipheriv, createHash } from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// This helper function gets fresh keys every time it's called.
// This solves the environment variable loading issue.
function getCryptoConfig() {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string;
  const ENCRYPTION_IV = process.env.ENCRYPTION_IV as string;

  if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
    throw new Error('CRITICAL CRYPTO ERROR: ENCRYPTION_KEY or ENCRYPTION_IV is not available in the environment. Check your .env file and server configuration.');
  }

  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ENCRYPTION_IV, 'hex');
  
  if (key.length !== 32) {
      throw new Error('Invalid ENCRYPTION_KEY length. Key must be 32 bytes (64 hex characters).');
  }
  if (iv.length !== 16) {
    throw new Error('Invalid ENCRYPTION_IV length. IV must be 16 bytes (32 hex characters).');
  }

  return { key, iv };
}

/**
 * Encrypts a string using AES-256-CBC algorithm.
 */
export function encrypt(text: string): string {
  // Get fresh, guaranteed-correct keys on every encryption call.
  const { key, iv } = getCryptoConfig();
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Decrypts a string using AES-256-CBC algorithm.
 */
export function decrypt(hash: string): string {
  // Get fresh, guaranteed-correct keys on every decryption call.
  const { key, iv } = getCryptoConfig();

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(hash, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error("Decryption failed for hash:", hash, error);
    return "Decryption Error"; // Your original, helpful return on error
  }
}

/**
 * Creates a one-way SHA-256 hash for searchable fields.
 */
export function createSearchHash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}