// In-memory API key store, shared across tabs.
//
// A module-level variable — NOT localStorage/sessionStorage — on purpose:
// - It survives tab switches (the tab components remount, but this module does
//   not re-evaluate), so a typed key isn't lost when you move between tabs.
// - It is wiped by a page refresh or closing the tab, because the module is
//   re-evaluated from scratch on the next load. The key never touches disk.

let apiKey = "";

export function getApiKey(): string {
  return apiKey;
}

export function setApiKey(key: string): void {
  apiKey = key;
}
