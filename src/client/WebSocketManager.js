/**
 * WebSocketManager - Handles real-time communication with Messenger
 * Manages WebSocket connections, reconnection, and message handling
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const { Endpoints, Protocol, EventTypes } = require('../constants');
const { NetworkError } = require('../utils/errors');

class WebSocketManager extends EventEmitter {
  constructor(client) {
    super();
    
    this.client = client;
    this.network = client.network;
    
    // WebSocket state
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    
    // Message handling
    this.messageHandlers = new Map();
    this.pendingMessages = new Map();
    
    // Setup message handlers
    this._setupMessageHandlers();
  }
  
  /**
   * Connect to Messenger WebSocket
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      return;
    }
    
    try {
      this.isConnecting = true;
      this.emit('connecting');
      
      // Get WebSocket URL and authentication
      const connectionInfo = await this._getConnectionInfo();
      
      // Create WebSocket connection
      this.ws = new WebSocket(connectionInfo.url, {
        headers: this._getWebSocketHeaders(connectionInfo),
        followRedirects: true,
        timeout: 30000
      });
      
      // Setup event handlers
      this._setupWebSocketHandlers();
      
      // Wait for connection
      await this._waitForConnection();
      
      // Send authentication message
      await this._authenticateWebSocket(connectionInfo);
      
      // Start heartbeat
      this._startHeartbeat();
      
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      this.emit('connect');
      this.emit(EventTypes.CONNECTION, { status: 'websocket_connected' });
      
    } catch (error) {
      this.isConnecting = false;
      this.emit('error', error);
      throw new NetworkError(`WebSocket connection failed: ${error.message}`);
    }
  }
  
  /**
   * Disconnect WebSocket
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }
    
    try {
      // Stop heartbeat
      this._stopHeartbeat();
      
      // Close WebSocket
      if (this.ws) {
        this.ws.close(1000, 'Client disconnect');
        this.ws = null;
      }
      
      this.isConnected = false;
      this.emit('disconnect');
      this.emit(EventTypes.DISCONNECTION, { status: 'websocket_disconnected' });
      
    } catch (error) {
      console.error('WebSocket disconnect error:', error);
    }
  }
  
  /**
   * Send message via WebSocket
   */
  async sendMessage(messageData) {
    if (!this.isConnected) {
      throw new NetworkError('WebSocket not connected');
    }
    
    try {
      const message = {
        type: 'message',
        data: messageData,
        timestamp: Date.now(),
        id: this._generateMessageId()
      };
      
      // Store pending message for acknowledgment
      this.pendingMessages.set(message.id, message);
      
      // Send message
      this.ws.send(JSON.stringify(message));
      
      // Wait for acknowledgment
      return await this._waitForAcknowledgment(message.id);
      
    } catch (error) {
      throw new NetworkError(`Failed to send message: ${error.message}`);
    }
  }
  
  /**
   * Send typing indicator
   */
  async sendTyping(threadId, isTyping = true) {
    if (!this.isConnected) {
      throw new NetworkError('WebSocket not connected');
    }
    
    try {
      const typingMessage = {
        type: 'typing',
        thread_id: threadId,
        typing: isTyping,
        timestamp: Date.now()
      };
      
      this.ws.send(JSON.stringify(typingMessage));
      return { success: true };
      
    } catch (error) {
      throw new NetworkError(`Failed to send typing indicator: ${error.message}`);
    }
  }
  
  /**
   * Send read receipt
   */
  async sendReadReceipt(threadId, messageId) {
    if (!this.isConnected) {
      throw new NetworkError('WebSocket not connected');
    }
    
    try {
      const readMessage = {
        type: 'read_receipt',
        thread_id: threadId,
        message_id: messageId,
        timestamp: Date.now()
      };
      
      this.ws.send(JSON.stringify(readMessage));
      return { success: true };
      
    } catch (error) {
      throw new NetworkError(`Failed to send read receipt: ${error.message}`);
    }
  }
  
  /**
   * Get connection information from Messenger
   */
  async _getConnectionInfo() {
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetWebSocketInfo {
            websocketInfo {
              url
              token
              expires_at
            }
          }
        `
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.websocketInfo) {
        return response.data.data.websocketInfo;
      }
      
      // Fallback to default WebSocket URL
      return {
        url: Endpoints.WEBSOCKET,
        token: this.client.auth.accessToken,
        expires_at: Date.now() + (3600 * 1000) // 1 hour
      };
      
    } catch (error) {
      // Use fallback URL if GraphQL fails
      return {
        url: Endpoints.WEBSOCKET,
        token: this.client.auth.accessToken,
        expires_at: Date.now() + (3600 * 1000)
      };
    }
  }
  
  /**
   * Setup WebSocket event handlers
   */
  _setupWebSocketHandlers() {
    this.ws.on('open', () => {
      this.emit('open');
    });
    
    this.ws.on('message', (data) => {
      this._handleWebSocketMessage(data);
    });
    
    this.ws.on('close', (code, reason) => {
      this._handleWebSocketClose(code, reason);
    });
    
    this.ws.on('error', (error) => {
      this._handleWebSocketError(error);
    });
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  _handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle different message types
      switch (message.type) {
        case 'message':
          this._handleIncomingMessage(message);
          break;
        case 'typing':
          this._handleTypingIndicator(message);
          break;
        case 'read_receipt':
          this._handleReadReceipt(message);
          break;
        case 'online_status':
          this._handleOnlineStatus(message);
          break;
        case 'acknowledgment':
          this._handleAcknowledgment(message);
          break;
        case 'heartbeat':
          this._handleHeartbeat(message);
          break;
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
      
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }
  
  /**
   * Handle incoming message
   */
  _handleIncomingMessage(message) {
    const messageData = {
      message_id: message.data.id,
      text: message.data.text,
      type: message.data.type,
      timestamp: message.data.timestamp,
      thread_id: message.data.thread_id,
      sender: message.data.sender
    };
    
    // Forward to message manager
    this.client.messages.handleIncomingMessage(messageData);
    
    // Emit message event
    this.emit(EventTypes.MESSAGE, messageData);
  }
  
  /**
   * Handle typing indicator
   */
  _handleTypingIndicator(message) {
    this.emit(EventTypes.TYPING, {
      thread_id: message.thread_id,
      user_id: message.user_id,
      typing: message.typing,
      timestamp: message.timestamp
    });
  }
  
  /**
   * Handle read receipt
   */
  _handleReadReceipt(message) {
    this.emit(EventTypes.READ, {
      thread_id: message.thread_id,
      message_id: message.message_id,
      user_id: message.user_id,
      timestamp: message.timestamp
    });
  }
  
  /**
   * Handle online status
   */
  _handleOnlineStatus(message) {
    const eventType = message.online ? EventTypes.ONLINE : EventTypes.OFFLINE;
    this.emit(eventType, {
      user_id: message.user_id,
      online: message.online,
      timestamp: message.timestamp
    });
  }
  
  /**
   * Handle acknowledgment
   */
  _handleAcknowledgment(message) {
    const pendingMessage = this.pendingMessages.get(message.message_id);
    if (pendingMessage) {
      this.pendingMessages.delete(message.message_id);
      this.emit('messageAcknowledged', pendingMessage);
    }
  }
  
  /**
   * Handle heartbeat
   */
  _handleHeartbeat(message) {
    // Reset heartbeat timeout
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this._startHeartbeatTimeout();
    }
  }
  
  /**
   * Handle WebSocket close
   */
  _handleWebSocketClose(code, reason) {
    this.isConnected = false;
    this.emit('close', code, reason);
    
    // Attempt reconnection if enabled
    if (this.client.options.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this._scheduleReconnect();
    }
  }
  
  /**
   * Handle WebSocket error
   */
  _handleWebSocketError(error) {
    this.emit('error', error);
    
    // Attempt reconnection on error
    if (this.client.options.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this._scheduleReconnect();
    }
  }
  
  /**
   * Schedule reconnection attempt
   */
  _scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (!this.isConnected && !this.isConnecting) {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }
  
  /**
   * Wait for WebSocket connection
   */
  _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new NetworkError('WebSocket connection timeout'));
      }, 30000);
      
      this.ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.ws.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Authenticate WebSocket connection
   */
  async _authenticateWebSocket(connectionInfo) {
    const authMessage = {
      type: 'authentication',
      token: connectionInfo.token,
      device_id: this.client.auth.deviceId,
      client_id: this.client.auth.clientId,
      platform: Protocol.PLATFORM,
      version: Protocol.CLIENT_VERSION
    };
    
    this.ws.send(JSON.stringify(authMessage));
    
    // Wait for authentication response
    return await this._waitForAuthentication();
  }
  
  /**
   * Wait for authentication response
   */
  _waitForAuthentication() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new NetworkError('Authentication timeout'));
      }, 10000);
      
      const authHandler = (message) => {
        if (message.type === 'authentication_response') {
          clearTimeout(timeout);
          this.removeListener('message', authHandler);
          
          if (message.success) {
            resolve(message);
          } else {
            reject(new NetworkError(message.error || 'Authentication failed'));
          }
        }
      };
      
      this.on('message', authHandler);
    });
  }
  
  /**
   * Wait for message acknowledgment
   */
  _waitForAcknowledgment(messageId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new NetworkError('Message acknowledgment timeout'));
      }, 10000);
      
      const ackHandler = (message) => {
        if (message.message_id === messageId) {
          clearTimeout(timeout);
          this.removeListener('messageAcknowledged', ackHandler);
          resolve(message);
        }
      };
      
      this.on('messageAcknowledged', ackHandler);
    });
  }
  
  /**
   * Start heartbeat mechanism
   */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        const heartbeatMessage = {
          type: 'heartbeat',
          timestamp: Date.now()
        };
        
        this.ws.send(JSON.stringify(heartbeatMessage));
        this._startHeartbeatTimeout();
      }
    }, 30000); // Send heartbeat every 30 seconds
  }
  
  /**
   * Start heartbeat timeout
   */
  _startHeartbeatTimeout() {
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('Heartbeat timeout, reconnecting...');
      this.disconnect().then(() => {
        this.connect().catch(console.error);
      });
    }, 10000); // 10 second timeout
  }
  
  /**
   * Stop heartbeat mechanism
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
  
  /**
   * Get WebSocket headers
   */
  _getWebSocketHeaders(connectionInfo) {
    return {
      'User-Agent': Protocol.USER_AGENT,
      'Accept-Language': Protocol.ACCEPT_LANGUAGE,
      'Authorization': `Bearer ${connectionInfo.token}`,
      'Sec-WebSocket-Protocol': 'messenger',
      'Origin': 'https://www.messenger.com'
    };
  }
  
  /**
   * Get authentication headers
   */
  _getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.client.auth.accessToken}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Generate unique message ID
   */
  _generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get WebSocket status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      pendingMessages: this.pendingMessages.size
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this._stopHeartbeat();
    this.disconnect();
    this.removeAllListeners();
  }
}

module.exports = WebSocketManager;