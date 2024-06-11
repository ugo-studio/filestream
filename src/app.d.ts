import type { FileServer } from "$lib/connection";

declare global {
  interface Window {
    _fileserver: FileServer;
  }
}
