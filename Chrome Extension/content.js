(function () {
  const TEXT_KEY = 'capturedAllText_v1';

  const TOXIC_KEYWORDS = [
    'kill', 'die', 'stupid', 'idiot', 'hate', 'bitch', 'asshole',
    "you're an idiot", 'trash', 'worthless', 'faggot', 'nigger'
  ];

  function normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Collapse multiple spaces
      .trim();
  }

  function isTextToxic(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    return TOXIC_KEYWORDS.some(kw => {
      const re = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      return re.test(t);
    });
  }

  function isNodeVisible(node) {
    if (!(node instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(node);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) < 0.1
    ) return false;

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;

    return true;
  }

  function isProbablyUIElement(node) {
    const uiTags = ['BUTTON', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'LABEL', 'INPUT', 'SVG'];
    if (uiTags.includes(node.tagName)) return true;

    const className = node.className?.toString() || '';
    if (/nav|menu|footer|header|sidebar|button|icon/i.test(className)) return true;

    return false;
  }

  function getAllVisibleTextNodes(root = document.body) {
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      const text = node.nodeValue.trim();

      if (
        text.length >= 20 &&                   // Filter out very short text
        parent &&
        isNodeVisible(parent) &&
        !isProbablyUIElement(parent)
      ) {
        textNodes.push({ text, node: parent });
      }
    }
    return textNodes;
  }

  function storeTexts(newTextObjs) {
    if (!newTextObjs?.length) return;

    chrome.storage.local.get([TEXT_KEY], (res) => {
      const existing = Array.isArray(res[TEXT_KEY]) ? res[TEXT_KEY] : [];
      const map = new Map();

      for (const e of existing) {
        const key = normalizeText(typeof e === 'string' ? e : e.text);
        map.set(key, typeof e === 'string' ? { text: e, toxic: isTextToxic(e) } : e);
      }

      let added = false;
      for (const { text } of newTextObjs) {
        const original = text.trim();
        const key = normalizeText(original);
        if (!key || map.has(key)) continue;

        map.set(key, { text: original, toxic: isTextToxic(original) });
        added = true;
      }

      if (added) {
        chrome.storage.local.set({ [TEXT_KEY]: Array.from(map.values()) });
      }
    });
  }

  function highlightIfToxic(node, text) {
    if (isTextToxic(text)) {
      node.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      node.style.color = '#800';
      node.setAttribute('data-toxic-highlight', 'true');
    }
  }

  function scanAndStore() {
    const textNodes = getAllVisibleTextNodes();
    storeTexts(textNodes);
    textNodes.forEach(({ node, text }) => highlightIfToxic(node, text));
  }

  window.addEventListener('load', () => {
    setTimeout(() => scanAndStore(), 800);
  });

  setTimeout(() => scanAndStore(), 400);

  // Optional: observe changes (e.g. infinite scroll, AJAX-loaded content)
  const mutationObserver = new MutationObserver(() => {
    scanAndStore();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

})();
