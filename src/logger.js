// logger.js
export function logInfo(...args) {
  console.log(`[INFO ${new Date().toISOString()}]`, ...args);
}

export function logWarn(...args) {
  console.warn(`[WARN ${new Date().toISOString()}]`, ...args);
}

export function logError(...args) {
  console.error(`[ERROR ${new Date().toISOString()}]`, ...args);
}
