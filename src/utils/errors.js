/**
 * Custom error classes for Messenger Private API
 * Provides detailed error information and categorization
 */

class MessengerError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'MessengerError';
    this.details = details;
    this.timestamp = new Date();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MessengerError);
    }
  }
  
  /**
   * Get error summary
   */
  getSummary() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      details: this.details
    };
  }
  
  /**
   * Check if error is retryable
   */
  isRetryable() {
    return false; // Base class is not retryable
  }
}

class AuthError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'AuthError';
    this.category = 'authentication';
  }
  
  isRetryable() {
    // Auth errors are generally not retryable
    return false;
  }
}

class NetworkError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'NetworkError';
    this.category = 'network';
  }
  
  isRetryable() {
    // Network errors are often retryable
    const { statusCode } = this.details;
    
    // Retry on server errors (5xx) and rate limiting (429)
    if (statusCode >= 500 || statusCode === 429) {
      return true;
    }
    
    // Retry on network-level errors
    if (this.details.originalError) {
      const { code } = this.details.originalError;
      return ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(code);
    }
    
    return false;
  }
  
  /**
   * Get HTTP status code if available
   */
  getStatusCode() {
    return this.details.statusCode || null;
  }
  
  /**
   * Get response data if available
   */
  getResponseData() {
    return this.details.responseData || null;
  }
}

class ValidationError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ValidationError';
    this.category = 'validation';
  }
  
  isRetryable() {
    return false; // Validation errors are not retryable
  }
  
  /**
   * Get validation field errors
   */
  getFieldErrors() {
    return this.details.fieldErrors || {};
  }
}

class RateLimitError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'RateLimitError';
    this.category = 'rate_limit';
  }
  
  isRetryable() {
    return true; // Rate limit errors are retryable after delay
  }
  
  /**
   * Get retry after delay
   */
  getRetryAfter() {
    return this.details.retryAfter || 60; // Default 60 seconds
  }
  
  /**
   * Get rate limit info
   */
  getRateLimitInfo() {
    return {
      limit: this.details.limit,
      remaining: this.details.remaining,
      reset: this.details.reset,
      retryAfter: this.getRetryAfter()
    };
  }
}

class MediaError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'MediaError';
    this.category = 'media';
  }
  
  isRetryable() {
    // Media errors might be retryable depending on the issue
    const { code } = this.details;
    return ['UPLOAD_FAILED', 'PROCESSING_FAILED'].includes(code);
  }
  
  /**
   * Get media error code
   */
  getErrorCode() {
    return this.details.code || 'UNKNOWN';
  }
  
  /**
   * Get file information
   */
  getFileInfo() {
    return {
      filename: this.details.filename,
      size: this.details.size,
      type: this.details.type
    };
  }
}

class WebSocketError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'WebSocketError';
    this.category = 'websocket';
  }
  
  isRetryable() {
    // WebSocket errors are often retryable
    const { code } = this.details;
    return [1000, 1001, 1002, 1003, 1005, 1006, 1011, 1012, 1013, 1014, 1015].includes(code);
  }
  
  /**
   * Get WebSocket close code
   */
  getCloseCode() {
    return this.details.code || null;
  }
  
  /**
   * Get close reason
   */
  getCloseReason() {
    return this.details.reason || null;
  }
}

class EncryptionError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'EncryptionError';
    this.category = 'encryption';
  }
  
  isRetryable() {
    return false; // Encryption errors are not retryable
  }
  
  /**
   * Get encryption algorithm used
   */
  getAlgorithm() {
    return this.details.algorithm || null;
  }
  
  /**
   * Get encryption key info
   */
  getKeyInfo() {
    return {
      keySize: this.details.keySize,
      ivSize: this.details.ivSize,
      algorithm: this.getAlgorithm()
    };
  }
}

class TimeoutError extends MessengerError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'TimeoutError';
    this.category = 'timeout';
  }
  
  isRetryable() {
    return true; // Timeout errors are retryable
  }
  
  /**
   * Get timeout duration
   */
  getTimeout() {
    return this.details.timeout || null;
  }
  
  /**
   * Get operation that timed out
   */
  getOperation() {
    return this.details.operation || null;
  }
}

/**
 * Error factory for creating appropriate error types
 */
class ErrorFactory {
  static create(type, message, details = {}) {
    const errorClasses = {
      'auth': AuthError,
      'network': NetworkError,
      'validation': ValidationError,
      'rate_limit': RateLimitError,
      'media': MediaError,
      'websocket': WebSocketError,
      'encryption': EncryptionError,
      'timeout': TimeoutError
    };
    
    const ErrorClass = errorClasses[type] || MessengerError;
    return new ErrorClass(message, details);
  }
  
  /**
   * Create error from HTTP response
   */
  static fromHttpResponse(response, url, method) {
    const { status, statusText, data } = response;
    
    let type = 'network';
    let message = `HTTP ${status}: ${statusText}`;
    
    // Categorize by status code
    if (status === 401 || status === 403) {
      type = 'auth';
      message = 'Authentication failed';
    } else if (status === 400) {
      type = 'validation';
      message = 'Invalid request';
    } else if (status === 429) {
      type = 'rate_limit';
      message = 'Rate limit exceeded';
    } else if (status >= 500) {
      type = 'network';
      message = 'Server error';
    }
    
    return this.create(type, message, {
      statusCode: status,
      statusText,
      responseData: data,
      url,
      method
    });
  }
  
  /**
   * Create error from network error
   */
  static fromNetworkError(error, url, method) {
    let type = 'network';
    let message = error.message;
    
    // Categorize by error code
    if (error.code === 'ECONNREFUSED') {
      message = 'Connection refused';
    } else if (error.code === 'ENOTFOUND') {
      message = 'Host not found';
    } else if (error.code === 'ETIMEDOUT') {
      type = 'timeout';
      message = 'Request timed out';
    }
    
    return this.create(type, message, {
      originalError: error,
      url,
      method
    });
  }
}

module.exports = {
  MessengerError,
  AuthError,
  NetworkError,
  ValidationError,
  RateLimitError,
  MediaError,
  WebSocketError,
  EncryptionError,
  TimeoutError,
  ErrorFactory
};