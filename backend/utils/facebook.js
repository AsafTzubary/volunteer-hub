const https = require('https');

const GRAPH_HOST = 'graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v25.0';
const REQUEST_TIMEOUT_MS = 10000;

// The Graph API can only publish to a Page, never to a personal profile, so
// these belong to the Volunteer Hub Page. A Page access token derived from a
// long-lived user token carries no expiry of its own, but it is invalidated if
// the granting user changes their password, loses their role on the Page, or
// revokes the app - so a sudden run of code 190 errors means the token, not
// the code.
function readCredentials() {
  const credentials = {
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  };

  const missing = Object.keys(credentials).filter((key) => !credentials[key]);

  return { credentials, missing };
}

function isFacebookConfigured() {
  return readCredentials().missing.length === 0;
}

function graphVersion() {
  return process.env.FACEBOOK_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
}

function describeError(statusCode, payload, raw) {
  const error = payload && payload.error;
  if (!error) return `Graph API responded ${statusCode}: ${raw}`;

  const details = [];
  if (error.code !== undefined) details.push(`code ${error.code}`);
  if (error.error_subcode !== undefined) details.push(`subcode ${error.error_subcode}`);
  if (error.fbtrace_id) details.push(`fbtrace_id ${error.fbtrace_id}`);

  const summary = `Graph API responded ${statusCode}: ${error.message || 'unknown error'}`;

  return details.length ? `${summary} (${details.join(', ')})` : summary;
}

// The token travels in the Authorization header rather than the query string or
// form body, so it stays out of server, proxy and access logs.
function graphRequest(method, path, form) {
  const { credentials, missing } = readCredentials();

  if (missing.length) {
    return Promise.reject(new Error(`Missing Facebook credentials: ${missing.join(', ')}.`));
  }

  const body = form ? new URLSearchParams(form).toString() : null;
  const headers = { Authorization: `Bearer ${credentials.accessToken}` };

  if (body !== null) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  const options = { hostname: GRAPH_HOST, path, method, headers };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let payload;
        try {
          payload = JSON.parse(data);
        } catch (err) {
          return reject(new Error(`Could not parse Graph API response: ${data}`));
        }

        // The Graph API can return an error object alongside a 200, so the
        // status code alone is not enough to call this a success.
        if (res.statusCode < 200 || res.statusCode >= 300 || payload.error) {
          return reject(new Error(describeError(res.statusCode, payload, data)));
        }

        resolve(payload);
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('Graph API request timed out.'));
    });

    request.on('error', reject);
    if (body !== null) request.write(body);
    request.end();
  });
}

function pagePath(suffix) {
  const { credentials } = readCredentials();
  return `/${graphVersion()}/${encodeURIComponent(credentials.pageId || '')}${suffix}`;
}

// Confirms the token, the Page id and the app's access to it without publishing
// anything. Reads carry no charge, so this is a free dry-run check.
function verifyPageAccess() {
  return graphRequest('GET', `${pagePath('')}?fields=id,name`);
}

function postToPage(message) {
  return graphRequest('POST', pagePath('/feed'), { message });
}

module.exports = { postToPage, verifyPageAccess, isFacebookConfigured };
