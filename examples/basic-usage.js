/**
 * Basic Usage Example for Messenger Private API
 * Demonstrates the main functionality of the library
 */

const { MessengerClient, AuthMethods, MessageTypes } = require('../src/index');

async function main() {
  console.log('🚀 Starting Messenger Private API Example\n');
  
  // Create client instance
  const client = new MessengerClient({
    autoReconnect: true,
    rateLimitDelay: 1000,
    maxRetries: 3
  });
  
  try {
    // Setup event listeners
    setupEventListeners(client);
    
    // Authenticate with Messenger
    console.log('📱 Authenticating with Messenger...');
    const authResult = await client.login({
      email: 'your-email@example.com',
      password: 'your-password'
    }, AuthMethods.EMAIL);
    
    if (authResult.requiresTwoFactor) {
      console.log(`🔐 Two-factor authentication required: ${authResult.method}`);
      
      // Handle 2FA (you would get this from user input)
      const twoFactorResult = await client.login({
        code: '123456', // Replace with actual 2FA code
        method: authResult.method
      }, AuthMethods.TWO_FACTOR);
      
      console.log('✅ Two-factor authentication completed');
    }
    
    console.log('✅ Authentication successful!');
    console.log(`👤 User ID: ${client.userId}\n`);
    
    // Get user profile
    console.log('👤 Getting user profile...');
    const profile = await client.getProfile();
    console.log(`Name: ${profile.name}`);
    console.log(`Email: ${profile.email}\n`);
    
    // Get contacts
    console.log('👥 Getting contacts...');
    const contacts = await client.getContacts({ limit: 10 });
    console.log(`Found ${contacts.totalCount} contacts\n`);
    
    // Get chat threads
    console.log('💬 Getting chat threads...');
    const chats = await client.getChats({ limit: 5 });
    console.log(`Found ${chats.totalCount} chat threads\n`);
    
    // Send a message to the first chat
    if (chats.chats.length > 0) {
      const firstChat = chats.chats[0];
      console.log(`💬 Sending message to: ${firstChat.name || 'Unknown'}`);
      
      const message = await client.sendMessage(firstChat.id, 'Hello from Messenger Private API! 👋');
      console.log(`✅ Message sent with ID: ${message.id}\n`);
      
      // Send typing indicator
      console.log('⌨️  Sending typing indicator...');
      await client.sendTyping(firstChat.id, true);
      
      // Wait a bit
      await sleep(2000);
      
      // Stop typing
      await client.sendTyping(firstChat.id, false);
      console.log('✅ Typing indicator stopped\n');
    }
    
    // Send media message (if you have a file)
    if (chats.chats.length > 0) {
      const firstChat = chats.chats[0];
      console.log(`📸 Sending media message to: ${firstChat.name || 'Unknown'}`);
      
      try {
        // Example: Send an image (you would need an actual file)
        const mediaData = {
          type: MessageTypes.IMAGE,
          data: Buffer.from('fake-image-data'), // Replace with actual file data
          filename: 'example.jpg',
          caption: 'Check out this image!'
        };
        
        const mediaMessage = await client.sendMedia(firstChat.id, mediaData);
        console.log(`✅ Media message sent with ID: ${mediaMessage.id}\n`);
      } catch (error) {
        console.log(`⚠️  Media message failed: ${error.message}\n`);
      }
    }
    
    // Search for messages
    console.log('🔍 Searching for messages...');
    const searchResults = await client.searchMessages('hello', { limit: 5 });
    console.log(`Found ${searchResults.users.length} messages containing 'hello'\n`);
    
    // Get message history for first chat
    if (chats.chats.length > 0) {
      const firstChat = chats.chats[0];
      console.log(`📚 Getting message history for: ${firstChat.name || 'Unknown'}`);
      
      const history = await client.getMessageHistory(firstChat.id, { limit: 10 });
      console.log(`Found ${history.edges.length} messages in history\n`);
    }
    
    // Keep the connection alive for a while to receive messages
    console.log('⏳ Keeping connection alive for 30 seconds to receive messages...');
    console.log('Press Ctrl+C to exit\n');
    
    await sleep(30000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.name === 'AuthError') {
      console.error('Authentication failed. Please check your credentials.');
    } else if (error.name === 'NetworkError') {
      console.error('Network error. Please check your internet connection.');
    } else if (error.name === 'RateLimitError') {
      console.error('Rate limit exceeded. Please wait before trying again.');
    }
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await client.logout();
    client.destroy();
    console.log('✅ Cleanup completed');
  }
}

/**
 * Setup event listeners for real-time updates
 */
function setupEventListeners(client) {
  // Connection events
  client.on('connection', (data) => {
    console.log(`🔗 Connection: ${data.status}`);
  });
  
  client.on('disconnection', (data) => {
    console.log(`🔌 Disconnection: ${data.status}`);
  });
  
  // Message events
  client.on('message', (message) => {
    console.log(`📨 New message from ${message.sender?.name || 'Unknown'}: ${message.text}`);
  });
  
  client.on('messageSent', (message) => {
    console.log(`✅ Message sent: ${message.text}`);
  });
  
  client.on('messageReceived', (message) => {
    console.log(`📥 Message received: ${message.text}`);
  });
  
  // Delivery and read events
  client.on('delivery', (data) => {
    console.log(`📬 Message delivered: ${data.message_id}`);
  });
  
  client.on('read', (data) => {
    console.log(`👁️  Message read: ${data.message_id}`);
  });
  
  // Typing events
  client.on('typing', (data) => {
    const status = data.typing ? 'started' : 'stopped';
    console.log(`⌨️  ${data.user_id} ${status} typing`);
  });
  
  // Online status events
  client.on('online', (data) => {
    console.log(`🟢 User ${data.user_id} is online`);
  });
  
  client.on('offline', (data) => {
    console.log(`🔴 User ${data.user_id} is offline`);
  });
  
  // Error events
  client.on('error', (error) => {
    console.error(`❌ Error: ${error.message}`);
  });
}

/**
 * Utility function to sleep for a specified number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle process termination
 */
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, setupEventListeners };