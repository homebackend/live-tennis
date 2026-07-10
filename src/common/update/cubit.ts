import { EventEmitter } from "events";

export class Cubit<S> extends EventEmitter {
  private _state: S;
  constructor(initialState: S) {
    super();
    this._state = initialState;
  }
  get state() {
    return this._state;
  }
  emitState(next: S) {
    this._state = next;
    this.emit("state", next);
  }
  close() {
    this.removeAllListeners();
  }
}
