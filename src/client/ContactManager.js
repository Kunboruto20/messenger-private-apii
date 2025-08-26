/**
 * ContactManager - Handles contact management and friend lists
 * Manages contacts, friends, and user information
 */

const { Endpoints } = require('../constants');
const { MessengerError, AuthError } = require('../utils/errors');

class ContactManager {
  constructor(client) {
    this.client = client;
    this.network = client.network;
    
    // Contact cache
    this.contacts = new Map();
    this.friends = new Map();
    this.blockedUsers = new Map();
    
    // Cache settings
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.lastCacheUpdate = 0;
  }
  
  /**
   * Get user contacts
   */
  async getContacts(options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { forceRefresh = false, limit = 100, offset = 0 } = options;
    
    // Check cache if not forcing refresh
    if (!forceRefresh && this._isCacheValid()) {
      return this._getCachedContacts(limit, offset);
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetContacts($limit: Int!, $offset: Int!) {
            viewer {
              contacts(first: $limit, offset: $offset) {
                edges {
                  node {
                    id
                    name
                    first_name
                    last_name
                    profile_pic
                    is_friend
                    is_blocked
                    mutual_friends
                    online_status
                    last_seen
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
          offset
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.viewer) {
        const contacts = response.data.data.viewer.contacts;
        
        // Update cache
        this._updateContactsCache(contacts.edges);
        
        return {
          contacts: contacts.edges.map(edge => edge.node),
          pageInfo: contacts.pageInfo,
          totalCount: contacts.totalCount
        };
      }
      
      throw new MessengerError('Failed to get contacts');
      
    } catch (error) {
      throw new MessengerError(`Failed to get contacts: ${error.message}`);
    }
  }
  
  /**
   * Get friends list
   */
  async getFriends(options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { forceRefresh = false, limit = 100, offset = 0 } = options;
    
    // Check cache if not forcing refresh
    if (!forceRefresh && this._isCacheValid()) {
      return this._getCachedFriends(limit, offset);
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetFriends($limit: Int!, $offset: Int!) {
            viewer {
              friends(first: $limit, offset: $offset) {
                edges {
                  node {
                    id
                    name
                    first_name
                    last_name
                    profile_pic
                    online_status
                    last_seen
                    mutual_friends
                    friendship_status
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
          offset
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.viewer) {
        const friends = response.data.data.viewer.friends;
        
        // Update cache
        this._updateFriendsCache(friends.edges);
        
        return {
          friends: friends.edges.map(edge => edge.node),
          pageInfo: friends.pageInfo,
          totalCount: friends.totalCount
        };
      }
      
      throw new MessengerError('Failed to get friends');
      
    } catch (error) {
      throw new MessengerError(`Failed to get friends: ${error.message}`);
    }
  }
  
  /**
   * Get user by ID
   */
  async getUserById(userId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    // Check cache first
    if (this.contacts.has(userId)) {
      return this.contacts.get(userId);
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetUser($userId: ID!) {
            user(id: $userId) {
              id
              name
              first_name
              last_name
              profile_pic
              cover_photo
              is_friend
              is_blocked
              mutual_friends
              online_status
              last_seen
              about
              birthday
              gender
              hometown
              current_city
              relationship_status
            }
          }
        `,
        variables: {
          userId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.user) {
        const user = response.data.data.user;
        
        // Update cache
        this.contacts.set(userId, user);
        
        return user;
      }
      
      throw new MessengerError('User not found');
      
    } catch (error) {
      throw new MessengerError(`Failed to get user: ${error.message}`);
    }
  }
  
  /**
   * Search users
   */
  async searchUsers(query, options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { limit = 50, type = 'all' } = options;
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query SearchUsers($query: String!, $limit: Int!, $type: String!) {
            searchUsers(query: $query, first: $limit, type: $type) {
              edges {
                node {
                  id
                  name
                  first_name
                  last_name
                  profile_pic
                  is_friend
                  mutual_friends
                  online_status
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
      
      if (response.data && response.data.data && response.data.data.searchUsers) {
        const results = response.data.data.searchUsers;
        
        return {
          users: results.edges.map(edge => edge.node),
          pageInfo: results.pageInfo
        };
      }
      
      throw new MessengerError('Search failed');
      
    } catch (error) {
      throw new MessengerError(`Search failed: ${error.message}`);
    }
  }
  
  /**
   * Add friend
   */
  async addFriend(userId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation AddFriend($userId: ID!) {
            addFriend(input: { userId: $userId }) {
              success
              friendship {
                id
                status
                created_at
              }
            }
          }
        `,
        variables: {
          userId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.addFriend) {
        const result = response.data.data.addFriend;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return result.friendship;
        } else {
          throw new MessengerError('Failed to add friend');
        }
      }
      
      throw new MessengerError('Failed to add friend');
      
    } catch (error) {
      throw new MessengerError(`Failed to add friend: ${error.message}`);
    }
  }
  
  /**
   * Remove friend
   */
  async removeFriend(userId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation RemoveFriend($userId: ID!) {
            removeFriend(input: { userId: $userId }) {
              success
            }
          }
        `,
        variables: {
          userId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.removeFriend) {
        const result = response.data.data.removeFriend;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return { success: true };
        } else {
          throw new MessengerError('Failed to remove friend');
        }
      }
      
      throw new MessengerError('Failed to remove friend');
      
    } catch (error) {
      throw new MessengerError(`Failed to remove friend: ${error.message}`);
    }
  }
  
  /**
   * Block user
   */
  async blockUser(userId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation BlockUser($userId: ID!) {
            blockUser(input: { userId: $userId }) {
              success
            }
          }
        `,
        variables: {
          userId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.blockUser) {
        const result = response.data.data.blockUser;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return { success: true };
        } else {
          throw new MessengerError('Failed to block user');
        }
      }
      
      throw new MessengerError('Failed to block user');
      
    } catch (error) {
      throw new MessengerError(`Failed to block user: ${error.message}`);
    }
  }
  
  /**
   * Unblock user
   */
  async unblockUser(userId) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          mutation UnblockUser($userId: ID!) {
            unblockUser(input: { userId: $userId }) {
              success
            }
          }
        `,
        variables: {
          userId
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.unblockUser) {
        const result = response.data.data.unblockUser;
        
        if (result.success) {
          // Update cache
          this._invalidateCache();
          return { success: true };
        } else {
          throw new MessengerError('Failed to unblock user');
        }
      }
      
      throw new MessengerError('Failed to unblock user');
      
    } catch (error) {
      throw new MessengerError(`Failed to unblock user: ${error.message}`);
    }
  }
  
  /**
   * Get blocked users
   */
  async getBlockedUsers(options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { limit = 100, offset = 0 } = options;
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetBlockedUsers($limit: Int!, $offset: Int!) {
            viewer {
              blockedUsers(first: $limit, offset: $offset) {
                edges {
                  node {
                    id
                    name
                    first_name
                    last_name
                    profile_pic
                    blocked_at
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
          offset
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.viewer) {
        const blockedUsers = response.data.data.viewer.blockedUsers;
        
        // Update cache
        this._updateBlockedUsersCache(blockedUsers.edges);
        
        return {
          blockedUsers: blockedUsers.edges.map(edge => edge.node),
          pageInfo: blockedUsers.pageInfo,
          totalCount: blockedUsers.totalCount
        };
      }
      
      throw new MessengerError('Failed to get blocked users');
      
    } catch (error) {
      throw new MessengerError(`Failed to get blocked users: ${error.message}`);
    }
  }
  
  /**
   * Get mutual friends
   */
  async getMutualFriends(userId, options = {}) {
    if (!this.client.isAuthenticated) {
      throw new AuthError('Not authenticated');
    }
    
    const { limit = 50, offset = 0 } = options;
    
    try {
      const response = await this.network.post(Endpoints.GRAPHQL, {
        query: `
          query GetMutualFriends($userId: ID!, $limit: Int!, $offset: Int!) {
            user(id: $userId) {
              mutualFriends(first: $limit, offset: $offset) {
                edges {
                  node {
                    id
                    name
                    first_name
                    last_name
                    profile_pic
                    online_status
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
          userId,
          limit,
          offset
        }
      }, {
        headers: this._getAuthHeaders()
      });
      
      if (response.data && response.data.data && response.data.data.user) {
        const mutualFriends = response.data.data.user.mutualFriends;
        
        return {
          mutualFriends: mutualFriends.edges.map(edge => edge.node),
          pageInfo: mutualFriends.pageInfo,
          totalCount: mutualFriends.totalCount
        };
      }
      
      throw new MessengerError('Failed to get mutual friends');
      
    } catch (error) {
      throw new MessengerError(`Failed to get mutual friends: ${error.message}`);
    }
  }
  
  /**
   * Cache management methods
   */
  _isCacheValid() {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }
  
  _updateContactsCache(contacts) {
    contacts.forEach(edge => {
      this.contacts.set(edge.node.id, edge.node);
    });
    this.lastCacheUpdate = Date.now();
  }
  
  _updateFriendsCache(friends) {
    friends.forEach(edge => {
      this.friends.set(edge.node.id, edge.node);
    });
    this.lastCacheUpdate = Date.now();
  }
  
  _updateBlockedUsersCache(blockedUsers) {
    blockedUsers.forEach(edge => {
      this.blockedUsers.set(edge.node.id, edge.node);
    });
    this.lastCacheUpdate = Date.now();
  }
  
  _invalidateCache() {
    this.contacts.clear();
    this.friends.clear();
    this.blockedUsers.clear();
    this.lastCacheUpdate = 0;
  }
  
  _getCachedContacts(limit, offset) {
    const contacts = Array.from(this.contacts.values());
    const paginated = contacts.slice(offset, offset + limit);
    
    return {
      contacts: paginated,
      pageInfo: {
        hasNextPage: offset + limit < contacts.length,
        hasPreviousPage: offset > 0,
        startCursor: offset.toString(),
        endCursor: (offset + paginated.length - 1).toString()
      },
      totalCount: contacts.length
    };
  }
  
  _getCachedFriends(limit, offset) {
    const friends = Array.from(this.friends.values());
    const paginated = friends.slice(offset, offset + limit);
    
    return {
      friends: paginated,
      pageInfo: {
        hasNextPage: offset + limit < friends.length,
        hasPreviousPage: offset > 0,
        startCursor: offset.toString(),
        endCursor: (offset + paginated.length - 1).toString()
      },
      totalCount: friends.length
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
   * Get contact statistics
   */
  getStats() {
    return {
      totalContacts: this.contacts.size,
      totalFriends: this.friends.size,
      totalBlocked: this.blockedUsers.size,
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

module.exports = ContactManager;