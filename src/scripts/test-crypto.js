// FILE: test-crypto.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// Paste your EXACT keys here
const ENCRYPTION_KEY = 'c73511b12f16a35539f0952ab5b0be38506d50f728dcf7d5d3c5e617de1cd352';
const ENCRYPTION_IV = 'fd2d9345dceba34f94fc2c04e41c0ce2';

const key = Buffer.from(ENCRYPTION_KEY, 'hex');
const iv = Buffer.from(ENCRYPTION_IV, 'hex');

function encrypt(text) {
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(hash) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(hash, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- TEST ---
const originalText = "This is a secret message.";
console.log("Original Text:", originalText);

const encryptedText = encrypt(originalText);
console.log("Encrypted Text:", encryptedText);

const decryptedText = decrypt(encryptedText);
console.log("Decrypted Text:", decryptedText);

if (originalText === decryptedText) {
  console.log("\n✅ SUCCESS: Encryption and decryption work perfectly with your keys.");
} else {
  console.log("\n❌ FAILED: There is a problem with your keys or functions.");
}