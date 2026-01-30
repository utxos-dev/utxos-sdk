// Polyfills for React Native - MUST be imported FIRST before any other imports
// This file sets up the Node.js-like environment that @meshsdk and crypto libraries expect

// 1. Buffer - CRITICAL: Must be set unconditionally and completely
import { Buffer } from 'buffer';
global.Buffer = Buffer;
globalThis.Buffer = Buffer;

// Also ensure Buffer is on window for web targets
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// 2. Process - many Node.js libraries check process.env
if (typeof global.process === 'undefined') {
  global.process = { env: {}, version: 'v18.0.0', browser: true };
} else {
  global.process.browser = true;
}
if (typeof globalThis.process === 'undefined') {
  globalThis.process = global.process;
}

// 3. TextEncoder/TextDecoder - built-in for React Native 0.72+ but ensure they're global
if (typeof global.TextEncoder === 'undefined' && typeof TextEncoder !== 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined' && typeof TextDecoder !== 'undefined') {
  global.TextDecoder = TextDecoder;
}

// 4. Base64 encoding (atob/btoa) - needed for various crypto operations
if (typeof global.atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}

// 5. Ensure globalThis matches global (some libraries use globalThis)
if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = global.atob;
}
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = global.btoa;
}

// 6. Uint8Array extensions that some crypto libraries expect
if (!Uint8Array.prototype.slice) {
  Uint8Array.prototype.slice = function(start, end) {
    return new Uint8Array(Array.prototype.slice.call(this, start, end));
  };
}

// Log that polyfills are loaded (helpful for debugging)
console.log('[shim.js] Polyfills loaded - Buffer:', typeof global.Buffer !== 'undefined');
