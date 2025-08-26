/**
 * Advanced Usage Example for Messenger Private API
 * Demonstrates advanced features and best practices
 */

const { MessengerClient, AuthMethods, MessageTypes } = require('../src/index');
const fs = require('fs').promises;
const path = require('path');

class AdvancedMessengerBot {
  constructor(options = {}) {
    this.client = new MessengerClient({
      autoReconnect: true,
      rateLimitDelay: 1000,
      maxRetries: 3,
      ...options
    });
    
    this.isRunning = false;
    this.autoReplyEnabled = false;
    this.messageHandlers = new Map();
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      commandsProcessed: 0,
      errors: 0
    };
    
    this.setupEventListeners();
    this.setupCommandHandlers();
  }
  
  /**
   * Start the bot
   */
  async start(credentials) {
    try {
      console.log('🤖 Starting Advanced Messenger Bot...');
      
      // Authenticate
      await this.authenticate(credentials);
      
      // Get initial data
      await this.initializeBot();
      
      this.isRunning = true;
      console.log('✅ Bot started successfully!');
      
      // Keep running
      await this.runLoop();
      
    } catch (error) {
      console.error('❌ Failed to start bot:', error.message);
      throw error;
    }
  }
  
  /**
   * Stop the bot
   */
  async stop() {
    console.log('🛑 Stopping bot...');
    this.isRunning = false;
    
    try {
      await this.client.logout();
      this.client.destroy();
      console.log('✅ Bot stopped successfully');
    } catch (error) {
      console.error('⚠️  Error stopping bot:', error.message);
    }
  }
  
  /**
   * Authenticate with Messenger
   */
  async authenticate(credentials) {
    console.log('🔐 Authenticating...');
    
    const authResult = await this.client.login(credentials, AuthMethods.EMAIL);
    
    if (authResult.requiresTwoFactor) {
      console.log(`🔐 Two-factor authentication required: ${authResult.method}`);
      
      // In a real application, you would prompt the user for the 2FA code
      const twoFactorCode = await this.promptForTwoFactorCode(authResult.method);
      
      await this.client.login({
        code: twoFactorCode,
        method: authResult.method
      }, AuthMethods.TWO_FACTOR);
    }
    
    console.log('✅ Authentication successful');
  }
  
  /**
   * Initialize bot with initial data
   */
  async initializeBot() {
    console.log('🚀 Initializing bot...');
    
    // Get user profile
    this.profile = await this.client.getProfile();
    console.log(`👤 Logged in as: ${this.profile.name}`);
    
    // Get contacts and chats
    this.contacts = await this.client.getContacts({ limit: 100 });
    this.chats = await this.client.getChats({ limit: 50 });
    
    console.log(`👥 Loaded ${this.contacts.totalCount} contacts`);
    console.log(`💬 Loaded ${this.chats.totalCount} chat threads`);
  }
  
  /**
   * Main bot loop
   */
  async runLoop() {
    console.log('🔄 Bot is running. Press Ctrl+C to stop.');
    
    while (this.isRunning) {
      try {
        // Update bot status every 5 minutes
        await this.updateBotStatus();
        
        // Wait before next iteration
        await this.sleep(5 * 60 * 1000);
        
      } catch (error) {
        console.error('❌ Error in bot loop:', error.message);
        this.stats.errors++;
        
        // Wait before retrying
        await this.sleep(30 * 1000);
      }
    }
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Message events
    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error('❌ Error handling message:', error.message);
        this.stats.errors++;
      }
    });
    
    // Connection events
    this.client.on('connection', (data) => {
      console.log(`🔗 Connection: ${data.status}`);
    });
    
    this.client.on('disconnection', (data) => {
      console.log(`🔌 Disconnection: ${data.status}`);
    });
    
    // Error events
    this.client.on('error', (error) => {
      console.error(`❌ Client error: ${error.message}`);
      this.stats.errors++;
    });
  }
  
  /**
   * Setup command handlers
   */
  setupCommandHandlers() {
    // Help command
    this.messageHandlers.set('help', async (message, threadId) => {
      const helpText = `
🤖 **Bot Commands:**

**Basic Commands:**
• \`help\` - Show this help message
• \`status\` - Show bot status
• \`stats\` - Show bot statistics
• \`ping\` - Test bot response

**Chat Management:**
• \`create group <name>\` - Create a new group
• \`add <user> to <group>\` - Add user to group
• \`remove <user> from <group>\` - Remove user from group

**Auto-reply:**
• \`auto-reply on\` - Enable auto-reply
• \`auto-reply off\` - Disable auto-reply
• \`set reply <text>\` - Set auto-reply message

**Utilities:**
• \`search <query>\` - Search messages
• \`contacts\` - List contacts
• \`chats\` - List chat threads

**Admin Commands:**
• \`broadcast <message>\` - Send message to all chats
• \`export contacts\` - Export contacts list
• \`backup\` - Create backup of data
      `.trim();
      
      await this.client.sendMessage(threadId, helpText);
    });
    
    // Status command
    this.messageHandlers.set('status', async (message, threadId) => {
      const status = this.client.getStatus();
      const statusText = `
📊 **Bot Status:**

**Connection:**
• Authenticated: ${status.isAuthenticated ? '✅' : '❌'}
• WebSocket: ${status.isConnected ? '✅' : '❌'}
• User ID: ${status.userId || 'N/A'}

**Statistics:**
• Messages Sent: ${this.stats.messagesSent}
• Messages Received: ${this.stats.messagesReceived}
• Commands Processed: ${this.stats.commandsProcessed}
• Errors: ${this.stats.errors}

**Auto-reply:**
• Enabled: ${this.autoReplyEnabled ? '✅' : '❌'}

**System:**
• Uptime: ${this.getUptime()}
• Memory: ${this.getMemoryUsage()}
      `.trim();
      
      await this.client.sendMessage(threadId, statusText);
    });
    
    // Stats command
    this.messageHandlers.set('stats', async (message, threadId) => {
      const statsText = `
📈 **Bot Statistics:**

**Messages:**
• Sent: ${this.stats.messagesSent}
• Received: ${this.stats.messagesReceived}
• Total: ${this.stats.messagesSent + this.stats.messagesReceived}

**Commands:**
• Processed: ${this.stats.commandsProcessed}
• Success Rate: ${this.calculateSuccessRate()}%

**Performance:**
• Errors: ${this.stats.errors}
• Error Rate: ${this.calculateErrorRate()}%

**Contacts & Chats:**
• Contacts: ${this.contacts?.totalCount || 0}
• Chat Threads: ${this.chats?.totalCount || 0}
      `.trim();
      
      await this.client.sendMessage(threadId, statsText);
    });
    
    // Ping command
    this.messageHandlers.set('ping', async (message, threadId) => {
      const startTime = Date.now();
      await this.client.sendMessage(threadId, '🏓 Pong!');
      const responseTime = Date.now() - startTime;
      
      await this.client.sendMessage(threadId, `⏱️ Response time: ${responseTime}ms`);
    });
    
    // Auto-reply commands
    this.messageHandlers.set('auto-reply', async (message, threadId) => {
      const args = message.text.split(' ');
      const action = args[1];
      
      if (action === 'on') {
        this.autoReplyEnabled = true;
        await this.client.sendMessage(threadId, '✅ Auto-reply enabled');
      } else if (action === 'off') {
        this.autoReplyEnabled = false;
        await this.client.sendMessage(threadId, '❌ Auto-reply disabled');
      } else {
        await this.client.sendMessage(threadId, '❓ Usage: auto-reply [on|off]');
      }
    });
    
    // Search command
    this.messageHandlers.set('search', async (message, threadId) => {
      const query = message.text.replace(/^search\s+/i, '').trim();
      
      if (!query) {
        await this.client.sendMessage(threadId, '❓ Usage: search <query>');
        return;
      }
      
      try {
        const results = await this.client.searchMessages(query, { limit: 10 });
        
        if (results.users && results.users.length > 0) {
          const resultText = results.users.map(msg => 
            `• ${msg.text} (${msg.thread?.name || 'Unknown'})`
          ).join('\n');
          
          await this.client.sendMessage(threadId, `🔍 **Search Results for "${query}":**\n\n${resultText}`);
        } else {
          await this.client.sendMessage(threadId, `🔍 No messages found for "${query}"`);
        }
      } catch (error) {
        await this.client.sendMessage(threadId, `❌ Search failed: ${error.message}`);
      }
    });
    
    // Contacts command
    this.messageHandlers.set('contacts', async (message, threadId) => {
      try {
        const contacts = await this.client.getContacts({ limit: 20 });
        
        if (contacts.contacts && contacts.contacts.length > 0) {
          const contactList = contacts.contacts.map(contact => 
            `• ${contact.name} (${contact.is_friend ? 'Friend' : 'Contact'})`
          ).join('\n');
          
          await this.client.sendMessage(threadId, `👥 **Contacts (${contacts.totalCount}):**\n\n${contactList}`);
        } else {
          await this.client.sendMessage(threadId, '👥 No contacts found');
        }
      } catch (error) {
        await this.client.sendMessage(threadId, `❌ Failed to get contacts: ${error.message}`);
      }
    });
    
    // Chats command
    this.messageHandlers.set('chats', async (message, threadId) => {
      try {
        const chats = await this.client.getChats({ limit: 20 });
        
        if (chats.chats && chats.chats.length > 0) {
          const chatList = chats.chats.map(chat => 
            `• ${chat.name || 'Unnamed'} (${chat.is_group ? 'Group' : 'Direct'}) - ${chat.participants?.length || 0} participants`
          ).join('\n');
          
          await this.client.sendMessage(threadId, `💬 **Chat Threads (${chats.totalCount}):**\n\n${chatList}`);
        } else {
          await this.client.sendMessage(threadId, '💬 No chat threads found');
        }
      } catch (error) {
        await this.client.sendMessage(threadId, `❌ Failed to get chats: ${error.message}`);
      }
    });
  }
  
  /**
   * Handle incoming messages
   */
  async handleIncomingMessage(message) {
    this.stats.messagesReceived++;
    
    // Check if it's a command
    if (message.text && message.text.startsWith('/')) {
      await this.handleCommand(message);
      return;
    }
    
    // Handle auto-reply
    if (this.autoReplyEnabled && message.sender?.id !== this.client.userId) {
      await this.handleAutoReply(message);
    }
    
    // Log message
    console.log(`📨 Message from ${message.sender?.name || 'Unknown'}: ${message.text}`);
  }
  
  /**
   * Handle bot commands
   */
  async handleCommand(message) {
    const command = message.text.slice(1).split(' ')[0].toLowerCase();
    const handler = this.messageHandlers.get(command);
    
    if (handler) {
      try {
        await handler(message, message.thread_id);
        this.stats.commandsProcessed++;
        console.log(`✅ Command processed: ${command}`);
      } catch (error) {
        console.error(`❌ Error processing command ${command}:`, error.message);
        await this.client.sendMessage(message.thread_id, `❌ Error processing command: ${error.message}`);
      }
    } else {
      await this.client.sendMessage(message.thread_id, `❓ Unknown command: ${command}. Type /help for available commands.`);
    }
  }
  
  /**
   * Handle auto-reply
   */
  async handleAutoReply(message) {
    try {
      const replyText = this.getAutoReplyText(message);
      if (replyText) {
        await this.client.sendMessage(message.thread_id, replyText);
        this.stats.messagesSent++;
      }
    } catch (error) {
      console.error('❌ Auto-reply failed:', error.message);
    }
  }
  
  /**
   * Get auto-reply text
   */
  getAutoReplyText(message) {
    // Simple auto-reply logic
    const text = message.text.toLowerCase();
    
    if (text.includes('hello') || text.includes('hi')) {
      return '👋 Hello! I\'m an automated bot. How can I help you?';
    }
    
    if (text.includes('how are you')) {
      return '🤖 I\'m doing well, thank you for asking!';
    }
    
    if (text.includes('time')) {
      return `🕐 The current time is: ${new Date().toLocaleString()}`;
    }
    
    if (text.includes('weather')) {
      return '🌤️ I\'m sorry, I don\'t have access to weather information yet.';
    }
    
    return null; // No auto-reply
  }
  
  /**
   * Update bot status
   */
  async updateBotStatus() {
    try {
      // Update status every 5 minutes
      const status = `🤖 Bot is running | Uptime: ${this.getUptime()} | Messages: ${this.stats.messagesSent + this.stats.messagesReceived}`;
      await this.client.updateStatus(status);
    } catch (error) {
      console.error('⚠️  Failed to update status:', error.message);
    }
  }
  
  /**
   * Utility methods
   */
  getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return `${Math.round(usage.heapUsed / 1024 / 1024)}MB / ${Math.round(usage.heapTotal / 1024 / 1024)}MB`;
  }
  
  calculateSuccessRate() {
    const total = this.stats.commandsProcessed;
    return total > 0 ? Math.round(((total - this.stats.errors) / total) * 100) : 100;
  }
  
  calculateErrorRate() {
    const total = this.stats.messagesSent + this.stats.messagesReceived;
    return total > 0 ? Math.round((this.stats.errors / total) * 100) : 0;
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async promptForTwoFactorCode(method) {
    // In a real application, this would prompt the user
    // For now, we'll throw an error
    throw new Error(`Two-factor authentication required (${method}). Please implement promptForTwoFactorCode method.`);
  }
}

// Example usage
async function runAdvancedBot() {
  const bot = new AdvancedMessengerBot();
  
  try {
    await bot.start({
      email: 'your-email@example.com',
      password: 'your-password'
    });
  } catch (error) {
    console.error('❌ Bot failed to start:', error.message);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot...');
  process.exit(0);
});

// Export for use in other modules
module.exports = { AdvancedMessengerBot, runAdvancedBot };

// Run if this file is executed directly
if (require.main === module) {
  console.log('🤖 Advanced Messenger Bot Example');
  console.log('⚠️  This is an example. Please modify credentials before running.');
  console.log('📖 See the code for implementation details.\n');
}