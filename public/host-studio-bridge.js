/* Transport only: the original WordPress studio owns its markup and controls. */
(function () {
  "use strict";
  var config = window.TRIPANZA_STUDIO;
  if (!config) return;
  // srcdoc inherits its parent's security origin, while location.origin itself
  // is "null" for about:srcdoc. Resolve app URLs against the parent origin.
  var origin = window.parent.location.origin;
  var nativeFetch = window.fetch.bind(window);
  var saving = false;
  var submitLabels = new WeakMap();

  function send(type, value) {
    window.parent.postMessage(Object.assign({ source: "tripanza-original-studio", type: type }, value || {}), origin);
  }

  function routePath(value) {
    try {
      var url = new URL(value, origin);
      if (url.origin !== origin) return null;
      if (url.pathname === "/" || /^\/(?:add-your-own-trip|poster-download|tours|host)(?:\/|$)/.test(url.pathname)) return url.pathname.replace(/\/$/, "") + url.search + url.hash || "/";
    } catch { /* Invalid link. */ }
    return null;
  }

  function errorMessage(value) {
    return typeof value === "string" ? value : "Unable to complete the request. Please try again.";
  }

  // Only the two original PDF/cache actions are routed through this endpoint.
  // The nonce stays bound to the current WordPress user; the bearer token never
  // enters the browser document.
  window.fetch = function (input, options) {
    var url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (url.indexOf("/api/host/studio/tools") !== -1) {
      options = Object.assign({}, options);
      var params = new URLSearchParams(String(options.body || ""));
      params.set("studio_nonce", window.TRIPANZA_STUDIO_NONCE || "");
      options.body = params.toString();
    }
    return nativeFetch(input, options);
  };

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href").charAt(0) === "#") return;
    var path = routePath(link.href);
    if (!path) return;
    event.preventDefault();
    send("navigate", { path: path });
  });

  // Snapshot before the original controller changes its submit label to
  // "Saving your trip...", so an interrupted save restores the real label.
  document.addEventListener("submit", function (event) {
    if (event.target instanceof HTMLFormElement) {
      submitLabels.set(event.target, Array.from(event.target.querySelectorAll('button[type="submit"],input[type="submit"]')).map(function (button) { return button.innerHTML; }));
    }
  }, true);

  document.addEventListener("submit", async function (event) {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
    var form = event.target;
    event.preventDefault();
    if (saving) return;
    if (!form.reportValidity()) return;
    var formData = new FormData(form);
    if (event.submitter && event.submitter.name) formData.set(event.submitter.name, event.submitter.value);
    var action = form.getAttribute("action");
    var search = action ? new URL(action, origin).search : new URL(config.endpoint, origin).search;
    var endpoint = new URL(config.endpoint, origin);
    endpoint.search = search;
    var buttons = Array.from(form.querySelectorAll('button[type="submit"],input[type="submit"]'));
    var labels = submitLabels.get(form) || buttons.map(function (button) { return button.innerHTML; });
    saving = true;
    document.body.setAttribute("aria-busy", "true");
    buttons.forEach(function (button) { button.disabled = true; });
    send("busy", { busy: true });
    try {
      var response = await nativeFetch(endpoint.pathname + endpoint.search, { method: "POST", body: formData, credentials: "same-origin" });
      if ((response.headers.get("content-type") || "").indexOf("application/json") !== -1) {
        var data = await response.json();
        if (data.redirect && routePath(data.redirect)) {
          send("navigate", { path: routePath(data.redirect), replace: true });
          return;
        }
        throw new Error(errorMessage(data.data || data.error));
      }
      if (!response.ok) throw new Error("Unable to save. Please try again.");
      var html = await response.text();
      send("document", { html: html });
    } catch (error) {
      var existing = document.getElementById("tripanza-studio-save-error");
      if (!existing) {
        existing = document.createElement("div");
        existing.id = "tripanza-studio-save-error";
        existing.className = "ftc-alert ftc-error tz-share-alert";
        existing.setAttribute("role", "alert");
        form.prepend(existing);
      }
      existing.textContent = error instanceof Error ? error.message : "Unable to save. Please try again.";
      existing.scrollIntoView({ behavior: "smooth", block: "center" });
      buttons.forEach(function (button, index) { button.disabled = false; button.innerHTML = labels[index]; });
    } finally {
      saving = false;
      document.body.removeAttribute("aria-busy");
      send("busy", { busy: false });
    }
  });

  document.addEventListener("DOMContentLoaded", function () { send("ready"); });
})();
