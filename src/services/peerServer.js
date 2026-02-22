/**
 * Minimal HTTP/1.1 server on top of react-native-tcp-socket.
 * Exposes a git sync API so peer devices can fetch/push over local Wi-Fi.
 *
 * Routes:
 *   GET  /api/health           → { ok, repoName }
 *   GET  /api/refs             → { refs: [{name, sha}] }
 *   GET  /api/pack?ref=<name>  → { pack: "<base64 packfile>" }
 *   POST /api/receive          ← { ref, sha, pack: "<base64>" }
 */
import TcpSocket from 'react-native-tcp-socket';
import RNFS from 'react-native-fs';
import git from 'isomorphic-git';
import fs from '../git/fs-adapter';
import { Buffer } from 'buffer';

let _server = null;
let _serverDir = null;

// ── HTTP helpers ────────────────────────────────────────────────────────────

function parseRequest(raw) {
  const headerEnd = raw.indexOf('\r\n\r\n');
  if (headerEnd === -1) return null;

  const headerSection = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd + 4);
  const lines = headerSection.split('\r\n');
  const [method, fullPath] = lines[0].split(' ');

  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const idx = lines[i].indexOf(':');
    if (idx > 0) {
      headers[lines[i].slice(0, idx).toLowerCase().trim()] = lines[i].slice(idx + 1).trim();
    }
  }

  const contentLength = parseInt(headers['content-length'] || '0', 10);
  const [pathname, queryStr = ''] = (fullPath || '/').split('?');
  const query = {};
  queryStr.split('&').filter(Boolean).forEach(p => {
    const [k, v = ''] = p.split('=');
    query[decodeURIComponent(k)] = decodeURIComponent(v);
  });

  return { method, pathname, query, headers, body, contentLength };
}

function respond(socket, status, statusText, data) {
  const body = JSON.stringify(data);
  const msg = [
    `HTTP/1.1 ${status} ${statusText}`,
    'Content-Type: application/json; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body, 'utf8')}`,
    'Connection: close',
    '',
    body,
  ].join('\r\n');
  // Use end() not destroy() — end() flushes all pending data before closing.
  // destroy() cuts the TCP connection immediately, dropping large responses mid-send.
  try {
    socket.end(msg);
  } catch {}
}

// ── Route handlers ──────────────────────────────────────────────────────────

async function handleHealth(socket) {
  const name = (_serverDir || '').split('/').pop();
  respond(socket, 200, 'OK', { ok: true, repoName: name });
}

async function handleRefs(socket) {
  const dir = _serverDir;
  const branches = await git.listBranches({ fs, dir });
  const refs = (
    await Promise.all(
      branches.map(async name => {
        try {
          const sha = await git.resolveRef({ fs, dir, ref: name });
          return { name, sha };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);
  respond(socket, 200, 'OK', { refs });
}

async function handlePack(socket, query) {
  const dir = _serverDir;
  const ref = query.ref || 'HEAD';
  const commits = await git.log({ fs, dir, ref, depth: 1000 });
  if (commits.length === 0) {
    respond(socket, 404, 'Not Found', { error: 'No commits on branch' });
    return;
  }
  const oids = commits.map(c => c.oid);
  const { packfile } = await git.packObjects({ fs, dir, oids, write: false });
  const pack = Buffer.from(packfile).toString('base64');
  respond(socket, 200, 'OK', { pack, ref, commits: commits.length });
}

async function handleReceive(socket, body) {
  const dir = _serverDir;
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    respond(socket, 400, 'Bad Request', { error: 'Invalid JSON body' });
    return;
  }

  const { ref, sha, pack } = data;
  if (!ref || !sha || !pack) {
    respond(socket, 400, 'Bad Request', { error: 'Missing ref/sha/pack' });
    return;
  }

  // Write pack into the repo's pack directory
  const packDir = `${dir}/.git/objects/pack`;
  const packDirExists = await RNFS.exists(packDir);
  if (!packDirExists) await RNFS.mkdir(packDir);

  const packPath = `${packDir}/pack-recv-${Date.now()}.pack`;
  await RNFS.writeFile(packPath, pack, 'base64');
  await git.indexPack({ fs, dir, filepath: packPath });

  await git.writeRef({ fs, dir, ref: `refs/heads/${ref}`, value: sha, force: true });

  respond(socket, 200, 'OK', { ok: true, ref, sha });
}

async function dispatch(socket, req) {
  const { method, pathname, query, body } = req;
  try {
    if (method === 'GET' && pathname === '/api/health') return handleHealth(socket);
    if (method === 'GET' && pathname === '/api/refs') return handleRefs(socket);
    if (method === 'GET' && pathname === '/api/pack') return handlePack(socket, query);
    if (method === 'POST' && pathname === '/api/receive') return handleReceive(socket, body);
    respond(socket, 404, 'Not Found', { error: `No route: ${method} ${pathname}` });
  } catch (e) {
    respond(socket, 500, 'Internal Server Error', { error: e.message });
  }
}

// ── Server lifecycle ────────────────────────────────────────────────────────

/**
 * Start the peer HTTP server on the given port.
 * @param {string} dir  - repo directory to serve
 * @param {number} port - TCP port (default 7821)
 * @param {function} onEvent - called with ('connection'|'error'|'push', data?)
 */
export function startServer(dir, port = 7821, onEvent = () => {}) {
  if (_server) return;
  _serverDir = dir;

  _server = TcpSocket.createServer(socket => {
    let buffer = '';

    socket.on('data', chunk => {
      buffer += (typeof chunk === 'string' ? chunk : chunk.toString('utf8'));

      // Wait until we have the complete headers
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      // For POST requests wait for the full body
      const headerSection = buffer.slice(0, headerEnd);
      const clMatch = headerSection.match(/content-length:\s*(\d+)/i);
      const contentLength = clMatch ? parseInt(clMatch[1], 10) : 0;
      const bodyReceived = Buffer.byteLength(buffer.slice(headerEnd + 4), 'utf8');
      if (bodyReceived < contentLength) return;

      const req = parseRequest(buffer);
      buffer = '';
      if (!req) return;

      if (req.pathname === '/api/receive') onEvent('push', req.query.ref);
      dispatch(socket, req);
    });

    socket.on('error', err => {
      console.warn('[peerServer] socket error:', err.message);
    });

    onEvent('connection');
  });

  _server.listen({ port, host: '0.0.0.0' }, () => {
    onEvent('listening');
  });

  _server.on('error', err => {
    console.error('[peerServer] server error:', err.message);
    onEvent('error', err.message);
  });
}

export function stopServer() {
  if (_server) {
    _server.close();
    _server = null;
    _serverDir = null;
  }
}

export function isServerRunning() {
  return _server !== null;
}
