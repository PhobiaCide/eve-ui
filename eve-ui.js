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
    return str.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, char => char.toUpperCase());
  }

  static async getImgHref(id, size) {
    try {
      const response = await fetchData(eveui_esi_endpoint(`/universe/names/`), "POST", [id]);
      console.log(response);
    } catch (error) {
      console.error("Error fetching image href:", error);
    }
  }

  static formatNumber(num, units = "") {
    if (isNaN(num)) return "n/a";

    let suffix = "";
    if (num >= 1_000_000_000) {
      suffix = "B";
      num /= 1_000_000_000;
    } else if (num >= 1_000_000) {
      suffix = "M";
      num /= 1_000_000;
    } else if (num >= 1_000) {
      suffix = "K";
      num /= 1_000;
    }

    return `${Number.isInteger(num) ? num.toFixed(0) : num.toFixed(2)} ${suffix} ${units}`.trim();
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
        fetchData({
          url: eveui_esi_endpoint(`/search`),
          cache: true,
          data: {
            search: e.target.value,
            categories: "inventorytype",
          },
        }).then(data => {
          if (!data.inventorytype) return;

          // Get names for required item ids
          fetchData({
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
  document.addEventListener("click", (e) => {
    if (e.target.closest(".eveui_itemselect, .eveui_more_icon")) return;
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
  document.addEventListener("mousedown", (e) => {
    if (!e.target.matches(".eveui_title")) return;
  
    e.preventDefault();
    drag_element = e.target.closest(".eveui_window");
    drag_element_x = e.clientX - drag_element.offsetLeft;
    drag_element_y = e.clientY - drag_element.offsetTop;
    drag_element.style.zIndex = current_zindex++;
  });
  
  document.addEventListener("mousemove", function (e) {
    mouse_x = e.clientX;
    mouse_y = e.clientY;

    if (drag_element === null) {
      return;
    }

    drag_element.style.left = (mouse_x - drag_element_x) + "px";
    drag_element.style.top = (mouse_y - drag_element_y) + "px";
  });
  document.addEventListener("mouseup", function () {
    drag_element = null;
  });
  window.addEventListener("resize", function () {
    // Resize handler to keep windows on screen
    document.querySelectorAll(".eveui_window").forEach(eveui_window => {
      let eveui_content = eveui_window.querySelector(".eveui_content");

      if (eveui_content.clientHeight > window.innerHeight - 50) {
        eveui_window.style.height = (window.innerHeight - 50) + "px";
      } else {
        eveui_window.style.height = "";
      }

      if (eveui_content.clientWidth > window.innerWidth - 40) {
        eveui_window.style.width = (window.innerWidth - 40) + "px";
      } else {
        eveui_window.style.width = "";
      }

      let rect = eveui_window.getBoundingClientRect();

      if (rect.bottom > window.innerHeight) {
        eveui_window.style.top = (window.innerHeight - eveui_window.clientHeight - 25) + "px";
      }

      if (rect.right > window.innerWidth) {
        eveui_window.style.left = (window.innerWidth - eveui_window.clientWidth - 10) + "px";
      }
    });

    if (eveui_mode === "modal") {
      let eveui_window = document.querySelector("[data-eveui-modal]");
      if (eveui_window) {
        eveui_window.style.top = (window.innerHeight / 2 - eveui_window.clientHeight / 2) + "px";
        eveui_window.style.left = (window.innerWidth / 2 - eveui_window.clientWidth / 2) + "px";
      }
    }
  });
  mark("event handlers set");
  function eve_version_query() {
    mark("eve version request");
  
    fetchData({
      url: eveui_esi_endpoint(`/status/`),
      dataType: "json",
      cache: true,
    })
      .then(function (data) {
        eve_version = data.server_version;
        mark("eve version response " + eve_version);
  
        if (window.indexedDB) {
          // indexedDB is available
          let open = indexedDB.open("eveui", eve_version);
  
          open.onupgradeneeded = function () {
            let db = open.result;
            if (db.objectStoreNames.contains("cache")) {
              db.deleteObjectStore("cache");
            }
            db.createObjectStore("cache", { keyPath: "path" });
          };
  
          open.onsuccess = function () {
            let db = open.result;
            let tx = db.transaction("cache", "readonly");
            let store = tx.objectStore("cache");
  
            store.getAll().onsuccess = function (e) {
              e.target.result.forEach(value => {
                eveui.cache[value.path] = value;
              });
  
              document.addEventListener("DOMContentLoaded", eveui_document_ready);
            };
          };
        } else {
          // indexedDB not available
          document.addEventListener("DOMContentLoaded", eveui_document_ready);
        }
  
        setInterval(autoexpand, 100);
      })
      .catch(function () {
        mark("eve version request failed");
        setTimeout(eve_version_query, 10000);
      });
  }
  eve_version_query();
  function eveui_document_ready() {
    // Expand fits where applicable
    mark("expanding fits");
    expand();
    cache_request("/markets/prices");
  
    // Start preload timer
    preload_timer = setTimeout(lazy_preload, eveui_preload_interval);
    mark("preload timer set");
  }
  function new_window(title = "&nbsp;") {
    let eveui_window = document.createElement("article");
    eveui_window.className = "eveui_window card shadow";
    eveui_window.innerHTML = `
      <header class="eveui_title card-header">
        <h4>${title}</h4>
      </header>
      <span class="eveui_icon eveui_close_icon"></span>
      <span class="eveui_scrollable">
        <span class="eveui_content">
          <span class="border-spinner"></span>
          Loading...
        </span>
      </span>
    `;
  
    if (eveui_mode === "modal" && !document.querySelector(".eveui_modal_overlay")) {
      let modalOverlay = document.createElement("div");
      modalOverlay.className = "eveui_modal_overlay";
      document.body.appendChild(modalOverlay);
      eveui_window.setAttribute("data-eveui-modal", "1");
    }
  
    eveui_window.style.zIndex = current_zindex++;
    eveui_window.style.left = (mouse_x + 10) + "px";
    eveui_window.style.top = (mouse_y - 10) + "px";
  
    return eveui_window;
  }
  function mark(mark) {
    // Log script time with annotation for performance metric
    console.log("eveui: " + performance.now().toFixed(3) + " " + mark);
  }
  function format_fit(dna, eveui_name) {
    // Generates HTML for a fit display
    let high_slots = {}, med_slots = {}, low_slots = {}, rig_slots = {};
    let subsystem_slots = {}, other_slots = {}, cargo_slots = {};
    let items = dna.split(":");
  
    // Ship name and number of slots
    let ship_id = parseInt(items.shift(), 10);
    let ship = cache_retrieve("/universe/types/" + ship_id);
    ship.hiSlots = 0;
    ship.medSlots = 0;
    ship.lowSlots = 0;
  
    ship.dogma_attributes.forEach(attr => {
      switch (attr.attribute_id) {
        case 14: ship.hiSlots = attr.value; break;
        case 13: ship.medSlots = attr.value; break;
        case 12: ship.lowSlots = attr.value; break;
        case 1137: ship.rigSlots = attr.value; break;
        case 1367: ship.maxSubSystems = attr.value; break;
      }
    });
  
    // Categorize items into slots
    for (let item of items) {
      if (!item.length) continue;
  
      let [item_id, quantity] = item.split(";");
      quantity = parseInt(quantity, 10);
  
      if (item_id.endsWith("_")) {
        cargo_slots[item_id.slice(0, -1)] = quantity;
        continue;
      }
  
      let itemData = cache_retrieve("/universe/types/" + item_id);
      
      let categorized = false;
      itemData.dogma_attributes.forEach(attr => {
        if (attr.attribute_id === 1272) {
          other_slots[item_id] = quantity;
          categorized = true;
        } else {
          switch (attr.attribute_id) {
            case 1374: ship.hiSlots += attr.value; break;
            case 1375: ship.medSlots += attr.value; break;
            case 1376: ship.lowSlots += attr.value; break;
          }
        }
      });
  
      if (categorized) continue;
  
      itemData.dogma_effects.forEach(effect => {
        switch (effect.effect_id) {
          case 12: high_slots[item_id] = quantity; break;
          case 13: med_slots[item_id] = quantity; break;
          case 11: low_slots[item_id] = quantity; break;
          case 2663: rig_slots[item_id] = quantity; break;
          case 3772: subsystem_slots[item_id] = quantity; break;
          default: cargo_slots[item_id] = quantity;
        }
      });
    }
  
    function item_rows(fittings, slots_available) {
      let html = "";
      let slots_used = 0;
  
      for (let item_id in fittings) {
        let item = cache_retrieve("/universe/types/" + item_id);
        slots_used += fittings[item_id];
  
        html += `<tr class="copy_only"><td>${item.name} x${fittings[item_id]}<br></td></tr>`;
        html += `<tr class="nocopy" data-eveui-itemid="${item_id}">
            <td><img src="${eveui_imageserver("types/" + item_id + "/icon?size=64")}" class="eveui_icon eveui_item_icon"></td>
            <td class="eveui_right">${fittings[item_id]}</td>
            <td colspan="2"><div class="eveui_rowcontent">${item.name}</div></td>
            <td class="eveui_right whitespace_nowrap">
              <span data-itemid="${item_id}" class="eveui_icon eveui_info_icon"></span>
              <span class="eveui_icon eveui_plus_icon eveui_edit"></span>
              <span class="eveui_icon eveui_minus_icon eveui_edit"></span>
              <span class="eveui_icon eveui_more_icon eveui_edit"></span>
            </td>
          </tr>`;
      }
  
      if (typeof slots_available !== "undefined") {
        if (slots_available > slots_used) {
          html += `<tr class="nocopy">
            <td class="eveui_icon eveui_item_icon"></td>
            <td class="eveui_right whitespace_nowrap">${slots_available - slots_used}</td>
            <td colspan="2"><div class="eveui_rowcontent">Empty</div></td>
            <td class="eveui_right"><span class="eveui_icon eveui_more_icon eveui_edit"></span></td>
          </tr>`;
        }
        if (slots_used > slots_available) {
          html += `<tr class="nocopy">
            <td class="eveui_icon eveui_item_icon"></td>
            <td class="eveui_right">${slots_available - slots_used}</td>
            <td><div class="eveui_rowcontent">Excess</div></td>
          </tr>`;
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
              <img src="${eveui_imageserver("types/" + ship_id + "/render?size=512")}" class="eveui_icon eveui_ship_icon">
            </td>
            <td>
              <div class="eveui_rowcontent">
                <span class="eveui_startcopy"></span>
                [
                <a target="_blank" href="${eveui_urlify(dna)}">
                  ${ship.name}, ${eveui_name || ship.name}
                </a>
                ]
                <br>
              </div>
            </td>
            <td class="eveui_right whitespace_nowrap nocopy" colspan="2">
              ${eveui_allow_edit ? '<span class="eveui_icon eveui_edit_icon"></span>' : ""}
              <span class="eveui_icon eveui_copy_icon"></span>
              <span data-itemid="${ship_id}" class="eveui_icon eveui_info_icon"></span>
              <span class="eveui_icon eveui_edit"></span>
              <span class="eveui_icon eveui_more_icon eveui_edit"></span>
            </td>
          </tr>
        </thead>
        <tbody class="whitespace_nowrap">
          ${item_rows(high_slots, ship.hiSlots)}
          <tr><td class="eveui_line_spacer">&nbsp;${item_rows(med_slots, ship.medSlots)}</td></tr>
          <tr><td class="eveui_line_spacer">&nbsp;${item_rows(low_slots, ship.lowSlots)}</td></tr>
          <tr><td class="eveui_line_spacer">&nbsp;${item_rows(rig_slots, ship.rigSlots)}</td></tr>
          <tr><td class="eveui_line_spacer">&nbsp;${item_rows(subsystem_slots, ship.maxSubSystems)}</td></tr>
          <tr><td class="eveui_line_spacer">&nbsp;${item_rows(other_slots)}</td></tr>
          <tr><td class="eveui_line_spacer">&nbsp;${item_rows(cargo_slots)}</td></tr>
        </tbody>
      </table>
      <span class="eveui_endcopy"></span>`;
  
    return html;
  }
  eveui.format_fit = format_fit;
  function fit_window(dna, eveui_name) {
    // Creates and populates a fit window
    let eveui_window = new_window("Fit");
    eveui_window.classList.add("fit_window");
    eveui_window.setAttribute("data-eveui-dna", dna);
    document.body.appendChild(eveui_window);
    window.dispatchEvent(new Event("resize"));
  
    // Load required items and set callback to display
    mark("fit window created");
  
    cache_items(dna)
      .then(() => {
        let content = eveui_window.querySelector(".eveui_content");
        if (content) {
          content.innerHTML = format_fit(dna, eveui_name);
        }
        window.dispatchEvent(new Event("resize"));
        mark("fit window populated");
      })
      .catch(() => {
        eveui_window.remove();
      });
  
    return eveui_window;
  }
  eveui.fit_window = fit_window;
  function format_item(item_id) {
    let item = cache_retrieve("/universe/types/" + item_id);
    let marketData = market_retrieve(item_id);
    
    let html = `
      <div class="card">
        <header class="card-header">
          <figure class="figure">
            <figcaption class="figure-caption">
              <h3>${item.name}</h3>
            </figcaption>
            <img src="${eveui_imageserver("types/" + item_id + "/render?size=512")}" class="figure-img img-fluid rounded" />
          </figure>
          <dl>
            <dt>Estimated price</dt>
            <dd class="text-end">Ƶ${format_number(marketData.average_price)}</dd>
          </dl>
        </header>
        <div class="card-body text-wrap">
          ${item.description}
          <header>Attributes</header>
          <dl>`;
  
    item.dogma_attributes.forEach(attr => {
      html += `
        <dt>
          <eveui key="/dogma/attributes/${attr.attribute_id}" path="display_name,name">
            attribute:${attr.attribute_id}
          </eveui>
        </dt>
        <dd class="text-end border-bottom">
          ${format_number(attr.value)}
        </dd>`;
    });
  
    html += `</dl></div></div>`;
    return html;
  }
  eveui.format_item = format_item;
  function item_window(item_id) {
    // Creates and populates an item window
    let eveui_window = new_window("Item");
    eveui_window.setAttribute("data-eveui-itemid", item_id);
    eveui_window.classList.add("item_window");
  
    switch (eveui_mode) {
      default:
        document.body.appendChild(eveui_window);
        break;
    }
  
    mark("item window created");
  
    // Load required items and set callback to display
    cache_request("/universe/types/" + item_id)
      .then(() => {
        let content = eveui_window.querySelector(".eveui_content");
        if (content) {
          content.innerHTML = format_item(item_id);
        }
        window.dispatchEvent(new Event("resize"));
        mark("item window populated");
      })
      .catch(() => {
        eveui_window.remove();
      });
  
    window.dispatchEvent(new Event("resize"));
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
        <img src="${eveui_imageserver("characters/" + char_id + "/portrait?size=512")}" 
             class="img-fluid img-rounded figure-img"/>
      </figure>
      <hr />
      <table class="table table-hover table-borderless">
        <thead>
          <tr>
            <th>Member of</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="1">
              <figure class="figure">
                <figcaption class="figure-caption">
                  <a href="corp:${character.corporation_id}">
                    <eveui key="/corporations/${character.corporation_id}" path="name">
                      ${character.corporation_id}
                    </eveui>
                  </a>
                </figcaption>
                <img class="border figure-img img-fluid rounded" 
                     src="${eveui_imageserver("corporations/" + character.corporation_id + "/logo?size=128")}" 
                     height="96" width="96" />
              </figure>
            </td>
          </tr>
          <tr>
            <td colspan="1" style="text-align: right;">Bio:&nbsp;</td>
            <td style="text-align: left;">
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
    eveui_window.setAttribute("data-eveui-charid", char_id);
    eveui_window.classList.add("char_window");
  
    switch (eveui_mode) {
      default:
        document.body.appendChild(eveui_window);
        break;
    }
  
    mark("char window created");
  
    // Load required characters and set callback to display
    cache_request("/characters/" + char_id)
      .then(() => {
        let content = eveui_window.querySelector(".eveui_content");
        if (content) {
          content.innerHTML = format_char(char_id);
        }
        window.dispatchEvent(new Event("resize"));
        mark("char window populated");
      })
      .catch(() => {
        eveui_window.remove();
      });
  
    window.dispatchEvent(new Event("resize"));
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
          <img src="${eveui_imageserver("corporations/" + corp_id + "/logo?size=256")}" 
               class="img-fluid border rounded figure-img"/>
          <hr />
        </figure>
        <table class="table">
          <tr>
            <td>
              <img class="float_left" 
                   src="${eveui_imageserver("alliances/" + corporation.alliance_id + "/logo?size=128")}" 
                   height="128" width="128" />
              Member of
              <eveui key="/alliances/${corporation.alliance_id}" path="name">
                ${corporation.alliance_id}
              </eveui>
            </td>
          </tr>
          <tr>
            <td>Bio:</td>
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
    eveui_window.setAttribute("data-eveui-corpid", corp_id);
    eveui_window.classList.add("corp_window");
  
    switch (eveui_mode) {
      default:
        document.body.appendChild(eveui_window);
        break;
    }
  
    mark("corp window created");
  
    // Load required corps and set callback to display
    cache_request("/corporations/" + corp_id)
      .then(() => {
        let content = eveui_window.querySelector(".eveui_content");
        if (content) {
          content.innerHTML = format_corp(corp_id);
        }
        window.dispatchEvent(new Event("resize"));
        mark("corp window populated");
      })
      .catch(() => {
        eveui_window.remove();
      });
  
    window.dispatchEvent(new Event("resize"));
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
    let market_prices = cache_retrieve("/markets/prices");
  
    for (let item of items) {
      if (item.length === 0) {
        continue;
      }
  
      let match = item.split(";");
      let item_id = match[0];
      let quantity = parseInt(match[1], 10) || 1;
  
      let price_entry = market_prices.find(v => v.type_id == item_id);
      if (price_entry) {
        total_price += price_entry.average_price * quantity;
      }
    }
  
    return total_price;
  }
  function calculate_gun_dps(dna) {
    let total_dps = 0;
    let items = dna.replace(/:+$/, "").split(":");
  
    for (let itemStr of items) {
      let [item_id, quantity] = itemStr.split(";");
      quantity = parseInt(quantity, 10) || 1;
  
      let item = cache_retrieve("/universe/types/" + item_id);
      let attr = {};
  
      for (let attribute of item.dogma_attributes) {
        attr[attribute.attribute_id] = attribute.value;
      }
  
      let groups = {
        53: "energy",
        55: "projectile",
        74: "hybrid",
      };
  
      if (groups[item.group_id]) {
        let base_dmg = 0;
        let base_dmg_mult = attr[64];
        let base_rof = attr[51] / 1000;
        let dmg_mult = [];
        let rof_mult = [];
        let ammo_groups = {
          [attr[604]]: 1,
          [attr[605]]: 1,
        };
  
        // Check all items for any relevant modifiers
        for (let innerItemStr of items) {
          let [inner_item_id, inner_quantity] = innerItemStr.split(";");
          inner_quantity = parseInt(inner_quantity, 10) || 1;
  
          let inner_item = cache_retrieve("/universe/types/" + inner_item_id);
          let inner_attr = {};
  
          for (let attribute of inner_item.dogma_attributes) {
            inner_attr[attribute.attribute_id] = attribute.value;
          }
  
          // Find highest damage ammo
          if (inner_item.group_id in ammo_groups) {
            let total_dmg = (inner_attr[114] || 0) +
                            (inner_attr[116] || 0) +
                            (inner_attr[117] || 0) +
                            (inner_attr[118] || 0);
            if (total_dmg > base_dmg) {
              base_dmg = total_dmg;
            }
          }
  
          // Rate of fire (RoF) modifiers
          if (204 in inner_attr) {
            for (let k = 0; k < inner_quantity; k++) {
              rof_mult.push(inner_attr[204]);
            }
          }
  
          // Damage multipliers
          if (inner_item.group_id === 302 && 64 in inner_attr) {
            for (let k = 0; k < inner_quantity; k++) {
              dmg_mult.push(inner_attr[64]);
            }
          }
        }
  
        // Apply skill bonuses (assuming level 5 skills)
        base_rof *= 0.9;  // Gunnery
        base_rof *= 0.8;  // Rapid firing
  
        rof_mult.sort((a, b) => a - b);
        for (let i = 0; i < rof_mult.length; i++) {
          base_rof *= 1 - (1 - rof_mult[i]) * stacking[i];
        }
  
        base_dmg_mult *= 1.15;  // Surgical Strike
        base_dmg_mult *= 1.25;  // Turret Skill
        base_dmg_mult *= 1.1;   // Turret Spec (TODO: Only for T2 weapons)
        base_dmg_mult *= 1.375; // Ship Skill (TODO: Actual ship skill calculations)
  
        dmg_mult.sort((a, b) => b - a);
        for (let i = 0; i < dmg_mult.length; i++) {
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
    if (num >= 1_000_000_000) {
      suffix = "B";
      num /= 1_000_000_000;
    } else if (num >= 1_000_000) {
      suffix = "M";
      num /= 1_000_000;
    } else if (num >= 1_000) {
      suffix = "K";
      num /= 1_000;
    }
  
    // Format to remove .00 if whole number
    const formattedNum = Number.isInteger(num) ? num.toFixed(0) : num.toFixed(2);
  
    return `${formattedNum} ${suffix} ${units}`.trim();
  }
  function formatMoney(num) {
    return `Ƶ ${format_number(num)}`;
  }
  function expand() {
    // Expands anything marked for expansion or all if in expand_all mode
    autoexpand();
  
    let expand_filter = "[data-eveui-expand]";
    if (eveui_mode === "expand_all") {
      expand_filter = "*";
    }
  
    document.querySelectorAll(eveui_fit_selector)
      .forEach(element => {
        if (element.closest(".eveui_content")) return; // Prevent infinite loops
  
        let dna = element.getAttribute("data-dna") || element.href.substring(element.href.indexOf(":") + 1);
  
        cache_items(dna).then(() => {
          let eveui_name = element.textContent.trim();
          let eveui_content = document.createElement("span");
          eveui_content.className = "eveui_content eveui_fit";
          eveui_content.setAttribute("data-eveui-dna", dna);
          eveui_content.innerHTML = format_fit(dna, eveui_name);
  
          element.replaceWith(eveui_content);
          mark("fit window expanded");
        });
      });
  
    document.querySelectorAll(eveui_item_selector)
      .forEach(element => {
        if (element.closest(".eveui_content")) return; // Prevent infinite loops
  
        let item_id = element.getAttribute("data-itemid") || element.href.substring(element.href.indexOf(":") + 1);
  
        cache_request("/universe/types/" + item_id).then(() => {
          let eveui_content = document.createElement("span");
          eveui_content.className = "eveui_content eveui_item";
          eveui_content.innerHTML = format_item(item_id);
  
          element.replaceWith(eveui_content);
          mark("item window expanded");
        });
      });
  
    document.querySelectorAll(eveui_char_selector)
      .forEach(element => {
        if (element.closest(".eveui_content")) return; // Prevent infinite loops
  
        let char_id = element.getAttribute("data-charid") || element.href.substring(element.href.indexOf(":") + 1);
  
        cache_request("/characters/" + char_id).then(() => {
          let eveui_content = document.createElement("span");
          eveui_content.className = "eveui_content eveui_char";
          eveui_content.innerHTML = format_char(char_id);
  
          element.replaceWith(eveui_content);
          mark("char window expanded");
        });
      });
  }
  eveui.expand = expand;
  function autoexpand() {
    // Expands elements that require expansion even when not in expand mode
  
    document.querySelectorAll("eveui[type=fit_stats]:not([state])").forEach(element => {
      let dna = element.getAttribute("key");
  
      if (eveui_show_fitstats) {
        cache_request("/markets/prices").then(() => {
          element.innerHTML = format_fitstats(dna);
        });
      }
  
      element.setAttribute("state", "done");
    });
  
    // Generic expansion of simple expressions
    document.querySelectorAll("eveui:not([type]):not([state])").forEach(element => {
      let key = element.getAttribute("key");
      element.setAttribute("state", "loading");
  
      cache_request(key).then(() => {
        let result = cache_retrieve(key);
        let paths = element.getAttribute("path").split(",");
  
        for (let path of paths) {
          let value = object_value(result, path);
          if (value) {
            element.innerHTML = value;
            element.setAttribute("state", "done");
            break;
          }
        }
      });
    });
  }
  function lazy_preload() {
    // Preload timer function
    preload_timer = setTimeout(lazy_preload, 5000);
  
    if (requests_pending > 0) {
      return;
    }
  
    if (preload_quota > 0) {
      document.querySelectorAll(eveui_fit_selector + ":not([data-eveui-cached])").forEach(elem => {
        let dna = elem.dataset.dna || elem.href.substring(elem.href.indexOf(":") + 1);
        let promise = cache_items(dna);
  
        // Skip if already cached
        if (promise.state && promise.state() === "resolved") {
          elem.setAttribute("data-eveui-cached", "1");
        } else {
          preload_quota--;
          promise.then(() => {
            clearTimeout(preload_timer);
            preload_timer = setTimeout(lazy_preload, eveui_preload_interval);
          });
          return;
        }
      });
    }
  }
  function object_value(object, path) {
    return path.split(".").reduce((value, key) => value?.[key], object);
  }
  const fetchData = async (url, method = "GET", data = null) => {
    const headers = {
      "Accept-Language": eveui_accept_language,
      "Content-Type": "application/json",
    };
  
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);
  
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
  };
  function cache_items(dna) {
    // Caches all items required to process the specified fit
    let pending = [];
    let items = dna.split(":");
  
    for (let item of items) {
      if (item.length === 0) {
        continue;
      }
  
      let match = item.split(";");
      let item_id = match[0];
  
      if (item_id.endsWith("_")) {
        item_id = item_id.slice(0, -1);
      }
  
      pending.push(cache_request("/universe/types/" + item_id));
    }
  
    return Promise.all(pending);
  }
  const cache_request = async (key) => {
    const url = eveui_esi_endpoint(`${key}/`);
    if (eveui.cache[key]) return eveui.cache[key];
  
    try {
      const data = await fetchData(url);
      eveui.cache[key] = data;
      return data;
    } catch (error) {
      console.error(`Error caching ${key}:`, error);
      throw error;
    }
  };
  function cache_retrieve(key) {
    let localizedKey = (eveui_accept_language || navigator.languages[0]) + key;
    return eveui.cache[localizedKey];
  }
  function market_retrieve(type_id) {
    let marketPrices = cache_retrieve("/markets/prices");
    return marketPrices.find(v => v.type_id == type_id) || null;
  }
  function clipboard_copy(element) {
    // Copy the contents of the selected element to the clipboard,
    // excluding elements with 'nocopy' and including 'copyonly'.
  
    document.querySelectorAll(".nocopy").forEach(el => el.style.display = "none");
    document.querySelectorAll(".copyonly").forEach(el => el.style.display = "block");
  
    let selection = window.getSelection();
    let range = document.createRange();
  
    let startCopy = element.querySelector(".eveui_startcopy");
    let endCopy = element.querySelector(".eveui_endcopy");
  
    if (startCopy && endCopy) {
      range.setStart(startCopy, 0);
      range.setEnd(endCopy, 0);
    } else {
      range.selectNodeContents(element);
    }
  
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("copy");
    selection.removeAllRanges();
  
    document.querySelectorAll(".nocopy").forEach(el => el.style.display = "");
    document.querySelectorAll(".copyonly").forEach(el => el.style.display = "none");
  }
  class EveUI {
    static expand() {
      // Expands anything marked for expansion or all if in expand_all mode
      autoexpand();
    
      let expand_filter = "[data-eveui-expand]";
      if (eveui_mode === "expand_all") {
        expand_filter = "*";
      }
    
      document.querySelectorAll(eveui_fit_selector)
        .forEach(element => {
          if (element.closest(".eveui_content")) return; // Prevent infinite loops
    
          let dna = element.getAttribute("data-dna") || element.href.substring(element.href.indexOf(":") + 1);
    
          cache_items(dna).then(() => {
            let eveui_name = element.textContent.trim();
            let eveui_content = document.createElement("span");
            eveui_content.className = "eveui_content eveui_fit";
            eveui_content.setAttribute("data-eveui-dna", dna);
            eveui_content.innerHTML = format_fit(dna, eveui_name);
    
            element.replaceWith(eveui_content);
            mark("fit window expanded");
          });
        });
    
      document.querySelectorAll(eveui_item_selector)
        .forEach(element => {
          if (element.closest(".eveui_content")) return; // Prevent infinite loops
    
          let item_id = element.getAttribute("data-itemid") || element.href.substring(element.href.indexOf(":") + 1);
    
          cache_request("/universe/types/" + item_id).then(() => {
            let eveui_content = document.createElement("span");
            eveui_content.className = "eveui_content eveui_item";
            eveui_content.innerHTML = format_item(item_id);
    
            element.replaceWith(eveui_content);
            mark("item window expanded");
          });
        });
    
      document.querySelectorAll(eveui_char_selector)
        .forEach(element => {
          if (element.closest(".eveui_content")) return; // Prevent infinite loops
    
          let char_id = element.getAttribute("data-charid") || element.href.substring(element.href.indexOf(":") + 1);
    
          cache_request("/characters/" + char_id).then(() => {
            let eveui_content = document.createElement("span");
            eveui_content.className = "eveui_content eveui_char";
            eveui_content.innerHTML = format_char(char_id);
    
            element.replaceWith(eveui_content);
            mark("char window expanded");
          });
        });
    }
    static format_fitstats(dna) {
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
    static corp_window(corp_id) {
      let eveui_window = new_window("Corporation");
      eveui_window.setAttribute("data-eveui-corpid", corp_id);
      eveui_window.classList.add("corp_window");
    
      switch (eveui_mode) {
        default:
          document.body.appendChild(eveui_window);
          break;
      }
    
      mark("corp window created");
    
      // Load required corps and set callback to display
      cache_request("/corporations/" + corp_id)
        .then(() => {
          let content = eveui_window.querySelector(".eveui_content");
          if (content) {
            content.innerHTML = format_corp(corp_id);
          }
          window.dispatchEvent(new Event("resize"));
          mark("corp window populated");
        })
        .catch(() => {
          eveui_window.remove();
        });
    
      window.dispatchEvent(new Event("resize"));
      return eveui_window;
    }
    static format_corp(corp_id) {
      let corporation = cache_retrieve("/corporations/" + corp_id);
    
      return `
        <div class="container-fluid">
          <figure class="figure">
            <figcaption class="figure-caption">
              <hr/>
              ${corporation.name}
              <hr />
            </figcaption>
            <img src="${eveui_imageserver("corporations/" + corp_id + "/logo?size=256")}" 
                 class="img-fluid border rounded figure-img"/>
            <hr />
          </figure>
          <table class="table">
            <tr>
              <td>
                <img class="float_left" 
                     src="${eveui_imageserver("alliances/" + corporation.alliance_id + "/logo?size=128")}" 
                     height="128" width="128" />
                Member of
                <eveui key="/alliances/${corporation.alliance_id}" path="name">
                  ${corporation.alliance_id}
                </eveui>
              </td>
            </tr>
            <tr>
              <td>Bio:</td>
              <td>
                ${corporation.description.replace(/<font[^>]+>/g, "<font>")}
              </td>
            </tr>
          </table>
        </div>`;
    }
    static char_window(char_id) {
      let eveui_window = new_window("Character");
      eveui_window.setAttribute("data-eveui-charid", char_id);
      eveui_window.classList.add("char_window");
    
      switch (eveui_mode) {
        default:
          document.body.appendChild(eveui_window);
          break;
      }
    
      mark("char window created");
    
      // Load required characters and set callback to display
      cache_request("/characters/" + char_id)
        .then(() => {
          let content = eveui_window.querySelector(".eveui_content");
          if (content) {
            content.innerHTML = format_char(char_id);
          }
          window.dispatchEvent(new Event("resize"));
          mark("char window populated");
        })
        .catch(() => {
          eveui_window.remove();
        });
    
      window.dispatchEvent(new Event("resize"));
      return eveui_window;
    }
  }
  mark("script end");
})(eveui || (eveui = {}));