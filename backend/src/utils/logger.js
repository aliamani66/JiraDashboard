const fs = require('fs');
const path = require('path');

const MAX_LOG_BUFFER_SIZE = 3000;
const logBuffer = [];
const sseClients = new Set();

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  try { fs.mkdirSync(logsDir, { recursive: true }); } catch (_) {}
}
const logFilePath = path.join(logsDir, 'app.log');

function formatTimestamp(d = new Date()) {
  return d.toISOString().replace('T', ' ').substring(0, 23);
}

// Preload recent logs from disk if available
try {
  if (fs.existsSync(logFilePath)) {
    const rawContent = fs.readFileSync(logFilePath, 'utf8');
    const rawLines = rawContent.split('\n').filter(l => l.trim());
    const recentLines = rawLines.slice(-300);
    recentLines.forEach((line, idx) => {
      // Line format: [2026-08-15 00:00:00.000] [LEVEL] [TAG] message
      const match = line.match(/^\[(.*?)\]\s+\[([A-Z]+)\]\s+\[(.*?)\]\s+(.*)$/);
      if (match) {
        logBuffer.push({
          id: `disk-${idx}-${Date.now()}`,
          timestamp: match[1],
          level: match[2],
          tag: match[3],
          message: match[4]
        });
      } else {
        logBuffer.push({
          id: `disk-${idx}-${Date.now()}`,
          timestamp: formatTimestamp(),
          level: 'INFO',
          tag: 'SYSTEM',
          message: line
        });
      }
    });
  }
} catch (_) {}

function broadcastLog(entry) {
  for (const client of sseClients) {
    try {
      client.res.write(`data: ${JSON.stringify(entry)}\n\n`);
      if (typeof client.res.flush === 'function') {
        client.res.flush();
      }
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

function addLog(level, message, meta = null) {
  const timestamp = formatTimestamp();
  const id = Date.now() + Math.random().toString(36).substring(2, 7);
  
  let formattedMsg = typeof message === 'object' ? JSON.stringify(message) : String(message);
  let stack = null;
  
  if (meta instanceof Error) {
    stack = meta.stack;
    if (!formattedMsg) formattedMsg = meta.message;
  } else if (meta && typeof meta === 'object') {
    if (meta.stack) stack = meta.stack;
  }

  // Detect tag/category from prefix e.g. [SYNC], [JIRA], [AUTH], [DB], [TEST], [HTTP]
  let tag = 'SYSTEM';
  const tagMatch = formattedMsg.match(/^\[([A-Z0-9_\-]+)\]/);
  if (tagMatch) {
    tag = tagMatch[1];
  }

  const logEntry = {
    id,
    timestamp,
    level: level.toUpperCase(),
    tag,
    message: formattedMsg,
    stack,
    meta: meta && !(meta instanceof Error) ? meta : undefined
  };

  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Append to disk log file asynchronously
  const line = `[${timestamp}] [${logEntry.level}] [${tag}] ${formattedMsg}${stack ? '\n' + stack : ''}\n`;
  try {
    fs.appendFile(logFilePath, line, () => {});
  } catch (_) {}

  // Broadcast to connected SSE live streams
  broadcastLog(logEntry);

  return logEntry;
}

const logger = {
  info: (msg, meta) => {
    addLog('INFO', msg, meta);
  },
  warn: (msg, meta) => {
    addLog('WARN', msg, meta);
  },
  error: (msg, meta) => {
    addLog('ERROR', msg, meta);
  },
  debug: (msg, meta) => {
    addLog('DEBUG', msg, meta);
  },
  http: (msg, meta) => {
    addLog('HTTP', msg, meta);
  },
  getLogs: (options = {}) => {
    const { limit = 500, level, search, tag } = options;
    let list = [...logBuffer];

    if (level && level !== 'ALL') {
      list = list.filter(l => l.level === level.toUpperCase());
    }
    if (tag && tag !== 'ALL') {
      list = list.filter(l => l.tag.toUpperCase() === tag.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => 
        l.message.toLowerCase().includes(q) || 
        l.tag.toLowerCase().includes(q) ||
        (l.stack && l.stack.toLowerCase().includes(q))
      );
    }

    return list.slice(-Math.min(limit, MAX_LOG_BUFFER_SIZE));
  },
  clearLogs: () => {
    logBuffer.length = 0;
    try {
      fs.writeFileSync(logFilePath, `--- Logs cleared at ${formatTimestamp()} ---\n`);
    } catch (_) {}
    return true;
  },
  addSseClient: (clientId, res) => {
    const client = { id: clientId, res };
    sseClients.add(client);
    return () => sseClients.delete(client);
  }
};

// Intercept standard console.log / error / warn so all existing codebase logs flow into logger
const origConsoleLog = console.log;
const origConsoleError = console.error;
const origConsoleWarn = console.warn;

console.log = (...args) => {
  origConsoleLog(...args);
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  addLog('INFO', msg);
};

console.error = (...args) => {
  origConsoleError(...args);
  const msg = args.map(a => typeof a === 'object' ? (a.message || JSON.stringify(a)) : String(a)).join(' ');
  const err = args.find(a => a instanceof Error);
  addLog('ERROR', msg, err);
};

console.warn = (...args) => {
  origConsoleWarn(...args);
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  addLog('WARN', msg);
};

module.exports = logger;
