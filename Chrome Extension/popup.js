const TEXT_KEY = 'capturedSocialText_v1';

function renderList(items) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  if (!items || items.length === 0) {
    list.textContent = '(no captured texts yet)';
    return;
  }
  items.forEach((t) => {
    const d = document.createElement('div');
    d.className = 'item';
    d.textContent = t;
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
