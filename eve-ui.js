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
const eveui_item_selector = `[href^="item:"],[data-itemid]`;
const eveui_char_selector = `[href^="char:"],[data-charid]`;
const eveui_corp_selector = `[href^="corp:"],[data-corpid]`;
const eveui_esi_endpoint = path => `https://esi.evetech.net${path}`;
const eveui_urlify = dna => `fitting:${encodeURI(dna)}`;
const eveui_imageserver = image_ref =>
  `https://images.evetech.net/${encodeURI(image_ref)}`;

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
  $(document).on("click", ".eveui_window .eveui_close_icon", function (e) {
    $(this).parent().remove();
    if ($(".eveui_window").length === 0) {
      $(".eveui_modal_overlay").remove();
    }
  });
  $(document).on("click", ".eveui_modal_overlay", function (e) {
    $(".eveui_window").remove();
    $(this).remove();
  });
  $(document).on("click", eveui_fit_selector, function (e) {
    e.preventDefault();
    preload_quota = eveui_preload_initial;
    // hide window if it already exists
    if (this.eveui_window && document.contains(this.eveui_window[0])) {
      this.eveui_window.remove();
      return;
    }
    let dna =
      $(this).attr("data-dna") ||
      this.href.substring(this.href.indexOf(":") + 1);
    let eveui_name = $(this).attr("data-title") || $(this).text().trim();
    switch (eveui_mode) {
      case "expand":
      case "expand_all":
        $(this).attr("data-eveui-expand", 1);
        expand();
        break;
      default:
        this.eveui_window = fit_window(dna, eveui_name);
        break;
    }
  });
  $(document).on("click", eveui_item_selector, function (e) {
    e.preventDefault();
    // hide window if it already exists
    if (this.eveui_window && document.contains(this.eveui_window[0])) {
      this.eveui_window.remove();
      return;
    }
    let item_id =
      $(this).attr("data-itemid") ||
      this.href.substring(this.href.indexOf(":") + 1);
    // create loading placeholder
    switch (eveui_mode) {
      case "expand":
      case "expand_all":
        $(this).attr("data-eveui-expand", 1);
        expand();
        break;
      default:
        this.eveui_window = item_window(item_id);
        break;
    }
  });
  $(document).on("click", eveui_char_selector, function (e) {
    e.preventDefault();
    // hide window if it already exists
    if (this.eveui_window && document.contains(this.eveui_window[0])) {
      this.eveui_window.remove();
      return;
    }
    let char_id =
      $(this).attr("data-charid") ||
      this.href.substring(this.href.indexOf(":") + 1);
    // create loading placeholder
    switch (eveui_mode) {
      case "expand":
      case "expand_all":
        $(this).attr("data-eveui-expand", 1);
        expand();
        break;
      default:
        this.eveui_window = char_window(char_id);
        break;
    }
  });
  $(document).on("click", eveui_corp_selector, function (e) {
    e.preventDefault();
    // hide window if it already exists
    if (this.eveui_window && document.contains(this.eveui_window[0])) {
      this.eveui_window.remove();
      return;
    }
    let corp_id =
      $(this).attr("data-corpid") ||
      this.href.substring(this.href.indexOf(":") + 1);
    // create loading placeholder
    switch (eveui_mode) {
      case "expand":
      case "expand_all":
        $(this).attr("data-eveui-expand", 1);
        expand();
        break;
      default:
        this.eveui_window = corp_window(corp_id);
        break;
    }
  });
  // info buttons, copy buttons, etc
  $(document).on("click", ".eveui_minus_icon", function (e) {
    e.preventDefault();
    let item_id = $(this)
      .closest("[data-eveui-itemid]")
      .attr("data-eveui-itemid");
    let dna = $(this).closest("[data-eveui-dna]").attr("data-eveui-dna");
    let re = new RegExp(":" + item_id + ";(\\d+)");
    let new_quantity = parseInt(dna.match(re)[1]) - 1;
    if (new_quantity > 0) {
      dna = dna.replace(re, ":" + item_id + ";" + new_quantity);
    } else {
      dna = dna.replace(re, "");
    }
    $(this).closest("[data-eveui-dna]").attr("data-eveui-dna", dna);
    cache_items(dna).done(function () {
      let eveui_window = $(`.eveui_window[data-eveui-dna="${dna}"]`);
      eveui_window.find(".eveui_content ").html(format_fit(dna));
      $(window).trigger("resize");
    });
  });
  $(document).on("click", ".eveui_plus_icon", function (e) {
    e.preventDefault();
    let item_id = $(this)
      .closest("[data-eveui-itemid]")
      .attr("data-eveui-itemid");
    let dna = $(this).closest("[data-eveui-dna]").attr("data-eveui-dna");
    let re = new RegExp(`:${item_id};(\\d+)`);
    let new_quantity = parseInt(dna.match(re)[1]) + 1;
    if (new_quantity > 0) {
      dna = dna.replace(re, `:${item_id};${new_quantity}`);
    } else {
      dna = dna.replace(re, "");
    }
    $(this).closest("[data-eveui-dna]").attr("data-eveui-dna", dna);
    cache_items(dna).done(function () {
      let eveui_window = $(`.eveui_window[data-eveui-dna="${dna}"]`);
      eveui_window.find(".eveui_content ").html(format_fit(dna));
      $(window).trigger("resize");
    });
  });
  $(document).on("click", ".eveui_edit_icon", function (e) {
    e.preventDefault();
    $(this).closest(".eveui_content").addClass("eveui_edit");
    $(this).remove();
  });
  $(document).on("click", ".eveui_more_icon", function (e) {
    e.preventDefault();
    let item_id = $(this)
      .closest("[data-eveui-itemid]")
      .attr("data-eveui-itemid");
    // hide window if it already exists
    if (this.eveui_itemselect && document.contains(this.eveui_itemselect[0])) {
      this.eveui_itemselect.remove();
      return;
    }
    $(".eveui_itemselect").remove();
    let eveui_itemselect = $(
      `<span class="eveui_itemselect"><input type="text" list="eveui_itemselect" placeholder="${$(
        this
      )
        .closest("[data-eveui-itemid]")
        .find(".eveui_rowcontent")
        .text()}" /><datalist id="eveui_itemselect" /></span>`
    );
    eveui_itemselect.css("z-index", current_zindex++);
    this.eveui_itemselect = eveui_itemselect;
    $(this)
      .closest("tr")
      .find(".eveui_rowcontent")
      .prepend(this.eveui_itemselect);
    eveui_itemselect.find("input").focus();
    if (typeof item_id === "undefined") {
      return;
    }
    let request_timestamp = performance.now();
    // get market group id for selected item
    cache_request("/latest/universe/types/" + item_id).done(function () {
      let data = cache_retrieve("/latest/universe/types/" + item_id);
      let market_group = data.market_group_id;
      // get items with the same market group
      cache_request("/latest/markets/groups/" + market_group).done(function () {
        if (request_timestamp > itemselect_lastupdate) {
          itemselect_lastupdate = request_timestamp;
        } else {
          return;
        }
        let data = cache_retrieve("/latest/markets/groups/" + market_group);
        let datalist = $(".eveui_itemselect datalist");
        cache_items(data.types.join(":")).done(function () {
          mark("marketgroup cached");
          data.types.sort(function (a, b) {
            return cache_retrieve("/latest/universe/types/" + a).name.localeCompare(
              cache_retrieve("/latest/universe/types/" + b).name
            );
          });
          for (let i of data.types) {
            datalist.append(
              `<option label="${
                cache_retrieve("/latest/universe/types/" + i).name
              }">(${i})</option>`
            );
          }
        });
      });
    });
  });
  $(document).on("input", ".eveui_itemselect input", function (e) {
    let eveui_itemselect = $(this).closest(".eveui_itemselect");
    let input_str = $(this).val();
    if (input_str.slice(0, 1) === "(" && input_str.slice(-1) === ")") {
      // numeric input is expected to mean selected item
      input_str = input_str.slice(1, -1);
      let item_id = $(this)
        .closest("[data-eveui-itemid]")
        .attr("data-eveui-itemid");
      let dna = $(this).closest("[data-eveui-dna]").attr("data-eveui-dna");
      if (typeof item_id === "undefined") {
        // append new item
        dna = `${dna.slice(0, -2)}:${input_str};1::`;
      } else {
        // replace existing item
        let re = new RegExp(`^${item_id}:`);
        dna = dna.replace(re, `${input_str}:`);
        re = new RegExp(`:${item_id};`);
        dna = dna.replace(re, `:${input_str};`);
      }
      $(this).closest("[data-eveui-dna]").attr("data-eveui-dna", dna);
      cache_items(dna).done(function () {
        let eveui_window = $(`.eveui_window[data-eveui-dna="${dna}"]`);
        eveui_window.find(".eveui_content ").html(format_fit(dna));
        $(window).trigger("resize");
      });
      $(".eveui_itemselect").remove();
    } else {
      // search for matching items
      if (input_str.length < 3) {
        return;
      }
      let request_timestamp = performance.now();
      // get item ids that match input
      ajax({
        url: eveui_esi_endpoint(`/latest/search/`),
        cache: true,
        data: {
          search: $(this).val(),
          categories: "inventorytype",
        },
      }).done(function (data) {
        if (typeof data.inventorytype === "undefined") {
          return;
        }
        // get names for required item ids
        ajax({
          url: eveui_esi_endpoint(`/latest/universe/names/`),
          cache: true,
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify({
            ids: data.inventorytype.slice(0, 50),
          }),
        }).done(function (data) {
          if (request_timestamp > itemselect_lastupdate) {
            itemselect_lastupdate = request_timestamp;
          } else {
            return;
          }
          let datalist = eveui_itemselect.find("datalist");
          data.sort(function (a, b) {
            return a.name.localeCompare(b.name);
          });
          datalist.empty();
          for (let i in data) {
            datalist.append(
              `<option label="${data[i].name}">(${data[i].id})</option>`
            );
          }
        });
      });
    }
  });
  // close itemselect window on any outside click
  $(document).on("click", function (e) {
    if ($(e.target).closest(".eveui_itemselect,.eveui_more_icon").length > 0) {
      return;
    }
    $(".eveui_itemselect").remove();
  });
  $(document).on("click", ".eveui_copy_icon", function (e) {
    clipboard_copy($(this).closest(".eveui_content"));
  });
  // custom window drag handlers
  $(document).on("mousedown", ".eveui_window", function (e) {
    $(this).css("z-index", current_zindex++);
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
      url: eveui_esi_endpoint(`/latest/status/`),
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
            db.createObjectStore("cache", { keyPath: "path" });
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
    cache_request("/latest/markets/prices");
    // start preload timer
    preload_timer = setTimeout(lazy_preload, eveui_preload_interval);
    mark("preload timer set");
  }
  function new_window(title = "&nbsp;") {
    let eveui_window = $(
      `<span class="eveui_window"><div class="eveui_title">${title}</div><span class="eveui_icon eveui_close_icon" /><span class="eveui_scrollable"><span class="eveui_content">Loading...</span></span></span>`
    );
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
    let ship = cache_retrieve("/latest/universe/types/" + ship_id);
    ship.hiSlots = 0;
    ship.medSlots = 0;
    ship.lowSlots = 0;
    for (let i in ship.dogma_attributes) {
      let attr = cache_retrieve("/latest/universe/types/" + ship_id)
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
      let item = cache_retrieve("/latest/universe/types/" + item_id);
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
        let item = cache_retrieve("/latest/universe/types/" + item_id);
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
        )}" class="eveui_icon eveui_item_icon" /><td class="eveui_right">${
          fittings[item_id]
        }<td colspan="2"><div class="eveui_rowcontent">${
          item.name
        }</div><td class="eveui_right whitespace_nowrap"><span data-itemid="${item_id}" class="eveui_icon eveui_info_icon" /><span class="eveui_icon eveui_plus_icon eveui_edit" /><span class="eveui_icon eveui_minus_icon eveui_edit" /><span class="eveui_icon eveui_more_icon eveui_edit" />`;
      }
      if (typeof slots_available !== "undefined") {
        if (slots_available > slots_used) {
          html += `<tr class="nocopy"><td class="eveui_icon eveui_item_icon" /><td class="eveui_right whitespace_nowrap">${
            slots_available - slots_used
          }<td colspan="2"><div class="eveui_rowcontent">Empty</div><td class="eveui_right"><span class="eveui_icon eveui_more_icon eveui_edit" />`;
        }
        if (slots_used > slots_available) {
          html += `<tr class="nocopy"><td class="eveui_icon eveui_item_icon" /><td class="eveui_right">${
            slots_available - slots_used
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
        <img src="${eveui_imageserver("types/" + ship_id + "/render?size=512")}" class="eveui_icon eveui_ship_icon" />
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
        ${eveui_allow_edit ? '<span class="eveui_icon eveui_edit_icon"></span>' : ""}
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
    let item = cache_retrieve("/latest/universe/types/" + item_id);
    let html = `
<img src="${eveui_imageserver("types/" + item_id + "/icon?size=512")}"height="128" width="128" class="float_right" />
${item.name}
<br />
${item.description}
<hr />
<table class="whitespace_nowrap">
  <tr>
    <td>
      Approx price
    </td>
    <td>
      ${format_number(market_retrieve(item_id).average_price)}
    </td>
  </tr>
  <tr>
    <td>
      &nbsp;
    </td>
  </tr>`;
    for (let i in item.dogma_attributes) {
      let attr = item.dogma_attributes[i];
      html += `
  <tr>
    <td>
      <eveui key="/latest/dogma/attributes/${attr.attribute_id}" path="display_name,name">
        attribute:${attr.attribute_id}
      </eveui>
    </td>
    <td>
      ${attr.value}
    </td>
  </tr>`;
    }
    html += "</table>";
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
    cache_request("/latest/universe/types/" + item_id)
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
    let character = cache_retrieve("/latest/characters/" + char_id);
    let html = `
<table>
  <thead>
    <td colspan="4">
      ${character.name}
      <hr />
    </td>
  </thead>
  <tbody>
    <tr>
      <td colspan="4">
        <img src="${eveui_imageserver("characters/" + char_id + "/portrait?size=512")}" height="256" width="256" />
        <hr />
      </td>
    </tr>
    <tr>
      <td colspan="1">
        <img  class="float_left" src="${eveui_imageserver("corporations/" + character.corporation_id + "/logo?size=128")}" height="96" width="96" />
      </td>
      <td style="text-align:left;position:relative;top:32px;">
        Member of
        <a href="corp:${character.corporation_id}">
          <eveui key="/latest/corporations/${character.corporation_id}" path="name">
            ${character.corporation_id}
          </eveui>
        </a
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
    cache_request("/latest/characters/" + char_id)
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
    let corporation = cache_retrieve("/latest/corporations/" + corp_id);
    return `
<table>
  <tr>
    <td colspan="2">
      <img src="${eveui_imageserver(
        "corporations/" + corp_id + "/logo?size=256"
      )}" height="256" width="256" />
      ${corporation.name}
      <hr />
      <img class="float_left" src="${eveui_imageserver(
        "alliances/" + corporation.alliance_id + "/logo?size=128"
      )}" height="128" width="128" />
      Member of
      <eveui key="/latest/alliances/${corporation.alliance_id}" path="name">
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
</table>`;
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
    cache_request("/latest/corporations/" + corp_id)
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
<span class="eveui_fit_stats">
  Approx. total price: ${format_number(calculate_fit_price(dna))}
  <br />
  Gun DPS: ${format_number(calculate_gun_dps(dna))}
  <br />
  Missile DPS: ?
  <br />
  Drone DPS: ?
  <br />
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
        $.grep(cache_retrieve("/latest/markets/prices"), function (v) {
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
      let item = cache_retrieve("/latest/universe/types/" + item_id);
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
          let item = cache_retrieve("/latest/universe/types/" + item_id);
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
  function format_number(num) {
    if (isNaN(num)) {
      return "n/a";
    }
    let suffix = "";
    if (num > 1000000000) {
      suffix = "B";
      num /= 1000000000;
    }
    if (num > 1000000) {
      suffix = "M";
      num /= 1000000;
    }
    if (num > 1000) {
      suffix = "K";
      num /= 1000;
    }
    return `${num.toFixed(2)}${suffix}`;
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
        cache_request("/latest/universe/types/" + item_id).done(function () {
          selected_element.replaceWith(
            `<span class="eveui_content eveui_item">
            ${format_item(
              item_id
            )}</span>`
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
        cache_request("/latest/characters/" + char_id).done(function () {
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
          cache_request("/latest/markets/prices").done(function () {
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
      pending.push(cache_request("/latest/universe/types/" + item_id));
    }
    return $.when.apply(null, pending);
  }
  function cache_request(key) {
    let url;
    let jsonp = false;
    let custom_cache =
      key.startsWith("/latest/universe/types") ||
      key.startsWith("/latest/dogma/attributes");
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
    return $.grep(cache_retrieve("/latest/markets/prices"), function (v) {
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