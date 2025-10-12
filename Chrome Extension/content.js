// Content script: observe DOM mutations and capture text from known social selectors.
(function () {
  const SELECTORS = [
    // Twitter
    'article div[data-testid="tweetText"]',
    'div[data-testid="reply"]',
    // Facebook
    'div[data-ad-preview="message"]',
    'div[data-testid="UFI2Comment/body"]',
    // Reddit
    'div[data-testid="post-container"]',
    'div[data-testid="comment"]',
    // YouTube (comment text)
    'ytd-comment-renderer #content-text',
    // Instagram
    'div.C4VMK > span',
    'ul.Mr508 li span'
  ];

  const TEXT_KEY = 'capturedSocialText_v1';

  // Lightweight in-browser toxicity detector (keyword-based fallback)
  // Note: the project's toxicClassifier.pt (PyTorch) cannot run in the browser.
  // This simple heuristic is used until the model is hosted or converted.
  const TOXIC_KEYWORDS = [
    'kill', 'die', 'stupid', 'idiot', 'hate', 'bitch', 'asshole', "you're an idiot",
    'trash', 'worthless', 'faggot', 'nigger'
  ];

  function isTextToxic(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    // word-based check to avoid partial matches
    for (const kw of TOXIC_KEYWORDS) {
      // simple contains; could be improved with word boundaries
      if (t.indexOf(kw) !== -1) return true;
    }
    return false;
  }

  function getTextFromNode(node) {
    try {
      return node.innerText || node.textContent || '';
    } catch (e) {
      return '';
    }
  }

  function storeTexts(newTexts) {
    if (!newTexts || newTexts.length === 0) return;
    chrome.storage.local.get([TEXT_KEY], (res) => {
      const existing = Array.isArray(res[TEXT_KEY]) ? res[TEXT_KEY] : [];
      // store objects { text, toxic }
      const map = new Map();
      for (const e of existing) {
        if (typeof e === 'string') map.set(e, { text: e, toxic: isTextToxic(e) });
        else if (e && e.text) map.set(e.text, e);
      }
      let added = false;
      for (const t of newTexts) {
        const s = t.trim();
        if (!s) continue;
        if (!map.has(s)) {
          map.set(s, { text: s, toxic: isTextToxic(s) });
          added = true;
        }
      }
      if (added) {
        const arr = Array.from(map.values());
        chrome.storage.local.set({ [TEXT_KEY]: arr });
      }
    });
  }

  // Debounce and batching for mutation observer to avoid repeated heavy scans
  const _pendingRoots = new Set();
  let _scanTimer = null;

  function scheduleScan(root) {
    if (root) _pendingRoots.add(root === document ? document.body : root);
    if (_scanTimer) clearTimeout(_scanTimer);
    _scanTimer = setTimeout(() => {
      const roots = Array.from(_pendingRoots);
      _pendingRoots.clear();
      for (const r of roots) {
        try {
          scanAndStore(r);
        } catch (e) {
          // continue with other roots
        }
      }
    }, 300); // batch mutations for 300ms
  }

  function scanAndStore(root = document.body) {
    const found = [];
    for (const sel of SELECTORS) {
      try {
        const nodes = root.querySelectorAll(sel);
        nodes.forEach((n) => {
          const t = getTextFromNode(n);
          if (t) {
            found.push(t);
            // highlight in-place if toxic
            try {
              if (isTextToxic(t)) {
                // add a red background / border to make it visible
                n.style.transition = 'background-color 0.2s ease, color 0.2s ease';
                n.style.backgroundColor = 'rgba(255,0,0,0.12)';
                n.style.color = '#800';
                // add a data attribute to mark it
                n.setAttribute('data-toxic-highlight', 'true');
              }
            } catch (e) {
              // ignore styling errors
            }
          }
        });
      } catch (e) {
        // invalid selector on some pages; ignore
      }
    }
    // If selectors didn't find much, use a bounded element-based fallback
    // This is much cheaper than walking every text node and prevents freezing on large pages.
    const MIN_LEN = 25; // minimum characters to consider
    const MAX_LEN = 1500; // maximum characters to capture from a single element
    const MAX_ELEMENTS = 300; // cap number of elements to inspect

    if (found.length < 3) {
      try {
        const containerSelectors = 'p, div, span, article, li, blockquote, h1, h2, h3, h4';
        const elems = root.querySelectorAll(containerSelectors);
        let inspected = 0;
        for (let i = 0; i < elems.length && inspected < MAX_ELEMENTS; i++) {
          const el = elems[i];
          if (!el || !el.textContent) continue;
          // skip elements that are clearly non-visible
          try {
            if (el.closest && el.closest('script, style, head, noscript, template')) continue;
          } catch (e) {
            // ignore
          }
          const rects = el.getClientRects();
          if (!rects || rects.length === 0) continue; // not visible
          const txt = el.innerText ? el.innerText.trim() : el.textContent.trim();
          if (!txt) continue;
          if (txt.length < MIN_LEN || txt.length > MAX_LEN) continue;
          found.push(txt);
          inspected++;
          // attempt to highlight if toxic
          try {
            if (isTextToxic(txt)) {
              el.style.transition = 'background-color 0.2s ease, color 0.2s ease';
              el.style.backgroundColor = 'rgba(255,0,0,0.12)';
              el.style.color = '#800';
              el.setAttribute('data-toxic-highlight', 'true');
            }
          } catch (e) {
            // ignore styling errors
          }
        }
      } catch (e) {
        // ignore fallback scan errors
      }
    }

    if (found.length) storeTexts(found);
  }

  // Observe the document for added nodes/text changes
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) scheduleScan(n);
        });
      }
      // attribute or characterData changes might affect text nodes
      if (m.target && m.target.nodeType === Node.ELEMENT_NODE) scheduleScan(m.target);
    }
    // always include document body in case of large changes
    scheduleScan(document.body);
  });

  try {
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  } catch (e) {
    // some pages may restrict script access
  }

  // Initial scan after a short delay to allow some dynamic content to render
  window.addEventListener('load', () => setTimeout(() => scheduleScan(document), 800));
  // also run immediately
  setTimeout(() => scheduleScan(document), 400);
})();
