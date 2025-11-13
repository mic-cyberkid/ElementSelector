# Element Selector – Documentation

## Overview

The **Element Selector** is a lightweight, zero-dependency JavaScript module that enables users to visually inspect and select HTML elements directly from a webpage — similar to Chrome DevTools’ element inspection tool. It is designed to be easily embeddable as a component within larger web applications or data extraction tools.

---

## Features

- 🔍 **Hover Highlighting**: Highlights elements as the user hovers over them.
- 🖱️ **Click-to-Select**: Select elements and extract structured information.
- 🧱 **Embeddable Component**: Works inside your app or within an iframe (same-origin).
- 🧠 **Metadata Extraction**: Returns tag, ID, class, attributes, text, bounding box, and unique CSS selector.
- ⚡ **Lightweight**: No dependencies, pure JavaScript, modular design.
- 🧭 **Tooltip Overlay**: Displays element info while hovering.
- 🧩 **Flexible API**: Configurable single or multi-select modes.

---

## Installation

Include the module file in your project:

```html
<script type="module" src="./element-selector.js"></script>
```

Or import it into your JavaScript/TypeScript project:

```js
import ElementSelector from './element-selector.js';
```

---

## Usage Example

### Basic Setup

```js
import ElementSelector from './element-selector.js';

const selector = new ElementSelector({
  onSelect: (info) => console.log('Selected element:', info),
});

selector.enable();
```

When enabled, users can hover to highlight elements and click to select them. Once selected, the callback receives structured data about the element.

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|----------|-------------|
| `root` | Document | `document` | The document context where selection occurs (e.g., `iframe.contentDocument`). |
| `onSelect` | Function | `null` | Callback invoked with element info upon selection. |
| `highlightStyle` | Object | `{ border, background, borderRadius }` | CSS styles for the hover overlay. |
| `showTooltip` | Boolean | `true` | Display a floating tooltip with element summary. |
| `singleSelection` | Boolean | `true` | If `true`, disables selector after first selection. |
| `multiSelectKey` | String | `'Shift'` | Key used to enable multiple selection (Shift, Ctrl, etc.). |
| `zIndex` | Number | `2147483646` | Z-index value for overlays. |
| `hoverThrottleMs` | Number | `16` | Mouse hover update rate in milliseconds (throttling). |

---

## Public Methods

### `enable()`
Activates the selector and adds event listeners. Hover highlights and click selection become active.

### `disable()`
Deactivates the selector, removes highlights, and stops all event listeners.

### `toggle()`
Toggles between enabled and disabled states.

### `destroy()`
Fully cleans up — removes overlays, listeners, and stored selections.

### `setOptions(options)`
Dynamically updates options. If `root` is changed, it re-initializes the environment.

### `getSelected()`
Returns an array of selected elements’ info.

---

## Data Structure: `onSelect` Callback

When a user selects an element, the `onSelect` callback receives the following data:

```js
{
  tag: 'div',
  id: 'main',
  classes: ['container', 'highlight'],
  text: 'Example content...',
  attributes: { 'data-id': '123', 'role': 'section' },
  boundingClientRect: { top, left, width, height, ... },
  selector: 'body > div.container:nth-child(2)',
  node: HTMLElement // reference to the selected DOM node
}
```

If multiple elements are selected (multi-select mode), the callback receives an **array** of these objects.

---

## Example: With Tooltip and Output Box

A simple interactive demo is provided in `test.html`:

```html
<button id="startSelector">Start Selector</button>
<pre id="output"></pre>

<script type="module">
  import ElementSelector from './element-selector.js';

  const output = document.getElementById('output');
  const selector = new ElementSelector({
    onSelect: (data) => {
      output.textContent = JSON.stringify(data, null, 2);
    },
    showTooltip: true
  });

  document.getElementById('startSelector').addEventListener('click', () => {
    selector.enable();
  });
</script>
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|---------|
| `Esc` | Exit selector mode (disables). |
| `Shift` (configurable) | Enables multi-select mode while held. |

---

## Integration with Iframes

The module supports iframe integration for same-origin frames:

```js
const iframe = document.querySelector('iframe');
const selector = new ElementSelector({
  root: iframe.contentDocument,
  onSelect: (info) => console.log('Iframe element selected:', info)
});
selector.enable();
```

> **Note:** Cross-origin iframes cannot be inspected due to browser security (CORS).

---

## Performance Notes

- Hover updates are throttled for smooth rendering.
- Overlay and tooltip use fixed positioning for consistency across scroll contexts.
- Clean detachment ensures minimal footprint when disabled.

---

## License

MIT License © 2025

Free for personal or commercial use. Attribution appreciated but not required.

---

## Future Enhancements

- Optional CSS/XPath generation refinement.
- Visual multi-selection overlays.
- Advanced keyboard shortcuts.
- React/Vue wrapper components.
- PostMessage bridge for cross-origin iframe coordination.

---

## Authors
mic-cyberkid  (2025)

GPT-5 (OpenAI Assistant) – technical architecture & documentation support

Ready to embed, lightweight, and production-ready HTML Element Selector module.
