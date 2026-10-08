import { describe, it, expect } from 'vitest';
import { CryptoUtils } from '../js/utils.js';

describe('CryptoUtils', () => {
  it('should encrypt and decrypt a string correctly', async () => {
    // Generate a 256-bit key for AES-GCM
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const data = JSON.stringify({ message: 'Hello World' });
    
    // Encrypt
    const encryptedData = await CryptoUtils.encrypt(data, key);
    expect(encryptedData).toBeDefined();
    expect(encryptedData.iv).toBeDefined();
    expect(encryptedData.ciphertext).toBeDefined();
    
    // Decrypt
    const decryptedData = await CryptoUtils.decrypt(encryptedData, key);
    expect(decryptedData).toBe(data);
    expect(JSON.parse(decryptedData).message).toBe('Hello World');
  });

  it('should fail to decrypt with wrong key', async () => {
    const key1 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const key2 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    
    const data = "Secret Data";
    const encrypted = await CryptoUtils.encrypt(data, key1);
    
    await expect(CryptoUtils.decrypt(encrypted, key2)).rejects.toThrow();
  });

  it('should derive keys consistently from the same password', async () => {
    // Create a 16-byte hex string
    const saltArray = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const result1 = await CryptoUtils.deriveKeys('my-secret-password', saltHex);
    const result2 = await CryptoUtils.deriveKeys('my-secret-password', saltHex);

    expect(result1.hashHex).toBe(result2.hashHex);
  });
});
