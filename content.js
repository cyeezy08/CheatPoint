// content.js — Deep form & quiz scanner v2

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
}

function cleanText(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

function findNearbyLabel(el, maxDepth = 6) {
  let node = el;
  for (let i = 0; i < maxDepth; i++) {
    node = node.parentElement;
    if (!node) break;
    const children = Array.from(node.children);
    for (const child of children) {
      if (child === el || child.contains(el)) continue;
      const txt = cleanText(child.innerText);
      if (txt.length > 5 && txt.length < 300 && !child.querySelector('input, select, textarea, button')) {
        return txt;
      }
    }
  }
  return null;
}

function getInputLabel(inp) {
  if (inp.id) {
    const lbl = document.querySelector(`label[for="${inp.id}"]`);
    if (lbl) return cleanText(lbl.innerText);
  }
  const parent = inp.closest('label');
  if (parent) return cleanText(parent.innerText);
  if (inp.getAttribute('aria-label')) return inp.getAttribute('aria-label');
  if (inp.value) return inp.value;
  return findNearbyLabel(inp, 3);
}

// ─── MAIN SCANNER ─────────────────────────────────────────────────────────────

function scanForms() {
  const fields = [];
  let idx = 0;

  // 1. Standard text inputs / textareas
  document.querySelectorAll('input[type="text"], input[type="email"], input[type="number"], input:not([type]), textarea').forEach(el => {
    if (!isVisible(el)) return;
    const label = getInputLabel(el) || findNearbyLabel(el) || `Text Field ${idx + 1}`;
    fields.push({ type: 'text', label, element: el, id: `f_text_${idx++}` });
  });

  // 2. Select dropdowns
  document.querySelectorAll('select').forEach(el => {
    if (!isVisible(el)) return;
    const label = getInputLabel(el) || findNearbyLabel(el) || `Dropdown ${idx}`;
    const options = Array.from(el.options).map(o => cleanText(o.text)).filter(Boolean);
    fields.push({ type: 'select', label, options, element: el, id: `f_sel_${idx++}` });
  });

  // 3. Radio groups
  const radioGroups = {};
  document.querySelectorAll('input[type="radio"]').forEach(el => {
    if (!isVisible(el)) return;
    const name = el.name || `noname_${el.id}`;
    if (!radioGroups[name]) radioGroups[name] = { elements: [], options: [], label: null };
    const optLabel = getInputLabel(el) || el.value || '';
    radioGroups[name].elements.push(el);
    radioGroups[name].options.push({ label: optLabel, element: el });
    if (!radioGroups[name].label) {
      const fs = el.closest('fieldset');
      const legend = fs && fs.querySelector('legend');
      if (legend) radioGroups[name].label = cleanText(legend.innerText);
      if (!radioGroups[name].label) radioGroups[name].label = findNearbyLabel(el, 5);
    }
  });
  Object.entries(radioGroups).forEach(([name, group]) => {
    fields.push({
      type: 'radio',
      label: group.label || `Multiple Choice ${idx + 1}`,
      options: group.options.map(o => o.label),
      elements: group.options.map(o => o.element),
      id: `f_radio_${idx++}`
    });
  });

  // 4. Checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(el => {
    if (!isVisible(el)) return;
    const label = getInputLabel(el) || findNearbyLabel(el) || `Checkbox ${idx}`;
    fields.push({ type: 'checkbox', label, element: el, id: `f_chk_${idx++}` });
  });

  // 5. ARIA controls (Google Forms etc)
  const ariaHandled = new Set();
  document.querySelectorAll('[role="radio"], [role="checkbox"]').forEach(el => {
    if (!isVisible(el) || ariaHandled.has(el)) return;
    const label = cleanText(el.getAttribute('aria-label') || el.innerText);
    const questionCtx = findNearbyLabel(el, 6);
    fields.push({ type: el.getAttribute('role'), label, questionContext: questionCtx, element: el, id: `f_aria_${idx++}`, isAriaControl: true });
    ariaHandled.add(el);
  });

  // 6. QUIZ containers — detect question+options blocks
  const quizSelectors = [
    '[class*="quiz"]', '[class*="question"]', '[class*="exercise"]',
    '[class*="problem"]', '[class*="task"]', '[class*="challenge"]',
    '[id*="quiz"]', '[id*="question"]', '[id*="exercise"]',
    'form', 'fieldset'
  ].join(',');

  const seen_quiz_labels = new Set(fields.map(f => (f.label || '').slice(0, 40)));

  document.querySelectorAll(quizSelectors).forEach(container => {
    if (!isVisible(container)) return;

    // Find question text
    const questionEl = container.querySelector(
      'h1, h2, h3, h4, p, [class*="title"], [class*="question"], [class*="prompt"], [class*="stem"], [class*="text"]'
    );
    const questionText = questionEl ? cleanText(questionEl.innerText) : cleanText(container.innerText).slice(0, 250);
    if (!questionText || questionText.length < 5) return;
    if (seen_quiz_labels.has(questionText.slice(0, 40))) return;

    // Find clickable options inside the container
    const optionEls = container.querySelectorAll(
      'li, button, [class*="option"], [class*="choice"], [class*="answer"], [class*="item"], [role="option"], [role="button"], [class*="radio"], [class*="check"]'
    );

    const options = [];
    optionEls.forEach(opt => {
      if (!isVisible(opt)) return;
      const txt = cleanText(opt.innerText);
      if (txt && txt.length > 0 && txt.length < 300 && txt !== questionText) {
        options.push({ label: txt, element: opt });
      }
    });

    if (options.length >= 2) {
      seen_quiz_labels.add(questionText.slice(0, 40));
      fields.push({
        type: 'quiz-choice',
        label: questionText,
        options: options.map(o => o.label),
        elements: options.map(o => o.element),
        id: `f_quiz_${idx++}`
      });
    }
  });

  // 7. FALLBACK: scan ALL li/button groups near question-like text
  if (fields.length === 0) {
    document.querySelectorAll('p, h3, h4, strong').forEach(qEl => {
      if (!isVisible(qEl)) return;
      const txt = cleanText(qEl.innerText);
      if (!txt || txt.length < 10 || txt.length > 400) return;
      const isQuestion = /\?/.test(txt) || /^(what|which|who|when|where|how|why|true|false|select|choose)/i.test(txt) || /^\d+[\.\)]/.test(txt);
      if (!isQuestion) return;

      const parent = qEl.parentElement;
      if (!parent) return;
      const siblingOptions = [];
      parent.querySelectorAll('li, [class*="option"], [class*="choice"], button').forEach(opt => {
        const t = cleanText(opt.innerText);
        if (t && t.length < 200 && t !== txt && isVisible(opt)) {
          siblingOptions.push({ label: t, element: opt });
        }
      });

      if (siblingOptions.length >= 2) {
        fields.push({
          type: 'quiz-choice',
          label: txt,
          options: siblingOptions.map(o => o.label),
          elements: siblingOptions.map(o => o.element),
          id: `f_fb_${idx++}`
        });
      }
    });
  }

  return fields;
}

// ─── FILL ─────────────────────────────────────────────────────────────────────

function fillAnswers(fields, answers) {
  answers.forEach(ans => {
    const field = fields.find(f => f.id === ans.id);
    if (!field) return;
    const val = (ans.value || '').toString().toLowerCase();

    if (field.type === 'text') {
      if (!field.element) return;
      field.element.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
                     Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (setter && setter.set) setter.set.call(field.element, ans.value);
      else field.element.value = ans.value;
      field.element.dispatchEvent(new Event('input', { bubbles: true }));
      field.element.dispatchEvent(new Event('change', { bubbles: true }));

    } else if (field.type === 'select') {
      const opt = Array.from(field.element.options).find(o =>
        o.text.toLowerCase().includes(val) || o.value.toLowerCase() === val
      );
      if (opt) { field.element.value = opt.value; field.element.dispatchEvent(new Event('change', { bubbles: true })); }

    } else if (field.type === 'radio') {
      const i = field.options.findIndex(o => o.toLowerCase().includes(val));
      if (i >= 0) field.elements[i].click();

    } else if (field.type === 'checkbox') {
      const shouldCheck = /true|yes|check|✓/.test(val);
      if (field.element.checked !== shouldCheck) field.element.click();

    } else if (field.type === 'quiz-choice' || field.isAriaControl) {
      if (!field.options || !field.elements) return;
      // Match by value string against option labels
      let matchIdx = field.options.findIndex(o => o.toLowerCase() === val);
      if (matchIdx < 0) matchIdx = field.options.findIndex(o => o.toLowerCase().includes(val) || val.includes(o.toLowerCase().slice(0, 15)));
      if (matchIdx >= 0 && field.elements[matchIdx]) {
        const el = field.elements[matchIdx];
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => { el.click(); }, 300);
      }
    }
  });
}

// ─── HIGHLIGHT ────────────────────────────────────────────────────────────────

function highlightFields(fields) {
  fields.forEach(f => {
    const els = f.elements ? f.elements : (f.element ? [f.element] : []);
    els.forEach(el => {
      if (!el) return;
      el.style.outline = '2.5px solid #4fffb0';
      el.style.borderRadius = '4px';
      setTimeout(() => { el.style.outline = ''; }, 4000);
    });
  });
}

// ─── PAGE CONTEXT ─────────────────────────────────────────────────────────────

function getPageContext(maxChars = 4000) {
  const seen = new Set();
  const blocks = [];
  document.querySelectorAll('p, li, h1, h2, h3, h4, label, legend, [class*="question"], [class*="option"], [class*="choice"], [class*="answer"]').forEach(el => {
    if (!isVisible(el)) return;
    const txt = cleanText(el.innerText);
    if (txt && txt.length > 3 && !seen.has(txt)) { seen.add(txt); blocks.push(txt); }
  });
  return blocks.join('\n').slice(0, maxChars);
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

let scannedFields = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'SCAN_PAGE') {
    scannedFields = scanForms();
    highlightFields(scannedFields);
    const pageContext = getPageContext();
    const serialized = scannedFields.map(f => ({
      id: f.id, type: f.type, label: f.label,
      options: f.options || null,
      questionContext: f.questionContext || null,
      isAriaControl: f.isAriaControl || false
    }));
    sendResponse({ fields: serialized, pageTitle: document.title, pageUrl: location.href, pageContext });
  }

  if (msg.action === 'FILL_FORM') {
    fillAnswers(scannedFields, msg.answers);
    sendResponse({ ok: true });
  }

  return true;
});
