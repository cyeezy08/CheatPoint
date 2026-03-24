# FormAI – OpenRouter Auto-Fill Chrome Extension

Auto-fill any webpage form (Google Forms, HTML forms, surveys) using AI via OpenRouter's free models.

---

## 📁 Files
```
form-ai-extension/
├── manifest.json       — Extension config
├── popup.html          — Extension popup UI
├── popup.js            — Popup logic (settings, scan, fill)
├── content.js          — Injected into pages (scans & fills forms)
├── background.js       — Service worker (handles API calls)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 How to Install (Developer Mode)

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select this `form-ai-extension/` folder
5. The extension icon will appear in your toolbar ✅

---

## ⚙️ Setup

1. Get a **free API key** from [openrouter.ai](https://openrouter.ai)
   - Sign up → Dashboard → API Keys → Create Key
2. Click the FormAI extension icon
3. Go to **Settings** tab
4. Paste your API key and pick a free model
5. Click **Save Settings** and optionally **Test Key**

---

## 🧑‍💻 How to Use

1. Open any webpage with a form (e.g. Google Forms, survey, sign-up)
2. Click the FormAI extension icon
3. On the **Fill** tab, optionally add context like:
   > "I am a 22 year old software engineering student from Malaysia"
4. Click **🔍 Scan Page for Fields** — detected fields will highlight green
5. Click **✨ Generate & Fill** — AI generates answers
6. Review the answers in the preview
7. Click **📝 Apply to Form** — fields get filled!
8. **Review everything before submitting!**

---

## 🆓 Free Models Available

| Model | Notes |
|-------|-------|
| `mistralai/mistral-7b-instruct:free` | Best overall free option |
| `meta-llama/llama-3.1-8b-instruct:free` | Great reasoning |
| `google/gemma-2-9b-it:free` | Google's free model |
| `microsoft/phi-3-mini-128k-instruct:free` | Long context |
| `qwen/qwen-2-7b-instruct:free` | Fast responses |

---

## ✅ Supported Field Types

- Text inputs & textareas
- Dropdown selects
- Radio button groups
- Checkboxes
- Google Forms (including ARIA-based custom controls)

## ⚠️ Limitations

- Cannot bypass CAPTCHA
- Some heavily JavaScript-rendered forms may need a page refresh first
- AI answers may not always be perfect — always review before submitting
- Google Forms uses custom div-based inputs, so results may vary

---

## 🔒 Privacy

- Your API key is stored locally in Chrome's `sync` storage
- Page content is sent to OpenRouter's API for processing
- No data is stored by this extension beyond your settings
