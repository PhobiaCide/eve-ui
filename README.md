# eve-ui

*A modernized, standalone EVE Online fit and info display script for embedding in arbitrary websites.*

> **Note:** This is a maintained fork of the original [eve-ui](https://github.com/Phobiacide/eve-ui).
> The goal of this fork is to restore support for in-game style URLs (`showinfo:` and `fitting:`), bringing back the classic functionality of EVE’s in-game browser (IGB) — but in any modern web environment.

---

## Overview

`eve-ui` lets you embed EVE Online fittings, ship types, characters, corporations, alliances, and more directly into any web page — no server-side setup required.

It automatically detects elements referencing EVE entities and renders interactive, copy-pasteable info panels using CCP’s public ESI APIs.

This fork extends compatibility to support **original in-game links** such as:

```
fitting:1230:28576;3:1319;2:6569;1:3831;2:2281;1:17912;8::
showinfo:1379//2113672280     ← Character
showinfo:2//98631147          ← Corporation
showinfo:16159//99011193      ← Alliance
```

With these, any in-game fitting or info link can now function directly in the browser.

---

## Features

* 🚀 **No backend required** — everything runs client-side.
* ⚙️ **Works with CCP’s APIs** for up-to-date data.
* 🤌 **Compatible with legacy `fitting:` and new `showinfo:` URLs.**
* 💡 **Lightweight and portable** — only requires jQuery.
* 🔍 **Flexible input formats** (`data-dna`, `data-itemid`, `data-charid`, or `href` attributes).
* 🎨 **Customizable styling** via CSS or inline overrides.
* 🤓 **Automatic detection** of links and elements containing EVE data.

---

## Usage

Include jQuery and `eve-ui.min.js` in your page:

```html
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js" defer></script>
<script src="eve-ui.min.js" defer></script>
```

By default, `eve-ui` will scan the document for supported elements and automatically render their content.

### Example

```html
<a href="fitting:670::">Capsule (Pod)</a>
<a href="showinfo:1379//2113672280">CCP Testguy1</a>
<a href="showinfo:2//98631147">CCP Corporation</a>
<a href="showinfo:16159//99011193">CCP Alliance</a>
```

You can also use `data-` attributes for greater flexibility:

```html
<img src="icon.png" data-dna="670::" alt="Pod" />
<div data-itemid="27740">Vindicator</div>
```

---

## Demo

Check out the current demo:
[https://phobiacide.github.io/eve-ui/](https://phobiacide.github.io/eve-ui/)

For the default example page and source view:
[https://quiescens.github.io/eve-ui/examples.html](https://quiescens.github.io/eve-ui/examples.html)

---

## CSP and Styling

If your site uses a strict Content Security Policy (CSP), you can disable inline styling by adding:

```html
<script eveui_style=""></script>
```

Then include the CSS manually for default styling.

---

## Supported Link Types

This project recognizes several EVE link formats — both legacy IGB-style `href`s and modern `data-` attributes. `eve-ui` will parse these and render the appropriate UI panel.

### `fitting:` (fitting DNA)

* Format: `fitting:<shipTypeID>:<slotSpec1>;<slotSpec2>;...::`
* Description: A DNA-like fitting string describing a ship type and fitted modules. The script parses the string and renders the fitting window (fittable modules, charges, rigs, etc).
* Example: `fitting:1230:28576;3:1319;2:6569;1:3831;2:2281;1:17912;8::`

### `showinfo:` (in‑game info links)

* Format: `showinfo:<typeId>//<entityId>`
* Description: Mirrors the old IGB `showinfo` links. `typeId` is the in-game content type code and `entityId` is the numeric ID of the target (character, corporation, alliance, station, etc.). The script maps `typeId` values to ESI endpoints where possible and displays the appropriate panel.
* Common examples:

  * `showinfo:1379//2113672280` → Character (example)
  * `showinfo:2//98631147` → Corporation (example)
  * `showinfo:16159//99011193` → Alliance (example)

> Note: `typeId` mappings vary in the wild — this fork supports the common mappings shown above and falls back to a generic universe/type lookup when an unknown `typeId` is encountered.

### `item:`, `char:`

* `item:<typeId>` — universe type lookup (e.g., `item:27740`)
* `char:<characterId>` — character id (e.g., `char:90788766`)

### `data-` attributes

* `data-dna` — same format as `fitting:` but stored as an attribute: `<div data-dna=":670::">`
* `data-itemid` / `data-charid` — alternative attribute forms recognized by the script.

The script will automatically detect these patterns in `href` attributes and data attributes. It also supports elements added dynamically (AJAX) when the page re-scans or when you call the public scan API (`eveui.scan()`).

--------|--------------|----------|
| `fitting:` | Ship fitting DNA string | `fitting:1230:28576;3:1319;2::` |
| `showinfo:` | In-game entity info | `showinfo:1379//2113672280` |
| `item:` | Type ID | `item:27740` |
| `char:` | Character ID | `char:90788766` |
| `data-dna` / `data-itemid` | Custom HTML data attributes | `<div data-dna=":670::">Pod</div>` |

---

## Getting DNA Strings

You can obtain EVE fitting DNA strings from:

* [Pyfa](https://github.com/pyfa-org/Pyfa)
* [Fuzzwork DNA Generator](https://www.fuzzwork.co.uk/ships/dnagen.php)
* Copying text from the in-game Fitting window, Notepad, or chat.

---

## License

This project remains under the same license as the original.
Original code © [Phobiacide](https://github.com/Phobiacide/eve-ui)
Fork maintained and extended by community contributors.

---

## Future Goals

* Support for structure and station links.
* Optional ESI caching to minimize requests.
* Modular UI theme support for faction-themed styling.
