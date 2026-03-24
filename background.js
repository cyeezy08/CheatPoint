// background.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'OPENROUTER_REQUEST') {
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${msg.apiKey}`,
        'HTTP-Referer': 'chrome-extension://form-ai',
        'X-Title': 'FormAI Extension'
      },
      body: JSON.stringify({
        model: msg.model,
        messages: msg.messages,
        max_tokens: 2000
      })
    })
    .then(r => r.json())
    .then(data => sendResponse({ ok: true, data }))
    .catch(err => sendResponse({ ok: false, error: err.message }));

    return true; // keep async channel open
  }
});
