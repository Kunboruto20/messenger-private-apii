# Messenger Private API

A comprehensive Node.js library that completely emulates the Messenger mobile application, providing real-time messaging capabilities, contact management, and full integration with Facebook's Messenger platform.

## Overview

Messenger Private API is designed to give developers complete control over Messenger functionality through a clean, intuitive API. Unlike web-based alternatives, this library directly emulates the mobile application's behavior, ensuring compatibility and reliability.

## Features

### Core Functionality
- **Complete Authentication System** - Support for email, phone, username, and two-factor authentication
- **Real-time Messaging** - WebSocket-based communication with instant message delivery
- **Media Support** - Send and receive images, videos, audio, files, stickers, and GIFs
- **Contact Management** - Full contact list, friend management, and user search capabilities
- **Chat Management** - Create, manage, and participate in group conversations
- **Message History** - Retrieve and search through conversation archives

### Advanced Features
- **Rate Limiting** - Built-in protection against API restrictions
- **Auto-reconnection** - Seamless handling of connection drops
- **Encryption** - Message encryption and security features
- **Event System** - Comprehensive event handling for all Messenger activities
- **Caching** - Intelligent caching for improved performance
- **Error Handling** - Detailed error categorization and recovery mechanisms

## Installation

```bash
npm install messenger-private-api
```

## Quick Start

### Basic Setup

```javascript
const { MessengerClient, AuthMethods } = require('messenger-private-api');

// Create client instance
const client = new MessengerClient({
  autoReconnect: true,
  rateLimitDelay: 1000,
  maxRetries: 3
});

// Setup event listeners
client.on('message', (message) => {
  console.log(`New message: ${message.text}`);
});

client.on('connection', (data) => {
  console.log(`Connection status: ${data.status}`);
});
```

### Authentication

```javascript
// Login with email and password
try {
  const authResult = await client.login({
    email: 'your-email@example.com',
    password: 'your-password'
  }, AuthMethods.EMAIL);

  if (authResult.requiresTwoFactor) {
    // Handle two-factor authentication
    const twoFactorResult = await client.login({
      code: '123456', // Get this from user input
      method: authResult.method
    }, AuthMethods.TWO_FACTOR);
  }

  console.log('Successfully authenticated!');
} catch (error) {
  console.error('Authentication failed:', error.message);
}
```

### Sending Messages

```javascript
// Send text message
const message = await client.sendMessage('thread-id-123', 'Hello, World!');
console.log(`Message sent with ID: ${message.id}`);

// Send media message
const mediaData = {
  type: 'image',
  data: fs.readFileSync('image.jpg'),
  filename: 'image.jpg',
  caption: 'Check out this image!'
};

const mediaMessage = await client.sendMedia('thread-id-123', mediaData);
console.log(`Media message sent: ${mediaMessage.id}`);
```

### Receiving Messages

```javascript
// Listen for incoming messages
client.on('message', async (message) => {
  console.log(`Message from ${message.sender.name}: ${message.text}`);
  
  // Auto-reply example
  if (message.text.toLowerCase().includes('hello')) {
    await client.sendMessage(message.thread_id, 'Hi there! How can I help you?');
  }
});

// Listen for delivery confirmations
client.on('delivery', (data) => {
  console.log(`Message ${data.message_id} delivered`);
});

// Listen for read receipts
client.on('read', (data) => {
  console.log(`Message ${data.message_id} read by user`);
});
```

## API Reference

### MessengerClient

The main class for interacting with Messenger.

#### Constructor Options

```javascript
const client = new MessengerClient({
  autoReconnect: true,        // Enable automatic reconnection
  rateLimitDelay: 1000,       // Delay between requests (ms)
  maxRetries: 3,              // Maximum retry attempts
  retryDelay: 2000            // Delay between retries (ms)
});
```

#### Authentication Methods

```javascript
// Email authentication
await client.login({
  email: 'user@example.com',
  password: 'password123'
}, AuthMethods.EMAIL);

// Phone authentication
await client.login({
  phone: '+1234567890',
  password: 'password123'
}, AuthMethods.PHONE);

// Username authentication
await client.login({
  username: 'username',
  password: 'password123'
}, AuthMethods.USERNAME);
```

#### Messaging Methods

```javascript
// Send text message
await client.sendMessage(threadId, text, options);

// Send media message
await client.sendMedia(threadId, mediaData, options);

// Send typing indicator
await client.sendTyping(threadId, isTyping);

// Mark message as read
await client.markAsRead(threadId, messageId);

// React to message
await client.reactToMessage(messageId, reaction);
```

#### Contact Management

```javascript
// Get contacts
const contacts = await client.getContacts({
  limit: 100,
  offset: 0,
  forceRefresh: false
});

// Get friends list
const friends = await client.getFriends({
  limit: 100,
  offset: 0
});

// Search users
const searchResults = await client.searchUsers('john', {
  limit: 50,
  type: 'all'
});

// Add friend
await client.addFriend(userId);

// Remove friend
await client.removeFriend(userId);
```

#### Chat Management

```javascript
// Get chat threads
const chats = await client.getChats({
  limit: 50,
  offset: 0,
  type: 'all'
});

// Get specific chat
const chat = await client.getChatById(threadId);

// Create new chat
const newChat = await client.createChat([userId1, userId2], {
  name: 'Group Chat',
  description: 'A new group chat',
  isGroup: true
});

// Create group chat
const groupChat = await client.createGroupChat(
  [userId1, userId2, userId3],
  'My Group',
  { description: 'Group description' }
);
```

### Event System

The library provides comprehensive event handling for real-time updates.

#### Available Events

```javascript
// Connection events
client.on('connection', (data) => {
  console.log(`Connection: ${data.status}`);
});

client.on('disconnection', (data) => {
  console.log(`Disconnection: ${data.status}`);
});

// Message events
client.on('message', (message) => {
  console.log(`New message: ${message.text}`);
});

client.on('messageSent', (message) => {
  console.log(`Message sent: ${message.text}`);
});

client.on('messageReceived', (message) => {
  console.log(`Message received: ${message.text}`);
});

// Delivery and read events
client.on('delivery', (data) => {
  console.log(`Message delivered: ${data.message_id}`);
});

client.on('read', (data) => {
  console.log(`Message read: ${data.message_id}`);
});

// Typing indicators
client.on('typing', (data) => {
  const status = data.typing ? 'started' : 'stopped';
  console.log(`User ${data.user_id} ${status} typing`);
});

// Online status
client.on('online', (data) => {
  console.log(`User ${data.user_id} is online`);
});

client.on('offline', (data) => {
  console.log(`User ${data.user_id} is offline`);
});

// Error handling
client.on('error', (error) => {
  console.error('Client error:', error.message);
});
```

### Error Handling

The library provides detailed error categorization and recovery mechanisms.

```javascript
try {
  await client.sendMessage(threadId, 'Hello');
} catch (error) {
  switch (error.name) {
    case 'AuthError':
      console.error('Authentication error:', error.message);
      break;
    case 'NetworkError':
      console.error('Network error:', error.message);
      if (error.isRetryable()) {
        console.log('This error can be retried');
      }
      break;
    case 'RateLimitError':
      console.error('Rate limit exceeded');
      console.log(`Retry after ${error.getRetryAfter()} seconds`);
      break;
    case 'ValidationError':
      console.error('Validation error:', error.message);
      break;
    default:
      console.error('Unknown error:', error.message);
  }
}
```

## Advanced Usage

### Bot Implementation

```javascript
class MessengerBot {
  constructor() {
    this.client = new MessengerClient();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('message', this.handleMessage.bind(this));
    this.client.on('connection', this.handleConnection.bind(this));
  }

  async handleMessage(message) {
    if (message.text.startsWith('/')) {
      await this.handleCommand(message);
    } else {
      await this.handleAutoReply(message);
    }
  }

  async handleCommand(message) {
    const command = message.text.slice(1).toLowerCase();
    
    switch (command) {
      case 'help':
        await this.client.sendMessage(message.thread_id, 'Available commands: /help, /status, /ping');
        break;
      case 'status':
        const status = this.client.getStatus();
        await this.client.sendMessage(message.thread_id, `Bot status: ${JSON.stringify(status)}`);
        break;
      case 'ping':
        await this.client.sendMessage(message.thread_id, 'Pong!');
        break;
    }
  }

  async handleAutoReply(message) {
    const text = message.text.toLowerCase();
    
    if (text.includes('hello') || text.includes('hi')) {
      await this.client.sendMessage(message.thread_id, 'Hello! How can I help you?');
    }
  }

  async start(credentials) {
    await this.client.login(credentials);
    console.log('Bot started successfully!');
  }
}

// Usage
const bot = new MessengerBot();
bot.start({
  email: 'bot@example.com',
  password: 'botpassword'
});
```

### Media Handling

```javascript
// Send image with caption
const imageData = {
  type: 'image',
  data: fs.readFileSync('photo.jpg'),
  filename: 'photo.jpg',
  caption: 'Beautiful sunset!'
};

await client.sendMedia(threadId, imageData);

// Send video
const videoData = {
  type: 'video',
  data: fs.readFileSync('video.mp4'),
  filename: 'video.mp4',
  caption: 'Check out this video!'
};

await client.sendMedia(threadId, videoData);

// Send file
const fileData = {
  type: 'file',
  data: fs.readFileSync('document.pdf'),
  filename: 'document.pdf'
};

await client.sendMedia(threadId, fileData);
```

### Group Chat Management

```javascript
// Add participants to group
await client.addParticipants(threadId, [userId1, userId2]);

// Remove participants from group
await client.removeParticipants(threadId, [userId1]);

// Update group settings
await client.updateGroupSettings(threadId, {
  name: 'New Group Name',
  description: 'Updated description',
  coverPhoto: 'https://example.com/cover.jpg'
});

// Leave group chat
await client.leaveGroupChat(threadId);
```

## Configuration

### Environment Variables

```bash
# Set environment variables for configuration
export MESSENGER_API_DEBUG=true
export MESSENGER_API_TIMEOUT=30000
export MESSENGER_API_MAX_RETRIES=5
```

### Client Configuration

```javascript
const client = new MessengerClient({
  // Connection settings
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
  
  // Rate limiting
  rateLimitDelay: 1000,
  maxRequestsPerMinute: 60,
  
  // Timeouts
  requestTimeout: 30000,
  websocketTimeout: 10000,
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 2000,
  
  // Caching
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
  
  // Logging
  debug: process.env.NODE_ENV === 'development',
  logLevel: 'info'
});
```

## Security Considerations

### Authentication Security
- Never store credentials in plain text
- Use environment variables for sensitive data
- Implement proper session management
- Handle two-factor authentication securely

### Data Protection
- Encrypt sensitive data at rest
- Use secure connections (HTTPS/WSS)
- Implement proper access controls
- Regular security audits

### Rate Limiting
- Respect API rate limits
- Implement exponential backoff
- Monitor usage patterns
- Handle rate limit errors gracefully

## Troubleshooting

### Common Issues

#### Authentication Problems
```javascript
// Check if credentials are correct
try {
  await client.login(credentials);
} catch (error) {
  if (error.name === 'AuthError') {
    console.log('Check your email/password');
  }
}
```

#### Connection Issues
```javascript
// Check connection status
const status = client.getStatus();
console.log('Connection status:', status);

// Manual reconnection
if (!status.isConnected) {
  await client.websocket.connect();
}
```

#### Message Sending Failures
```javascript
// Check message limits
const messageLength = text.length;
if (messageLength > 20000) {
  console.error('Message too long');
}

// Check file size limits
const fileSize = fileData.length;
if (fileSize > 25 * 1024 * 1024) { // 25MB
  console.error('File too large');
}
```

### Debug Mode

```javascript
const client = new MessengerClient({
  debug: true,
  logLevel: 'debug'
});

// Enable detailed logging
client.on('debug', (message) => {
  console.log('Debug:', message);
});
```

## Performance Optimization

### Caching Strategies
```javascript
// Force refresh contacts
const contacts = await client.getContacts({
  forceRefresh: true
});

// Use cached data when possible
const contacts = await client.getContacts({
  forceRefresh: false // Use cache if available
});
```

### Batch Operations
```javascript
// Send multiple messages efficiently
const messages = ['Hello', 'How are you?', 'Goodbye'];
for (const message of messages) {
  await client.sendMessage(threadId, message);
  // Add delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### Connection Management
```javascript
// Optimize WebSocket connection
client.websocket.on('connect', () => {
  console.log('WebSocket connected, optimizing...');
});

client.websocket.on('disconnect', () => {
  console.log('WebSocket disconnected, attempting reconnection...');
});
```

## Examples

### Complete Bot Example
See `examples/advanced-usage.js` for a comprehensive bot implementation.

### Basic Usage Example
See `examples/basic-usage.js` for simple usage patterns.

### Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- test/basic.test.js
```

## Contributing

We welcome contributions! Please see our contributing guidelines for details.

### Development Setup
```bash
# Clone repository
git clone https://github.com/yourusername/messenger-private-api.git

# Install dependencies
npm install

# Run tests
npm test

# Build project
npm run build
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

### Documentation
- [API Reference](docs/API.md)
- [Examples](examples/)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

### Community
- [GitHub Issues](https://github.com/yourusername/messenger-private-api/issues)
- [Discussions](https://github.com/yourusername/messenger-private-api/discussions)
- [Wiki](https://github.com/yourusername/messenger-private-api/wiki)

### Professional Support
For enterprise support and custom implementations, please contact our team.

---

**Note**: This library is for educational and development purposes. Please ensure compliance with Facebook's Terms of Service and applicable laws when using this library.
