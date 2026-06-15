import { describe, it, expect } from 'vitest';
import { encryptBackup, decryptBackup, isEncryptedBackup } from './cryptoBackup';

const sample = JSON.stringify({ products: [{ name: 'Salz', quantity: 2 }], version: '2.0.0' });

describe('cryptoBackup', () => {
  it('round-trips: decrypt(encrypt(x)) === x with the right passphrase', async () => {
    const env = await encryptBackup(sample, 'correct horse battery staple');
    const out = await decryptBackup(env, 'correct horse battery staple');
    expect(out).toBe(sample);
  });

  it('produces a recognizable encrypted envelope (no plaintext leak)', async () => {
    const env = await encryptBackup(sample, 'pw12345678');
    expect(isEncryptedBackup(env)).toBe(true);
    expect(env).not.toContain('Salz');
    expect(isEncryptedBackup(sample)).toBe(false);
  });

  it('fails to decrypt with a wrong passphrase', async () => {
    const env = await encryptBackup(sample, 'right-passphrase');
    await expect(decryptBackup(env, 'wrong-passphrase')).rejects.toBeTruthy();
  });

  it('uses a fresh salt/iv each time (different ciphertext for same input)', async () => {
    const a = await encryptBackup(sample, 'same-pw');
    const b = await encryptBackup(sample, 'same-pw');
    expect(a).not.toBe(b);
  });

  it('rejects a non-envelope as invalid', async () => {
    await expect(decryptBackup('{"foo":1}', 'x')).rejects.toThrow();
  });
});
