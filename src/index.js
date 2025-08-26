/**
 * Messenger Private API - Main Entry Point
 * A Node.js library that completely emulates the Messenger mobile app
 * and allows real interactions with Messenger servers
 */

const MessengerClient = require('./client/MessengerClient');
const { AuthMethods, MessageTypes, EventTypes } = require('./constants');
const { MessengerError, AuthError, NetworkError } = require('./utils/errors');

// Export main classes and utilities
module.exports = {
  MessengerClient,
  AuthMethods,
  MessageTypes,
  EventTypes,
  MessengerError,
  AuthError,
  NetworkError
};

// Export default client instance
module.exports.default = MessengerClient;