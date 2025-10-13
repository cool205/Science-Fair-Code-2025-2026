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

  // Toxic keywords list
  const TOXIC_KEYWORDS = [
    'kill', 'die', 'stupid', 'idiot', 'hate', 'bitch', 'asshole', "you're an idiot",
    'trash', 'worthless', 'faggot', 'nigger'
  ];

  // Check if text contains toxic keywords with word boundaries
  function isTextToxic(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    for (const kw of TOXIC_KEYWORDS) {
      // Escape keyword for regex and use word boundaries for exact word match
      const re = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (re.test(t)) return true;
    }
    return false;
  }

  // Safely get text from a DOM node
  function getTextFromNode(node) {
    try {
      return node.innerText || node.textContent || '';
    } catch (e) {
      return '';
    }
  }

  // Store new texts in chrome storage, avoiding duplicates
  function storeTexts(newTexts) {
    if (!newTexts || newTexts.length === 0) return;
    chrome.storage.local.get([TEXT_KEY], (res) => {
      const existing = Array.isArray(res[TEXT_KEY]) ? res[TEXT_KEY] : [];
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

  // Highlight node if text is toxic
  function highlightIfToxic(node, text) {
    try {
      if (isTextToxic(text)) {
        node.style.transition = 'background-color 0.2s ease, color 0.2s ease';
        node.style.backgroundColor = 'rgba(255,0,0,0.12)';
        node.style.color = '#800';
        node.setAttribute('data-toxic-highlight', 'true');
      }
    } catch (e) {
      // Ignore styling errors
    }
  }

  // IntersectionObserver callback: process elements when they come into view
  function onIntersect(entries, observer) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const node = entry.target;
        const text = getTextFromNode(node);
        if (text) {
          storeTexts([text]);
          highlightIfToxic(node, text);
          // Stop observing to save resources
          observer.unobserve(node);
        }
      }
    }
  }

  // Create IntersectionObserver with threshold 0.1 (10%)
  const observer = new IntersectionObserver(onIntersect, {
    root: null, // viewport
    rootMargin: '0px',
    threshold: 0.1
  });

  // Find elements matching selectors and start observing them
  function observeMatchingElements(root = document) {
    for (const sel of SELECTORS) {
      try {
        const nodes = root.querySelectorAll(sel);
        nodes.forEach((n) => {
          observer.observe(n);
        });
      } catch (e) {
        // Invalid selector on some pages, ignore
      }
    }
  }

  // Initial scan on page load
  window.addEventListener('load', () => {
    setTimeout(() => observeMatchingElements(document), 800);
  });

  // Also run shortly after script injection for SPA or fast-loading pages
  setTimeout(() => observeMatchingElements(document), 400);

  // MutationObserver to detect new elements added dynamically and observe them
  const mutationObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Observe new matching elements inside added node subtree
            observeMatchingElements(node);
          }
        });
      }
    }
  });

  try {
    mutationObserver.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  } catch (e) {
    // Some pages may restrict script access
  }
})();
