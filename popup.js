// Handle blocking toggle
document.getElementById('enableToggle').addEventListener('change', async (e) => {
  const isEnabled = e.target.checked;
  await chrome.storage.sync.set({ 'noPosthogEnabled': isEnabled });
  document.getElementById('status').textContent = isEnabled ? 'Blocking ON' : 'Blocking OFF';
  updatePageStorage();
});

// Handle logging toggle
document.getElementById('loggingToggle').addEventListener('change', async (e) => {
  const isEnabled = e.target.checked;
  await chrome.storage.sync.set({ 'noPosthogLogging': isEnabled });
  document.getElementById('loggingStatus').textContent = isEnabled ? 'Logging ON' : 'Logging OFF';
  updatePageStorage();
});

// Update localStorage on current page
async function updatePageStorage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith('chrome://')) return;
    
    const settings = await chrome.storage.sync.get(['noPosthogEnabled', 'noPosthogLogging']);
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (enabled, logging) => {
        localStorage.setItem('noPosthogEnabled', enabled);
        localStorage.setItem('noPosthogLogging', logging);
      },
      args: [String(settings.noPosthogEnabled !== false), String(settings.noPosthogLogging !== false)]
    });
  } catch (e) {
    // Silently fail - settings will apply on next page load
  }
}

// Load stored settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(['noPosthogEnabled', 'noPosthogLogging']);
  
  const blockingEnabled = settings.noPosthogEnabled !== false;
  const loggingEnabled = settings.noPosthogLogging !== false;
  
  document.getElementById('enableToggle').checked = blockingEnabled;
  document.getElementById('status').textContent = blockingEnabled ? 'Blocking ON' : 'Blocking OFF';
  
  document.getElementById('loggingToggle').checked = loggingEnabled;
  document.getElementById('loggingStatus').textContent = loggingEnabled ? 'Logging ON' : 'Logging OFF';
});
