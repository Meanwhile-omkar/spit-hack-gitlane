const API = 'https://api.github.com';

function headers(token) {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/** Extract { owner, repo } from a GitHub HTTPS remote URL */
export function parseGitHubUrl(url) {
  if (!url) return null;
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** List PRs. state = 'open' | 'closed' | 'all' */
export async function listPRs(token, owner, repo, state = 'open') {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Create a PR. Throws if branch doesn't exist on GitHub (push it first). */
export async function createPR(token, owner, repo, { head, base, title, body = '' }) {
  const res = await fetch(`${API}/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ title, head, base, body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub ${res.status}`);
  }
  return res.json();
}

/** Merge a PR by number. Returns the merge result. */
export async function mergePR(token, owner, repo, prNumber) {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
    {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({ merge_method: 'merge' }),
    },
  );
  if (res.status === 405) throw new Error('Cannot merge — conflict or already merged');
  if (res.status === 409) throw new Error('Merge conflict exists. Resolve locally first.');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub ${res.status}`);
  }
  return res.json();
}

/** Get a single PR with refreshed mergeable status + list of changed files */
export async function getPRDetails(token, owner, repo, prNumber) {
  const [prRes, filesRes] = await Promise.all([
    fetch(`${API}/repos/${owner}/${repo}/pulls/${prNumber}`, { headers: headers(token) }),
    fetch(`${API}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`, { headers: headers(token) }),
  ]);
  const [pr, files] = await Promise.all([prRes.json(), filesRes.json()]);
  return { pr, files: Array.isArray(files) ? files : [] };
}

/** Get the default branch of a repo */
export async function getDefaultBranch(token, owner, repo) {
  const res = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers(token) });
  if (!res.ok) return 'main';
  const data = await res.json();
  return data.default_branch ?? 'main';
}
