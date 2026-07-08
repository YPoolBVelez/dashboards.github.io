import { Store } from './store/State.js';
import { DataService } from './services/DataService.js';
import { ChartService } from './services/ChartService.js';
import { UIController } from './controllers/UIController.js';

console.info('[main] module loaded');
try {
	// expose partial app early so diagnostics can read it
	window.__APP__ = window.__APP__ || {};
	const store = new Store();
	const dataService = new DataService(store);
	const chartService = new ChartService('mainChart');
	const ui = new UIController(store, dataService, chartService);
	// finalize debug exposure
	window.__APP__.store = store;
	window.__APP__.dataService = dataService;
	window.__APP__.chartService = chartService;
	window.__APP__.ui = ui;
	window.__APP__.initialized = true;
	console.info('[main] app initialized', { initialized: window.__APP__.initialized });
} catch (err) {
	console.error('[main] initialization error', err);
	window.__APP__ = window.__APP__ || {};
	window.__APP__.initError = err && err.message ? err.message : String(err);
}
