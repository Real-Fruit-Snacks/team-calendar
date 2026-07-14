export function detectHost(location) {
  return String(location.hostname || '').endsWith('github.io') ? 'github' : 'gitlab';
}

export function githubRepo(location) {
  const owner = String(location.hostname).replace('.github.io', '');
  const seg = String(location.pathname || '/').split('/').filter(Boolean)[0];
  return { owner, repo: seg || `${owner}.github.io` };
}

export function encodeBase64(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf-8').toString('base64');
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

export function decodeBase64(b64) {
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf-8');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function tokenCreateURL(kind, origin) {
  return kind === 'github'
    ? 'https://github.com/settings/tokens/new?description=Team%20Calendar&scopes=repo'
    : `${origin}/-/user_settings/personal_access_tokens?name=Team%20Calendar&scopes=api`;
}

function conflictError(status, message) {
  const err = new Error(message || `Request failed (${status})`);
  err.status = status;
  err.conflict = status === 409 || status === 400;
  return err;
}

function githubAdapter({ owner, repo, branch, fetchImpl }) {
  const base = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const headers = (token) => ({
    'Accept': 'application/vnd.github+json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });
  return {
    kind: 'github',
    async getFile(path, token) {
      const res = await fetchImpl(`${base}/${path}?ref=${branch}`, { headers: headers(token) });
      if (!res.ok) throw conflictError(res.status, `getFile ${path}`);
      const json = await res.json();
      return { content: decodeBase64(json.content), ref: json.sha };
    },
    async putFile(path, content, message, token, ref) {
      const res = await fetchImpl(`${base}/${path}`, {
        method: 'PUT',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: encodeBase64(content), sha: ref, branch }),
      });
      if (!res.ok) throw conflictError(res.status, `putFile ${path}`);
      const json = await res.json();
      return json.content.sha;
    },
  };
}

function gitlabAdapter({ origin, projectId, branch, fetchImpl }) {
  const base = `${origin}/api/v4/projects/${projectId}/repository/files`;
  const headers = (token) => (token ? { 'PRIVATE-TOKEN': token } : {});
  async function getFile(path, token) {
    const enc = encodeURIComponent(path);
    const res = await fetchImpl(`${base}/${enc}?ref=${branch}`, { headers: headers(token) });
    if (!res.ok) throw conflictError(res.status, `getFile ${path}`);
    const json = await res.json();
    return { content: decodeBase64(json.content), ref: json.last_commit_id };
  }
  async function putFile(path, content, message, token, ref) {
    const enc = encodeURIComponent(path);
    const res = await fetchImpl(`${base}/${enc}`, {
      method: 'PUT',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, content, commit_message: message, last_commit_id: ref }),
    });
    if (!res.ok) throw conflictError(res.status, `putFile ${path}`);
    // GitLab's PUT response carries no commit id; re-fetch so the next
    // optimistic-concurrency save sends a real last_commit_id, not a synthetic one.
    const fresh = await getFile(path, token);
    return fresh.ref;
  }
  return { kind: 'gitlab', getFile, putFile };
}

export function createHost({ location, config = {}, fetchImpl = fetch } = {}) {
  const kind = config.host || detectHost(location);
  const branch = config.branch || 'main';
  if (kind === 'github') {
    const repo = config.repo
      ? { owner: config.repo.split('/')[0], repo: config.repo.split('/')[1] }
      : githubRepo(location);
    return githubAdapter({ owner: repo.owner, repo: repo.repo, branch, fetchImpl });
  }
  return gitlabAdapter({
    origin: config.origin || location.origin,
    projectId: config.projectId,
    branch,
    fetchImpl,
  });
}
