declare global {
  interface Window {
    localStorage: Storage;
  }
}

import "mock-local-storage";
