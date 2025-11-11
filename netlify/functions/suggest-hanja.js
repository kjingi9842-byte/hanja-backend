exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { userInput } = JSON.parse(event.body);  // userInput으로 받기
    
    if (!userInput || userInput.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '텍스트를 입력해주세요.' }) };
    }

    console.log('요청:', userInput);

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
          content: `한국어 문장 "${userInput}"의 의미를 담은 2글자 한자어를 3-5개 추천해주세요.

응답 형식 (JSON만):
{
  "suggestions": [
    {
      "hanja": "漢字",
      "meaning": "전체 의미 설명",
      "characters": [
        {"character": "漢", "eum": "한", "meaning": "한나라"},
        {"character": "字", "eum": "자", "meaning": "글자"}
      ]
    }
  ]
}

반드시 위 형식의 JSON만 출력하세요.`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.content[0].text.trim();
    
    const match = content.match(/\{[\s\S]*\}/);
    if (match) content = match[0];
    
    const result = JSON.parse(content);

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (error) {
    console.error('에러:', error.message);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ 
        error: '오류 발생',
        message: error.message,
        suggestions: [] 
      }) 
    };
  }
};
