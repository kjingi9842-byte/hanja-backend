exports.handler = async (event) => {
  // CORS 헤더 강화
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };

  // Preflight 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { text } = JSON.parse(event.body || '{}');
    
    if (!text || text.trim().length === 0) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: '텍스트를 입력해주세요.' }) 
      };
    }

    console.log('요청:', text);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `한국어 문장 "${text}"의 의미를 담은 2글자 한자어를 3-5개 추천해주세요.

응답 형식 (JSON만):
{
  "suggestions": [
    {
      "hanja": "不屈",
      "meaning": "굽히지 않는 의지",
      "characters": [
        {"character": "不", "eum": "불", "meaning": "아니다"},
        {"character": "屈", "eum": "굴", "meaning": "굽히다"}
      ]
    }
  ]
}`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API 에러:', response
