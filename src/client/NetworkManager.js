/**
 * NetworkManager - Handles HTTP requests and network operations
 * Manages retries, rate limiting, and request/response handling
 */

const axios = require('axios');
const { Protocol } = require('../constants');
const { NetworkError } = require('../utils/errors');

class NetworkManager {
  constructor(client) {
    this.client = client;
    
    // Create axios instance with default configuration
    this.axios = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept all status codes < 500
      headers: {
        'User-Agent': Protocol.USER_AGENT,
        'Accept-Language': Protocol.ACCEPT_LANGUAGE,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    // Request tracking
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.rateLimitDelay = Protocol.RATE_LIMIT_DELAY;
    this.maxRetries = Protocol.MAX_RETRIES;
    this.retryDelay = Protocol.RETRY_DELAY;
    
    // Setup interceptors
    this._setupInterceptors();
  }
  
  /**
   * GET request
   */
  async get(url, options = {}) {
    return await this._makeRequest('GET', url, null, options);
  }
  
  /**
   * POST request
   */
  async post(url, data = null, options = {}) {
    return await this._makeRequest('POST', url, data, options);
  }
  
  /**
   * PUT request
   */
  async put(url, data = null, options = {}) {
    return await this._makeRequest('PUT', url, data, options);
  }
  
  /**
   * DELETE request
   */
  async delete(url, options = {}) {
    return await this._makeRequest('DELETE', url, null, options);
  }
  
  /**
   * PATCH request
   */
  async patch(url, data = null, options = {}) {
    return await this._makeRequest('PATCH', url, data, options);
  }
  
  /**
   * Main request method with retry logic
   */
  async _makeRequest(method, url, data, options) {
    const requestId = ++this.requestCount;
    let lastError = null;
    
    // Apply rate limiting
    await this._applyRateLimit();
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Prepare request configuration
        const config = this._prepareRequestConfig(method, url, data, options);
        
        // Make request
        const response = await this.axios.request(config);
        
        // Update request tracking
        this._updateRequestTracking();
        
        // Handle response
        return this._handleResponse(response, options);
        
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (this._shouldRetry(error, attempt)) {
          console.warn(`Request ${requestId} failed (attempt ${attempt}/${this.maxRetries}):`, error.message);
          
          // Wait before retry
          if (attempt < this.maxRetries) {
            await this._wait(this.retryDelay * attempt);
          }
        } else {
          break;
        }
      }
    }
    
    // All retries failed
    throw this._createNetworkError(lastError, url, method);
  }
  
  /**
   * Prepare request configuration
   */
  _prepareRequestConfig(method, url, data, options) {
    const config = {
      method: method.toLowerCase(),
      url,
      headers: { ...this._getDefaultHeaders(), ...options.headers },
      ...options
    };
    
    // Handle different data types
    if (data) {
      if (data instanceof FormData) {
        config.data = data;
        // Don't set Content-Type for FormData, let browser set it
      } else if (typeof data === 'object') {
        config.data = JSON.stringify(data);
        config.headers['Content-Type'] = 'application/json';
      } else {
        config.data = data;
      }
    }
    
    // Handle query parameters
    if (options.params) {
      config.params = options.params;
    }
    
    // Handle response type
    if (options.responseType) {
      config.responseType = options.responseType;
    }
    
    // Handle timeout
    if (options.timeout) {
      config.timeout = options.timeout;
    }
    
    // Handle follow redirects
    if (options.followRedirect !== undefined) {
      config.maxRedirects = options.followRedirect ? 5 : 0;
    }
    
    return config;
  }
  
  /**
   * Handle response
   */
  _handleResponse(response, options) {
    // Check if we need to follow redirects manually
    if (options.followRedirect === false && response.status >= 300 && response.status < 400) {
      return response;
    }
    
    // Check for error status codes
    if (response.status >= 400) {
      throw this._createHttpError(response);
    }
    
    return response;
  }
  
  /**
   * Check if request should be retried
   */
  _shouldRetry(error, attempt) {
    // Don't retry on last attempt
    if (attempt >= this.maxRetries) {
      return false;
    }
    
    // Retry on network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Retry on 5xx server errors
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    // Retry on rate limiting (429)
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    // Don't retry on client errors (4xx)
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return false;
    }
    
    return false;
  }
  
  /**
   * Apply rate limiting
   */
  async _applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await this._wait(waitTime);
    }
  }
  
  /**
   * Update request tracking
   */
  _updateRequestTracking() {
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Wait for specified time
   */
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Create network error
   */
  _createNetworkError(error, url, method) {
    let message = `Request failed: ${method} ${url}`;
    let statusCode = null;
    let responseData = null;
    
    if (error.response) {
      statusCode = error.response.status;
      responseData = error.response.data;
      message += ` - Status: ${statusCode}`;
      
      if (responseData && responseData.error) {
        message += ` - ${responseData.error}`;
      }
    } else if (error.request) {
      message += ' - No response received';
    } else {
      message += ` - ${error.message}`;
    }
    
    return new NetworkError(message, {
      statusCode,
      responseData,
      originalError: error,
      url,
      method
    });
  }
  
  /**
   * Create HTTP error
   */
  _createHttpError(response) {
    const message = `HTTP ${response.status}: ${response.statusText}`;
    
    return new NetworkError(message, {
      statusCode: response.status,
      responseData: response.data,
      response,
      url: response.config.url,
      method: response.config.method
    });
  }
  
  /**
   * Get default headers
   */
  _getDefaultHeaders() {
    const headers = {
      'User-Agent': Protocol.USER_AGENT,
      'Accept-Language': Protocol.ACCEPT_LANGUAGE,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive'
    };
    
    // Add authorization header if available
    if (this.client.auth && this.client.auth.accessToken) {
      headers['Authorization'] = `Bearer ${this.client.auth.accessToken}`;
    }
    
    return headers;
  }
  
  /**
   * Setup axios interceptors
   */
  _setupInterceptors() {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        // Log request (in development)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[${new Date().toISOString()}] ${config.method.toUpperCase()} ${config.url}`);
        }
        
        // Add request ID for tracking
        config.metadata = { startTime: Date.now() };
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        // Log response time (in development)
        if (process.env.NODE_ENV === 'development' && response.config.metadata) {
          const duration = Date.now() - response.config.metadata.startTime;
          console.log(`[${new Date().toISOString()}] ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
        }
        
        return response;
      },
      (error) => {
        // Log error (in development)
        if (process.env.NODE_ENV === 'development') {
          console.error(`[${new Date().toISOString()}] Request failed:`, error.message);
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Upload file with progress tracking
   */
  async uploadFile(url, file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.fields) {
      Object.entries(options.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    
    const uploadOptions = {
      ...options,
      data: formData,
      headers: {
        ...options.headers,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (options.onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(percentCompleted, progressEvent);
        }
      }
    };
    
    return await this.post(url, formData, uploadOptions);
  }
  
  /**
   * Download file
   */
  async downloadFile(url, options = {}) {
    const downloadOptions = {
      ...options,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        if (options.onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(percentCompleted, progressEvent);
        }
      }
    };
    
    return await this.get(url, downloadOptions);
  }
  
  /**
   * Make batch request
   */
  async batchRequest(requests, options = {}) {
    const batchData = {
      batch: requests.map((req, index) => ({
        method: req.method || 'GET',
        relative_url: req.url,
        body: req.data ? JSON.stringify(req.data) : undefined,
        name: req.name || `request_${index}`
      }))
    };
    
    const response = await this.post('/batch', batchData, options);
    
    // Parse batch response
    if (response.data && Array.isArray(response.data)) {
      return response.data.map((item, index) => ({
        name: item.name || `request_${index}`,
        code: item.code,
        body: item.body ? JSON.parse(item.body) : null,
        headers: item.headers || []
      }));
    }
    
    return response.data;
  }
  
  /**
   * Get request statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      rateLimitDelay: this.rateLimitDelay,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    };
  }
  
  /**
   * Update rate limiting settings
   */
  updateRateLimit(delay, maxRetries, retryDelay) {
    this.rateLimitDelay = delay || this.rateLimitDelay;
    this.maxRetries = maxRetries || this.maxRetries;
    this.retryDelay = retryDelay || this.retryDelay;
  }
  
  /**
   * Clear request tracking
   */
  clearStats() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    // Cancel any pending requests
    // Note: axios doesn't have a built-in way to cancel all requests
    // This would need to be implemented with AbortController if needed
  }
}

module.exports = NetworkManager;