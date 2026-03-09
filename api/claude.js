const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 없습니다.' });
  }

  // Anthropic 형식 → Gemini 형식으로 변환
  const anthropicBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  
  // messages 배열에서 이미지와 텍스트 추출
  const parts = [];
  for (const msg of anthropicBody.messages || []) {
    const content = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
    for (const block of content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data,
          },
        });
      }
    }
  }

  const geminiBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: anthropicBody.max_tokens || 2000,
    },
  });

  const model = 'gemini-1.5-flash';
  const path = `/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(geminiBody),
    },
  };

  return new Promise((resolve) => {
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try {
          const geminiRes = JSON.parse(data);
          
          // Gemini 응답 → Anthropic 형식으로 변환 (App.jsx가 그대로 동작하도록)
          const text = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const anthropicRes = {
            content: [{ type: 'text', text }],
          };
          res.status(200).json(anthropicRes);
        } catch (e) {
          res.status(500).json({ error: 'JSON 파싱 실패', raw: data.slice(0, 300) });
        }
        resolve();
      });
    });
    request.on('error', (err) => {
      res.status(500).json({ error: err.message });
      resolve();
    });
    request.write(geminiBody);
    request.end();
  });
};
