/**
 * Core Git operations powered by isomorphic-git.
 * All functions are async and return plain JS objects — no git internals leak out.
 */
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import RNFS from 'react-native-fs';
import fs from './fs-adapter';
import { Buffer } from 'buffer';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Base directory where repos are stored */
export const REPOS_DIR = `${RNFS.DocumentDirectoryPath}/gitlane_repos`;

/** Ensure repos base dir exists */
export async function ensureReposDir() {
  const exists = await RNFS.exists(REPOS_DIR);
  if (!exists) await RNFS.mkdir(REPOS_DIR);
}

/** Build auth callbacks from a PAT token */
function makeAuth(token) {
  if (!token) return {};
  return {
    onAuth: () => ({ username: token, password: '' }),
    onAuthFailure: () => ({ cancel: true }),
  };
}

// ── Repository management ─────────────────────────────────────────────────

/**
 * Clone a remote repository.
 * @param {string} url - HTTPS clone URL
 * @param {string} repoName - local folder name
 * @param {string|null} token - PAT for private repos
 * @param {function} onProgress - called with {phase, loaded, total}
 */
export async function cloneRepo(url, repoName, token = null, onProgress = null) {
  await ensureReposDir();
  const dir = `${REPOS_DIR}/${repoName}`;
  await git.clone({
    fs,
    http,
    dir,
    url,
    singleBranch: true,
    depth: 50,          // shallow clone for speed
    ...makeAuth(token),
    onProgress: onProgress ?? (() => {}),
    onMessage: msg => console.log('[git]', msg),
  });
  return { dir, name: repoName, url };
}

/**
 * Open (validate) an existing local repo.
 */
export async function openRepo(dir) {
  const commits = await git.log({ fs, dir, depth: 1 });
  const branch = await git.currentBranch({ fs, dir }) ?? 'HEAD detached';
  return { dir, branch, headSha: commits[0]?.oid ?? null };
}

// ── Status & Index ────────────────────────────────────────────────────────

/**
 * Get working-tree status.
 * Returns array of { path, status } where status is one of:
 * 'new' | 'modified' | 'deleted' | 'staged' | 'staged-modified' | 'staged-deleted' | 'unmodified' | 'ignored'
 */
export async function getStatus(dir) {
  const matrix = await git.statusMatrix({ fs, dir });
  return matrix
    .filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))
    .map(([filepath, head, workdir, stage]) => {
      let status;
      if (head === 0 && workdir === 2 && stage === 0) status = 'new';
      else if (head === 0 && workdir === 2 && stage === 2) status = 'staged-new';
      else if (head === 1 && workdir === 2 && stage === 1) status = 'modified';
      else if (head === 1 && workdir === 2 && stage === 2) status = 'staged-modified';
      else if (head === 1 && workdir === 0 && stage === 1) status = 'deleted';
      else if (head === 1 && workdir === 0 && stage === 0) status = 'staged-deleted';
      else status = 'modified';
      return { path: filepath, status, staged: stage !== head };
    });
}

/** Stage a single file */
export async function stageFile(dir, filepath) {
  await git.add({ fs, dir, filepath });
}

/** Unstage a single file */
export async function unstageFile(dir, filepath) {
  await git.resetIndex({ fs, dir, filepath });
}

/** Stage all changes */
export async function stageAll(dir) {
  await git.add({ fs, dir, filepath: '.' });
}

/** Unstage all */
export async function unstageAll(dir) {
  const matrix = await git.statusMatrix({ fs, dir });
  await Promise.all(matrix.map(([filepath]) => git.resetIndex({ fs, dir, filepath })));
}

// ── Commits ───────────────────────────────────────────────────────────────

/**
 * Create a commit.
 */
export async function commit(dir, message, authorName, authorEmail) {
  const sha = await git.commit({
    fs,
    dir,
    message,
    author: { name: authorName, email: authorEmail },
  });
  return sha;
}

// ── Log / History ─────────────────────────────────────────────────────────

/**
 * Get commit log.
 */
export async function getLog(dir, { depth = 100, ref = 'HEAD' } = {}) {
  const commits = await git.log({ fs, dir, depth, ref });
  return commits.map(c => ({
    sha: c.oid,
    shortSha: c.oid.slice(0, 7),
    message: c.commit.message.trim(),
    summary: c.commit.message.split('\n')[0].trim(),
    authorName: c.commit.author.name,
    authorEmail: c.commit.author.email,
    authoredAt: c.commit.author.timestamp * 1000,
    committedAt: c.commit.committer.timestamp * 1000,
    parentShas: c.commit.parent,
  }));
}

// ── Diff ──────────────────────────────────────────────────────────────────

/**
 * Diff a file in the working directory vs HEAD.
 * Returns unified diff string.
 */
export async function diffFile(dir, filepath) {
  try {
    const headContent = await readFileAtRef(dir, filepath, 'HEAD');
    const workdirPath = `${dir}/${filepath}`;
    const exists = await RNFS.exists(workdirPath);
    const workContent = exists ? await RNFS.readFile(workdirPath, 'utf8') : '';
    return unifiedDiff(filepath, headContent, workContent);
  } catch {
    return '';
  }
}

/**
 * Diff between two commits.
 */
export async function diffCommits(dir, oldSha, newSha) {
  const changes = await git.walk({
    fs,
    dir,
    trees: [git.TREE({ ref: oldSha }), git.TREE({ ref: newSha })],
    map: async (filepath, [oldEntry, newEntry]) => {
      if (!oldEntry && !newEntry) return;
      const oldContent = oldEntry ? await oldEntry.content().then(b => Buffer.from(b).toString('utf8')) : '';
      const newContent = newEntry ? await newEntry.content().then(b => Buffer.from(b).toString('utf8')) : '';
      if (oldContent === newContent) return;
      return { filepath, diff: unifiedDiff(filepath, oldContent, newContent) };
    },
  });
  return changes.filter(Boolean);
}

async function readFileAtRef(dir, filepath, ref) {
  try {
    const { blob } = await git.readBlob({
      fs,
      dir,
      oid: await git.resolveRef({ fs, dir, ref }),
      filepath,
    });
    return Buffer.from(blob).toString('utf8');
  } catch {
    return '';
  }
}

/** Minimal unified diff (shows +/- lines) */
function unifiedDiff(filepath, oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const lines = [];
  lines.push(`--- a/${filepath}`);
  lines.push(`+++ b/${filepath}`);
  // Simple line-by-line diff (good enough for mobile display)
  const maxLen = Math.max(oldLines.length, newLines.length);
  let chunk = [];
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o !== n) {
      if (o !== undefined) chunk.push(`-${o}`);
      if (n !== undefined) chunk.push(`+${n}`);
    } else {
      chunk.push(` ${o ?? ''}`);
    }
  }
  if (chunk.length) {
    lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
    lines.push(...chunk);
  }
  return lines.join('\n');
}

// ── Branches ──────────────────────────────────────────────────────────────

export async function listBranches(dir) {
  const [local, remote] = await Promise.all([
    git.listBranches({ fs, dir }),
    git.listBranches({ fs, dir, remote: 'origin' }),
  ]);
  const current = await git.currentBranch({ fs, dir });
  return {
    current,
    local: local.map(b => ({ name: b, isCurrent: b === current, isRemote: false })),
    remote: remote.map(b => ({ name: b, fullName: `origin/${b}`, isRemote: true })),
  };
}

export async function createBranch(dir, name, checkout = true) {
  await git.branch({ fs, dir, ref: name, checkout });
}

export async function checkoutBranch(dir, ref) {
  await git.checkout({ fs, dir, ref });
}

export async function deleteBranch(dir, ref) {
  await git.deleteBranch({ fs, dir, ref });
}

// ── Remote operations ─────────────────────────────────────────────────────

export async function fetchRepo(dir, token = null) {
  await git.fetch({
    fs, http, dir,
    remote: 'origin',
    prune: true,
    ...makeAuth(token),
    onProgress: () => {},
  });
}

export async function pullRepo(dir, authorName, authorEmail, token = null) {
  await git.pull({
    fs, http, dir,
    remote: 'origin',
    author: { name: authorName, email: authorEmail },
    ...makeAuth(token),
    onProgress: () => {},
  });
}

export async function pushRepo(dir, token = null, force = false) {
  const result = await git.push({
    fs, http, dir,
    remote: 'origin',
    force,
    ...makeAuth(token),
    onProgress: () => {},
  });
  return result;
}

// ── Config ────────────────────────────────────────────────────────────────

export async function getConfig(dir) {
  const [name, email] = await Promise.all([
    git.getConfig({ fs, dir, path: 'user.name' }).catch(() => ''),
    git.getConfig({ fs, dir, path: 'user.email' }).catch(() => ''),
  ]);
  return { name: name ?? '', email: email ?? '' };
}

export async function setConfig(dir, name, email) {
  await Promise.all([
    git.setConfig({ fs, dir, path: 'user.name', value: name }),
    git.setConfig({ fs, dir, path: 'user.email', value: email }),
  ]);
}

export async function getRemoteUrl(dir) {
  try {
    return await git.getConfig({ fs, dir, path: 'remote.origin.url' });
  } catch {
    return null;
  }
}

// ── Peer-to-peer (local network) ───────────────────────────────────────────

const PEER_TEMP_DIR = `${RNFS.TemporaryDirectoryPath}/gitlane_peer`;

async function ensurePeerTemp() {
  const exists = await RNFS.exists(PEER_TEMP_DIR);
  if (!exists) await RNFS.mkdir(PEER_TEMP_DIR);
}

/**
 * Initialise a new local git repo (no remote needed).
 * Creates a README.md and an initial commit so the repo is immediately usable.
 */
export async function initRepo(dirPath, repoName, authorName = 'GitLane User', authorEmail = 'user@gitlane.app') {
  await ensureReposDir();
  await RNFS.mkdir(dirPath);
  await git.init({ fs, dir: dirPath, defaultBranch: 'main' });
  // Seed with a README so there's something to commit
  await RNFS.writeFile(
    `${dirPath}/README.md`,
    `# ${repoName}\n\nCreated with GitLane (offline)\n`,
    'utf8',
  );
  await git.add({ fs, dir: dirPath, filepath: 'README.md' });
  await git.commit({
    fs,
    dir: dirPath,
    message: 'Initial commit',
    author: { name: authorName, email: authorEmail },
  });
  return dirPath;
}

/**
 * Fetch all refs + objects from a peer HTTP server.
 * Updates local branches to match the peer's state.
 */
export async function fetchFromPeer(dir, peerUrl) {
  const resp = await fetch(`${peerUrl}/api/refs`);
  if (!resp.ok) throw new Error(`Peer returned ${resp.status}`);
  const { refs } = await resp.json();
  if (!refs || refs.length === 0) throw new Error('Peer has no branches');

  await ensurePeerTemp();

  for (const ref of refs) {
    try {
      // Check if we already have this exact commit
      try {
        await git.readCommit({ fs, dir, oid: ref.sha });
        // Have it — just update the local branch pointer
        await git.writeRef({ fs, dir, ref: `refs/heads/${ref.name}`, value: ref.sha, force: true });
        continue;
      } catch { /* don't have it, need to download */ }

      const packResp = await fetch(`${peerUrl}/api/pack?ref=${encodeURIComponent(ref.name)}`);
      if (!packResp.ok) continue;
      const { pack } = await packResp.json();

      // Write pack into the repo's pack directory so indexPack can find it
      const packDir = `${dir}/.git/objects/pack`;
      const packDirExists = await RNFS.exists(packDir);
      if (!packDirExists) await RNFS.mkdir(packDir);

      const packPath = `${packDir}/pack-peer-${Date.now()}.pack`;
      await RNFS.writeFile(packPath, pack, 'base64');
      await git.indexPack({ fs, dir, filepath: packPath });

      await git.writeRef({ fs, dir, ref: `refs/heads/${ref.name}`, value: ref.sha, force: true });
    } catch (e) {
      console.warn(`[peer] Failed to fetch branch ${ref.name}:`, e.message);
    }
  }
  return refs;
}

/**
 * Push a local branch to a peer HTTP server.
 */
export async function pushToPeer(dir, peerUrl, branch) {
  const sha = await git.resolveRef({ fs, dir, ref: branch });
  const commits = await git.log({ fs, dir, ref: branch, depth: 1000 });
  const oids = commits.map(c => c.oid);

  const { packfile } = await git.packObjects({ fs, dir, oids, write: false });
  const packBase64 = Buffer.from(packfile).toString('base64');

  const resp = await fetch(`${peerUrl}/api/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: branch, sha, pack: packBase64 }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `Push failed: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Clone a full repo from a peer — creates directory, inits git, fetches all branches.
 */
export async function cloneFromPeer(peerUrl, repoName) {
  await ensureReposDir();
  const dir = `${REPOS_DIR}/${repoName}`;
  const exists = await RNFS.exists(dir);
  if (exists) throw new Error(`"${repoName}" already exists locally`);

  await RNFS.mkdir(dir);
  await git.init({ fs, dir, defaultBranch: 'main' });

  const refs = await fetchFromPeer(dir, peerUrl);

  // Checkout whichever branch came first (usually main/master)
  if (refs.length > 0) {
    await git.checkout({ fs, dir, ref: refs[0].name }).catch(() => {});
  }
  return { dir, name: repoName };
}
