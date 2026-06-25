export function createResponsiveStore() {
  return {
    subscribe(callback: () => void): () => void {
      if (typeof window === 'undefined') {
        return () => {};
      }
      window.addEventListener('resize', callback);
      return () => window.removeEventListener('resize', callback);
    },
    getSnapshot(): number | null {
      return typeof window === 'undefined' ? null : window.innerWidth;
    },
    getServerSnapshot(): number | null {
      return null;
    },
  };
}
