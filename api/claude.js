const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 없음' });
  }

  // body가 이미 파싱된 객체일 수도, 문자열일 수도 있어서 둘 다 처리
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  };

  return new Promise((resolve) => {
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try {
          // JSON 파싱 시도
          const parsed = JSON.parse(data);
          res.status(response.statusCode).json(parsed);
        } catch (e) {
          // JSON이 아니면 에러 메시지와 원본 텍스트 같이 반환
          res.status(500).json({
            error: 'Anthropic API 응답이 JSON이 아닙니다',
            status: response.statusCode,
            raw: data.slice(0, 500),
          });
        }
        resolve();
      });
    });
    request.on('error', (err) => {
      res.status(500).json({ error: err.message });
      resolve();
    });
    request.write(body);
    request.end();
  });
};
