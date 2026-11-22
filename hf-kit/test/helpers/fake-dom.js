// A tiny DOM stand-in for node --test: enough for HFKit.draw.el (createElementNS, setAttribute,
// appendChild, style, textContent) so effects and overlays can be mounted and serialised without a
// browser. Layout is not simulated (offsetWidth is 0): code under test must not depend on it.
export function fakeDocument() {
  const doc = {
    createElementNS: (ns, tag) => make(tag, doc),
    createElement: (tag) => make(tag, doc),
  };
  return doc;
}

function make(tag, doc) {
  const e = {
    tagName: tag, ownerDocument: doc, attrs: {}, children: [], style: {}, parentNode: null, _text: "",
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; },
    get firstChild() { return this.children[0] || null; },
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
    set textContent(v) { this._text = String(v); this.children = []; },
    set innerHTML(v) { if (v !== "") throw new Error("fake DOM: innerHTML is not supported"); this.children = []; this._text = ""; },
    get innerHTML() { return this.children.map(serialize).join(""); },
    offsetWidth: 0, offsetHeight: 0,
  };
  return e;
}

/* Deterministic text form of an element tree (tag, sorted attributes, style, text, children). */
export function serialize(e) {
  const a = Object.keys(e.attrs).sort().map((k) => ` ${k}="${e.attrs[k]}"`).join("");
  const st = Object.keys(e.style).sort().map((k) => `${k}:${e.style[k]}`).join(";");
  return `<${e.tagName}${a}${st ? ` style="${st}"` : ""}>${e._text}${e.children.map(serialize).join("")}</${e.tagName}>`;
}

/* Every element of a tree, depth first. */
export function all(e) { return [e, ...e.children.flatMap(all)]; }
