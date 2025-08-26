/**
 * Encryption utilities for Messenger Private API
 * Handles message encryption, key generation, and security features
 */

const crypto = require('crypto');
const { Encryption } = require('../constants');

/**
 * Generate a random encryption key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(Encryption.KEY_SIZE);
}

/**
 * Generate a random initialization vector
 */
function generateIV() {
  return crypto.randomBytes(Encryption.IV_SIZE);
}

/**
 * Encrypt data using AES-256-GCM
 */
function encryptData(data, key, iv = null) {
  try {
    // Generate IV if not provided
    if (!iv) {
      iv = generateIV();
    }
    
    // Create cipher
    const cipher = crypto.createCipher(Encryption.ALGORITHM, key);
    cipher.setAAD(Buffer.from('messenger-api', 'utf8'));
    
    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: Encryption.ALGORITHM
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
function decryptData(encryptedData, key, iv, tag) {
  try {
    // Create decipher
    const decipher = crypto.createDecipher(Encryption.ALGORITHM, key);
    decipher.setAAD(Buffer.from('messenger-api', 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Encrypt a message
 */
function encryptMessage(message, key) {
  try {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const encrypted = encryptData(messageStr, key);
    
    return {
      ...encrypted,
      timestamp: Date.now(),
      version: '1.0'
    };
  } catch (error) {
    throw new Error(`Message encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a message
 */
function decryptMessage(encryptedMessage, key) {
  try {
    const { encrypted, iv, tag } = encryptedMessage;
    const decrypted = decryptData(encrypted, key, iv, tag);
    
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    throw new Error(`Message decryption failed: ${error.message}`);
  }
}

/**
 * Generate a secure hash of data
 */
function generateHash(data, algorithm = 'sha256') {
  try {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    return hash.digest('hex');
  } catch (error) {
    throw new Error(`Hash generation failed: ${error.message}`);
  }
}

/**
 * Generate HMAC signature
 */
function generateHMAC(data, secret, algorithm = 'sha256') {
  try {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(data);
    return hmac.digest('hex');
  } catch (error) {
    throw new Error(`HMAC generation failed: ${error.message}`);
  }
}

/**
 * Verify HMAC signature
 */
function verifyHMAC(data, signature, secret, algorithm = 'sha256') {
  try {
    const expectedSignature = generateHMAC(data, secret, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

/**
 * Generate a random message ID
 */
function generateMessageId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  const hash = generateHash(`${timestamp}${random}`).substr(0, 8);
  
  return `msg_${timestamp}_${random}_${hash}`;
}

/**
 * Generate a secure token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a nonce for replay protection
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Encrypt sensitive data for storage
 */
function encryptForStorage(data, masterKey) {
  try {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
    
    const encrypted = encryptData(dataStr, key);
    
    return {
      ...encrypted,
      salt: salt.toString('hex'),
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Storage encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt data from storage
 */
function decryptFromStorage(encryptedData, masterKey) {
  try {
    const { encrypted, iv, tag, salt } = encryptedData;
    const key = crypto.pbkdf2Sync(masterKey, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
    
    const decrypted = decryptData(encrypted, key, iv, tag);
    
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    throw new Error(`Storage decryption failed: ${error.message}`);
  }
}

/**
 * Generate a key derivation function
 */
function deriveKey(password, salt, iterations = 100000, keyLength = 32) {
  try {
    return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
  } catch (error) {
    throw new Error(`Key derivation failed: ${error.message}`);
  }
}

/**
 * Generate a secure random string
 */
function generateRandomString(length = 16, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Create a secure fingerprint
 */
function createFingerprint(data) {
  try {
    const hash = generateHash(data, 'sha256');
    return hash.substr(0, 16); // Return first 16 characters
  } catch (error) {
    throw new Error(`Fingerprint creation failed: ${error.message}`);
  }
}

/**
 * Verify data integrity
 */
function verifyIntegrity(data, expectedHash, algorithm = 'sha256') {
  try {
    const actualHash = generateHash(data, algorithm);
    return actualHash === expectedHash;
  } catch (error) {
    return false;
  }
}

/**
 * Encrypt file data
 */
function encryptFile(fileBuffer, key) {
  try {
    const iv = generateIV();
    const cipher = crypto.createCipher(Encryption.ALGORITHM, key);
    cipher.setAAD(Buffer.from('messenger-file', 'utf8'));
    
    let encrypted = cipher.update(fileBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv,
      tag: tag,
      algorithm: Encryption.ALGORITHM,
      originalSize: fileBuffer.length
    };
  } catch (error) {
    throw new Error(`File encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt file data
 */
function decryptFile(encryptedFile, key) {
  try {
    const { encrypted, iv, tag } = encryptedFile;
    
    const decipher = crypto.createDecipher(Encryption.ALGORITHM, key);
    decipher.setAAD(Buffer.from('messenger-file', 'utf8'));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  } catch (error) {
    throw new Error(`File decryption failed: ${error.message}`);
  }
}

module.exports = {
  generateEncryptionKey,
  generateIV,
  encryptData,
  decryptData,
  encryptMessage,
  decryptMessage,
  generateHash,
  generateHMAC,
  verifyHMAC,
  generateMessageId,
  generateSecureToken,
  generateNonce,
  encryptForStorage,
  decryptFromStorage,
  deriveKey,
  generateRandomString,
  createFingerprint,
  verifyIntegrity,
  encryptFile,
  decryptFile
};