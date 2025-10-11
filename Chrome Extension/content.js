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
      const set = new Set(existing);
      let added = false;
      for (const t of newTexts) {
        const s = t.trim();
        if (s && !set.has(s)) {
          set.add(s);
          added = true;
        }
      }
      if (added) {
        const arr = Array.from(set);
        chrome.storage.local.set({ [TEXT_KEY]: arr });
      }
    });
  }

  function scanAndStore(root = document) {
    const found = [];
    for (const sel of SELECTORS) {
      try {
        const nodes = root.querySelectorAll(sel);
        nodes.forEach((n) => {
          const t = getTextFromNode(n);
          if (t) found.push(t);
        });
      } catch (e) {
        // invalid selector on some pages; ignore
      }
    }
    if (found.length) storeTexts(found);
  }

  // Observe the document for added nodes/text changes
  const observer = new MutationObserver((mutations) => {
    const roots = new Set();
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) roots.add(n);
        });
      }
      // attribute or characterData changes might affect text nodes
      if (m.target && m.target.nodeType === Node.ELEMENT_NODE) roots.add(m.target);
    }
    // always include document in case of large changes
    roots.add(document);
    for (const r of roots) scanAndStore(r);
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
  window.addEventListener('load', () => setTimeout(() => scanAndStore(document), 800));
  // also run immediately
  setTimeout(() => scanAndStore(document), 400);
})();
