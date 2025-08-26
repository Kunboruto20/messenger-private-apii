/**
 * AuthManager - Handles authentication with Messenger
 * Supports multiple authentication methods and 2FA
 */

const crypto = require('crypto');
const { Endpoints, Protocol, AuthMethods } = require('../constants');
const { AuthError, NetworkError } = require('../utils/errors');
const { generateDeviceId, generateClientId } = require('../utils/device');

class AuthManager {
  constructor(client) {
    this.client = client;
    this.network = client.network;
    
    // Authentication state
    this.accessToken = null;
    this.userId = null;
    this.deviceId = null;
    this.clientId = null;
    this.sessionCookies = null;
    this.twoFactorRequired = false;
    this.twoFactorMethod = null;
    
    // Generate device identifiers
    this.deviceId = generateDeviceId();
    this.clientId = generateClientId();
  }
  
  /**
   * Main authentication method
   */
  async authenticate(credentials, method = AuthMethods.EMAIL) {
    try {
      switch (method) {
        case AuthMethods.EMAIL:
          return await this._authenticateWithEmail(credentials);
        case AuthMethods.PHONE:
          return await this._authenticateWithPhone(credentials);
        case AuthMethods.USERNAME:
          return await this._authenticateWithUsername(credentials);
        case AuthMethods.TWO_FACTOR:
          return await this._completeTwoFactor(credentials);
        default:
          throw new AuthError(`Unsupported authentication method: ${method}`);
      }
    } catch (error) {
      throw new AuthError(`Authentication failed: ${error.message}`);
    }
  }
  
  /**
   * Authenticate with email and password
   */
  async _authenticateWithEmail(credentials) {
    const { email, password } = credentials;
    
    if (!email || !password) {
      throw new AuthError('Email and password are required');
    }
    
    // Step 1: Get login form and extract necessary tokens
    const loginForm = await this._getLoginForm();
    
    // Step 2: Submit login credentials
    const loginData = {
      email,
      pass: password,
      lsd: loginForm.lsd,
      jazoest: loginForm.jazoest,
      m_ts: loginForm.m_ts,
      li: loginForm.li,
      try_number: '0',
      unrecognized_tries: '0',
      bi_xrwh: loginForm.bi_xrwh,
      _spin: loginForm._spin
    };
    
    const loginResponse = await this.network.post(Endpoints.LOGIN, loginData, {
      headers: this._getAuthHeaders(),
      followRedirect: false
    });
    
    // Check for 2FA requirement
    if (this._isTwoFactorRequired(loginResponse)) {
      this.twoFactorRequired = true;
      this.twoFactorMethod = this._detectTwoFactorMethod(loginResponse);
      
      return {
        success: false,
        requiresTwoFactor: true,
        method: this.twoFactorMethod,
        message: 'Two-factor authentication required'
      };
    }
    
    // Check for successful login
    if (this._isLoginSuccessful(loginResponse)) {
      return await this._completeAuthentication(loginResponse);
    }
    
    // Handle login errors
    const error = this._extractLoginError(loginResponse);
    throw new AuthError(error || 'Login failed');
  }
  
  /**
   * Authenticate with phone number
   */
  async _authenticateWithPhone(credentials) {
    const { phone, password } = credentials;
    
    if (!phone || !password) {
      throw new AuthError('Phone number and password are required');
    }
    
    // Convert phone to email format for login
    const phoneEmail = `${phone}@facebook.com`;
    return await this._authenticateWithEmail({ email: phoneEmail, password });
  }
  
  /**
   * Authenticate with username
   */
  async _authenticateWithUsername(credentials) {
    const { username, password } = credentials;
    
    if (!username || !password) {
      throw new AuthError('Username and password are required');
    }
    
    // Convert username to email format for login
    const usernameEmail = `${username}@facebook.com`;
    return await this._authenticateWithEmail({ email: usernameEmail, password });
  }
  
  /**
   * Complete two-factor authentication
   */
  async _completeTwoFactor(credentials) {
    if (!this.twoFactorRequired) {
      throw new AuthError('Two-factor authentication not required');
    }
    
    const { code, method } = credentials;
    
    if (!code) {
      throw new AuthError('Two-factor authentication code is required');
    }
    
    // Submit 2FA code
    const twoFactorData = {
      code,
      submit: 'Submit',
      lsd: this._extractLsd(),
      jazoest: this._extractJazoest()
    };
    
    const twoFactorResponse = await this.network.post(Endpoints.LOGIN_2FA, twoFactorData, {
      headers: this._getAuthHeaders(),
      followRedirect: false
    });
    
    if (this._isLoginSuccessful(twoFactorResponse)) {
      return await this._completeAuthentication(twoFactorResponse);
    }
    
    const error = this._extractLoginError(twoFactorResponse);
    throw new AuthError(error || 'Two-factor authentication failed');
  }
  
  /**
   * Get login form to extract necessary tokens
   */
  async _getLoginForm() {
    const response = await this.network.get(Endpoints.LOGIN, {
      headers: this._getAuthHeaders()
    });
    
    // Extract form tokens using regex
    const lsd = this._extractToken(response.data, 'name="lsd" value="([^"]+)"');
    const jazoest = this._extractToken(response.data, 'name="jazoest" value="([^"]+)"');
    const m_ts = this._extractToken(response.data, 'name="m_ts" value="([^"]+)"');
    const li = this._extractToken(response.data, 'name="li" value="([^"]+)"');
    const bi_xrwh = this._extractToken(response.data, 'name="bi_xrwh" value="([^"]+)"');
    const _spin = this._extractToken(response.data, 'name="_spin" value="([^"]+)"');
    
    return { lsd, jazoest, m_ts, li, bi_xrwh, _spin };
  }
  
  /**
   * Complete authentication after successful login
   */
  async _completeAuthentication(loginResponse) {
    // Extract session cookies
    this.sessionCookies = this._extractCookies(loginResponse);
    
    // Get user ID and access token
    const userInfo = await this._getUserInfo();
    this.userId = userInfo.userId;
    this.accessToken = userInfo.accessToken;
    
    // Store session data
    const sessionData = {
      userId: this.userId,
      accessToken: this.accessToken,
      deviceId: this.deviceId,
      clientId: this.clientId,
      cookies: this.sessionCookies
    };
    
    return {
      success: true,
      userId: this.userId,
      accessToken: this.accessToken,
      sessionData
    };
  }
  
  /**
   * Get user information after login
   */
  async _getUserInfo() {
    // Use GraphQL to get user info
    const query = `
      query {
        viewer {
          id
          name
          profile_pic
        }
      }
    `;
    
    const response = await this.network.post(Endpoints.GRAPHQL, {
      query,
      variables: {},
      access_token: this.accessToken
    }, {
      headers: this._getAuthHeaders()
    });
    
    if (response.data && response.data.data && response.data.data.viewer) {
      return {
        userId: response.data.data.viewer.id,
        accessToken: this.accessToken
      };
    }
    
    throw new AuthError('Failed to get user information');
  }
  
  /**
   * Get user profile
   */
  async getProfile() {
    if (!this.accessToken) {
      throw new AuthError('Not authenticated');
    }
    
    const query = `
      query {
        viewer {
          id
          name
          first_name
          last_name
          profile_pic
          cover_photo
          email
          birthday
          gender
          hometown
          current_city
          relationship_status
        }
      }
    `;
    
    const response = await this.network.post(Endpoints.GRAPHQL, {
      query,
      variables: {},
      access_token: this.accessToken
    }, {
      headers: this._getAuthHeaders()
    });
    
    if (response.data && response.data.data && response.data.data.viewer) {
      return response.data.data.viewer;
    }
    
    throw new AuthError('Failed to get profile information');
  }
  
  /**
   * Update user status
   */
  async updateStatus(status) {
    if (!this.accessToken) {
      throw new AuthError('Not authenticated');
    }
    
    const mutation = `
      mutation UpdateStatus($status: String!) {
        updateStatus(input: { status: $status }) {
          success
          status
        }
      }
    `;
    
    const response = await this.network.post(Endpoints.GRAPHQL, {
      query: mutation,
      variables: { status },
      access_token: this.accessToken
    }, {
      headers: this._getAuthHeaders()
    });
    
    return response.data;
  }
  
  /**
   * Logout and cleanup
   */
  async logout() {
    try {
      if (this.accessToken) {
        // Revoke access token
        await this.network.delete(`${Endpoints.GRAPHQL}?access_token=${this.accessToken}`);
      }
      
      // Clear session data
      this.accessToken = null;
      this.userId = null;
      this.sessionCookies = null;
      this.twoFactorRequired = false;
      this.twoFactorMethod = null;
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  /**
   * Helper methods
   */
  _getAuthHeaders() {
    return {
      'User-Agent': Protocol.USER_AGENT,
      'Accept-Language': Protocol.ACCEPT_LANGUAGE,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };
  }
  
  _extractToken(html, regex) {
    const match = html.match(regex);
    return match ? match[1] : '';
  }
  
  _extractCookies(response) {
    const cookies = response.headers['set-cookie'];
    if (!cookies) return {};
    
    const cookieObj = {};
    cookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      cookieObj[name.trim()] = value.trim();
    });
    
    return cookieObj;
  }
  
  _isTwoFactorRequired(response) {
    return response.data.includes('checkpoint') || 
           response.data.includes('two-factor') ||
           response.data.includes('2FA');
  }
  
  _isLoginSuccessful(response) {
    return response.data.includes('c_user') ||
           response.data.includes('xs') ||
           response.data.includes('access_token');
  }
  
  _detectTwoFactorMethod(response) {
    if (response.data.includes('SMS')) return 'sms';
    if (response.data.includes('TOTP')) return 'totp';
    if (response.data.includes('backup')) return 'backup';
    return 'unknown';
  }
  
  _extractLoginError(response) {
    // Extract error message from response
    const errorMatch = response.data.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/div>/i);
    return errorMatch ? errorMatch[1].trim() : 'Unknown login error';
  }
  
  _extractLsd() {
    // Extract lsd token from current page
    return this._extractToken(document.documentElement.innerHTML, 'name="lsd" value="([^"]+)"');
  }
  
  _extractJazoest() {
    // Extract jazoest token from current page
    return this._extractToken(document.documentElement.innerHTML, 'name="jazoest" value="([^"]+)"');
  }
  
  /**
   * Get current authentication status
   */
  getStatus() {
    return {
      isAuthenticated: !!this.accessToken,
      userId: this.userId,
      twoFactorRequired: this.twoFactorRequired,
      twoFactorMethod: this.twoFactorMethod,
      deviceId: this.deviceId,
      clientId: this.clientId
    };
  }
}

module.exports = AuthManager;