// js/main.js
$(function () {
  // Helper: llama si existe (soporta sync/async)
  async function callIfExists(obj, method) {
    try {
      const fn = obj && typeof obj[method] === 'function' ? obj[method] : null;
      if (!fn) return;
      const r = fn.call(obj);
      if (r && typeof r.then === 'function') await r; // si devuelve promesa, espera
    } catch (e) {
      console.error(`[init] ${method}() falló:`, e);
    }
  }

  // Mostrar una pestaña (oculta el resto)
  function showTab(tab) {
    $('main > section').addClass('hidden');
    $(`#view-${tab}`).removeClass('hidden');
  }

  // Sidebar: navegación entre vistas
  $(document).off('click', '.nav-item').on('click', '.nav-item', async function () {
    $('.nav-item').removeClass('active');
    $(this).addClass('active');

    const tab = $(this).data('tab');
    showTab(tab);

    // Inicializaciones por pestaña (solo si existen)
    if (tab === 'dashboard') await callIfExists(window.uiDashboard, 'render');
    if (tab === 'registro')  await callIfExists(window.uiRegistro, 'init') || await callIfExists(window.uiRegistro, 'renderSprints');
    if (tab === 'admin')     await callIfExists(window.uiAdmin, 'init')   || await callIfExists(window.uiAdmin, 'cargar');
    if (tab === 'cargas')    await callIfExists(window.uiCargas, 'init');
    if (tab === 'historias') await callIfExists(window.uiHistorias, 'init') || await callIfExists(window.uiHistorias, 'cargar');
    if (tab === 'prioridades') await callIfExists(window.uiPrioridades, 'init');
    if (tab === 'matriz')    await callIfExists(window.uiMatriz, 'init');
  });

  // ---------- Boot inicial ----------
  // Asegúrate que api esté disponible (por si el alias llega tarde)
  if (!(window.api)) {
    try { window.api = window.api || {}; } catch (_) {}
  }

  // Marca activa la primera pestaña (dashboard) y renderiza
  const $first = $('.nav-item[data-tab="dashboard"]');
  if ($first.length) {
    $first.trigger('click');
  } else {
    // fallback si no hay sidebar: intenta renderizar dashboard directo
    callIfExists(window.uiDashboard, 'render');
  }
});
