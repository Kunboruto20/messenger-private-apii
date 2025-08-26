/**
 * MessageManager - Handles sending and receiving messages
 * Supports text, media, reactions, and real-time messaging
 */

const { Endpoints, MessageTypes, Limits } = require('../constants');
const { MessengerError, AuthError } = require('../utils/errors');
const { encryptMessage, generateMessageId } = require('../utils/encryption');

class MessageManager {
  constructor(client) {
    this.client = client;
    this.network = client.network;
    this.websocket = client.websocket;
    
    // Message state
    this.messageQueue = [];
    this.sentMessages = new Map();
    this.receivedMessages = new Map();
    
    // Rate limiting
    this.lastMessageTime = 0;
    this.messageCount = 0;
    this.rateLimitResetTime = Date.now() + (60 * 1000); // 1 minute
  }
  
  /**
   * Send text message
   */
  async sendText(threadId, text, options = {}) {
    if (!text || text.length > Limits.MAX_TEXT_LENGTH) {
      throw new MessengerError(`Text message must be between 1 and ${Limits.MAX_TEXT_LENGTH} characters`);
    }
    
    const messageData = {
      thread_id: threadId,
      message: text,
      type: MessageTypes.TEXT,
      timestamp: Date.now(),
      message_id: generateMessageId(),
      ...options
    };
    
    return await this._sendMessage(messageData);
  }
  
  /**
   * Send media message
   */
  async sendMedia(threadId, mediaData, options = {}) {
    const { type, data, filename, caption } = mediaData;
    
    if (!Object.values(MessageTypes).includes(type)) {
      throw new MessengerError(`Unsupported media type: ${type}`);
    }
    
    // Validate file size
    if (data.length > this._getMaxSizeForType(type)) {
      throw new MessengerError(`File size exceeds limit for ${type}`);
    }
    
    // Upload media first
    const uploadResult = await this._uploadMedia(mediaData);
    
    const messageData = {
      thread_id: threadId,
      type: type,
      media_id: uploadResult.media_id,
      caption: caption || '',
      timestamp: Date.now(),
      message_id: generateMessageId(),
      ...options
    };
    
    return await this._sendMessage(messageData);
  }
  
  /**
   * Send sticker
   */
  async sendSticker(threadId, stickerId, options = {}) {
    const messageData = {
      thread_id: threadId,
      type: MessageTypes.STICKER,
      sticker_id: stickerId,
      timestamp: Date.now(),
      message_id: generateMessageId(),
      ...options
    };
    
    return await this._sendMessage(messageData);
  }
  
  /**
   * Send GIF
   */
  async sendGif(threadId, gifUrl, options = {}) {
    const messageData = {
      thread_id: threadId,
      type: MessageTypes.GIF,
      gif_url: gifUrl,
      timestamp: Date.now(),
      message_id: generateMessageId(),
      ...options
    };
    
    return await this._sendMessage(messageData);
  }
  
  /**
   * Send location
   */
  async sendLocation(threadId, latitude, longitude, name = '', options = {}) {
    const messageData = {
      thread_id: threadId,
      type: MessageTypes.LOCATION,
      latitude,
      longitude,
      location_name: name,
      timestamp: Date.now(),
      message_id: generateMessageId(),
      ...options
    };
    
    return await this._sendMessage(messageData);
  }
  
  /**
   * React to a message
   */
  async reactToMessage(messageId, reaction, options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const reactionData = {
      message_id: messageId,
      reaction,
      timestamp: Date.now(),
      ...options
    };
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation ReactToMessage($messageId: ID!, $reaction: String!) {
            reactToMessage(input: { messageId: $messageId, reaction: $reaction }) {
              success
              reaction
            }
          }
        `,
        variables: {
          messageId,
          reaction
        }
      }, {
        headers: this._getMessageHeaders()
      });
      
      return response.data;
    } catch (error) {
      throw new MessengerError(`Failed to react to message: ${error.message}`);
    }
  }
  
  /**
   * Mark message as read
   */
  async markAsRead(threadId, messageId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation MarkAsRead($threadId: ID!, $messageId: ID!) {
            markAsRead(input: { threadId: $threadId, messageId: $messageId }) {
              success
            }
          }
        `,
        variables: {
          threadId,
          messageId
        }
      }, {
        headers: this._getMessageHeaders()
      });
      
      return response.data;
    } catch (error) {
      throw new MessengerError(`Failed to mark message as read: ${error.message}`);
    }
  }
  
  /**
   * Send typing indicator
   */
  async sendTyping(threadId, isTyping = true) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      // Send typing indicator via WebSocket for real-time updates
      await this.websocket.sendTyping(threadId, isTyping);
      
      return { success: true, typing: isTyping };
    } catch (error) {
      throw new MessengerError(`Failed to send typing indicator: ${error.message}`);
    }
  }
  
  /**
   * Get message history
   */
  async getHistory(threadId, options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { limit = 50, before = null, after = null } = options;
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetMessageHistory($threadId: ID!, $limit: Int!, $before: String, $after: String) {
            thread(id: $threadId) {
              messages(first: $limit, before: $before, after: $after) {
                edges {
                  node {
                    id
                    text
                    type
                    timestamp
                    sender {
                      id
                      name
                      profile_pic
                    }
                    reactions {
                      reaction
                      user {
                        id
                        name
                      }
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
              }
            }
          }
        `,
        variables: {
          threadId,
          limit,
          before,
          after
        }
      }, {
        headers: this._getMessageHeaders()
      });
      
      return response.data.data.thread.messages;
    } catch (error) {
      throw new MessengerError(`Failed to get message history: ${error.message}`);
    }
  }
  
  /**
   * Search messages
   */
  async search(query, options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { limit = 50, threadId = null, type = null } = options;
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query SearchMessages($query: String!, $limit: Int!, $threadId: ID, $type: String) {
            searchMessages(query: $query, first: $limit, threadId: $threadId, type: $type) {
              edges {
                node {
                  id
                  text
                  type
                  timestamp
                  thread {
                    id
                    name
                  }
                  sender {
                    id
                    name
                    profile_pic
                  }
                }
              }
              pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
              }
            }
          }
        `,
        variables: {
          query,
          limit,
          threadId,
          type
        }
      }, {
        headers: this._getMessageHeaders()
      });
      
      return response.data.data.searchMessages;
    } catch (error) {
      throw new MessengerError(`Failed to search messages: ${error.message}`);
    }
  }
  
  /**
   * Internal message sending method
   */
  async _sendMessage(messageData) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    // Rate limiting
    await this._checkRateLimit();
    
    try {
      // Encrypt message if needed
      const encryptedMessage = await this._encryptMessageIfNeeded(messageData);
      
      // Send via GraphQL API
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation SendMessage($input: SendMessageInput!) {
            sendMessage(input: $input) {
              success
              message {
                id
                text
                type
                timestamp
                thread_id
              }
            }
          }
        `,
        variables: {
          input: encryptedMessage
        }
      }, {
        headers: this._getMessageHeaders()
      });
      
      if (response.data.data.sendMessage.success) {
        const sentMessage = response.data.data.sendMessage.message;
        
        // Store sent message
        this.sentMessages.set(sentMessage.id, sentMessage);
        
        // Update rate limiting
        this._updateRateLimit();
        
        // Emit message sent event
        this.client.emit('messageSent', sentMessage);
        
        return sentMessage;
      } else {
        throw new MessengerError('Failed to send message');
      }
    } catch (error) {
      throw new MessengerError(`Failed to send message: ${error.message}`);
    }
  }
  
  /**
   * Upload media file
   */
  async _uploadMedia(mediaData) {
    const { type, data, filename } = mediaData;
    
    try {
      const formData = new FormData();
      formData.append('file', data, filename);
      formData.append('type', type);
      formData.append('thread_id', mediaData.threadId);
      
      const response = await this.network.post(Endpoints.UPLOAD_API, formData, {
        headers: {
          ...this._getMessageHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        return {
          media_id: response.data.media_id,
          url: response.data.url
        };
      } else {
        throw new MessengerError('Media upload failed');
      }
    } catch (error) {
      throw new MessengerError(`Media upload failed: ${error.message}`);
    }
  }
  
  /**
   * Encrypt message if encryption is enabled
   */
  async _encryptMessageIfNeeded(messageData) {
    // For now, return message as-is
    // Encryption can be implemented later based on Messenger's protocol
    return messageData;
  }
  
  /**
   * Check rate limiting
   */
  async _checkRateLimit() {
    const now = Date.now();
    
    // Reset counter if minute has passed
    if (now > this.rateLimitResetTime) {
      this.messageCount = 0;
      this.rateLimitResetTime = now + (60 * 1000);
    }
    
    // Check if we're over the limit (max 30 messages per minute)
    if (this.messageCount >= 30) {
      const waitTime = this.rateLimitResetTime - now;
      throw new MessengerError(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    // Ensure minimum delay between messages
    const timeSinceLastMessage = now - this.lastMessageTime;
    if (timeSinceLastMessage < 1000) { // 1 second minimum
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastMessage));
    }
  }
  
  /**
   * Update rate limiting counters
   */
  _updateRateLimit() {
    this.messageCount++;
    this.lastMessageTime = Date.now();
  }
  
  /**
   * Get maximum file size for media type
   */
  _getMaxSizeForType(type) {
    switch (type) {
      case MessageTypes.IMAGE:
        return Limits.MAX_IMAGE_SIZE;
      case MessageTypes.VIDEO:
        return Limits.MAX_VIDEO_SIZE;
      case MessageTypes.AUDIO:
        return Limits.MAX_AUDIO_SIZE;
      case MessageTypes.FILE:
        return Limits.MAX_FILE_SIZE;
      case MessageTypes.STICKER:
        return Limits.MAX_STICKER_SIZE;
      default:
        return Limits.MAX_FILE_SIZE;
    }
  }
  
  /**
   * Get headers for message requests
   */
  _getMessageHeaders() {
    return {
      'Authorization': `Bearer ${this.client.auth.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    };
  }
  
  /**
   * Handle incoming message from WebSocket
   */
  handleIncomingMessage(messageData) {
    const message = {
      id: messageData.message_id,
      text: messageData.text,
      type: messageData.type,
      timestamp: messageData.timestamp,
      thread_id: messageData.thread_id,
      sender: messageData.sender,
      ...messageData
    };
    
    // Store received message
    this.receivedMessages.set(message.id, message);
    
    // Emit message received event
    this.client.emit('messageReceived', message);
    
    return message;
  }
  
  /**
   * Get message statistics
   */
  getStats() {
    return {
      sentCount: this.sentMessages.size,
      receivedCount: this.receivedMessages.size,
      queueLength: this.messageQueue.length,
      messageCount: this.messageCount,
      rateLimitResetTime: this.rateLimitResetTime
    };
  }
}

module.exports = MessageManager;