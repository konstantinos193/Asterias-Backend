(function () {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var statusDot = document.getElementById('status-dot');
  var statusValue = document.getElementById('status-value');
  var versionValue = document.getElementById('version-value');
  var envValue = document.getElementById('env-value');
  var uptimeValue = document.getElementById('uptime-value');

  function formatUptime(seconds) {
    var s = Math.floor(seconds);
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 'h uptime';
    if (h > 0) return h + 'h ' + m + 'm uptime';
    return m + 'm uptime';
  }

  fetch('/health')
    .then(function (r) { return r.json(); })
    .then(function (payload) {
      var d = payload.data || payload;
      var ok = d.status === 'OK';

      statusValue.textContent = ok ? 'Operational' : (d.status || 'Degraded');
      versionValue.textContent = d.version || '—';
      envValue.textContent = d.environment || '—';

      if (d.uptime != null) {
        uptimeValue.textContent = formatUptime(d.uptime);
      }

      if (!ok) {
        statusDot.classList.add('error');
      }

      // Swagger is mounted only outside production, so the markup ships without
      // a link to it — a hardcoded /api/docs href would be a dead 404 in prod
      // (and Googlebot crawls hrefs whether or not JS later hides them).
      // Where the route does exist, make the card clickable again.
      if (d.environment && d.environment !== 'production') {
        var docsCard = document.getElementById('docs-card');
        var docsDesc = document.getElementById('docs-desc');
        if (docsCard) {
          docsCard.classList.remove('card-static');
          docsCard.style.cursor = 'pointer';
          docsCard.addEventListener('click', function () {
            window.location.href = '/api/docs';
          });
        }
        if (docsDesc) {
          docsDesc.textContent =
            'Interactive API documentation with full request and response schemas.';
        }
      }
    })
    .catch(function () {
      statusValue.textContent = 'Unreachable';
      statusDot.classList.add('error');
    });
})();
