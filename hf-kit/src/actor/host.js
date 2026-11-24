/* hf-kit actor, part 2/3: the cast (HFKit.cast). The host is a saved actor with a FIXED face
 * (curly hair, no glasses, skin #F0CDAE) and voice; only the outfit changes per video (blazer by
 * default, lab coat for science / health / tech). Extras are generic, deterministic characters
 * that never share the host's face. Pure data, no DOM. */
(function (root) {
  "use strict";
  var P = root.HFKitPresenter;
  var A = (root.HFKitActor = root.HFKitActor || {});
  if (!A.rig) throw new Error("actor/host.js: load actor/rig.js first");

  function freeze(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === "object") freeze(o[k]); });
    return Object.freeze(o);
  }

  var host = freeze({
    character: "host",
    face: { hair: "curly", skin: "#F0CDAE" },
    voice: "am_adam",
    defaultOutfit: "blazer",
  });

  /* Extras' looks. The host's skin tone is not in this list, so no extra can wear his face. */
  var SKINS = ["#F6D9C5", "#EFC6A4", "#D7A27A", "#B57A52", "#94603E", "#70452B", "#F3CDB0", "#C58D62"];
  var HAIR_COLORS = ["#1E1712", "#4A2C1A", "#7A4A28", "#B9853F", "#D8B26A", "#8E3B22", "#9A9A9A", "#2D2A26"];
  /* No curls: the curly crop is the host's signature. */
  var HAIRS = ["short", "long", "bun", "bald", "short", "long", "bun"];
  var OUTFITS = ["casual", "explorer", "lab-coat", "blazer", "casual"];
  var SWEATERS = [
    { jacket: "#3E7C6B", jacketShade: "#2F6255", jacketLight: "#5A9A88", jacketLine: "#163A31", shirt: "#2F6255", accent: "#F4E3C1" },
    { jacket: "#B5523B", jacketShade: "#93402D", jacketLight: "#CF6E57", jacketLine: "#4A1A10", shirt: "#93402D", accent: "#F3D9A4" },
    { jacket: "#4B5DA8", jacketShade: "#3A4A8A", jacketLight: "#6A7CC2", jacketLine: "#1A2250", shirt: "#3A4A8A", accent: "#F2C14E" },
    { jacket: "#8A5BA8", jacketShade: "#6F4889", jacketLight: "#A57BC0", jacketLine: "#33204A", shirt: "#6F4889", accent: "#F4E3C1" },
    { jacket: "#D9A441", jacketShade: "#B88630", jacketLight: "#EBC06A", jacketLine: "#5A3E0E", shirt: "#B88630", accent: "#3E5F8F" },
  ];
  var VOICES = ["af_heart", "am_michael", "bf_emma", "bm_george", "af_bella", "am_fenrir"];

  /* Extra number n (1, 2, ...): the same n always gives the same character. */
  function extra(n) {
    n = Math.max(1, Math.floor(Number(n) || 1));
    var rnd = P.seededRandom(n * 104729 + 7);
    var pick = function (list) { return list[Math.floor(rnd() * list.length)]; };
    var face = {
      hair: HAIRS[(n * 3 + Math.floor(rnd() * 2)) % HAIRS.length],
      skin: SKINS[(n * 5 + Math.floor(rnd() * 3)) % SKINS.length],
      hairColor: pick(HAIR_COLORS),
    };
    var outfit = OUTFITS[(n + Math.floor(rnd() * 2)) % OUTFITS.length];
    var c = {
      character: "extra-" + n,
      face: face,
      voice: VOICES[n % VOICES.length],
      defaultOutfit: outfit,
    };
    if (outfit === "casual") c.colors = Object.assign({}, SWEATERS[(n + Math.floor(rnd() * 5)) % SWEATERS.length]);
    return c;
  }

  /* A character from its name ("host", "extra-3") or a character object (returned as is). */
  function resolve(c) {
    if (c && typeof c === "object") return c;
    if (c === undefined || c === null || c === "host") return host;
    var m = /^extra-(\d+)$/.exec(String(c));
    if (m) return extra(+m[1]);
    throw new Error("cast: unknown character " + c);
  }

  A.cast = { host: host, extra: extra, resolve: resolve };
  if (root.HFKit) root.HFKit.cast = A.cast;
})(typeof globalThis !== "undefined" ? globalThis : window);
