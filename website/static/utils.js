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


export function getPhaseImage(phase) {
  const PHASE_IMAGES = [
    "new_moon.png",
    "waxing_crescent.png",
    "first_quarter.png",
    "waxing_gibbous.png",
    "full_moon.png",
    "waning_gibbous.png",
    "last_quarter.png",
    "waning_crescent.png"
  ];
  return PHASE_IMAGES[phase] ?? "";
}

