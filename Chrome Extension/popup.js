const TEXT_KEY = 'capturedSocialText_v1';

function renderList(items) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  if (!items || items.length === 0) {
    list.textContent = '(no captured texts yet)';
    return;
  }
  items.forEach((it) => {
    // items may be string (old) or object { text, toxic }
    const text = typeof it === 'string' ? it : it.text || '';
    const toxic = typeof it === 'object' && it.toxic === true;
    const d = document.createElement('div');
    d.className = 'item';
    d.textContent = text;
    if (toxic) {
      d.style.backgroundColor = 'rgba(255,0,0,0.08)';
      d.style.color = '#800';
      // add a small badge
      const badge = document.createElement('span');
      badge.textContent = ' TOXIC';
      badge.style.fontWeight = '600';
      badge.style.marginLeft = '8px';
      badge.style.color = '#900';
      d.appendChild(badge);
    }
    list.appendChild(d);
  });
}

function refresh() {
  chrome.storage.local.get([TEXT_KEY], (res) => {
    const items = Array.isArray(res[TEXT_KEY]) ? res[TEXT_KEY] : [];
    renderList(items);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh').addEventListener('click', refresh);
  document.getElementById('clear').addEventListener('click', () => {
    chrome.storage.local.remove([TEXT_KEY], () => refresh());
  });
  refresh();
});
