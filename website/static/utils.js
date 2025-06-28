// utils.js

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log messages with a timestamp prefix.
 * @param  {...any} args
 */
export function logWithTime(...args) {
  const now = new Date().toISOString();
  console.log(`[${now}]`, ...args);
}

