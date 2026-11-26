/* Refresh expiring Toffee signed stream URLs before each native/HLS retry.
 * This does not bypass DRM or authentication; it only reloads the public M3U
 * source already configured in the app and uses the current URL it publishes.
 */
(function () {
  "use strict";
  var playlistUrl = "https://raw.githubusercontent.com/srhady/toffee-bd/refs/heads/main/toffee_playlist.m3u";
  var video = document.getElementById("player");
  var refreshing = false;
  var lastRefresh = 0;

  function isToffee(url) {
    return /toffeelive\.com/i.test(String(url || ""));
  }
  function clean(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^\s+|\s+$/g, "");
  }
  function currentTitle() {
    var el = document.getElementById("current-title");
    return el ? el.textContent || "" : "";
  }
  function findStream(m3u, title) {
    var lines = m3u.replace(/^\uFEFF/, "").split(/\r?\n/);
    var wanted = clean(title), entries = [], meta = "";
    var i, line, comma, name, match, url;
    for (i = 0; i < lines.length; i++) {
      line = lines[i].replace(/^\s+|\s+$/g, "");
      if (!line) continue;
      if (line.indexOf("#EXTINF") === 0) {
        comma = line.indexOf(",");
        meta = comma >= 0 ? line.slice(comma + 1).replace(/^\s+|\s+$/g, "") : "";
      } else if (line.charAt(0) !== "#" && meta) {
        name = clean(meta);
        entries.push({ name: name, url: line });
        meta = "";
      }
    }
    for (i = 0; i < entries.length; i++) {
      if (entries[i].name === wanted) return entries[i].url;
    }
    for (i = 0; i < entries.length; i++) {
      if (wanted && (entries[i].name.indexOf(wanted) >= 0 || wanted.indexOf(entries[i].name) >= 0)) return entries[i].url;
    }
    return "";
  }
  function fetchFresh(title, oldUrl) {
    var now = Date.now();
    if (refreshing || now - lastRefresh < 2500) return Promise.resolve("");
    refreshing = true;
    lastRefresh = now;
    return fetch(playlistUrl, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.text();
    }).then(function (body) {
      if (currentTitle() !== title) return "";
      var fresh = findStream(body, title);
      return fresh && fresh !== oldUrl ? fresh : "";
    }).catch(function () {
      return "";
    }).then(function (fresh) {
      refreshing = false;
      return fresh;
    });
  }
  function useFreshUrl(target, oldUrl, title) {
    fetchFresh(title, oldUrl).then(function (fresh) {
      if (!fresh || currentTitle() !== title || !target) return;
      try {
        target.pause();
        target.setAttribute("src", fresh);
        target.load();
        var result = target.play();
        if (result && result.catch) result.catch(function () {});
        var status = document.getElementById("playback-status");
        if (status) status.textContent = "Refreshed the expired Toffee stream link. Reconnecting…";
      } catch (e) {}
    });
  }

  if (!video || !window.fetch) return;

  /* webOS native HLS path: refresh whenever app.js assigns a Toffee URL. */
  var descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
  if (descriptor && descriptor.set && descriptor.get) {
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: function () { return descriptor.get.call(this); },
      set: function (value) {
        descriptor.set.call(this, value);
        if (this === video && isToffee(value)) {
          useFreshUrl(this, String(value), currentTitle());
        }
      }
    });
  }

  /* HLS.js path: resolve a fresh signed URL before loading the manifest. */
  function patchHls() {
    if (!window.Hls || !window.Hls.prototype || window.Hls.prototype.__ashikaToffeeRefresh) return;
    var original = window.Hls.prototype.loadSource;
    if (typeof original !== "function") return;
    window.Hls.prototype.loadSource = function (url) {
      var self = this;
      if (!isToffee(url)) return original.call(self, url);
      var title = currentTitle();
      fetchFresh(title, String(url)).then(function (fresh) {
        original.call(self, fresh || url);
      });
    };
    window.Hls.prototype.__ashikaToffeeRefresh = true;
  }
  patchHls();
  var attempts = 0;
  var patchTimer = setInterval(function () {
    patchHls();
    attempts++;
    if (attempts > 20) clearInterval(patchTimer);
  }, 250);
})();
