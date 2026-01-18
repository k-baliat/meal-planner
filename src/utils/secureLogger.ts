/**
 * Secure Logger Utility
 * 
 * Provides logging functions that automatically sanitize sensitive information
 * before outputting to the console. This prevents accidental exposure of:
 * - User IDs
 * - Email addresses
 * - API keys
 * - Auth tokens
 * - Firebase document IDs (in some contexts)
 * 
 * Usage:
 * import { secureLog, secureWarn, secureError } from './utils/secureLogger';
 * secureLog('[Feature]', 'Operation completed', { userId: 'abc123', name: 'Recipe' });
 * // Output: [Feature] Operation completed { userId: '[REDACTED]', name: 'Recipe' }
 */

// Development mode flag - set to true only for local development
// In production, this should always be false
const IS_DEV_MODE = process.env.NODE_ENV === 'development';

/**
 * Sanitize an object by redacting sensitive fields
 * 
 * @param obj - The object to sanitize
 * @returns A new object with sensitive fields redacted
 */
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // If not an object, return as-is
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Create a shallow copy and redact sensitive fields
  const sanitized: any = {};
  const sensitiveFields = [
    'userId',
    'uid',
    'userEmail',
    'email',
    'apiKey',
    'token',
    'password',
    'credential',
    'secret',
    'recipeId', // Firebase document IDs can be sensitive
    'id', // Generic IDs
    'docId'
  ];

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this is a sensitive field
      const isSensitive = sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        // Redact sensitive fields
        sanitized[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeObject(obj[key]);
      } else {
        // Keep non-sensitive fields
        sanitized[key] = obj[key];
      }
    }
  }

  return sanitized;
};

/**
 * Sanitize arguments for logging
 * 
 * @param args - Arguments to sanitize
 * @returns Sanitized arguments
 */
const sanitizeArgs = (...args: any[]): any[] => {
  // In development mode, don't sanitize (for debugging)
  if (IS_DEV_MODE) {
    return args;
  }

  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObject(arg);
    }
    return arg;
  });
};

/**
 * Secure console.log replacement
 * 
 * Usage: secureLog('[Feature]', 'Message', { data: 'value' })
 */
export const secureLog = (...args: any[]): void => {
  console.log(...sanitizeArgs(...args));
};

/**
 * Secure console.warn replacement
 * 
 * Usage: secureWarn('[Feature]', 'Warning message', { data: 'value' })
 */
export const secureWarn = (...args: any[]): void => {
  console.warn(...sanitizeArgs(...args));
};

/**
 * Secure console.error replacement
 * 
 * Usage: secureError('[Feature]', 'Error message', { error: errorObj })
 */
export const secureError = (...args: any[]): void => {
  console.error(...sanitizeArgs(...args));
};

/**
 * Secure console.info replacement
 * 
 * Usage: secureInfo('[Feature]', 'Info message', { data: 'value' })
 */
export const secureInfo = (...args: any[]): void => {
  console.info(...sanitizeArgs(...args));
};

/**
 * Log only in development mode
 * This is completely silent in production
 * 
 * Usage: devLog('[Feature]', 'Debug message', { sensitive: 'data' })
 */
export const devLog = (...args: any[]): void => {
  if (IS_DEV_MODE) {
    console.log('[DEV]', ...args);
  }
};

/**
 * Manually sanitize an object
 * Useful when you need to sanitize data before passing to other functions
 * 
 * Usage: const cleaned = sanitize({ userId: '123', name: 'Test' })
 */
export const sanitize = (obj: any): any => {
  return sanitizeObject(obj);
};

/**
 * Create a sanitized logger with a prefix
 * Useful for feature-specific logging
 * 
 * Usage:
 * const recipeLogger = createLogger('[Recipe]');
 * recipeLogger.log('Created recipe', { userId: '123' });
 */
export const createLogger = (prefix: string) => {
  return {
    log: (...args: any[]) => secureLog(prefix, ...args),
    warn: (...args: any[]) => secureWarn(prefix, ...args),
    error: (...args: any[]) => secureError(prefix, ...args),
    info: (...args: any[]) => secureInfo(prefix, ...args),
    dev: (...args: any[]) => devLog(prefix, ...args)
  };
};





