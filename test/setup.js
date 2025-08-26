/**
 * Test setup file for Jest
 * Configures global test environment and utilities
 */

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock process methods
global.process = {
  ...process,
  exit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn()
};

// Mock setTimeout and setInterval
global.setTimeout = jest.fn((callback, delay) => {
  if (typeof callback === 'function') {
    return setTimeout(callback, delay);
  }
  return setTimeout(() => {}, delay);
});

global.setInterval = jest.fn((callback, delay) => {
  if (typeof callback === 'function') {
    return setInterval(callback, delay);
  }
  return setInterval(() => {}, delay);
});

// Mock clearTimeout and clearInterval
global.clearTimeout = jest.fn(clearTimeout);
global.clearInterval = jest.fn(clearInterval);

// Mock crypto module
const crypto = require('crypto');
jest.mock('crypto', () => ({
  ...crypto,
  randomBytes: jest.fn((size) => {
    const buffer = Buffer.alloc(size);
    buffer.fill(0x42); // Fill with predictable data for tests
    return buffer;
  }),
  createHash: jest.fn((algorithm) => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => Buffer.from('test-hash-' + algorithm))
  })),
  createHmac: jest.fn((algorithm, key) => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => Buffer.from('test-hmac-' + algorithm))
  })),
  createCipher: jest.fn((algorithm, key) => ({
    update: jest.fn().mockReturnThis(),
    final: jest.fn(() => Buffer.from('encrypted-data')),
    setAAD: jest.fn().mockReturnThis(),
    getAuthTag: jest.fn(() => Buffer.from('auth-tag'))
  })),
  createDecipher: jest.fn((algorithm, key) => ({
    update: jest.fn().mockReturnThis(),
    final: jest.fn(() => Buffer.from('decrypted-data')),
    setAAD: jest.fn().mockReturnThis(),
    setAuthTag: jest.fn().mockReturnThis()
  })),
  pbkdf2Sync: jest.fn((password, salt, iterations, keyLength, algorithm) => {
    return Buffer.alloc(keyLength).fill(0x42);
  })
}));

// Mock os module
const os = require('os');
jest.mock('os', () => ({
  ...os,
  platform: jest.fn(() => 'linux'),
  arch: jest.fn(() => 'x64'),
  hostname: jest.fn(() => 'test-host'),
  cpus: jest.fn(() => [
    { model: 'Test CPU', speed: 1000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }
  ]),
  totalmem: jest.fn(() => 1024 * 1024 * 1024), // 1GB
  freemem: jest.fn(() => 512 * 1024 * 1024),   // 512MB
  uptime: jest.fn(() => 3600),                  // 1 hour
  loadavg: jest.fn(() => [0.1, 0.2, 0.3]),
  networkInterfaces: jest.fn(() => ({
    eth0: [{ address: '192.168.1.100', family: 'IPv4' }]
  }))
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock FormData
global.FormData = jest.fn().mockImplementation(() => ({
  append: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  has: jest.fn(),
  delete: jest.fn(),
  set: jest.fn(),
  forEach: jest.fn(),
  keys: jest.fn(() => []),
  values: jest.fn(() => []),
  entries: jest.fn(() => [])
}));

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Global test utilities
global.testUtils = {
  // Create mock message
  createMockMessage: (overrides = {}) => ({
    id: 'msg_test_123',
    text: 'Test message',
    type: 'text',
    timestamp: Date.now(),
    thread_id: 'thread_test_123',
    sender: {
      id: 'user_test_123',
      name: 'Test User'
    },
    ...overrides
  }),
  
  // Create mock thread
  createMockThread: (overrides = {}) => ({
    id: 'thread_test_123',
    name: 'Test Thread',
    type: 'direct',
    participants: [
      {
        id: 'user_test_123',
        name: 'Test User',
        profile_pic: 'https://example.com/pic.jpg'
      }
    ],
    last_message: {
      id: 'msg_test_123',
      text: 'Last message',
      timestamp: Date.now()
    },
    unread_count: 0,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides
  }),
  
  // Create mock user
  createMockUser: (overrides = {}) => ({
    id: 'user_test_123',
    name: 'Test User',
    first_name: 'Test',
    last_name: 'User',
    profile_pic: 'https://example.com/pic.jpg',
    is_friend: true,
    online_status: 'online',
    ...overrides
  }),
  
  // Create mock contact
  createMockContact: (overrides = {}) => ({
    id: 'contact_test_123',
    name: 'Test Contact',
    first_name: 'Test',
    last_name: 'Contact',
    profile_pic: 'https://example.com/pic.jpg',
    is_friend: false,
    mutual_friends: 5,
    ...overrides
  }),
  
  // Wait for a specified time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock network response
  createMockResponse: (data, status = 200, headers = {}) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  }),
  
  // Mock network error
  createMockError: (message, code, response) => ({
    message,
    code,
    response,
    isAxiosError: true
  }),
  
  // Create mock authentication result
  createMockAuthResult: (overrides = {}) => ({
    success: true,
    userId: 'user_test_123',
    accessToken: 'test_access_token_123',
    sessionData: {
      userId: 'user_test_123',
      accessToken: 'test_access_token_123',
      deviceId: 'device_test_123',
      clientId: 'client_test_123',
      cookies: {}
    },
    ...overrides
  }),
  
  // Create mock two-factor result
  createMockTwoFactorResult: (overrides = {}) => ({
    success: false,
    requiresTwoFactor: true,
    method: 'sms',
    message: 'Two-factor authentication required',
    ...overrides
  })
};

// Global test matchers
expect.extend({
  // Check if object has required properties
  toHaveRequiredProperties(received, requiredProps) {
    const missingProps = requiredProps.filter(prop => !(prop in received));
    
    if (missingProps.length === 0) {
      return {
        message: () => `Expected object to have all required properties`,
        pass: true
      };
    }
    
    return {
      message: () => `Expected object to have properties: ${missingProps.join(', ')}`,
      pass: false
    };
  },
  
  // Check if function throws specific error
  toThrowWithName(received, errorName) {
    try {
      received();
      return {
        message: () => `Expected function to throw ${errorName}`,
        pass: false
      };
    } catch (error) {
      if (error.name === errorName) {
        return {
          message: () => `Expected function to throw ${errorName}`,
          pass: true
        };
      }
      
      return {
        message: () => `Expected function to throw ${errorName}, but threw ${error.name}`,
        pass: false
      };
    }
  },
  
  // Check if object is valid ID
  toBeValidId(received) {
    const isValid = typeof received === 'string' && 
                   received.length > 0 && 
                   /^[a-zA-Z0-9_-]+$/.test(received);
    
    if (isValid) {
      return {
        message: () => `Expected ${received} to be a valid ID`,
        pass: true
      };
    }
    
    return {
      message: () => `Expected ${received} to be a valid ID`,
      pass: false
    };
  }
});

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset console mocks
  global.console.log.mockClear();
  global.console.error.mockClear();
  global.console.warn.mockClear();
  
  // Reset timer mocks
  jest.clearAllTimers();
});

// Global test teardown
afterEach(() => {
  // Clean up any remaining timers
  jest.clearAllTimers();
  
  // Clean up any remaining event listeners
  if (global.process && global.process.removeAllListeners) {
    global.process.removeAllListeners();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});