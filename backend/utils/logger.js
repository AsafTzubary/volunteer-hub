const crypto = require('crypto');

const SENSITIVE_KEY = /pass|secret|token|auth|cookie|session|credential|api[-_]?key/i;
const REDACTED = '[redacted]';
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 10;
const MAX_STRING_LENGTH = 200;

function safeString(value) {
  try {
    return String(value);
  } catch {
    return '[unprintable]';
  }
}

function truncate(text) {
  return text.length > MAX_STRING_LENGTH
    ? `${text.slice(0, MAX_STRING_LENGTH)}… (${text.length} chars)`
    : text;
}

function isPlainObject(value) {
  return value.constructor === Object || value.constructor === undefined;
}

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[deep]';

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`… ${value.length - MAX_ARRAY_ITEMS} more`);
    return items;
  }

  if (typeof value === 'object') {
    if (!isPlainObject(value)) return truncate(safeString(value));
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }

  return truncate(safeString(value));
}

function describeError(err) {
  if (!(err instanceof Error)) {
    return { name: 'NonError', message: truncate(safeString(err)) };
  }
  return {
    name: err.name,
    message: truncate(err.message || ''),
    ...(err.code !== undefined && { code: safeString(err.code) }),
  };
}

function describeRequest(req) {
  return {
    method: req.method,
    path: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
    query: redact(req.query || {}),
    body: redact(req.body || {}),
    user: (req.session && req.session.username) || null,
  };
}

function newRequestId() {
  return crypto.randomBytes(4).toString('hex');
}

function logError(err, { requestId, req, status = 500 } = {}) {
  const entry = {
    at: new Date().toISOString(),
    level: 'error',
    requestId,
    status,
    error: describeError(err),
  };

  try {
    if (req) entry.request = describeRequest(req);
    console.error(`[error] ${JSON.stringify(entry)}`);
  } catch {
    console.error(`[error] ${requestId || '-'} could not be serialised for logging`);
  }

  if (err && err.stack) console.error(err.stack);
}

module.exports = { logError, newRequestId, redact };
