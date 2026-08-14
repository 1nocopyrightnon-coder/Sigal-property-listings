const https = require('https');

function githubRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'SigalGroupRealty-CMS'
      }
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error('GitHub ' + res.statusCode + ': ' + (parsed.message || data)));
          else resolve(parsed);
        } catch(e) { reject(new Error('Parse error: ' + data.slice(0,200))); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async (event, context) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  const TOKEN  = process.env.GITHUB_TOKEN;
  const REPO   = process.env.GITHUB_REPO;
  const BRANCH = process.env.GITHUB_BRANCH || 'main';
  const FILE   = '/repos/' + REPO + '/contents/listings/listings.json';

  if (!TOKEN) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'GITHUB_TOKEN missing' }) };
  if (!REPO)  return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'GITHUB_REPO missing' }) };

  try {
    if (event.httpMethod === 'GET') {
      const data    = await githubRequest('GET', FILE, null, TOKEN);
      const content = JSON.parse(Buffer.from(data.content.replace(/\n/g,''), 'base64').toString('utf8'));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: content, sha: data.sha }) };
    }
    if (event.httpMethod === 'PUT') {
      const { listings, sha } = JSON.parse(event.body);
      const encoded = Buffer.from(JSON.stringify({ listings }, null, 2)).toString('base64');
      const result  = await githubRequest('PUT', FILE, {
        message: 'CMS update ' + new Date().toISOString(),
        content: encoded, sha, branch: BRANCH
      }, TOKEN);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, sha: result.content.sha }) };
    }
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch(err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
