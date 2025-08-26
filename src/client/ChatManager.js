/**
 * ChatManager - Handles chat threads and group conversations
 * Manages chat creation, deletion, and thread information
 */

const { Endpoints } = require('../constants');
const { MessengerError, AuthError } = require('../utils/errors');

class ChatManager {
  constructor(client) {
    this.client = client;
    this.network = client.network;
    
    // Chat cache
    this.chats = new Map();
    this.threads = new Map();
    
    // Cache settings
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.lastCacheUpdate = 0;
  }
  
  /**
   * Get chat threads
   */
  async getChats(options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { forceRefresh = false, limit = 50, offset = 0, type = 'all' } = options;
    
    // Check cache if not forcing refresh
    if (!forceRefresh && this._isCacheValid()) {
      return this._getCachedChats(limit, offset, type);
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetChats($limit: Int!, $offset: Int!, $type: String!) {
            viewer {
              threads(first: $limit, offset: $offset, type: $type) {
                edges {
                  node {
                    id
                    name
                    type
                    participants {
                      id
                      name
                      first_name
                      last_name
                      profile_pic
                      online_status
                      last_seen
                    }
                    last_message {
                      id
                      text
                      type
                      timestamp
                      sender {
                        id
                        name
                      }
                    }
                    unread_count
                    updated_at
                    created_at
                    is_group
                    group_info {
                      name
                      description
                      cover_photo
                      admins {
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
                totalCount
              }
            }
          }
        `,
        variables: {
          limit,
          offset,
          type
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.viewer) {
        const threads = response.data.data.viewer.threads;
        
        // Update cache
        this._updateChatsCache(threads.edges);
        
        return {
          chats: threads.edges.map(edge => edge.node),
          pageInfo: threads.pageInfo,
          totalCount: threads.totalCount
        };
      }
      
      throw new MessengerError('Failed to get chats');
      
    } catch (error) {
      throw new MessengerError(`Failed to get chats: ${error.message}`);
    }
  }
  
  /**
   * Get chat thread by ID
   */
  async getChatById(threadId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    // Check cache first
    if (this.threads.has(threadId)) {
      return this.threads.get(threadId);
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetThread($threadId: ID!) {
            thread(id: $threadId) {
              id
              name
              type
              participants {
                id
                name
                first_name
                last_name
                profile_pic
                online_status
                last_seen
              }
              last_message {
                id
                text
                type
                timestamp
                sender {
                  id
                  name
                }
              }
              unread_count
              updated_at
              created_at
              is_group
              group_info {
                name
                description
                cover_photo
                admins {
                  id
                  name
                }
                members {
                  id
                  name
                  profile_pic
                }
              }
              settings {
                notifications_enabled
                mute_until
                theme
                emoji
              }
            }
          }
        `,
        variables: {
          threadId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.thread) {
        const thread = response.data.data.thread;
        
        // Update cache
        this.threads.set(threadId, thread);
        
        return thread;
      }
      
      throw new MessengerError('Thread not found');
      
    } catch (error) {
      throw new MessengerError(`Failed to get thread: ${error.message}`);
    }
  }
  
  /**
   * Create new chat thread
   */
  async createChat(participantIds, options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    if (!participantIds || participantIds.length === 0) {
      throw new MessengerError('At least one participant is required');
    }
    
    const { name, description, isGroup = false } = options;
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation CreateThread($input: CreateThreadInput!) {
            createThread(input: $input) {
              success
              thread {
                id
                name
                type
                participants {
                  id
                  name
                  profile_pic
                }
                created_at
              }
            }
          }
        `,
        variables: {
          input: {
            participantIds,
            name,
            description,
            isGroup
          }
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.createThread) {
        const result = response.data.data.createThread;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return result.thread;
        } else {
          throw new MessengerError('Failed to create thread');
        }
      }
      
      throw new MessengerError('Failed to create thread');
      
    } catch (error) {
      throw new MessengerError(`Failed to create thread: ${error.message}`);
    }
  }
  
  /**
   * Create group chat
   */
  async createGroupChat(participantIds, name, options = {}) {
    const { description, coverPhoto } = options;
    
    return await this.createChat(participantIds, {
      name,
      description,
      isGroup: true,
      coverPhoto
    });
  }
  
  /**
   * Delete chat thread
   */
  async deleteChat(threadId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation DeleteThread($threadId: ID!) {
            deleteThread(input: { threadId: $threadId }) {
              success
            }
          }
        `,
        variables: {
          threadId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.deleteThread) {
        const result = response.data.data.deleteThread;
        
        if (result.success) {
          // Remove from cache
          this.threads.delete(threadId);
          return { success: true };
        } else {
          throw new MessengerError('Failed to delete thread');
        }
      }
      
      throw new MessengerError('Failed to delete thread');
      
    } catch (error) {
      throw new MessengerError(`Failed to delete thread: ${error.message}`);
    }
  }
  
  /**
   * Leave group chat
   */
  async leaveGroupChat(threadId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation LeaveThread($threadId: ID!) {
            leaveThread(input: { threadId: $threadId }) {
              success
            }
          }
        `,
        variables: {
          threadId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.leaveThread) {
        const result = response.data.data.leaveThread;
        
        if (result.success) {
          // Remove from cache
          this.threads.delete(threadId);
          return { success: true };
        } else {
          throw new MessengerError('Failed to leave thread');
        }
      }
      
      throw new MessengerError('Failed to leave thread');
      
    } catch (error) {
      throw new MessengerError(`Failed to leave thread: ${error.message}`);
    }
  }
  
  /**
   * Add participants to group chat
   */
  async addParticipants(threadId, participantIds) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation AddParticipants($threadId: ID!, $participantIds: [ID!]!) {
            addParticipants(input: { threadId: $threadId, participantIds: $participantIds }) {
              success
              thread {
                id
                participants {
                  id
                  name
                  profile_pic
                }
              }
            }
          }
        `,
        variables: {
          threadId,
          participantIds
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.addParticipants) {
        const result = response.data.data.addParticipants;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return result.thread;
        } else {
          throw new MessengerError('Failed to add participants');
        }
      }
      
      throw new MessengerError('Failed to add participants');
      
    } catch (error) {
      throw new MessengerError(`Failed to add participants: ${error.message}`);
    }
  }
  
  /**
   * Remove participants from group chat
   */
  async removeParticipants(threadId, participantIds) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation RemoveParticipants($threadId: ID!, $participantIds: [ID!]!) {
            removeParticipants(input: { threadId: $threadId, participantIds: $participantIds }) {
              success
              thread {
                id
                participants {
                  id
                  name
                  profile_pic
                }
              }
            }
          }
        `,
        variables: {
          threadId,
          participantIds
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.removeParticipants) {
        const result = response.data.data.removeParticipants;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return result.thread;
        } else {
          throw new MessengerError('Failed to remove participants');
        }
      }
      
      throw new MessengerError('Failed to remove participants');
      
    } catch (error) {
      throw new MessengerError(`Failed to remove participants: ${error.message}`);
    }
  }
  
  /**
   * Update group chat settings
   */
  async updateGroupSettings(threadId, settings) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation UpdateThreadSettings($threadId: ID!, $input: UpdateThreadSettingsInput!) {
            updateThreadSettings(input: { threadId: $threadId, settings: $input }) {
              success
              thread {
                id
                name
                description
                cover_photo
                settings {
                  notifications_enabled
                  mute_until
                  theme
                  emoji
                }
              }
            }
          }
        `,
        variables: {
          threadId,
          input: settings
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.updateThreadSettings) {
        const result = response.data.data.updateThreadSettings;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return result.thread;
        } else {
          throw new MessengerError('Failed to update thread settings');
        }
      }
      
      throw new MessengerError('Failed to update thread settings');
      
    } catch (error) {
      throw new MessengerError(`Failed to update thread settings: ${error.message}`);
    }
  }
  
  /**
   * Search chat threads
   */
  async searchChats(query, options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { limit = 50, type = 'all' } = options;
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query SearchThreads($query: String!, $limit: Int!, $type: String!) {
            searchThreads(query: $query, first: $limit, type: $type) {
              edges {
                node {
                  id
                  name
                  type
                  participants {
                    id
                    name
                    profile_pic
                  }
                  last_message {
                    id
                    text
                    timestamp
                    sender {
                      id
                      name
                    }
                  }
                  unread_count
                  updated_at
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
          type
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.searchThreads) {
        const results = response.data.data.searchThreads;
        
        return {
          chats: results.edges.map(edge => edge.node),
          pageInfo: results.pageInfo
        };
      }
      
      throw new MessengerError('Search failed');
      
    } catch (error) {
      throw new MessengerError(`Search failed: ${error.message}`);
    }
  }
  
  /**
   * Get chat statistics
   */
  async getChatStats(threadId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetThreadStats($threadId: ID!) {
            thread(id: $threadId) {
              id
              stats {
                total_messages
                total_participants
                created_at
                last_activity
                message_count_today
                message_count_week
                message_count_month
              }
            }
          }
        `,
        variables: {
          threadId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.thread) {
        return response.data.data.thread.stats;
      }
      
      throw new MessengerError('Failed to get thread stats');
      
    } catch (error) {
      throw new MessengerError(`Failed to get thread stats: ${error.message}`);
    }
  }
  
  /**
   * Cache management methods
   */
  _isCacheValid() {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }
  
  _updateChatsCache(chats) {
    chats.forEach(edge => {
      this.chats.set(edge.node.id, edge.node);
      this.threads.set(edge.node.id, edge.node);
    });
    this.lastCacheUpdate = Date.now();
  }
  
  _invalidateCache() {
    this.chats.clear();
    this.threads.clear();
    this.lastCacheUpdate = 0;
  }
  
  _getCachedChats(limit, offset, type) {
    let chats = Array.from(this.chats.values());
    
    // Filter by type if specified
    if (type !== 'all') {
      chats = chats.filter(chat => chat.type === type);
    }
    
    const paginated = chats.slice(offset, offset + limit);
    
    return {
      chats: paginated,
      pageInfo: {
        hasNextPage: offset + limit < chats.length,
        hasPreviousPage: offset > 0,
        startCursor: offset.toString(),
        endCursor: (offset + paginated.length - 1).toString()
      },
      totalCount: chats.length
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
   * Get chat manager statistics
   */
  getStats() {
    return {
      totalChats: this.chats.size,
      totalThreads: this.threads.size,
      lastCacheUpdate: this.lastCacheUpdate,
      cacheExpiry: this.cacheExpiry
    };
  }
  
  /**
   * Clear all caches
   */
  clearCache() {
    this._invalidateCache();
  }
}

module.exports = ChatManager;