/**
 * Global teardown for Jest tests
 * Runs once after all test suites
 */

module.exports = async () => {
  console.log('🧹 Cleaning up global test environment...');
  
  // Clean up global mocks
  jest.restoreAllMocks();
  
  // Clear all timers
  jest.clearAllTimers();
  
  // Reset environment variables
  delete process.env.TEST_MODE;
  
  // Clean up global objects
  if (global.window) {
    delete global.window;
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  console.log('✅ Global test environment cleanup complete');
};