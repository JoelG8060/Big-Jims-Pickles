import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.join(__dirname, '.env'));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const PORT = Number(process.env.PORT || 3000);
const DATABASE_PATH = requireEnv('DATABASE_PATH');
const SESSION_SECRET = requireEnv('SESSION_SECRET');
const ADMIN_USERNAME = requireEnv('ADMIN_USERNAME');
const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');
const REQUEST_COOKIE_NAME = 'big_jims_admin_session';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

mkdirSync(path.dirname(path.resolve(ROOT_DIR, DATABASE_PATH)), { recursive: true });

const database = new DatabaseSync(path.resolve(ROOT_DIR, DATABASE_PATH));
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

const schemaPath = path.join(__dirname, 'migrations', '001_create_requests.sql');
database.exec(readFileSync(schemaPath, 'utf8'));

const statements = {
  insertRequest: database.prepare(`
    INSERT INTO requests (
      id, category, name, contact, style, quantity, notes, status, created_at
    ) VALUES (
      @id, @category, @name, @contact, @style, @quantity, @notes, @status, @created_at
    )
  `),
  getRequestById: database.prepare(`
    SELECT id, category, name, contact, style, quantity, notes, status, created_at
    FROM requests
    WHERE id = ?
  `),
  listRequests: database.prepare(`
    SELECT id, category, name, contact, style, quantity, notes, status, created_at
    FROM requests
    ORDER BY datetime(created_at) DESC, rowid DESC
  `),
  deleteRequest: database.prepare('DELETE FROM requests WHERE id = ?'),
  updateRequestStatus: database.prepare(`
    UPDATE requests
    SET status = ?
    WHERE id = ?
  `),
  summary: database.prepare(`
    SELECT
      COUNT(*) AS totalRequests,
      COALESCE(SUM(CASE WHEN category = 'Pickles' THEN 1 ELSE 0 END), 0) AS pickleCount,
      COALESCE(SUM(CASE WHEN category = 'Ranch' THEN 1 ELSE 0 END), 0) AS ranchCount
    FROM requests
  `),
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeCategory(value) {
  const category = normalizeText(value);
  return category === 'Pickles' || category === 'Ranch' ? category : '';
}

function normalizeStatus(value) {
  const status = normalizeText(value);
  return ['New', 'Contacted', 'In Progress', 'Ready', 'Complete'].includes(status)
    ? status
    : '';
}

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function textResponse(res, statusCode, body, headers = {}) {
  const payload = String(body);
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, chunk) => {
    const [rawKey, ...rest] = chunk.split('=');
    const key = rawKey?.trim();
    if (!key) {
      return cookies;
    }
    cookies[key] = decodeURIComponent(rest.join('=').trim());
    return cookies;
  }, {});
}

function signAdminToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  let valid = false;
  try {
    valid =
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    valid = false;
  }

  if (!valid) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.username !== ADMIN_USERNAME || typeof decoded.exp !== 'number') {
      return null;
    }
    if (Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function getAuthenticatedAdmin(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  return verifyAdminToken(cookies[REQUEST_COOKIE_NAME]);
}

function setCookieHeader(token, maxAgeSeconds) {
  const cookiePieces = [
    `${REQUEST_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    cookiePieces.push('Secure');
  }

  return cookiePieces.join('; ');
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function serializeRequest(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    contact: row.contact,
    style: row.style,
    quantity: row.quantity,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

function getSummary() {
  const row = statements.summary.get();
  return {
    totalRequests: Number(row?.totalRequests || 0),
    pickleCount: Number(row?.pickleCount || 0),
    ranchCount: Number(row?.ranchCount || 0),
  };
}

function createRequest({ category, name, contact, style, quantity, notes }) {
  const request = {
    id: randomUUID(),
    category,
    name,
    contact,
    style,
    quantity,
    notes,
    status: 'New',
    created_at: new Date().toISOString(),
  };

  statements.insertRequest.run(request);
  const savedRequest = statements.getRequestById.get(request.id);
  return serializeRequest(savedRequest);
}

function updateRequestStatus(id, status) {
  const updateResult = statements.updateRequestStatus.run(status, id);
  if (!updateResult.changes) {
    return null;
  }
  return serializeRequest(statements.getRequestById.get(id));
}

function deleteRequestById(id) {
  const deleteResult = statements.deleteRequest.run(id);
  return deleteResult.changes > 0;
}

async function serveStaticFile(request, response, requestPath) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const candidatePath = path.normalize(path.join(ROOT_DIR, safePath));

  if (!candidatePath.startsWith(ROOT_DIR)) {
    textResponse(response, 403, 'Forbidden');
    return;
  }

  let filePath = candidatePath;
  let contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

  if (!existsSync(filePath)) {
    if (path.extname(filePath)) {
      textResponse(response, 404, 'Not found');
      return;
    }
    filePath = path.join(ROOT_DIR, 'index.html');
    contentType = MIME_TYPES['.html'];
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    textResponse(response, 404, 'Not found');
    return;
  }

  const isCacheSensitiveAsset = filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css');

  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stats.size,
    'Cache-Control': isCacheSensitiveAsset ? 'no-store' : 'public, max-age=3600',
  });

  if ((request.method || 'GET') === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function handleApi(request, response, url) {
  const { pathname } = url;
  const method = request.method || 'GET';

  try {
    if (pathname === '/api/public/stats' && method === 'GET') {
      jsonResponse(response, 200, getSummary());
      return;
    }

    if (pathname === '/api/admin/me' && method === 'GET') {
      const admin = getAuthenticatedAdmin(request);
      if (!admin) {
        jsonResponse(response, 401, { authenticated: false });
        return;
      }
      jsonResponse(response, 200, { authenticated: true, username: admin.username });
      return;
    }

    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await readJsonBody(request);
      const username = normalizeText(body.username);
      const password = normalizeText(body.password);

      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        jsonResponse(response, 401, { message: 'That admin login did not match the stored credentials.' });
        return;
      }

      const token = signAdminToken(username);
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': setCookieHeader(token, 60 * 60 * 24 * 7),
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify({ authenticated: true, username }));
      return;
    }

    if (pathname === '/api/admin/logout' && method === 'POST') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `${REQUEST_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify({ authenticated: false }));
      return;
    }

    if (pathname === '/api/requests' && method === 'POST') {
      const body = await readJsonBody(request);
      const category = normalizeCategory(body.category);
      const name = normalizeText(body.name);
      const contact = normalizeText(body.contact);
      const style = normalizeText(body.style);
      const quantity = normalizeText(body.quantity);
      const notes = normalizeText(body.notes);

      if (!category || !name || !contact || !style || !quantity) {
        jsonResponse(response, 400, { message: 'Please fill out the required request fields.' });
        return;
      }

      const savedRequest = createRequest({
        category,
        name,
        contact,
        style,
        quantity,
        notes,
      });

      jsonResponse(response, 201, { request: savedRequest, summary: getSummary() });
      return;
    }

    if (pathname === '/api/admin/requests' && method === 'GET') {
      if (!getAuthenticatedAdmin(request)) {
        jsonResponse(response, 401, { message: 'Authentication required.' });
        return;
      }
      jsonResponse(response, 200, {
        requests: statements.listRequests.all().map(serializeRequest),
      });
      return;
    }

    if (pathname.startsWith('/api/admin/requests/') && method === 'PATCH') {
      if (!getAuthenticatedAdmin(request)) {
        jsonResponse(response, 401, { message: 'Authentication required.' });
        return;
      }

      const id = pathname.split('/').pop();
      const body = await readJsonBody(request);
      const status = normalizeStatus(body.status);

      if (!id || !status) {
        jsonResponse(response, 400, { message: 'Please choose a valid request status.' });
        return;
      }

      const updatedRequest = updateRequestStatus(id, status);
      if (!updatedRequest) {
        jsonResponse(response, 404, { message: 'Request not found.' });
        return;
      }

      jsonResponse(response, 200, { request: updatedRequest, summary: getSummary() });
      return;
    }

    if (pathname.startsWith('/api/admin/requests/') && method === 'DELETE') {
      if (!getAuthenticatedAdmin(request)) {
        jsonResponse(response, 401, { message: 'Authentication required.' });
        return;
      }

      const id = pathname.split('/').pop();
      if (!id) {
        jsonResponse(response, 400, { message: 'Missing request id.' });
        return;
      }

      const deleted = deleteRequestById(id);
      if (!deleted) {
        jsonResponse(response, 404, { message: 'Request not found.' });
        return;
      }

      jsonResponse(response, 200, { success: true, summary: getSummary() });
      return;
    }

    if (pathname === '/healthz' && method === 'GET') {
      textResponse(response, 200, 'ok');
      return;
    }

    jsonResponse(response, 404, { message: 'Not found' });
  } catch (error) {
    console.error(error);
    jsonResponse(response, 500, { message: 'Something went wrong on the server.' });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
      return;
    }

    if (request.method && request.method !== 'GET' && request.method !== 'HEAD') {
      textResponse(response, 405, 'Method not allowed');
      return;
    }

      await serveStaticFile(request, response, url.pathname);
  } catch (error) {
    console.error(error);
    jsonResponse(response, 500, { message: 'Unexpected server failure.' });
  }
});

server.listen(PORT, () => {
  console.log(`Big Jims Pickels running on http://127.0.0.1:${PORT}`);
});
