/* filteredData es estado derivado: debe seguir accesible, pero no duplicarse al serializar el proyecto. */
(function () {
  'use strict';
  var state = window.dashboardState;
  if (!state) return;
  try {
    var filtered = state.filteredData;
    Object.defineProperty(state, 'filteredData', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: filtered
    });
  } catch (error) {
    console.warn('No fue posible optimizar la serialización del estado:', error);
  }
})();
