export class Store {
  constructor(initial = {}) {
    this.state = Object.assign({
      raw: [],
      xAxis: null,
      valueKey: null,
      chartType: 'bar',
      showCards: true
    }, initial);
    this.subscribers = new Set();
  }
  setState(patch) {
    Object.assign(this.state, patch);
    // notify subscribers with a shallow copy for safety
    const snapshot = Object.assign({}, this.state);
    this.subscribers.forEach(fn => {
      try { fn(snapshot); } catch (e) { console.error('Subscriber error', e); }
    });
  }
  getState() {
    return this.state;
  }
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
}
