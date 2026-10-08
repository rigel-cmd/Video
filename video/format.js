/* Format de sortie : paysage 1920×1080 (par défaut) ou vertical 1080×1920 pour les réseaux sociaux
   (?format=vertical). Même scénario et même chronologie ; seule la mise en page change (classe .v). */
(function () {
  const vertical = new URLSearchParams(location.search).get('format') === 'vertical';
  window.FMT = vertical
    ? { name: 'vertical', W: 1080, H: 1920, vertical: true }
    : { name: 'paysage', W: 1920, H: 1080, vertical: false };
  document.documentElement.classList.toggle('v', vertical);
})();
