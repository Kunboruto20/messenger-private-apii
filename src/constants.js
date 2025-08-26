/**
 * Constants and configuration for Messenger Private API
 */

// Authentication methods
const AuthMethods = {
  PHONE: 'phone',
  EMAIL: 'email',
  USERNAME: 'username',
  TWO_FACTOR: '2fa',
  QR_CODE: 'qr_code'
};

// Message types
const MessageTypes = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  STICKER: 'sticker',
  GIF: 'gif',
  FILE: 'file',
  LOCATION: 'location',
  REACTION: 'reaction'
};

// Event types
const EventTypes = {
  MESSAGE: 'message',
  DELIVERY: 'delivery',
  READ: 'read',
  TYPING: 'typing',
  ONLINE: 'online',
  OFFLINE: 'offline',
  CONNECTION: 'connection',
  DISCONNECTION: 'disconnection'
};

// Messenger server endpoints (based on reverse engineering)
const Endpoints = {
  // Main API endpoints
  GRAPHQL: 'https://graph.facebook.com/graphql',
  MESSENGER_API: 'https://edge-chat.facebook.com/chat',
  UPLOAD_API: 'https://upload.facebook.com/ajax/mercury/upload.php',
  
  // Authentication endpoints
  LOGIN: 'https://m.facebook.com/login/device-based/regular/login/',
  LOGIN_2FA: 'https://m.facebook.com/login/checkpoint/',
  LOGIN_DEVICE: 'https://m.facebook.com/login/device-based/regular/login/',
  
  // Mobile app endpoints
  MOBILE_API: 'https://b-graph.facebook.com/graphql',
  MOBILE_UPLOAD: 'https://b-upload.facebook.com/ajax/mercury/upload.php',
  
  // WebSocket endpoints
  WEBSOCKET: 'wss://edge-chat.facebook.com/chat',
  WEBSOCKET_MOBILE: 'wss://b-edge-chat.facebook.com/chat'
};

// Protocol constants
const Protocol = {
  VERSION: '1.0',
  API_VERSION: 'v18.0',
  CLIENT_VERSION: '2023.12.04.00',
  DEVICE_ID: 'android',
  PLATFORM: 'android',
  
  // Headers
  USER_AGENT: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ACCEPT_LANGUAGE: 'en-US,en;q=0.9',
  
  // Rate limiting
  RATE_LIMIT_DELAY: 1000, // 1 second
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000 // 2 seconds
};

// Message limits
const Limits = {
  MAX_TEXT_LENGTH: 20000,
  MAX_IMAGE_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_AUDIO_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_STICKER_SIZE: 1 * 1024 * 1024 // 1MB
};

// Encryption constants
const Encryption = {
  ALGORITHM: 'AES-256-GCM',
  KEY_SIZE: 32,
  IV_SIZE: 16,
  TAG_SIZE: 16
};

module.exports = {
  AuthMethods,
  MessageTypes,
  EventTypes,
  Endpoints,
  Protocol,
  Limits,
  Encryption
};