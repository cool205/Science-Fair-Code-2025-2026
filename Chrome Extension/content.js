(function () {
  const TEXT_KEY = 'capturedText_v2';
  const PERSPECTIVE_API_KEY = 'YOUR_API_KEY_HERE'; // Replace this with your key

  // Debounce settings for DOM changes
  let mutationTimeout = null;
  const DEBOUNCE_TIME = 1000;

  function normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Collapse multiple spaces
      .trim();
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
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight
    );
  }

  function isProbablyUIElement(node) {
    const uiTags = ['BUTTON', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'LABEL', 'INPUT', 'SVG'];
    if (uiTags.includes(node.tagName)) return true;
    const className = node.className?.toString() || '';
    return /nav|menu|footer|header|sidebar|button|icon/i.test(className);
  }

  function getAllVisibleTextNodes(root = document.body) {
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      const text = node.nodeValue.trim();

      if (
        text.length >= 20 &&
        parent &&
        isNodeVisible(parent) &&
        !isProbablyUIElement(parent)
      ) {
        textNodes.push({ text, node: parent });
      }
    }

    return textNodes;
  }

  async function checkToxicity(text) {
    try {
      const response = await fetch(`https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${PERSPECTIVE_API_KEY}`, {
        method: 'POST',
        body: JSON.stringify({
          comment: { text },
          languages: ['en'],
          requestedAttributes: { TOXICITY: {} },
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      const score = result.attributeScores?.TOXICITY?.summaryScore?.value || 0;
      return score >= 0.8; // Adjust threshold as needed
    } catch (error) {
      console.warn('Toxicity check failed:', error);
      return false;
    }
  }

  function highlightToxic(node) {
    node.style.backgroundColor = 'rgba(255, 0, 0, 0.07)';
    node.style.color = '#900';
    node.setAttribute('data-toxic-highlight', 'true');
  }

  function storeTexts(textObjs) {
    if (!textObjs?.length) return;

    chrome.storage.local.get([TEXT_KEY], (res) => {
      const existing = Array.isArray(res[TEXT_KEY]) ? res[TEXT_KEY] : [];
      const map = new Map();

      for (const e of existing) {
        const key = normalizeText(e.text);
        map.set(key, e);
      }

      let added = false;
      for (const { text, toxic } of textObjs) {
        const key = normalizeText(text);
        if (!key || map.has(key)) continue;

        map.set(key, { text, toxic });
        added = true;
      }

      if (added) {
        chrome.storage.local.set({ [TEXT_KEY]: Array.from(map.values()) });
      }
    });
  }

  async function scanAndStore() {
    const nodes = getAllVisibleTextNodes();
    const processed = [];

    for (const { text, node } of nodes) {
      const key = normalizeText(text);
      if (!key) continue;

      const toxic = await checkToxicity(text);
      processed.push({ text, toxic });

      if (toxic) highlightToxic(node);
    }

    storeTexts(processed);
  }

  function debounceScan() {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      scanAndStore();
    }, DEBOUNCE_TIME);
  }

  // Initial scan
  window.addEventListener('load', () => {
    setTimeout(() => scanAndStore(), 1000);
  });

  // Mutation observer for dynamic content
  const observer = new MutationObserver(debounceScan);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

})();
