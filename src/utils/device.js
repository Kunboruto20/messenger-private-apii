/**
 * Device utilities for Messenger Private API
 * Handles device identification and device-specific functionality
 */

const crypto = require('crypto');
const os = require('os');

/**
 * Generate a unique device ID
 */
function generateDeviceId() {
  try {
    // Use system information to create a unique device fingerprint
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMem: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
      networkInterfaces: Object.keys(os.networkInterfaces()).length
    };
    
    // Create a hash of system information
    const systemHash = crypto.createHash('sha256')
      .update(JSON.stringify(systemInfo))
      .digest('hex')
      .substr(0, 16);
    
    // Add timestamp for uniqueness
    const timestamp = Date.now().toString(36);
    
    return `device_${systemHash}_${timestamp}`;
  } catch (error) {
    // Fallback to random device ID
    return `device_${crypto.randomBytes(8).toString('hex')}`;
  }
}

/**
 * Generate a unique client ID
 */
function generateClientId() {
  try {
    // Create a combination of random data and timestamp
    const randomBytes = crypto.randomBytes(12).toString('hex');
    const timestamp = Date.now().toString(36);
    const processId = process.pid.toString(36);
    
    return `client_${randomBytes}_${timestamp}_${processId}`;
  } catch (error) {
    // Fallback to simple random ID
    return `client_${crypto.randomBytes(16).toString('hex')}`;
  }
}

/**
 * Generate a session ID
 */
function generateSessionId() {
  try {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);
    
    return `session_${randomBytes}_${timestamp}`;
  } catch (error) {
    return `session_${crypto.randomBytes(20).toString('hex')}`;
  }
}

/**
 * Generate a request ID
 */
function generateRequestId() {
  try {
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now().toString(36);
    
    return `req_${randomBytes}_${timestamp}`;
  } catch (error) {
    return `req_${crypto.randomBytes(12).toString('hex')}`;
  }
}

/**
 * Get device information
 */
function getDeviceInfo() {
  try {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      networkInterfaces: Object.keys(os.networkInterfaces()),
      nodeVersion: process.version,
      processId: process.pid,
      memoryUsage: process.memoryUsage()
    };
  } catch (error) {
    return {
      platform: 'unknown',
      arch: 'unknown',
      error: error.message
    };
  }
}

/**
 * Get device capabilities
 */
function getDeviceCapabilities() {
  try {
    const capabilities = {
      encryption: true,
      websocket: true,
      fileUpload: true,
      mediaSupport: true,
      realTimeMessaging: true,
      offlineSupport: true,
      pushNotifications: false, // Would need native integration
      locationServices: false, // Would need native integration
      camera: false, // Would need native integration
      microphone: false // Would need native integration
    };
    
    // Check for specific capabilities based on environment
    if (typeof window !== 'undefined') {
      // Browser environment
      capabilities.pushNotifications = 'serviceWorker' in navigator;
      capabilities.locationServices = 'geolocation' in navigator;
      capabilities.camera = 'getUserMedia' in navigator;
      capabilities.microphone = 'getUserMedia' in navigator;
    }
    
    return capabilities;
  } catch (error) {
    return {
      encryption: true,
      websocket: true,
      fileUpload: true,
      mediaSupport: true,
      realTimeMessaging: true,
      offlineSupport: true,
      error: error.message
    };
  }
}

/**
 * Generate device fingerprint
 */
function generateDeviceFingerprint() {
  try {
    const deviceInfo = getDeviceInfo();
    const capabilities = getDeviceCapabilities();
    
    // Create a unique fingerprint based on device characteristics
    const fingerprintData = {
      platform: deviceInfo.platform,
      arch: deviceInfo.arch,
      hostname: deviceInfo.hostname,
      cpus: deviceInfo.cpus,
      nodeVersion: deviceInfo.nodeVersion,
      capabilities: Object.keys(capabilities).filter(key => capabilities[key])
    };
    
    // Generate hash of fingerprint data
    const fingerprint = crypto.createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
    
    return {
      fingerprint,
      data: fingerprintData,
      timestamp: Date.now()
    };
  } catch (error) {
    // Fallback to random fingerprint
    return {
      fingerprint: crypto.randomBytes(32).toString('hex'),
      data: { error: error.message },
      timestamp: Date.now()
    };
  }
}

/**
 * Validate device ID format
 */
function isValidDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') {
    return false;
  }
  
  // Check if it follows the expected format
  const deviceIdPattern = /^device_[a-f0-9]{16}_[a-z0-9]+$/;
  return deviceIdPattern.test(deviceId);
}

/**
 * Validate client ID format
 */
function isValidClientId(clientId) {
  if (!clientId || typeof clientId !== 'string') {
    return false;
  }
  
  // Check if it follows the expected format
  const clientIdPattern = /^client_[a-f0-9]{24}_[a-z0-9]+_[a-z0-9]+$/;
  return clientIdPattern.test(clientId);
}

/**
 * Generate device-specific headers
 */
function generateDeviceHeaders(deviceId, clientId) {
  try {
    const deviceInfo = getDeviceInfo();
    const capabilities = getDeviceCapabilities();
    
    return {
      'X-Device-ID': deviceId,
      'X-Client-ID': clientId,
      'X-Device-Platform': deviceInfo.platform,
      'X-Device-Arch': deviceInfo.arch,
      'X-Device-Capabilities': Object.keys(capabilities).filter(key => capabilities[key]).join(','),
      'X-Device-Node-Version': deviceInfo.nodeVersion,
      'X-Device-Timestamp': Date.now().toString()
    };
  } catch (error) {
    return {
      'X-Device-ID': deviceId,
      'X-Client-ID': clientId,
      'X-Device-Error': error.message
    };
  }
}

/**
 * Create device context for requests
 */
function createDeviceContext(deviceId, clientId) {
  try {
    const deviceInfo = getDeviceInfo();
    const capabilities = getDeviceCapabilities();
    const fingerprint = generateDeviceFingerprint();
    
    return {
      deviceId,
      clientId,
      info: deviceInfo,
      capabilities,
      fingerprint: fingerprint.fingerprint,
      timestamp: Date.now(),
      sessionId: generateSessionId()
    };
  } catch (error) {
    return {
      deviceId,
      clientId,
      error: error.message,
      timestamp: Date.now(),
      sessionId: generateSessionId()
    };
  }
}

/**
 * Get device statistics
 */
function getDeviceStats() {
  try {
    const deviceInfo = getDeviceInfo();
    const capabilities = getDeviceCapabilities();
    
    return {
      system: {
        platform: deviceInfo.platform,
        arch: deviceInfo.arch,
        hostname: deviceInfo.hostname,
        cpus: deviceInfo.cpus,
        totalMemory: deviceInfo.totalMemory,
        freeMemory: deviceInfo.freeMemory,
        uptime: deviceInfo.uptime
      },
      process: {
        nodeVersion: deviceInfo.nodeVersion,
        processId: deviceInfo.processId,
        memoryUsage: deviceInfo.memoryUsage
      },
      capabilities: capabilities,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      error: error.message,
      timestamp: Date.now()
    };
  }
}

/**
 * Check if device supports feature
 */
function supportsFeature(feature) {
  try {
    const capabilities = getDeviceCapabilities();
    return capabilities[feature] === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get optimal settings for device
 */
function getOptimalSettings() {
  try {
    const deviceInfo = getDeviceInfo();
    const capabilities = getDeviceCapabilities();
    
    const settings = {
      // Connection settings
      maxConcurrentRequests: Math.min(deviceInfo.cpus * 2, 10),
      requestTimeout: 30000,
      retryAttempts: 3,
      
      // WebSocket settings
      websocketReconnectDelay: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      
      // Cache settings
      cacheExpiry: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 1000,
      
      // Rate limiting
      rateLimitDelay: 1000,
      maxRequestsPerMinute: 60,
      
      // Media settings
      maxFileSize: capabilities.fileUpload ? 25 * 1024 * 1024 : 0, // 25MB
      supportedMediaTypes: capabilities.mediaSupport ? ['image', 'video', 'audio', 'file'] : ['text'],
      
      // Encryption settings
      encryptionEnabled: capabilities.encryption,
      keyRotationInterval: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    // Adjust based on device capabilities
    if (deviceInfo.totalMemory < 2 * 1024 * 1024 * 1024) { // Less than 2GB RAM
      settings.maxConcurrentRequests = Math.max(settings.maxConcurrentRequests / 2, 2);
      settings.maxCacheSize = 500;
    }
    
    if (deviceInfo.cpus < 2) {
      settings.maxConcurrentRequests = Math.max(settings.maxConcurrentRequests / 2, 1);
    }
    
    return settings;
  } catch (error) {
    // Return default settings on error
    return {
      maxConcurrentRequests: 5,
      requestTimeout: 30000,
      retryAttempts: 3,
      websocketReconnectDelay: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      cacheExpiry: 5 * 60 * 1000,
      maxCacheSize: 1000,
      rateLimitDelay: 1000,
      maxRequestsPerMinute: 60,
      maxFileSize: 25 * 1024 * 1024,
      supportedMediaTypes: ['image', 'video', 'audio', 'file'],
      encryptionEnabled: true,
      keyRotationInterval: 24 * 60 * 60 * 1000
    };
  }
}

module.exports = {
  generateDeviceId,
  generateClientId,
  generateSessionId,
  generateRequestId,
  getDeviceInfo,
  getDeviceCapabilities,
  generateDeviceFingerprint,
  isValidDeviceId,
  isValidClientId,
  generateDeviceHeaders,
  createDeviceContext,
  getDeviceStats,
  supportsFeature,
  getOptimalSettings
};