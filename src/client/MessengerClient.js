/**
 * MessengerClient - Main class for interacting with Messenger
 * Emulates the complete behavior of the mobile Messenger app
 */

const EventEmitter = require('events');
const { Endpoints, Protocol, EventTypes, AuthMethods } = require('../constants');
const { MessengerError, AuthError, NetworkError } = require('../utils/errors');
const AuthManager = require('./AuthManager');
const MessageManager = require('./MessageManager');
const ContactManager = require('./ContactManager');
const ChatManager = require('./ChatManager');
const WebSocketManager = require('./WebSocketManager');
const NetworkManager = require('./NetworkManager');

class MessengerClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      autoReconnect: true,
      rateLimitDelay: Protocol.RATE_LIMIT_DELAY,
      maxRetries: Protocol.MAX_RETRIES,
      retryDelay: Protocol.RETRY_DELAY,
      ...options
    };
    
    // Initialize managers
    this.auth = new AuthManager(this);
    this.messages = new MessageManager(this);
    this.contacts = new ContactManager(this);
    this.chats = new ChatManager(this);
    this.websocket = new WebSocketManager(this);
    this.network = new NetworkManager(this);
    
    // State
    this.isAuthenticated = false;
    this.isConnected = false;
    this.userId = null;
    this.sessionData = null;
    
    // Bind methods
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.sendMedia = this.sendMedia.bind(this);
    this.getContacts = this.getContacts.bind(this);
    this.getChats = this.getChats.bind(this);
    
    // Setup event listeners
    this._setupEventListeners();
  }
  
  /**
   * Authenticate with Messenger using various methods
   */
  async login(credentials, method = AuthMethods.EMAIL) {
    try {
      this.emit(EventTypes.CONNECTION, { status: 'connecting' });
      
      const authResult = await this.auth.authenticate(credentials, method);
      
      if (authResult.success) {
        this.isAuthenticated = true;
        this.userId = authResult.userId;
        this.sessionData = authResult.sessionData;
        
        // Connect to WebSocket for real-time updates
        await this.websocket.connect();
        
        this.emit(EventTypes.CONNECTION, { 
          status: 'connected', 
          userId: this.userId 
        });
        
        return authResult;
      } else {
        throw new AuthError(authResult.error || 'Authentication failed');
      }
    } catch (error) {
      this.emit(EventTypes.CONNECTION, { 
        status: 'failed', 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Logout and cleanup
   */
  async logout() {
    try {
      await this.websocket.disconnect();
      await this.auth.logout();
      
      this.isAuthenticated = false;
      this.isConnected = false;
      this.userId = null;
      this.sessionData = null;
      
      this.emit(EventTypes.DISCONNECTION, { status: 'logged_out' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  /**
   * Send a text message
   */
  async sendMessage(threadId, text, options = {}) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.messages.sendText(threadId, text, options);
  }
  
  /**
   * Send media (image, video, audio, file)
   */
  async sendMedia(threadId, mediaData, options = {}) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.messages.sendMedia(threadId, mediaData, options);
  }
  
  /**
   * Get user contacts
   */
  async getContacts(options = {}) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.contacts.getContacts(options);
  }
  
  /**
   * Get chat threads
   */
  async getChats(options = {}) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.chats.getChats(options);
  }
  
  /**
   * Get user profile information
   */
  async getProfile() {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.auth.getProfile();
  }
  
  /**
   * Update user status
   */
  async updateStatus(status) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.auth.updateStatus(status);
  }
  
  /**
   * Mark message as read
   */
  async markAsRead(threadId, messageId) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.messages.markAsRead(threadId, messageId);
  }
  
  /**
   * Send typing indicator
   */
  async sendTyping(threadId, isTyping = true) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.messages.sendTyping(threadId, isTyping);
  }
  
  /**
   * React to a message
   */
  async reactToMessage(messageId, reaction) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.messages.reactToMessage(messageId, reaction);
  }
  
  /**
   * Get message history
   */
  async getMessageHistory(threadId, options = {}) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.messages.getHistory(threadId, options);
  }
  
  /**
   * Search messages
   */
  async searchMessages(query, options = {}) {
    if (!this.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    return await this.messages.search(query, options);
  }
  
  /**
   * Setup internal event listeners
   */
  _setupEventListeners() {
    // WebSocket events
    this.websocket.on(EventTypes.MESSAGE, (data) => {
      this.emit(EventTypes.MESSAGE, data);
    });
    
    this.websocket.on(EventTypes.DELIVERY, (data) => {
      this.emit(EventTypes.DELIVERY, data);
    });
    
    this.websocket.on(EventTypes.READ, (data) => {
      this.emit(EventTypes.READ, data);
    });
    
    this.websocket.on(EventTypes.TYPING, (data) => {
      this.emit(EventTypes.TYPING, data);
    });
    
    this.websocket.on(EventTypes.ONLINE, (data) => {
      this.emit(EventTypes.ONLINE, data);
    });
    
    this.websocket.on(EventTypes.OFFLINE, (data) => {
      this.emit(EventTypes.OFFLINE, data);
    });
    
    // Connection events
    this.websocket.on('connect', () => {
      this.isConnected = true;
      this.emit(EventTypes.CONNECTION, { status: 'websocket_connected' });
    });
    
    this.websocket.on('disconnect', () => {
      this.isConnected = false;
      this.emit(EventTypes.DISCONNECTION, { status: 'websocket_disconnected' });
    });
    
    // Error handling
    this.websocket.on('error', (error) => {
      this.emit('error', error);
    });
  }
  
  /**
   * Get current connection status
   */
  getStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      isConnected: this.isConnected,
      userId: this.userId,
      websocketStatus: this.websocket.getStatus()
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.removeAllListeners();
    this.websocket.destroy();
    this.network.destroy();
  }
}

module.exports = MessengerClient;