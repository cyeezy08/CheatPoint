// popup.js

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function showAlert(id, msg, type = 'info') {
  const el = document.getElementById(id);
  el.className = `alert show alert-${type}`;
  el.innerHTML = msg;
}
function hideAlert(id) {
  document.getElementById(id).classList.remove('show');
}

function setStatusDot(state) {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot ' + (state || '');
}

// ─── TABS ────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

function getSelectedModel() {
  const custom = document.getElementById('customModel').value.trim();
  if (custom) return custom;
  return document.getElementById('modelSelect').value;
}

// Load saved settings
chrome.storage.sync.get(['apiKey', 'model'], ({ apiKey, model }) => {
  if (apiKey) {
    document.getElementById('apiKey').value = apiKey;
    setStatusDot('connected');
  }
  if (model) {
    const sel = document.getElementById('modelSelect');
    const opt = Array.from(sel.options).find(o => o.value === model);
    if (opt) sel.value = model;
    else document.getElementById('customModel').value = model;
  }
});

// Save settings
document.getElementById('btnSave').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = getSelectedModel();
  if (!apiKey) return showAlert('settingsAlert', '❌ Please enter your API key.', 'error');
  if (!model) return showAlert('settingsAlert', '❌ Please select a model.', 'error');

  chrome.storage.sync.set({ apiKey, model }, () => {
    setStatusDot('connected');
    showAlert('settingsAlert', '✅ Settings saved!', 'info');
    setTimeout(() => hideAlert('settingsAlert'), 2500);
  });
});

// Toggle API key visibility
document.getElementById('toggleKey').addEventListener('click', () => {
  const input = document.getElementById('apiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// Test API key
document.getElementById('btnTest').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) return showAlert('settingsAlert', '❌ Enter an API key first.', 'error');

  showAlert('settingsAlert', '<span class="spinner"></span> Testing connection...', 'loading');

  chrome.runtime.sendMessage({
    action: 'OPENROUTER_REQUEST',
    apiKey,
    model: getSelectedModel() || 'mistralai/mistral-7b-instruct:free',
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }]
  }, (res) => {
    if (res.ok && res.data?.choices?.[0]) {
      setStatusDot('connected');
      showAlert('settingsAlert', '✅ Connected! API key is valid.', 'info');
    } else {
      setStatusDot('error');
      const errMsg = res.data?.error?.message || res.error || 'Unknown error';
      showAlert('settingsAlert', `❌ Error: ${errMsg}`, 'error');
    }
  });
});

// Model search filter
document.getElementById('modelSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  document.querySelectorAll('#modelSelect option').forEach(opt => {
    opt.style.display = opt.text.toLowerCase().includes(q) ? '' : 'none';
  });
});

// ─── FILL TAB ────────────────────────────────────────────────────────────────

let detectedFields = [];
let generatedAnswers = [];
let capturedPageContext = '';

// SCAN
document.getElementById('btnScan').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'SCAN_PAGE' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      return showAlert('fillAlert', '❌ Cannot scan this page. Try refreshing it first.', 'error');
    }

    detectedFields = response.fields;
    capturedPageContext = response.pageContext || '';
    generatedAnswers = [];

    if (detectedFields.length === 0) {
      return showAlert('fillAlert', '⚠️ No fields found. Try scrolling through all questions first, then scan again.', 'error');
    }

    hideAlert('fillAlert');
    renderFieldList(detectedFields);
    document.getElementById('fieldListWrap').style.display = 'block';
    document.getElementById('answerPreviewWrap').style.display = 'none';
    document.getElementById('btnFill').disabled = false;
  });
});

function renderFieldList(fields) {
  const list = document.getElementById('fieldList');
  const count = document.getElementById('fieldCount');
  count.textContent = `${fields.length} Field${fields.length !== 1 ? 's' : ''} Detected`;

  list.innerHTML = fields.map(f => {
    const opts = f.options ? `<div class="field-options">Options: ${f.options.slice(0,4).join(', ')}${f.options.length > 4 ? '...' : ''}</div>` : '';
    return `
      <div class="field-item">
        <span class="field-type">${f.type}</span>
        <div>
          <div class="field-label">${f.label || '(unlabeled)'}</div>
          ${opts}
        </div>
      </div>`;
  }).join('');
}

// CLEAR
document.getElementById('btnClear').addEventListener('click', () => {
  detectedFields = [];
  generatedAnswers = [];
  document.getElementById('fieldListWrap').style.display = 'none';
  document.getElementById('answerPreviewWrap').style.display = 'none';
  hideAlert('fillAlert');
});

// GENERATE ANSWERS
document.getElementById('btnFill').addEventListener('click', async () => {
  chrome.storage.sync.get(['apiKey', 'model'], async ({ apiKey, model }) => {
    if (!apiKey) {
      return showAlert('fillAlert', '❌ No API key. Go to Settings tab first.', 'error');
    }

    const userContext = document.getElementById('userContext').value.trim();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const pageTitle = tab.title || 'Unknown Page';

    // Build the AI prompt
    const fieldsDescription = detectedFields.map((f, i) => {
      let desc = `${i + 1}. [${f.type.toUpperCase()}] "${f.label}"`;
      if (f.options && f.options.length > 0) {
        desc += `\n   Available options: ${f.options.join(', ')}`;
      }
      desc += `\n   Field ID: ${f.id}`;
      return desc;
    }).join('\n\n');

    const systemPrompt = `You are an expert quiz and form answering assistant.
You will receive form fields (including quiz questions with multiple choice options) extracted from a webpage.
You MUST answer each field correctly using your knowledge.

Respond ONLY with a valid JSON array. No markdown, no preamble, no explanation. Raw JSON only.

Format: [{"id":"field_id","value":"your answer"},...]

CRITICAL RULES:
- For quiz-choice, radio, select: "value" MUST be copied EXACTLY from the provided options list (copy the exact text)
- For text inputs: write a short accurate answer
- For checkboxes: "true" to check, "false" to uncheck
- Use your real knowledge to pick the CORRECT answer for quiz questions
- If options are listed, you MUST pick one that exists in the list exactly`;

    const pageCtxSection = capturedPageContext ? `\n\nPAGE CONTENT (use this to understand quiz questions):\n${capturedPageContext.slice(0, 2000)}` : '';
    const userPrompt = `Page: "${pageTitle}"
${userContext ? `\nUser context: ${userContext}` : ''}${pageCtxSection}

\nFORM FIELDS TO FILL (answer each correctly):
${fieldsDescription}

Respond with JSON array only.`;

    const btn = document.getElementById('btnFill');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating...';
    showAlert('fillAlert', '<span class="spinner"></span> Asking AI to fill your form...', 'loading');

    chrome.runtime.sendMessage({
      action: 'OPENROUTER_REQUEST',
      apiKey,
      model: model || 'mistralai/mistral-7b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }, (res) => {
      btn.disabled = false;
      btn.innerHTML = '✨ Generate & Fill';

      if (!res.ok || !res.data?.choices?.[0]) {
        const errMsg = res.data?.error?.message || res.error || 'Request failed';
        return showAlert('fillAlert', `❌ AI Error: ${errMsg}`, 'error');
      }

      let rawText = res.data.choices[0].message?.content || '';
      // Strip markdown fences if present
      rawText = rawText.replace(/```json|```/g, '').trim();

      try {
        generatedAnswers = JSON.parse(rawText);
        if (!Array.isArray(generatedAnswers)) throw new Error('Not an array');

        hideAlert('fillAlert');
        renderAnswerPreview(generatedAnswers);
        document.getElementById('answerPreviewWrap').style.display = 'block';

      } catch (e) {
        showAlert('fillAlert', `❌ Could not parse AI response. Try a different model. Raw: ${rawText.slice(0,100)}`, 'error');
      }
    });
  });
});

function renderAnswerPreview(answers) {
  const list = document.getElementById('answerList');
  list.innerHTML = answers.map(ans => {
    const field = detectedFields.find(f => f.id === ans.id);
    const label = field?.label || ans.id;
    return `
      <div class="answer-item">
        <div class="answer-q">Q: ${label}</div>
        <div class="answer-a">→ ${ans.value}</div>
      </div>`;
  }).join('');
}

// APPLY ANSWERS
document.getElementById('btnApply').addEventListener('click', async () => {
  if (!generatedAnswers.length) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, {
    action: 'FILL_FORM',
    answers: generatedAnswers
  }, (res) => {
    if (res?.ok) {
      showAlert('fillAlert', '✅ Form filled successfully! Review before submitting.', 'info');
    } else {
      showAlert('fillAlert', '⚠️ Some fields may not have been filled. Check the form manually.', 'error');
    }
  });
});
