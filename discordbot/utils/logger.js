export const logListeners = new Set();

export function addLogListener(listener) {
    logListeners.add(listener);
}

export function removeLogListener(listener) {
    logListeners.delete(listener);
}

export function logInfo(...args) {
    console.log(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const logData = JSON.stringify({ type: 'log', message: msg, time: new Date().toISOString() });
    logListeners.forEach(l => l(logData));
}

export function logError(...args) {
    console.error(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const logData = JSON.stringify({ type: 'error', message: msg, time: new Date().toISOString() });
    logListeners.forEach(l => l(logData));
}
