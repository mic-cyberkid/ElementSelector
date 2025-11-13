/*
  element-selector.js
  Production-ready, lightweight HTML Element Selector / Inspector
  - ES Module (export default)
  - Small footprint, zero external deps
  - Works in same-document or inside an iframe (pass a Document/Window)

  Usage (same-page):
    import ElementSelector from './element-selector.js';
    const selector = new ElementSelector({ onSelect: (info) => console.log(info) });
    selector.enable();

  Usage (iframe):
    // assuming `iframe` is an <iframe> element already loaded and same-origin
    import ElementSelector from './element-selector.js';
    const selector = new ElementSelector({ root: iframe.contentDocument, onSelect: cb });
    selector.enable();

  API:
    new ElementSelector(options)
      - options.root (Document) default: window.document
      - options.onSelect (fn) called with info when element selected
      - options.highlightStyle (object) override style properties for overlay
      - options.tooltip (boolean) show tooltip
      - options.singleSelection (boolean) default true — auto-disable after selection
      - options.multiSelectKey (string) e.g. 'Shift' to enable multi-select when held
      - options.zIndex (number)
    Methods: enable(), disable(), toggle(), destroy(), setOptions(opts), getSelected()

  Notes:
    - Designed to be resilient (throttled mousemove), avoids interfering with page JS
    - All DOM nodes created are namespaced and removed on destroy
    - For cross-origin iframes: selection inside them is NOT possible due to browser security
*/

const DEFAULTS = {
  root: document,
  onSelect: null,
  highlightStyle: {
    border: '2px solid rgba(0, 150, 255, 0.9)',
    background: 'rgba(0, 150, 255, 0.12)',
    borderRadius: '4px'
  },
  showTooltip: true,
  singleSelection: true,
  multiSelectKey: 'Shift',
  zIndex: 2147483646, // very high but less than browser chrome
  hoverThrottleMs: 16 // ~60fps
};

function isDocument(obj) {
  return obj && obj.nodeType === 9;
}

function now() { return performance && performance.now ? performance.now() : Date.now(); }

export default class ElementSelector {
  constructor(options = {}) {
    this.options = Object.assign({}, DEFAULTS, options);
    this.root = isDocument(this.options.root) ? this.options.root : document;
    this.window = this.root.defaultView || window;
    this.onSelect = this.options.onSelect;

    // internal state
    this.enabled = false;
    this._lastMove = 0;
    this._selected = [];
    this._hoveredEl = null;

    // namespaced element ids/classes to avoid collisions
    this._ns = 'esel';

    // create overlay + tooltip
    this._createOverlay();
    if (this.options.showTooltip) this._createTooltip();

    // bound handlers so we can add/remove
    this._bound = {
      mousemove: this._onMouseMove.bind(this),
      click: this._onClick.bind(this),
      keydown: this._onKeyDown.bind(this),
      keyup: this._onKeyUp.bind(this),
      scroll: this._onScrollOrResize.bind(this),
      resize: this._onScrollOrResize.bind(this),
    };

    // remember page-level listeners target: root or its defaultView
    this._listenersTarget = this.root;
  }

  // --------------------------- Public API ---------------------------
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this._attachListeners();
    this._overlay.style.display = 'block';
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this._detachListeners();
    this._overlay.style.display = 'none';
    this._clearHover();
  }

  toggle() {
    this.enabled ? this.disable() : this.enable();
  }

  destroy() {
    this.disable();
    this._removeNodes();
    this.onSelect = null;
    this._selected = [];
  }

  setOptions(opts = {}) {
    Object.assign(this.options, opts);
    if (opts.root && isDocument(opts.root)) {
      // switch root (clean listeners and overlay nodes)
      this.disable();
      this._removeNodes();
      this.root = opts.root;
      this.window = this.root.defaultView || window;
      this._createOverlay();
      if (this.options.showTooltip) this._createTooltip();
      this._listenersTarget = this.root;
    }
  }

  getSelected() {
    return this._selected.slice();
  }

  // ------------------------ Internal utilities ----------------------
  _createOverlay() {
    // overlay container
    this._overlay = this.root.createElement('div');
    this._overlay.className = `${this._ns}-overlay`;
    const s = this._overlay.style;
    s.position = 'absolute';
    s.pointerEvents = 'none';
    s.display = 'none';
    s.zIndex = String(this.options.zIndex);
    s.boxSizing = 'border-box';
    s.transition = 'all 40ms ease-out';
    Object.assign(s, this.options.highlightStyle);

    // ensure insertion into the correct document
    const container = this.root.documentElement || this.root.body || this.root;
    container.appendChild(this._overlay);
  }

  _createTooltip() {
    this._tooltip = this.root.createElement('div');
    this._tooltip.className = `${this._ns}-tooltip`;
    const s = this._tooltip.style;
    s.position = 'fixed';
    s.pointerEvents = 'none';
    s.display = 'none';
    s.zIndex = String(this.options.zIndex + 1);
    s.padding = '6px 8px';
    s.fontSize = '12px';
    s.borderRadius = '4px';
    s.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    s.background = 'white';
    s.color = '#222';
    s.maxWidth = '360px';
    s.whiteSpace = 'nowrap';

    this.root.documentElement.appendChild(this._tooltip);
  }

  _removeNodes() {
    if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
    if (this._tooltip && this._tooltip.parentNode) this._tooltip.parentNode.removeChild(this._tooltip);
    this._overlay = null;
    this._tooltip = null;
  }

  _attachListeners() {
    // use capture for click to intercept before page handlers
    this.window.addEventListener('mousemove', this._bound.mousemove, { passive: true });
    this.window.addEventListener('click', this._bound.click, { capture: true });
    this.window.addEventListener('keydown', this._bound.keydown, { passive: true });
    this.window.addEventListener('keyup', this._bound.keyup, { passive: true });
    this.window.addEventListener('scroll', this._bound.scroll, { passive: true });
    this.window.addEventListener('resize', this._bound.resize, { passive: true });
  }

  _detachListeners() {
    this.window.removeEventListener('mousemove', this._bound.mousemove);
    this.window.removeEventListener('click', this._bound.click, { capture: true });
    this.window.removeEventListener('keydown', this._bound.keydown);
    this.window.removeEventListener('keyup', this._bound.keyup);
    this.window.removeEventListener('scroll', this._bound.scroll);
    this.window.removeEventListener('resize', this._bound.resize);
  }

  _onMouseMove(e) {
    // throttle to reasonable framerate
    const t = now();
    if (t - this._lastMove < this.options.hoverThrottleMs) return;
    this._lastMove = t;

    const el = e.target;
    if (!el || el === this._overlay || (this._tooltip && el === this._tooltip)) {
      this._clearHover();
      return;
    }

    if (el === this._hoveredEl) return; // unchanged
    this._hoveredEl = el;
    this._updateOverlayFor(el);
  }

  _onClick(e) {
    if (!this.enabled) return;

    // ignore clicks on our UI
    if (e.target === this._overlay || e.target === this._tooltip) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Let the user hold multiSelectKey to select multiple
    const multi = !!e[this._getModifierFlagName(this.options.multiSelectKey)];

    // Prevent navigation / default page click behavior while selector active
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    const info = this._extractElementInfo(el);

    if (!multi) {
      this._selected = [info];
    } else {
      this._selected.push(info);
    }

    if (typeof this.onSelect === 'function') {
      try { this.onSelect(this._selected.slice()); }
      catch (err) { console.error('ElementSelector onSelect handler error', err); }
    }

    if (this.options.singleSelection && !multi) {
      this.disable();
    }
  }

  _onKeyDown(e) {
    // Escape disables
    if (e.key === 'Escape' || e.key === 'Esc') {
      this.disable();
      return;
    }
  }

  _onKeyUp() {
    // noop for now (placeholder for future keyboard features)
  }

  _onScrollOrResize() {
    // re-evaluate overlay position if hovered
    if (this._hoveredEl) this._updateOverlayFor(this._hoveredEl);
  }

  _clearHover() {
    this._hoveredEl = null;
    if (this._overlay) this._overlay.style.display = 'none';
    if (this._tooltip) this._tooltip.style.display = 'none';
  }

  _updateOverlayFor(el) {
    if (!el || !this._overlay) return;

    // compute bounding box relative to viewport
    let rect;
    try {
      rect = el.getBoundingClientRect();
    } catch (err) {
      // element might be removed
      this._clearHover();
      return;
    }

    const doc = this.root;
    const win = this.window;

    // position overlay using fixed positioning to avoid stacking context oddities
    const overlayStyle = this._overlay.style;
    overlayStyle.display = 'block';
    overlayStyle.position = 'fixed';
    overlayStyle.top = `${Math.max(0, rect.top)}px`;
    overlayStyle.left = `${Math.max(0, rect.left)}px`;
    overlayStyle.width = `${Math.max(0, rect.width)}px`;
    overlayStyle.height = `${Math.max(0, rect.height)}px`;

    if (this._tooltip) this._updateTooltip(el, rect);
  }

  _updateTooltip(el, rect) {
    const tip = this._tooltip;
    if (!tip) return;
    const summary = this._buildTooltipText(el);
    tip.textContent = summary;
    tip.style.display = 'block';

    // prefer placing tooltip above the element if there's space
    const vw = this.window.innerWidth;
    const vh = this.window.innerHeight;
    const tipRect = tip.getBoundingClientRect();

    let top = rect.top - tipRect.height - 8; // above
    let left = rect.left;
    if (top < 6) top = rect.bottom + 8; // below if not enough space
    if (left + tipRect.width > vw - 12) left = Math.max(6, vw - tipRect.width - 12);

    tip.style.top = `${Math.max(6, top)}px`;
    tip.style.left = `${Math.max(6, left)}px`;
  }

  _buildTooltipText(el) {
    try {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = el.classList && el.classList.length ? '.' + Array.from(el.classList).slice(0,3).join('.') : '';
      const text = (el.innerText || el.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 140);
      return `${tag}${id}${cls}${text ? ` — "${text}"` : ''}`;
    } catch (err) {
      return el.tagName ? el.tagName.toLowerCase() : 'element';
    }
  }

  _extractElementInfo(el) {
    const attrs = {};
    try {
      for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes[i];
        attrs[a.name] = a.value;
      }
    } catch (err) {
      // some special elements might throw; ignore
    }

    const info = {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className ? el.className.split(/\s+/).filter(Boolean) : [],
      text: (el.innerText || el.textContent || '').trim(),
      attributes: attrs,
      boundingClientRect: (function(){ try { return el.getBoundingClientRect(); } catch(e){ return null; } })(),
      selector: this._generateSmartSelector(el),
      node: el // raw DOM node (consumer may ignore or serialize as needed)
    };

    return info;
  }

  _generateSmartSelector(el) {
    // Attempt to build a short, robust selector using ID when available,
    // otherwise create a scoped path using tag.class:nth-child when helpful.
    if (!el || el.nodeType !== 1) return null;

    if (el.id) return `#${CSS.escape ? CSS.escape(el.id) : el.id}`;

    const parts = [];
    let node = el;
    const maxDepth = 6;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < maxDepth) {
      let part = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        // prefer first distinctive class
        const cls = Array.from(node.classList).slice(0,2).join('.');
        if (cls) part += `.${cls}`;
      }
      // if sibling count requires nth-child for uniqueness
      const parent = node.parentNode;
      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (sameTagSiblings.length > 1) {
          const idx = Array.prototype.indexOf.call(parent.children, node) + 1;
          part += `:nth-child(${idx})`;
        }
      }
      parts.unshift(part);
      node = node.parentNode;
      depth++;
    }
    return parts.join(' > ');
  }

  _getModifierFlagName(keyName) {
    // Convert 'Shift' -> 'shiftKey', 'Ctrl' -> 'ctrlKey', 'Alt' -> 'altKey', 'Meta' -> 'metaKey'
    const map = { Shift: 'shiftKey', Ctrl: 'ctrlKey', Alt: 'altKey', Meta: 'metaKey' };
    return map[keyName] || 'shiftKey';
  }
}
