export class Cubit<S> {
  private _state: S;
  private stateListeners = new Set<(s: S) => void>();

  constructor(initialState: S) { this._state = initialState; }
  get state() { return this._state; }

  protected emitState(next: S) {
    this._state = next;
    this.stateListeners.forEach(l => l(next));
  }

  on(event: 'state', listener: (s: S) => void): { remove: () => void } {
    this.stateListeners.add(listener);
    return {
      remove: () => this.stateListeners.delete(listener)
    };
  }

  off(event: 'state', listener: (s: S) => void) {
    this.stateListeners.delete(listener);
  }

  removeAllListeners() { this.stateListeners.clear(); }
  close() { this.removeAllListeners(); }
}