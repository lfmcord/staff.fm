import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Provides authenticated encryption at rest using AES-256-GCM.
 * Payload layout: [IV (12 bytes)][AUTH_TAG (16 bytes)][CIPHERTEXT].
 */
export class EncryptionHelper {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly IV_LENGTH = 12;
    private static readonly AUTH_TAG_LENGTH = 16;
    private readonly key: Buffer;

    constructor(secret: string) {
        if (!secret) {
            throw new Error('A CACHE_ENCRYPTION_KEY must be provided to enable encryption at rest.');
        }
        // Derive a deterministic 32-byte (256-bit) key from the configured secret.
        this.key = createHash('sha256').update(secret).digest();
    }

    public encrypt(plaintext: string): string {
        return this.encryptBuffer(Buffer.from(plaintext, 'utf8')).toString('base64');
    }

    public decrypt(payload: string): string {
        return this.decryptBuffer(Buffer.from(payload, 'base64')).toString('utf8');
    }

    public encryptBuffer(plaintext: Buffer): Buffer {
        const iv = randomBytes(EncryptionHelper.IV_LENGTH);
        const cipher = createCipheriv(EncryptionHelper.ALGORITHM, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
    }

    public decryptBuffer(payload: Buffer): Buffer {
        const iv = payload.subarray(0, EncryptionHelper.IV_LENGTH);
        const authTag = payload.subarray(
            EncryptionHelper.IV_LENGTH,
            EncryptionHelper.IV_LENGTH + EncryptionHelper.AUTH_TAG_LENGTH
        );
        const encrypted = payload.subarray(EncryptionHelper.IV_LENGTH + EncryptionHelper.AUTH_TAG_LENGTH);
        const decipher = createDecipheriv(EncryptionHelper.ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
}

