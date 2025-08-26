/**
 * Basic tests for Messenger Private API
 * Tests core functionality without requiring actual authentication
 */

const { MessengerClient, AuthMethods, MessageTypes, EventTypes } = require('../src/index');

describe('Messenger Private API', () => {
  let client;
  
  beforeEach(() => {
    client = new MessengerClient({
      autoReconnect: false,
      rateLimitDelay: 100,
      maxRetries: 1
    });
  });
  
  afterEach(() => {
    if (client) {
      client.destroy();
    }
  });
  
  describe('Client Initialization', () => {
    test('should create client instance', () => {
      expect(client).toBeInstanceOf(MessengerClient);
      expect(client.isAuthenticated).toBe(false);
      expect(client.isConnected).toBe(false);
    });
    
    test('should have all required managers', () => {
      expect(client.auth).toBeDefined();
      expect(client.messages).toBeDefined();
      expect(client.contacts).toBeDefined();
      expect(client.chats).toBeDefined();
      expect(client.websocket).toBeDefined();
      expect(client.network).toBeDefined();
    });
    
    test('should have correct default options', () => {
      expect(client.options.autoReconnect).toBe(false);
      expect(client.options.rateLimitDelay).toBe(100);
      expect(client.options.maxRetries).toBe(1);
    });
  });
  
  describe('Constants', () => {
    test('should have valid authentication methods', () => {
      expect(AuthMethods.PHONE).toBe('phone');
      expect(AuthMethods.EMAIL).toBe('email');
      expect(AuthMethods.USERNAME).toBe('username');
      expect(AuthMethods.TWO_FACTOR).toBe('2fa');
      expect(AuthMethods.QR_CODE).toBe('qr_code');
    });
    
    test('should have valid message types', () => {
      expect(MessageTypes.TEXT).toBe('text');
      expect(MessageTypes.IMAGE).toBe('image');
      expect(MessageTypes.VIDEO).toBe('video');
      expect(MessageTypes.AUDIO).toBe('audio');
      expect(MessageTypes.STICKER).toBe('sticker');
      expect(MessageTypes.GIF).toBe('gif');
      expect(MessageTypes.FILE).toBe('file');
      expect(MessageTypes.LOCATION).toBe('location');
      expect(MessageTypes.REACTION).toBe('reaction');
    });
    
    test('should have valid event types', () => {
      expect(EventTypes.MESSAGE).toBe('message');
      expect(EventTypes.DELIVERY).toBe('delivery');
      expect(EventTypes.READ).toBe('read');
      expect(EventTypes.TYPING).toBe('typing');
      expect(EventTypes.ONLINE).toBe('online');
      expect(EventTypes.OFFLINE).toBe('offline');
      expect(EventTypes.CONNECTION).toBe('connection');
      expect(EventTypes.DISCONNECTION).toBe('disconnection');
    });
  });
  
  describe('Event System', () => {
    test('should emit connection events', (done) => {
      client.on(EventTypes.CONNECTION, (data) => {
        expect(data.status).toBe('connecting');
        done();
      });
      
      client.emit(EventTypes.CONNECTION, { status: 'connecting' });
    });
    
    test('should emit message events', (done) => {
      client.on(EventTypes.MESSAGE, (message) => {
        expect(message.text).toBe('Hello World');
        expect(message.sender).toBeDefined();
        done();
      });
      
      client.emit(EventTypes.MESSAGE, {
        text: 'Hello World',
        sender: { id: '123', name: 'Test User' }
      });
    });
    
    test('should emit multiple event types', (done) => {
      let eventCount = 0;
      const expectedEvents = 3;
      
      const checkComplete = () => {
        eventCount++;
        if (eventCount === expectedEvents) {
          done();
        }
      };
      
      client.on(EventTypes.MESSAGE, checkComplete);
      client.on(EventTypes.TYPING, checkComplete);
      client.on(EventTypes.READ, checkComplete);
      
      client.emit(EventTypes.MESSAGE, { text: 'Test' });
      client.emit(EventTypes.TYPING, { typing: true });
      client.emit(EventTypes.READ, { message_id: '123' });
    });
  });
  
  describe('Status Management', () => {
    test('should return correct status when not authenticated', () => {
      const status = client.getStatus();
      
      expect(status.isAuthenticated).toBe(false);
      expect(status.isConnected).toBe(false);
      expect(status.userId).toBe(null);
      expect(status.websocketStatus).toBeDefined();
    });
    
    test('should update status after authentication simulation', () => {
      // Simulate authentication
      client.isAuthenticated = true;
      client.userId = 'test-user-123';
      
      const status = client.getStatus();
      
      expect(status.isAuthenticated).toBe(true);
      expect(status.userId).toBe('test-user-123');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle authentication errors', async () => {
      try {
        await client.sendMessage('thread-123', 'Hello');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AuthError');
        expect(error.message).toContain('Not authenticated');
      }
    });
    
    test('should handle media sending errors', async () => {
      try {
        await client.sendMedia('thread-123', { type: 'image', data: Buffer.from('test') });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AuthError');
        expect(error.message).toContain('Not authenticated');
      }
    });
    
    test('should handle contact retrieval errors', async () => {
      try {
        await client.getContacts();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AuthError');
        expect(error.message).toContain('Not authenticated');
      }
    });
    
    test('should handle chat retrieval errors', async () => {
      try {
        await client.getChats();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AuthError');
        expect(error.message).toContain('Not authenticated');
      }
    });
  });
  
  describe('Manager Functionality', () => {
    test('should have working auth manager', () => {
      expect(client.auth).toBeDefined();
      expect(typeof client.auth.authenticate).toBe('function');
      expect(typeof client.auth.logout).toBe('function');
      expect(typeof client.auth.getProfile).toBe('function');
    });
    
    test('should have working message manager', () => {
      expect(client.messages).toBeDefined();
      expect(typeof client.messages.sendText).toBe('function');
      expect(typeof client.messages.sendMedia).toBe('function');
      expect(typeof client.messages.getHistory).toBe('function');
    });
    
    test('should have working contact manager', () => {
      expect(client.contacts).toBeDefined();
      expect(typeof client.contacts.getContacts).toBe('function');
      expect(typeof client.contacts.getFriends).toBe('function');
      expect(typeof client.contacts.searchUsers).toBe('function');
    });
    
    test('should have working chat manager', () => {
      expect(client.chats).toBeDefined();
      expect(typeof client.chats.getChats).toBe('function');
      expect(typeof client.chats.createChat).toBe('function');
      expect(typeof client.chats.getChatById).toBe('function');
    });
    
    test('should have working websocket manager', () => {
      expect(client.websocket).toBeDefined();
      expect(typeof client.websocket.connect).toBe('function');
      expect(typeof client.websocket.disconnect).toBe('function');
      expect(typeof client.websocket.sendMessage).toBe('function');
    });
    
    test('should have working network manager', () => {
      expect(client.network).toBeDefined();
      expect(typeof client.network.get).toBe('function');
      expect(typeof client.network.post).toBe('function');
      expect(typeof client.network.put).toBe('function');
      expect(typeof client.network.delete).toBe('function');
    });
  });
  
  describe('Utility Functions', () => {
    test('should generate valid message IDs', () => {
      const messageId1 = client.messages._generateMessageId();
      const messageId2 = client.messages._generateMessageId();
      
      expect(messageId1).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(messageId2).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(messageId1).not.toBe(messageId2);
    });
    
    test('should handle rate limiting correctly', async () => {
      // Simulate authentication
      client.isAuthenticated = true;
      
      try {
        // This should work without rate limiting issues
        await client.messages._checkRateLimit();
        expect(true).toBe(true); // Should not throw
      } catch (error) {
        fail('Rate limiting should not fail on first check');
      }
    });
  });
  
  describe('Cleanup', () => {
    test('should cleanup resources on destroy', () => {
      const originalRemoveAllListeners = client.removeAllListeners;
      const originalWebSocketDestroy = client.websocket.destroy;
      const originalNetworkDestroy = client.network.destroy;
      
      // Mock the methods
      client.removeAllListeners = jest.fn();
      client.websocket.destroy = jest.fn();
      client.network.destroy = jest.fn();
      
      client.destroy();
      
      expect(client.removeAllListeners).toHaveBeenCalled();
      expect(client.websocket.destroy).toHaveBeenCalled();
      expect(client.network.destroy).toHaveBeenCalled();
      
      // Restore original methods
      client.removeAllListeners = originalRemoveAllListeners;
      client.websocket.destroy = originalWebSocketDestroy;
      client.network.destroy = originalNetworkDestroy;
    });
  });
});

// Mock console methods to avoid noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});