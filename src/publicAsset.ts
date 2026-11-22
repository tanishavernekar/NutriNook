declare global {
  interface Window {
    cozyKitchenFiles?: Record<string, string>;
  }
}

// Browsers cannot fetch sibling JSON or theme images from a file:// page.
export const publicAsset = (path: string) =>
  window.cozyKitchenFiles?.[path] ?? new URL(path, document.baseURI).href;
