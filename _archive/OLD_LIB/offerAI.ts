export async function generateOffer(payload: any) {
  const response = await fetch('/api/gpt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'offer',
      payload
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.error || 'Failed to generate offer');
  }

  // Automatiskt hantera GPT-svar om handleGptResponse finns
  if (data.gptResponse && window.handleGptResponse) {
    try {
      await window.handleGptResponse(data.gptResponse);
    } catch (error) {
      console.error('Fel vid automatisk hantering av GPT-svar:', error);
    }
  }

  return data.data;
}

export async function ask(text: string) {
  const response = await fetch('/api/gpt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'chat',
      payload: { message: text }
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.error || 'Failed to get response');
  }

  return data.text;
}

