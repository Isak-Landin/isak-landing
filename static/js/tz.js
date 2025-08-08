// static/js/tz.js
(function () {
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    var match = document.cookie.match(/(?:^|; )tz=([^;]*)/);
    var current = match ? decodeURIComponent(match[1]) : null;
    if (current !== tz) {
      document.cookie = "tz=" + encodeURIComponent(tz) + "; Path=/; Max-Age=31536000; SameSite=Lax";
    }
  } catch (e) {
    // ignore
  }
})();
