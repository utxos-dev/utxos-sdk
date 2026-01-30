// Polyfills for React Native - MUST be imported first
import { Buffer } from 'buffer';

// Make Buffer global
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill process
if (typeof global.process === 'undefined') {
  global.process = { env: {}, version: '' };
}

// TextEncoder/TextDecoder are built-in for React Native 0.72+
// No polyfill needed for modern Expo/React Native

// Polyfill atob/btoa for React Native
if (typeof global.atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
