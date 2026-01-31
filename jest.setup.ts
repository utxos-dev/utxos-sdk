/**
 * Jest setup file - initializes platform adapters for testing
 *
 * Tests run in Node.js environment, so we use browser adapters
 * but with Node.js polyfills where needed.
 */

import { setAdapters } from './src/internal/platform-context';
import { browserAdapters } from './src/platforms/browser';

// Initialize adapters before any tests run
setAdapters(browserAdapters);
