"use strict";

const eveui_user_agent = `For source website, see referrer. For library, see https://github.com/PhobiaCide/eve-ui/
  r: 0.0.2`;
let eveui_accept_language;
const eveui_preload_initial = 50;
const eveui_preload_interval = 10;
const eveui_mode = "modal"; //* expand_all, expand, multi_window, modal
const eveui_allow_edit = true;
const eveui_show_fitstats = true;
const eveui_fit_selector = `[href^="fitting:"],[data-dna]`;
const eveui_item_selector = `[href^="showinfo:"],[data-itemid]`;
const eveui_char_selector = `[href^="char:"],[data-charid]`;
const eveui_corp_selector = `[href^="corp:"],[data-corpid]`;
const eveui_esi_endpoint = (path) => `https://esi.evetech.net/latest${path}?datasource=tranquility`;
const eveui_urlify = (dna) => `fitting:${encodeURI(dna)}`;
const eveui_imageserver = (image_ref) =>
  `https://images.evetech.net/${encodeURI(image_ref)}`;

class Utility {
  static toTitleCase(str) {
    return str
      // Convert camelCase to space-separated words
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Convert all words to title case
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  static async getImgHref(id, size) {
    console.log(await ajax({
      url: eveui_esi_endpoint(`/universe/names/`),
      method: "POST",
      payload: JSON.stringify([id]),
      cache: true,
      contentType: "application/json"
    }));
  }
}

let eveui;
(function (eveui) {
  mark("script start");
  let $ = jQuery;
  let mouse_x = 0;
  let mouse_y = 0;
  let drag_element = null;
  let drag_element_x = 0;
  let drag_element_y = 0;
  let current_zindex = 100;
  let preload_timer;
  let preload_quota = eveui_preload_initial;
  eveui.cache = {};
  let eve_version;
  let requests_pending = 0;
  let itemselect_lastupdate = 0;
  let errors_lastminute = 0;
  let stacking = [1, 0.8691, 0.5706, 0.283, 0.106, 0.03];
  let db;

  // click handlers to create/close windows
  document.addEventListener("click", function (e) {
    if (e.target.matches(".eveui_window .eveui_close_icon")) {
      const parent = e.target.parentElement;
      if (parent) {
        parent.remove();
      }

      if (document.querySelectorAll(".eveui_window").length === 0) {
        const overlay = document.querySelector(".eveui_modal_overlay");
        if (overlay) {
          overlay.remove();
        }
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(".eveui_modal_overlay")) {
      document.querySelectorAll(".eveui_window").forEach(window => window.remove());
      e.target.remove();
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(eveui_fit_selector)) {
      e.preventDefault();
      preload_quota = eveui_preload_initial;

      // Hide window if it already exists
      if (e.target.eveui_window && document.contains(e.target.eveui_window)) {
        e.target.eveui_window.remove();
        return;
      }

      let dna = e.target.getAttribute("data-dna") || e.target.href.substring(e.target.href.indexOf(":") + 1);
      let eveui_name = e.target.getAttribute("data-title") || e.target.textContent.trim();

      switch (eveui_mode) {
        case "expand":
        case "expand_all":
          e.target.setAttribute("data-eveui-expand", "1");
          expand();
          break;
        default:
          e.target.eveui_window = fit_window(dna, eveui_name);
          break;
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(eveui_item_selector)) {
      e.preventDefault();

      // Hide window if it already exists
      if (e.target.eveui_window && document.contains(e.target.eveui_window)) {
        e.target.eveui_window.remove();
        return;
      }

      let item_id = e.target.getAttribute("data-itemid") || e.target.href.substring(e.target.href.indexOf(":") + 1);

      // Create loading placeholder
      switch (eveui_mode) {
        case "expand":
        case "expand_all":
          e.target.setAttribute("data-eveui-expand", "1");
          expand();
          break;
        default:
          e.target.eveui_window = item_window(item_id);
          break;
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(eveui_char_selector)) {
      e.preventDefault();

      // Hide window if it already exists
      if (e.target.eveui_window && document.contains(e.target.eveui_window)) {
        e.target.eveui_window.remove();
        return;
      }

      let char_id = e.target.getAttribute("data-charid") || e.target.href.substring(e.target.href.indexOf(":") + 1);

      // Create loading placeholder
      switch (eveui_mode) {
        case "expand":
        case "expand_all":
          e.target.setAttribute("data-eveui-expand", "1");
          expand();
          break;
        default:
          e.target.eveui_window = char_window(char_id);
          break;
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(eveui_corp_selector)) {
      e.preventDefault();

      // Hide window if it already exists
      if (e.target.eveui_window && document.contains(e.target.eveui_window)) {
        e.target.eveui_window.remove();
        return;
      }

      let corp_id = e.target.getAttribute("data-corpid") || e.target.href.substring(e.target.href.indexOf(":") + 1);

      // Create loading placeholder
      switch (eveui_mode) {
        case "expand":
        case "expand_all":
          e.target.setAttribute("data-eveui-expand", "1");
          expand();
          break;
        default:
          e.target.eveui_window = corp_window(corp_id);
          break;
      }
    }
  });

  // info buttons, copy buttons, etc
  document.addEventListener("click", function (e) {
    if (e.target.matches(".eveui_minus_icon")) {
      e.preventDefault();

      let itemElement = e.target.closest("[data-eveui-itemid]");
      let dnaElement = e.target.closest("[data-eveui-dna]");

      if (!itemElement || !dnaElement) return;

      let item_id = itemElement.getAttribute("data-eveui-itemid");
      let dna = dnaElement.getAttribute("data-eveui-dna");

      let re = new RegExp(":" + item_id + ";(\\d+)");
      let match = dna.match(re);

      if (!match) return;

      let new_quantity = parseInt(match[1]) - 1;

      if (new_quantity > 0) {
        dna = dna.replace(re, ":" + item_id + ";" + new_quantity);
      } else {
        dna = dna.replace(re, "");
      }

      dnaElement.setAttribute("data-eveui-dna", dna);

      cache_items(dna).then(() => {
        let eveui_window = document.querySelector(`.eveui_window[data-eveui-dna="${dna}"]`);
        if (eveui_window) {
          let content = eveui_window.querySelector(".eveui_content");
          if (content) {
            content.innerHTML = format_fit(dna);
          }
        }
        window.dispatchEvent(new Event("resize"));
      });
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(".eveui_plus_icon")) {
      e.preventDefault();

      let itemElement = e.target.closest("[data-eveui-itemid]");
      let dnaElement = e.target.closest("[data-eveui-dna]");

      if (!itemElement || !dnaElement) return;

      let item_id = itemElement.getAttribute("data-eveui-itemid");
      let dna = dnaElement.getAttribute("data-eveui-dna");

      let re = new RegExp(`:${item_id};(\\d+)`);
      let match = dna.match(re);

      if (!match) return;

      let new_quantity = parseInt(match[1]) + 1;

      dna = dna.replace(re, `:${item_id};${new_quantity}`);

      dnaElement.setAttribute("data-eveui-dna", dna);

      cache_items(dna).then(() => {
        let eveui_window = document.querySelector(`.eveui_window[data-eveui-dna="${dna}"]`);
        if (eveui_window) {
          let content = eveui_window.querySelector(".eveui_content");
          if (content) {
            content.innerHTML = format_fit(dna);
          }
        }
        window.dispatchEvent(new Event("resize"));
      });
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(".eveui_edit_icon")) {
      e.preventDefault();

      let contentElement = e.target.closest(".eveui_content");
      if (contentElement) {
        contentElement.classList.add("eveui_edit");
      }

      e.target.remove();
    }
  });
  document.addEventListener("click", function (e) {
    if (e.target.matches(".eveui_more_icon")) {
      e.preventDefault();

      let itemElement = e.target.closest("[data-eveui-itemid]");
      if (!itemElement) return;

      let item_id = itemElement.getAttribute("data-eveui-itemid");

      // Hide window if it already exists
      if (e.target.eveui_itemselect && document.contains(e.target.eveui_itemselect)) {
        e.target.eveui_itemselect.remove();
        return;
      }

      document.querySelectorAll(".eveui_itemselect").forEach(el => el.remove());

      let rowContent = itemElement.querySelector(".eveui_rowcontent");
      if (!rowContent) return;

      let inputPlaceholder = rowContent.textContent.trim();
      let eveui_itemselect = document.createElement("span");
      eveui_itemselect.className = "eveui_itemselect";
      eveui_itemselect.innerHTML = `
        <input type="text" list="eveui_itemselect" placeholder="${inputPlaceholder}" />
        <datalist id="eveui_itemselect"></datalist>
      `;

      eveui_itemselect.style.zIndex = current_zindex++;
      e.target.eveui_itemselect = eveui_itemselect;

      rowContent.prepend(eveui_itemselect);
      eveui_itemselect.querySelector("input").focus();

      if (typeof item_id === "undefined") return;

      let request_timestamp = performance.now();

      // Get market group id for selected item
      cache_request(`/universe/types/${item_id}`).then(() => {
        let data = cache_retrieve(`/universe/types/${item_id}`);
        let market_group = data.market_group_id;

        // Get items with the same market group
        cache_request(`/markets/groups/${market_group}`).then(() => {
          if (request_timestamp > itemselect_lastupdate) {
            itemselect_lastupdate = request_timestamp;
          } else {
            return;
          }

          let data = cache_retrieve(`/markets/groups/${market_group}`);
          let datalist = document.querySelector(".eveui_itemselect datalist");

          cache_items(data.types.join(":")).then(() => {
            mark("marketgroup cached");

            data.types.sort((a, b) => {
              return cache_retrieve(`/universe/types/${a}`).name.localeCompare(
                cache_retrieve(`/universe/types/${b}`).name
              );
            });

            for (let i of data.types) {
              let option = document.createElement("option");
              option.label = cache_retrieve(`/universe/types/${i}`).name;
              option.textContent = `(${i})`;
              datalist.appendChild(option);
            }
          });
        });
      });
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.matches(".eveui_itemselect input")) {
      let eveui_itemselect = e.target.closest(".eveui_itemselect");
      let input_str = e.target.value.trim();

      if (input_str.startsWith("(") && input_str.endsWith(")")) {
        // Numeric input is expected to mean selected item
        input_str = input_str.slice(1, -1);

        let itemElement = e.target.closest("[data-eveui-itemid]");
        let dnaElement = e.target.closest("[data-eveui-dna]");

        if (!dnaElement) return;

        let item_id = itemElement ? itemElement.getAttribute("data-eveui-itemid") : undefined;
        let dna = dnaElement.getAttribute("data-eveui-dna");

        if (typeof item_id === "undefined") {
          // Append new item
          dna = `${dna.slice(0, -2)}:${input_str};1::`;
        } else {
          // Replace existing item
          let re1 = new RegExp(`^${item_id}:`);
          dna = dna.replace(re1, `${input_str}:`);

          let re2 = new RegExp(`:${item_id};`);
          dna = dna.replace(re2, `:${input_str};`);
        }

        dnaElement.setAttribute("data-eveui-dna", dna);

        cache_items(dna).then(() => {
          let eveui_window = document.querySelector(`.eveui_window[data-eveui-dna="${dna}"]`);
          if (eveui_window) {
            let content = eveui_window.querySelector(".eveui_content");
            if (content) {
              content.innerHTML = format_fit(dna);
            }
          }
          window.dispatchEvent(new Event("resize"));
        });

        document.querySelectorAll(".eveui_itemselect").forEach(el => el.remove());
      } else {
        // Search for matching items
        if (input_str.length < 3) return;

        let request_timestamp = performance.now();

        // Get item ids that match input
        ajax({
          url: eveui_esi_endpoint(`/search`),
          cache: true,
          data: {
            search: e.target.value,
            categories: "inventorytype",
          },
        }).then(data => {
          if (!data.inventorytype) return;

          // Get names for required item ids
          ajax({
            url: eveui_esi_endpoint(`/universe/names/`),
            cache: true,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ ids: data.inventorytype.slice(0, 50) }),
          }).then(data => {
            if (request_timestamp > itemselect_lastupdate) {
              itemselect_lastupdate = request_timestamp;
            } else {
              return;
            }

            let datalist = eveui_itemselect.querySelector("datalist");
            datalist.innerHTML = "";

            data.sort((a, b) => a.name.localeCompare(b.name));

            for (let item of data) {
              let option = document.createElement("option");
              option.label = item.name;
              option.textContent = `(${item.id})`;
              datalist.appendChild(option);
            }
          });
        });
      }
    }
  });

  // close itemselect window on any outside click
  document.addEventListener("click", function (e) {
    if (e.target.closest(".eveui_itemselect, .eveui_more_icon")) {
      return;
    }
    document.querySelectorAll(".eveui_itemselect").forEach(el => el.remove());
  });

  document.addEventListener("click", function (e) {
    if (e.target.matches(".eveui_copy_icon")) {
      let contentElement = e.target.closest(".eveui_content");
      if (contentElement) {
        clipboard_copy(contentElement);
      }
    }
  });

  // custom window drag handlers
  document.addEventListener("mousedown", function (e) {
    if (e.target.matches(".eveui_window")) {
      e.target.style.zIndex = current_zindex++;
    }
  });

  $(document).on("mousedown", ".eveui_title", function (e) {
    e.preventDefault();
    drag_element = $(this).parent();
    drag_element_x = mouse_x - drag_element.position().left;
    drag_element_y = mouse_y - drag_element.position().top;
    drag_element.css("z-index", current_zindex++);
  });
  $(document).on("mousemove", function (e) {
    mouse_x = e.clientX;
    mouse_y = e.clientY;
    if (drag_element === null) {
      return;
    }
    drag_element.css("left", mouse_x - drag_element_x);
    drag_element.css("top", mouse_y - drag_element_y);
  });
  $(document).on("mouseup", function (e) {
    drag_element = null;
  });
  $(window).on("resize", function (e) {
    // resize handler to try to keep windows onscreen
    $(".eveui_window").each(function () {
      let eveui_window = $(this);
      let eveui_content = eveui_window.find(".eveui_content");
      if (eveui_content.height() > window.innerHeight - 50) {
        eveui_window.css("height", window.innerHeight - 50);
      } else {
        eveui_window.css("height", "");
      }
      if (eveui_content.width() > window.innerWidth - 40) {
        eveui_window.css("width", window.innerWidth - 40);
      } else {
        eveui_window.css("width", "");
      }
      if (eveui_window[0].getBoundingClientRect().bottom > window.innerHeight) {
        eveui_window.css(
          "top",
          window.innerHeight - eveui_window.height() - 25
        );
      }
      if (eveui_window[0].getBoundingClientRect().right > window.innerWidth) {
        eveui_window.css("left", window.innerWidth - eveui_window.width() - 10);
      }
    });
    if (eveui_mode === "modal") {
      let eveui_window = $("[data-eveui-modal]");
      eveui_window.css(
        "top",
        window.innerHeight / 2 - eveui_window.height() / 2
      );
      eveui_window.css(
        "left",
        window.innerWidth / 2 - eveui_window.width() / 2
      );
    }
  });
  mark("event handlers set");

  function eve_version_query() {
    mark("eve version request");
    ajax({
      url: eveui_esi_endpoint(`/status/`),
      dataType: "json",
      cache: true,
    })
      .done(function (data) {
        eve_version = data.server_version;
        mark("eve version response " + eve_version);
        if (indexedDB) {
          // indexedDB is available
          let open = indexedDB.open("eveui", eve_version);
          open.onupgradeneeded = function (e) {
            let db = open.result;
            if (db.objectStoreNames.contains("cache")) {
              db.deleteObjectStore("cache");
            }
            db.createObjectStore("cache", {
              keyPath: "path"
            });
          };
          open.onsuccess = function () {
            db = open.result;
            let tx = db.transaction("cache", "readonly");
            let store = tx.objectStore("cache");
            store.getAll().onsuccess = function (e) {
              $.each(e.target.result, function (index, value) {
                eveui.cache[value.path] = value;
              });
              $(document).ready(eveui_document_ready);
            };
          };
        } else {
          // indexedDB not available
          $(document).ready(eveui_document_ready);
        }
        setInterval(autoexpand, 100);
      })
      .fail(function (xhr) {
        mark("eve version request failed");
        setTimeout(eve_version_query, 10000);
      });
  }
  eve_version_query();

  function eveui_document_ready() {
    // expand fits where applicable
    mark("expanding fits");
    expand();
    cache_request("/markets/prices");
    // start preload timer
    preload_timer = setTimeout(lazy_preload, eveui_preload_interval);
    mark("preload timer set");
  }

  function new_window(title = "&nbsp;") {
    let eveui_window = $(`
      <article class="eveui_window card shadow">
        <header class="eveui_title card-header">
          <h4>${title}</h4>
        </header>
        <span class="eveui_icon eveui_close_icon" ></span>
        <span class="eveui_scrollable">
          <span class="eveui_content">
            <span class="border-spinner"></span>
            Loading...
          </span>
        </span>
      </article>`);
    if (eveui_mode === "modal" && $(".eveui_modal_overlay").length === 0) {
      $("body").append(`<div class="eveui_modal_overlay" />`);
      eveui_window.attr("data-eveui-modal", 1);
    }
    eveui_window.css("z-index", current_zindex++);
    eveui_window.css("left", mouse_x + 10);
    eveui_window.css("top", mouse_y - 10);
    return eveui_window;
  }

  function mark(mark) {
    // log script time with annotation for performance metric
    console.log("eveui: " + performance.now().toFixed(3) + " " + mark);
  }

  function format_fit(dna, eveui_name) {
    // generates html for a fit display
    let high_slots = {};
    let med_slots = {};
    let low_slots = {};
    let rig_slots = {};
    let subsystem_slots = {};
    let other_slots = {};
    let cargo_slots = {};
    let items = dna.split(":");
    // ship name and number of slots
    let ship_id = parseInt(items.shift());
    let ship = cache_retrieve("/universe/types/" + ship_id);
    ship.hiSlots = 0;
    ship.medSlots = 0;
    ship.lowSlots = 0;
    for (let i in ship.dogma_attributes) {
      let attr = cache_retrieve("/universe/types/" + ship_id)
        .dogma_attributes[i];
      switch (attr.attribute_id) {
        case 14: // hiSlots
          ship.hiSlots = attr.value;
          break;
        case 13: // medSlots
          ship.medSlots = attr.value;
          break;
        case 12: // lowSlots
          ship.lowSlots = attr.value;
          break;
        case 1137: // rigSlots
          ship.rigSlots = attr.value;
          break;
        case 1367: //maxSubSystems
          ship.maxSubSystems = attr.value;
          break;
      }
    }
    // categorize items into slots
    outer: for (let i in items) {
      if (items[i].length === 0) {
        continue;
      }
      let match = items[i].split(";");
      let item_id = match[0];
      let quantity = parseInt(match[1]);
      if (item_id.endsWith("_")) {
        item_id = item_id.slice(0, -1);
        cargo_slots[item_id] = quantity;
        continue;
      }
      let item = cache_retrieve("/universe/types/" + item_id);
      for (let j in item.dogma_attributes) {
        let attr = item.dogma_attributes[j];
        switch (attr.attribute_id) {
          case 1272:
            other_slots[item_id] = quantity;
            continue outer;
          case 1374: // hiSlotModifier
            ship.hiSlots += attr.value;
            break;
          case 1375: // medSlotModifier
            ship.medSlots += attr.value;
            break;
          case 1376: // lowSlotModifier
            ship.lowSlots += attr.value;
            break;
        }
      }
      for (let j in item.dogma_effects) {
        let effect = item.dogma_effects[j];
        switch (effect.effect_id) {
          case 12: // hiPower
            high_slots[item_id] = quantity;
            continue outer;
          case 13: // medPower
            med_slots[item_id] = quantity;
            continue outer;
          case 11: // loPower
            low_slots[item_id] = quantity;
            continue outer;
          case 2663: // rigSlot
            rig_slots[item_id] = quantity;
            continue outer;
          case 3772: // subSystem
            subsystem_slots[item_id] = quantity;
            continue outer;
        }
      }
      cargo_slots[item_id] = quantity;
    }

    function item_rows(fittings, slots_available) {
      // generates table rows for listed slots
      let html = "";
      let slots_used = 0;
      for (let item_id in fittings) {
        let item = cache_retrieve("/universe/types/" + item_id);
        slots_used += fittings[item_id];
        if (slots_available) {
          html += `<tr class="copy_only"><td>${(item.name + "<br />").repeat(
            fittings[item_id]
          )}`;
        } else {
          html += `<tr class="copy_only"><td>${item.name} x${fittings[item_id]}<br />`;
        }
        html += `<tr class="nocopy" data-eveui-itemid="${item_id}"><td><img src="${eveui_imageserver(
          "types/" + item_id + "/icon?size=64"
        )}" class="eveui_icon eveui_item_icon" /><td class="eveui_right">${fittings[item_id]
          }<td colspan="2"><div class="eveui_rowcontent">${item.name
          }</div><td class="eveui_right whitespace_nowrap"><span data-itemid="${item_id}" class="eveui_icon eveui_info_icon" /><span class="eveui_icon eveui_plus_icon eveui_edit" /><span class="eveui_icon eveui_minus_icon eveui_edit" /><span class="eveui_icon eveui_more_icon eveui_edit" />`;
      }
      if (typeof slots_available !== "undefined") {
        if (slots_available > slots_used) {
          html += `<tr class="nocopy"><td class="eveui_icon eveui_item_icon" /><td class="eveui_right whitespace_nowrap">${slots_available - slots_used
            }<td colspan="2"><div class="eveui_rowcontent">Empty</div><td class="eveui_right"><span class="eveui_icon eveui_more_icon eveui_edit" />`;
        }
        if (slots_used > slots_available) {
          html += `<tr class="nocopy"><td class="eveui_icon eveui_item_icon" /><td class="eveui_right">${slots_available - slots_used
            }<td><div class="eveui_rowcontent">Excess</div>`;
        }
      }
      return html;
    }
    let html = `
  <span class="float_right">
    <eveui type="fit_stats" key="${dna}"></eveui>
  </span>
  <table class="eveui_fit_table">
    <thead>
      <tr class="eveui_fit_header" data-eveui-itemid="${ship_id}">
        <td colspan="2">
          <img src="${eveui_imageserver(
      "types/" + ship_id + "/render?size=512"
    )}" class="eveui_icon eveui_ship_icon" />
        </td>
        <td>
          <div class="eveui_rowcontent">
            <span class="eveui_startcopy"></span>
            [
            <a target="_blank" href="${eveui_urlify(dna)}">
              ${ship.name}, ${eveui_name || ship.name}
            </a>
            ]
          <br/>
          </div>
        </td>
        <td class="eveui_right whitespace_nowrap nocopy" colspan="2">
          ${eveui_allow_edit
        ? '<span class="eveui_icon eveui_edit_icon"></span>'
        : ""
      }
          <span class="eveui_icon eveui_copy_icon"</span>
          <span data-itemid="${ship_id}" class="eveui_icon eveui_info_icon"></span>
          <span class="eveui_icon eveui_edit"></span>
          <span class="eveui_icon eveui_edit"></span>
          <span class="eveui_icon eveui_more_icon eveui_edit"></span>
        </td>
      </tr>
    </thead>
    <tbody class="whitespace_nowrap">
      ${item_rows(high_slots, ship.hiSlots)}
      <tr>
        <td class="eveui_line_spacer">
          &nbsp;${item_rows(med_slots, ship.medSlots)}
        </td>
      </tr>
      <tr>
        <td class="eveui_line_spacer">
          &nbsp;${item_rows(low_slots, ship.lowSlots)}
        </td>
      </tr>
      <tr>
        <td class="eveui_line_spacer">
          &nbsp;${item_rows(rig_slots, ship.rigSlots)}
        </td>
      </tr>
      <tr>
        <td class="eveui_line_spacer">
          &nbsp;${item_rows(subsystem_slots, ship.maxSubSystems)}
        </td>
      </tr>
      <tr>
        <td class="eveui_line_spacer">
          &nbsp;${item_rows(other_slots)}
        </td>
      </tr>
      <tr>
        <td class="eveui_line_spacer">
          &nbsp;${item_rows(cargo_slots)}
        </td>
      </tr>
    </tbody>
  </table>
  <span class="eveui_endcopy"></span>`;
    return html;
  }
  eveui.format_fit = format_fit;

  function fit_window(dna, eveui_name) {
    // creates and populates a fit window
    let eveui_window = new_window("Fit");
    eveui_window.addClass("fit_window");
    eveui_window.attr("data-eveui-dna", dna);
    $("body").append(eveui_window);
    $(window).trigger("resize");
    // load required items and set callback to display
    mark("fit window created");
    cache_items(dna)
      .done(function () {
        eveui_window.find(".eveui_content ").html(format_fit(dna, eveui_name));
        $(window).trigger("resize");
        mark("fit window populated");
      })
      .fail(function () {
        eveui_window.remove();
      });
    return eveui_window;
  }
  eveui.fit_window = fit_window;

  function format_item(item_id) {
    let item = cache_retrieve("/universe/types/" + item_id);
    let html = `
      <div class="card">
      <header class="card-header">
      <figure class="figure">
      <figcaption class="figure-caption">
      <h3>
      ${item.name}
      </h3>
      </figcaption>
  <img src="${eveui_imageserver("types/" + item_id + "/render?size=512")}" class="figure-img img-fluid rounded" />
  </figure>
  <dl>
    <dt>Estimated price</dt>
    <dd class="text-end">Ƶ${format_number(market_retrieve(item_id).average_price)}</dd>
</dl>
  </header>
  <div class="card-body text-wrap">
  ${item.description}

<header>
        Attributes
</header><dl>`;
    for (let i in item.dogma_attributes) {
      let attr = item.dogma_attributes[i];
      html += `
    
      <dt>
        <eveui key="/dogma/attributes/${attr.attribute_id}" path="display_name,name">
          attribute:${attr.attribute_id}
        </eveui>
      </dt>
      <dd class="text-end border-bottom">
        ${format_number(attr.value)}
      </dd>
    `;
    }
    html += "</dl></div></div>";
    return html;
  }
  eveui.format_item = format_item;

  function item_window(item_id) {
    // creates and populates an item window
    let eveui_window = new_window("Item");
    eveui_window.attr("data-eveui-itemid", item_id);
    eveui_window.addClass("item_window");
    switch (eveui_mode) {
      default:
        $("body").append(eveui_window);
        break;
    }
    mark("item window created");
    // load required items and set callback to display
    cache_request("/universe/types/" + item_id)
      .done(function () {
        eveui_window.find(".eveui_content").html(format_item(item_id));
        $(window).trigger("resize");
        mark("item window populated");
      })
      .fail(function () {
        eveui_window.remove();
      });
    $(window).trigger("resize");
    return eveui_window;
  }
  eveui.item_window = item_window;

  function format_char(char_id) {
    let character = cache_retrieve("/characters/" + char_id);
    let html = `
 <hr/>
  <figure class="figure">
  <figcaption class="figure-caption">
        ${character.name}
</figcaption>
 
  
          <img src="${eveui_imageserver(
      "characters/" + char_id + "/portrait?size=512"
    )}" class="img-fluid img-rounded figure-img"/>
     
 </figure>
      <hr />
        <table class="table table-hover table-borderless">
        <thead>
        <tr>
        <th> Member of</th></tr></thead>
    <tbody>
   
        <td colspan="1">
        
        <figure class="figure">
        <figcaption class="figure-caption">
                  
          <a href="corp:${character.corporation_id}">
            <eveui key="/corporations/${character.corporation_id
      }" path="name">
              ${character.corporation_id}
            </eveui>
          </a>
          </figcaption>
          <img  class="border figure-img img-fluid rounded" src="${eveui_imageserver(
        "corporations/" + character.corporation_id + "/logo?size=128"
      )}" height="96" width="96" />
          </figure>
        </td>
       

      </tr>
      <tr>
        <td colspan="1" style="text-align: right;">
          Bio:&nbsp;
        </td>
        <td style="text-align:left;">
          ${character.description.replace(/<font[^>]+>/g, "<font>")}
        </td>
      </tr>
    </tbody>
  </table>`;
    return html;
  }
  eveui.format_char = format_char;

  function char_window(char_id) {
    let eveui_window = new_window("Character");
    eveui_window.attr("data-eveui-charid", char_id);
    eveui_window.addClass("char_window");
    switch (eveui_mode) {
      default:
        $("body").append(eveui_window);
        break;
    }
    mark("char window created");
    // load required chars and set callback to display
    cache_request("/characters/" + char_id)
      .done(function () {
        eveui_window.find(".eveui_content").html(format_char(char_id));
        $(window).trigger("resize");
        mark("char window populated");
      })
      .fail(function () {
        eveui_window.remove();
      });
    $(window).trigger("resize");
    return eveui_window;
  }
  eveui.char_window = char_window;

  function format_corp(corp_id) {
    let corporation = cache_retrieve("/corporations/" + corp_id);
    return `
    <div class="container-fluid">
 <figure class="figure">
  <figcaption class="figure-caption">
  <hr/>
         ${corporation.name}
        <hr />
</figcaption>
          <img src="${eveui_imageserver(
      "corporations/" + corp_id + "/logo?size=256"
    )}" class="img-fluid border rounded figure-img"/>
          <hr />
 </figure>
          <table class="table">
    <tr>
      <td>
        <img class="float_left" src="${eveui_imageserver(
      "alliances/" + corporation.alliance_id + "/logo?size=128"
    )}" height="128" width="128" />
        Member of
        <eveui key="/alliances/${corporation.alliance_id}" path="name">
  ${corporation.alliance_id}
        </eveui>
      </td>
    </tr>
    <tr>
      <td>
        Bio:
      </td>
      <td>
        ${corporation.description.replace(/<font[^>]+>/g, "<font>")}
      </td>
    </tr>
  </table>
  </div>`;
  }
  eveui.format_corp = format_corp;

  function corp_window(corp_id) {
    let eveui_window = new_window("Corporation");
    eveui_window.attr("data-eveui-corpid", corp_id);
    eveui_window.addClass("corp_window");
    switch (eveui_mode) {
      default:
        $("body").append(eveui_window);
        break;
    }
    mark("corp window created");
    // load required corps and set callback to display
    cache_request("/corporations/" + corp_id)
      .done(function () {
        eveui_window.find(".eveui_content").html(format_corp(corp_id));
        $(window).trigger("resize");
        mark("corp window populated");
      })
      .fail(function () {
        eveui_window.remove();
      });
    $(window).trigger("resize");
    return eveui_window;
  }
  eveui.corp_window = corp_window;
  // i am going for clarity and extendability here more so than efficiency
  function format_fitstats(dna) {
    return `
  <span class="card shadow eveui_fit_stats text-body">
<dl>
<dt>Estimated Price</dt>
<dd>${formatMoney(calculate_fit_price(dna))}</dd>
<dt>Gun Damage</dt>
<dd>${format_number(calculate_gun_dps(dna), "DPS")}</dd>
<dt>Missile Damage</dt>
<dd>?</dd>
<dt>Drone Damage</dt>
<dd>?</dd>
</dl>
  </span>`;
  }
  eveui.format_fitstats = format_fitstats;

  function calculate_fit_price(dna) {
    let items = dna.split(":");
    let total_price = 0;
    for (let i in items) {
      if (items[i].length === 0) {
        continue;
      }
      let match = items[i].split(";");
      let item_id = match[0];
      let quantity = parseInt(match[1]) || 1;
      total_price +=
        $.grep(cache_retrieve("/markets/prices"), function (v) {
          return v["type_id"] == item_id;
        })[0]["average_price"] * quantity;
    }
    return total_price;
  }

  function calculate_gun_dps(dna) {
    let total_dps = 0;
    let items = dna.replace(/:+$/, "").split(":");
    for (let i in items) {
      let match = items[i].split(";");
      let item_id = match[0];
      let quantity = parseInt(match[1]) || 1;
      let item = cache_retrieve("/universe/types/" + item_id);
      let attr = {};
      for (let j in item.dogma_attributes) {
        attr[item.dogma_attributes[j]["attribute_id"]] =
          item.dogma_attributes[j]["value"];
      }
      let groups = {
        53: "energy",
        55: "projectile",
        74: "hybrid",
      };
      if (item.group_id in groups) {
        let base_dmg = 0;
        let base_dmg_mult = attr[64];
        let base_rof = attr[51] / 1000;
        let dmg_mult = [];
        let rof_mult = [];
        let ammo_groups = {};
        ammo_groups[attr[604]] = 1;
        ammo_groups[attr[605]] = 1;
        // check all items for any relevant modifiers
        for (let j in items) {
          let match = items[j].split(";");
          let item_id = match[0];
          let quantity = parseInt(match[1]) || 1;
          let item = cache_retrieve("/universe/types/" + item_id);
          let attr = {};
          for (let k in item.dogma_attributes) {
            attr[item.dogma_attributes[k]["attribute_id"]] =
              item.dogma_attributes[k]["value"];
          }
          // find highest damage ammo
          if (item.group_id in ammo_groups) {
            let total_dmg = 0;
            total_dmg += attr[114];
            total_dmg += attr[116];
            total_dmg += attr[117];
            total_dmg += attr[118];
            if (total_dmg > base_dmg) {
              base_dmg = total_dmg;
            }
          }
          // rof
          if (204 in attr) {
            for (let k = 0; k < quantity; k++) {
              rof_mult.push(attr[204]);
            }
          }
          // dmg_mult
          switch (item.group_id) {
            case 302:
              if (64 in attr) {
                for (let k = 0; k < quantity; k++) {
                  dmg_mult.push(attr[64]);
                }
              }
              break;
          }
        }
        // skills, we are only going to handle level 5 skills, we are a basic fit display system, not an actually fitting program
        base_rof *= 0.9; // gunnery
        base_rof *= 0.8; // rapid firing
        rof_mult.sort(function (a, b) {
          return a - b;
        });
        for (let i in rof_mult) {
          base_rof *= 1 - (1 - rof_mult[i]) * stacking[i];
        }
        base_dmg_mult *= 1.15; // surgical strike
        base_dmg_mult *= 1.25; // turret skill
        base_dmg_mult *= 1.1; // turret spec TODO: only for guns that require t2 skill
        base_dmg_mult *= 1.375; // ship skill TODO: actual ship skill
        dmg_mult.sort(function (a, b) {
          return b - a;
        });
        for (let i in dmg_mult) {
          base_dmg_mult *= 1 + (dmg_mult[i] - 1) * stacking[i];
        }
        total_dps += ((base_dmg * base_dmg_mult) / base_rof) * quantity;
      }
    }
    return total_dps;
  }

  function format_number(num, units = "") {
    if (isNaN(num)) {
      return "n/a";
    }
    let suffix = "";
    if (num >= 1000000000) {
      suffix = "B";
      num /= 1000000000;
    } else if (num >= 1000000) {
      suffix = "M";
      num /= 1000000;
    } else if (num >= 1000) {
      suffix = "K";
      num /= 1000;
    }

    // Remove .00 if it's a whole number
    const formattedNum = Number.isInteger(num) ? num.toFixed(0) : num.toFixed(2);

    return `${formattedNum} ${suffix} ${units}`.trim();
  }

  function formatMoney(num) {
    return `Ƶ ${format_number(num)}`;
  }

  function expand() {
    // expands anything that has been marked for expansion, or all applicable if we are set to expand_all mode
    autoexpand();
    let expand_filter = "[data-eveui-expand]";
    if (eveui_mode === "expand_all") {
      expand_filter = "*";
    }
    $(eveui_fit_selector)
      .filter(expand_filter)
      .each(function () {
        let selected_element = $(this);
        if (selected_element.closest(".eveui_content").length > 0) {
          // if element is part of eveui content already, don't expand, otherwise we might get a really fun infinite loop
          return;
        }
        let dna =
          selected_element.attr("data-dna") ||
          this.href.substring(this.href.indexOf(":") + 1);
        cache_items(dna).done(function () {
          let eveui_name = $(this).text().trim();
          let eveui_content = $(
            `<span class="eveui_content eveui_fit">${format_fit(
              dna,
              eveui_name
            )}</span>`
          );
          eveui_content.attr("data-eveui-dna", dna);
          selected_element = selected_element.replaceWith(eveui_content);
          mark("fit window expanded");
        });
      });
    $(eveui_item_selector)
      .filter(expand_filter)
      .each(function () {
        let selected_element = $(this);
        if (selected_element.closest(".eveui_content").length > 0) {
          // if element is part of eveui content already, don't expand, otherwise we might get a really fun infinite loop
          return;
        }
        let item_id =
          selected_element.attr("data-itemid") ||
          this.href.substring(this.href.indexOf(":") + 1);
        cache_request("/universe/types/" + item_id).done(function () {
          selected_element.replaceWith(
            `<span class="eveui_content eveui_item">
              ${format_item(item_id)}</span>`
          );
          mark("item window expanded");
        });
      });
    $(eveui_char_selector)
      .filter(expand_filter)
      .each(function () {
        let selected_element = $(this);
        if (selected_element.closest(".eveui_content").length > 0) {
          // if element is part of eveui content already, don't expand, otherwise we might get a really fun infinite loop
          return;
        }
        let char_id =
          selected_element.attr("data-charid") ||
          this.href.substring(this.href.indexOf(":") + 1);
        cache_request("/characters/" + char_id).done(function () {
          selected_element.replaceWith(
            `<span class="eveui_content eveui_char">${format_char(
              char_id
            )}</span>`
          );
          mark("char window expanded");
        });
      });
  }
  eveui.expand = expand;

  function autoexpand() {
    // expands elements that require expansion even when not in expand mode
    $("eveui[type=fit_stats]")
      .filter(":not([state])")
      .each(function () {
        let selected_element = $(this);
        let dna = selected_element.attr("key");
        if (eveui_show_fitstats) {
          cache_request("/markets/prices").done(function () {
            selected_element.html(format_fitstats(dna));
          });
        }
        selected_element.attr("state", "done");
      });
    // generic expansion of simple expressions
    $("eveui:not([type])")
      .filter(":not([state])")
      .each(function () {
        let selected_element = $(this);
        let key = selected_element.attr("key");
        selected_element.attr("state", "loading");
        cache_request(key).done(function () {
          let result = cache_retrieve(key);
          $.each(
            selected_element.attr("path").split(","),
            function (index, path) {
              let value = object_value(result, path);
              if (value) {
                selected_element.html(value);
                selected_element.attr("state", "done");
                return false;
              }
            }
          );
        });
      });
  }

  function lazy_preload() {
    // preload timer function
    preload_timer = setTimeout(lazy_preload, 5000);
    if (requests_pending > 0) {
      return;
    }
    if (preload_quota > 0) {
      $(eveui_fit_selector)
        .not("[data-eveui-cached]")
        .each(function (i) {
          let elem = $(this);
          let dna =
            elem.data("dna") || this.href.substring(this.href.indexOf(":") + 1);
          let promise = cache_items(dna);
          // skip if already cached
          if (promise.state() === "resolved") {
            elem.attr("data-eveui-cached", 1);
          } else {
            preload_quota--;
            promise.done(function () {
              clearTimeout(preload_timer);
              preload_timer = setTimeout(lazy_preload, eveui_preload_interval);
            });
            return false;
          }
        });
    }
  }

  function object_value(object, path) {
    let value = object;
    $.each(path.split("."), function (index, key) {
      value = value[key];
    });
    return value;
  }

  function ajax(settings) {
    let my_settings = {
      headers: {
        "Accept-Language": eveui_accept_language,
      },
      data: {
        user_agent: eveui_user_agent,
      },
    };
    $.extend(true, my_settings, settings);
    return $.ajax(my_settings);
  }

  function cache_items(dna) {
    // caches all items required to process the specified fit
    let pending = [];
    let items = dna.split(":");
    for (let item in items) {
      if (items[item].length === 0) {
        continue;
      }
      let match = items[item].split(";");
      let item_id = match[0];
      if (item_id.endsWith("_")) {
        item_id = item_id.slice(0, -1);
      }
      pending.push(cache_request("/universe/types/" + item_id));
    }
    return $.when.apply(null, pending);
  }

  function cache_request(key) {
    let url;
    let jsonp = false;
    let custom_cache =
      key.startsWith("/universe/types") ||
      key.startsWith("/dogma/attributes");
    url = eveui_esi_endpoint(key + "/");
    key = (eveui_accept_language || navigator.languages[0]) + key;
    let dataType = jsonp ? "jsonp" : "json";
    if (typeof eveui.cache[key] === "object") {
      if (typeof eveui.cache[key].promise === "function") {
        // item is pending, return the existing deferred object
        return eveui.cache[key];
      } else {
        // if item is already cached, we can return a resolved promise
        return $.Deferred().resolve();
      }
    }
    if (errors_lastminute > 50) {
      return $.Deferred().reject();
    }
    requests_pending++;
    return (eveui.cache[key] = ajax({
      url: url,
      dataType: dataType,
      cache: !custom_cache,
    })
      .done(function (data) {
        data.path = key;
        // store data in session cache
        eveui.cache[key] = data;
        if (db) {
          // indexedDB is ready
          // only manually cache keypaths where the data doesn't change until the server version changes
          if (custom_cache) {
            let tx = db.transaction("cache", "readwrite");
            let store = tx.objectStore("cache");
            store.put(data);
          }
        }
      })
      .fail((xhr) => {
        // on a transient failed request, allow retry attempt on the same request after 10s
        if (xhr.status >= 500) {
          setTimeout(function () {
            delete eveui.cache[key];
          }, 10000);
        }
        // increment error count, decrement 1 minute later
        errors_lastminute++;
        if (errors_lastminute == 50) {
          mark("too many errors in last 60s");
        }
        setTimeout(function () {
          errors_lastminute--;
        }, 60000);
      })
      .always(function () {
        requests_pending--;
      }));
  }

  function cache_retrieve(key) {
    key = (eveui_accept_language || navigator.languages[0]) + key;
    return eveui.cache[key];
  }

  function market_retrieve(type_id) {
    return $.grep(cache_retrieve("/markets/prices"), function (v) {
      return v["type_id"] == type_id;
    })[0];
  }

  function clipboard_copy(element) {
    // copy the contents of selected element to clipboard
    // while excluding any elements with 'nocopy' class
    // and including otherwise-invisible elements with 'copyonly' class
    $(".nocopy").hide();
    $(".copyonly").show();
    let selection = window.getSelection();
    let range = document.createRange();
    if (element.find(".eveui_startcopy").length) {
      range.setStart(element.find(".eveui_startcopy")[0], 0);
      range.setEnd(element.find(".eveui_endcopy")[0], 0);
    } else {
      range.selectNodeContents(element[0]);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("copy");
    selection.removeAllRanges();
    $(".nocopy").show();
    $(".copyonly").hide();
  }
  mark("script end");
})(eveui || (eveui = {}));