exports.handler = async (event, context) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Verify Netlify Identity
  const { user } = context.clientContext || {};
  if (!user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const TOKEN  = process.env.GITHUB_TOKEN;
  const REPO   = process.env.GITHUB_REPO;
  const BRANCH = process.env.GITHUB_BRANCH || 'main';
  const FILE   = 'listings/listings.json';
  const URL    = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

  const ghHeaders = {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SigalGroupRealty-CMS'
  };

  try {
    // GET — read current listings + SHA
    if (event.httpMethod === 'GET') {
      const res  = await fetch(URL, { headers: ghHeaders });
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const json = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ data: json, sha: data.sha })
      };
    }

    // PUT — save updated listings
    if (event.httpMethod === 'PUT') {
      const { listings, sha } = JSON.parse(event.body);
      const encoded = Buffer.from(JSON.stringify({ listings }, null, 2)).toString('base64');
      const res = await fetch(URL, {
        method: 'PUT', headers: ghHeaders,
        body: JSON.stringify({
          message: `CMS update — ${new Date().toISOString()}`,
          content: encoded,
          sha, branch: BRANCH
        })
      });
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ success: true, sha: data.content.sha })
      };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
