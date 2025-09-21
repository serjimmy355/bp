// cookie-banner.js (v3) — essential-only banner, mobile-tuned, debug helpers
// Place in /public and include with: <script src="/cookie-banner.js?v=3"></script>
(function () {
  var CONSENT_KEY = "cookieConsent_v2"; // bump key so you can test fresh

  function acknowledged() {
    try { localStorage.setItem(CONSENT_KEY, "essential-only"); } catch (e) {}
    var banner = document.getElementById("cookie-banner");
    if (banner) banner.remove();
    document.body && document.body.focus && document.body.focus();
  }

  function injectBanner() {
    // Already acknowledged?
    try {
      if (localStorage.getItem(CONSENT_KEY)) return;
    } catch (_) {} // private mode etc.

    var banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Cookie notice");
    banner.style.cssText = [
      "position:fixed",
      "left:0", "right:0", "bottom:0",
      "background:#161e2e",
      "color:#eaf1fb",
      "padding:16px",
      "padding-bottom:calc(16px + env(safe-area-inset-bottom))",
      "border-top:1px solid #232a3a",
      "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif",
      "z-index:2147483000", // very high so it sits above other fixed UI
      "text-align:center",
      "box-sizing:border-box"
    ].join(";");

    var inner = document.createElement("div");
    inner.style.cssText = "max-width:900px; margin:0 auto; padding:0 12px;";

    // Text
    var p = document.createElement("p");
    p.style.cssText = "margin:0 0 10px 0; font-size:16px; line-height:1.5;";
    p.innerHTML = 'We only use <strong>essential cookies</strong> to make our site work (login, security, preferences). '+
                  'No analytics or marketing cookies are used. '+
                  'See our <a href="/cookies.html" style="color:#3b82f6; text-decoration:underline;">Cookies Policy</a>.';

    // Button
    var btn = document.createElement("button");
    btn.id = "cookie-ack";
    btn.setAttribute("tabindex", "0");
    // Reset inherited styles and reapply
    btn.style.cssText = [
      "all:unset",
      "background:#3b82f6",
      "color:#ffffff",
      "padding:12px 20px",
      "border-radius:12px",
      "cursor:pointer",
      "font-size:16px",
      "font-weight:700",
      "text-align:center",
      "display:inline-block",
      "width:220px",
      "max-width:100%",
      "margin:8px auto 0",
      "box-sizing:border-box",
      "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif",
      "outline:2px solid transparent",
      "outline-offset:2px"
    ].join(";");
    btn.textContent = "OK, understood";

    // Mobile tweaks
    if (window.matchMedia && window.matchMedia("(max-width: 420px)").matches) {
      p.style.fontSize = "15px";
      p.style.lineHeight = "1.45";
      btn.style.width = "200px";
      btn.style.padding = "10px 16px";
      btn.style.fontSize = "15px";
      banner.style.padding = "14px";
      banner.style.paddingBottom = "calc(14px + env(safe-area-inset-bottom))";
    }

    // Compose
    inner.appendChild(p);
    inner.appendChild(btn);
    banner.appendChild(inner);
    document.body.appendChild(banner);

    // Events
    btn.addEventListener("click", acknowledged);
    banner.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === "Escape") acknowledged();
    });
  }

  // Debug helpers so you can test easily
  window.__cookieBannerReset = function () {
    try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}
    var existing = document.getElementById("cookie-banner");
    if (existing) existing.remove();
    injectBanner();
  };
  window.__cookieBannerStatus = function () {
    try { return localStorage.getItem(CONSENT_KEY) || null; } catch (e) { return null; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectBanner);
  } else {
    injectBanner();
  }
})();