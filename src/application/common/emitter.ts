/** Minimal typed event emitter for one-shot application events. */
export class Emitter<E> {
  private listeners = new Set<(e: E) => void>();

  on(fn: (e: E) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e: E) {
    for (const l of this.listeners) l(e);
  }
}

/** State container compatible with React's `useSyncExternalStore`. */
export class Observable {
  private version = 0;
  private subscribers = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  };

  getVersion = () => this.version;

  protected changed() {
    this.version++;
    for (const s of this.subscribers) s();
  }
}
