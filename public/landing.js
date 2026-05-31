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
    })
    .catch(function () {
      statusValue.textContent = 'Unreachable';
      statusDot.classList.add('error');
    });
})();
