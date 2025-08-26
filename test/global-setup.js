/**
 * Global setup for Jest tests
 * Runs once before all test suites
 */

module.exports = async () => {
  console.log('🚀 Setting up global test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  
  // Mock global objects that might not exist in test environment
  global.global = global;
  
  // Set up test timeouts
  jest.setTimeout(10000);
  
  // Mock browser APIs if they don't exist
  if (typeof global.window === 'undefined') {
    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
      location: {
        href: 'https://www.messenger.com',
        origin: 'https://www.messenger.com',
        protocol: 'https:',
        host: 'www.messenger.com',
        hostname: 'www.messenger.com',
        port: '',
        pathname: '/',
        search: '',
        hash: ''
      },
      navigator: {
        userAgent: 'Jest Test Environment',
        platform: 'Linux x86_64',
        language: 'en-US',
        languages: ['en-US', 'en'],
        cookieEnabled: true,
        onLine: true
      },
      document: {
        createElement: jest.fn(() => ({
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          removeChild: jest.fn(),
          innerHTML: '',
          textContent: ''
        })),
        getElementById: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        documentElement: {
          innerHTML: '<html><head></head><body></body></html>'
        }
      },
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        key: jest.fn(),
        length: 0
      },
      sessionStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        key: jest.fn(),
        length: 0
      },
      fetch: jest.fn(),
      XMLHttpRequest: jest.fn(),
      FormData: jest.fn(),
      File: jest.fn(),
      FileReader: jest.fn(),
      Blob: jest.fn(),
      URL: {
        createObjectURL: jest.fn(),
        revokeObjectURL: jest.fn()
      },
      URLSearchParams: jest.fn(),
      Headers: jest.fn(),
      Request: jest.fn(),
      Response: jest.fn(),
      Event: jest.fn(),
      CustomEvent: jest.fn(),
      EventTarget: jest.fn(),
      AbortController: jest.fn(),
      AbortSignal: jest.fn(),
      TextEncoder: jest.fn(),
      TextDecoder: jest.fn(),
      atob: jest.fn(),
      btoa: jest.fn(),
      setTimeout: jest.fn(),
      setInterval: jest.fn(),
      clearTimeout: jest.fn(),
      clearInterval: jest.fn(),
      requestAnimationFrame: jest.fn(),
      cancelAnimationFrame: jest.fn(),
      requestIdleCallback: jest.fn(),
      cancelIdleCallback: jest.fn(),
      performance: {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        getEntries: jest.fn(() => []),
        getEntriesByName: jest.fn(() => []),
        getEntriesByType: jest.fn(() => [])
      }
    };
  }
  
  // Mock Node.js modules that might cause issues in tests
  jest.mock('fs', () => ({
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      appendFile: jest.fn(),
      unlink: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn(),
      access: jest.fn()
    },
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    createReadStream: jest.fn(),
    createWriteStream: jest.fn()
  }));
  
  jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    resolve: jest.fn((...args) => args.join('/')),
    dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
    basename: jest.fn((path) => path.split('/').pop()),
    extname: jest.fn((path) => {
      const ext = path.split('.').pop();
      return ext === path ? '' : '.' + ext;
    }),
    sep: '/',
    delimiter: ':',
    normalize: jest.fn((path) => path),
    relative: jest.fn((from, to) => to),
    isAbsolute: jest.fn((path) => path.startsWith('/')),
    parse: jest.fn((path) => ({
      root: '/',
      dir: path.split('/').slice(0, -1).join('/'),
      base: path.split('/').pop(),
      ext: path.split('.').pop() === path ? '' : '.' + path.split('.').pop(),
      name: path.split('/').pop().split('.')[0]
    }))
  }));
  
  // Mock network-related modules
  jest.mock('net', () => ({
    createConnection: jest.fn(),
    createServer: jest.fn(),
    connect: jest.fn(),
    Socket: jest.fn(),
    Server: jest.fn()
  }));
  
  jest.mock('tls', () => ({
    createSecureContext: jest.fn(),
    createSecurePair: jest.fn(),
    connect: jest.fn(),
    createServer: jest.fn(),
    SecureContext: jest.fn(),
    TLSSocket: jest.fn(),
    TLSServer: jest.fn()
  }));
  
  // Mock crypto-related modules
  jest.mock('crypto', () => {
    const originalCrypto = require('crypto');
    return {
      ...originalCrypto,
      randomBytes: jest.fn((size) => {
        const buffer = Buffer.alloc(size);
        buffer.fill(0x42); // Fill with predictable data for tests
        return buffer;
      }),
      createHash: jest.fn((algorithm) => ({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => Buffer.from('test-hash-' + algorithm))
      })),
      createHmac: jest.fn((algorithm, key) => ({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => Buffer.from('test-hmac-' + algorithm))
      })),
      createCipher: jest.fn((algorithm, key) => ({
        update: jest.fn().mockReturnThis(),
        final: jest.fn(() => Buffer.from('encrypted-data')),
        setAAD: jest.fn().mockReturnThis(),
        getAuthTag: jest.fn(() => Buffer.from('auth-tag'))
      })),
      createDecipher: jest.fn((algorithm, key) => ({
        update: jest.fn().mockReturnThis(),
        final: jest.fn(() => Buffer.from('decrypted-data')),
        setAAD: jest.fn().mockReturnThis(),
        setAuthTag: jest.fn().mockReturnThis()
      })),
      pbkdf2Sync: jest.fn((password, salt, iterations, keyLength, algorithm) => {
        return Buffer.alloc(keyLength).fill(0x42);
      })
    };
  });
  
  // Mock os module
  jest.mock('os', () => ({
    platform: jest.fn(() => 'linux'),
    arch: jest.fn(() => 'x64'),
    hostname: jest.fn(() => 'test-host'),
    cpus: jest.fn(() => [
      { model: 'Test CPU', speed: 1000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }
    ]),
    totalmem: jest.fn(() => 1024 * 1024 * 1024), // 1GB
    freemem: jest.fn(() => 512 * 1024 * 1024),   // 512MB
    uptime: jest.fn(() => 3600),                  // 1 hour
    loadavg: jest.fn(() => [0.1, 0.2, 0.3]),
    networkInterfaces: jest.fn(() => ({
      eth0: [{ address: '192.168.1.100', family: 'IPv4' }]
    })),
    type: jest.fn(() => 'Linux'),
    release: jest.fn(() => '5.4.0-test'),
    userInfo: jest.fn(() => ({
      username: 'testuser',
      uid: 1000,
      gid: 1000,
      shell: '/bin/bash',
      homedir: '/home/testuser'
    })),
    homedir: jest.fn(() => '/home/testuser'),
    tmpdir: jest.fn(() => '/tmp'),
    endianness: jest.fn(() => 'LE'),
    EOL: '\n'
  }));
  
  // Mock child_process module
  jest.mock('child_process', () => ({
    spawn: jest.fn(),
    exec: jest.fn(),
    execFile: jest.fn(),
    fork: jest.fn(),
    spawnSync: jest.fn(),
    execSync: jest.fn(),
    execFileSync: jest.fn()
  }));
  
  // Mock cluster module
  jest.mock('cluster', () => ({
    isMaster: false,
    isWorker: true,
    fork: jest.fn(),
    setupMaster: jest.fn(),
    worker: {
      id: 1,
      process: { pid: 12345 }
    },
    workers: {},
    on: jest.fn(),
    emit: jest.fn()
  }));
  
  // Mock worker_threads module
  jest.mock('worker_threads', () => ({
    Worker: jest.fn(),
    isMainThread: true,
    parentPort: null,
    workerData: null,
    threadId: 0,
    getEnvironmentData: jest.fn(),
    setEnvironmentData: jest.fn()
  }));
  
  // Set up global error handlers
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception in global setup:', error);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection in global setup:', reason);
  });
  
  console.log('✅ Global test environment setup complete');
};