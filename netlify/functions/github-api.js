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

function corsHeaders(event) {
  const site = (process.env.URL || '').replace(/\/$/, '');
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = new Set([site, ...extra].filter(Boolean));
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowOrigin = allowed.has(origin) ? origin : (site || 'null');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function safeString(v, maxLen) {
  if (v == null) return '';
  const s = String(v).slice(0, maxLen || 500);
  if (/[<>&]/.test(s)) return '';
  return s;
}

function safeHttpUrl(v) {
  const s = String(v || '').trim();
  return /^https?:\/\//i.test(s) ? s.slice(0, 2048) : '';
}

function validateListings(listings) {
  if (!Array.isArray(listings)) throw new Error('Invalid listings payload');
  if (listings.length > 200) throw new Error('Too many listings');
  return listings.map(function(item) {
    if (!item || typeof item !== 'object') throw new Error('Invalid listing entry');
    return {
      title: safeString(item.title, 200),
      price: safeString(item.price, 80),
      status: safeString(item.status, 40),
      city: safeString(item.city, 120),
      address: safeString(item.address, 200),
      beds: safeString(item.beds, 20),
      baths: safeString(item.baths, 20),
      size: safeString(item.size, 40),
      year: safeString(item.year, 10),
      type: safeString(item.type, 80),
      description: safeString(item.description, 5000),
      image: safeHttpUrl(item.image),
      gallery: Array.isArray(item.gallery)
        ? item.gallery.map(safeHttpUrl).filter(Boolean).slice(0, 30)
        : []
    };
  });
}

exports.handler = async (event, context) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  const TOKEN  = process.env.GITHUB_TOKEN;
  const REPO   = process.env.GITHUB_REPO;
  const BRANCH = process.env.GITHUB_BRANCH || 'main';
  const FILE   = '/repos/' + REPO + '/contents/listings/listings.json';

  if (!TOKEN) {
    console.error('GITHUB_TOKEN missing');
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server configuration error' }) };
  }
  if (!REPO) {
    console.error('GITHUB_REPO missing');
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const data    = await githubRequest('GET', FILE, null, TOKEN);
      const content = JSON.parse(Buffer.from(data.content.replace(/\n/g,''), 'base64').toString('utf8'));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: content, sha: data.sha }) };
    }
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const listings = validateListings(body.listings);
      const sha = body.sha;
      if (!sha || typeof sha !== 'string') throw new Error('Invalid sha');
      const encoded = Buffer.from(JSON.stringify({ listings }, null, 2)).toString('base64');
      const result  = await githubRequest('PUT', FILE, {
        message: 'CMS update ' + new Date().toISOString(),
        content: encoded, sha, branch: BRANCH
      }, TOKEN);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, sha: result.content.sha }) };
    }
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch(err) {
    console.error('github-api error:', err.message);
    const msg = String(err.message || '');
    const clientMsg = /Invalid|Too many/i.test(msg) ? msg : 'Request failed';
    const status = /Invalid|Too many/i.test(msg) ? 400 : 500;
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: clientMsg }) };
  }
};
