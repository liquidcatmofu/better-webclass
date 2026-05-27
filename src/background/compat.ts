// Firefox does not support chrome.storage.session — fall back to local storage.
export const compatSession: typeof chrome.storage.local =
  (chrome.storage as unknown as { session?: typeof chrome.storage.local }).session
  ?? chrome.storage.local;
