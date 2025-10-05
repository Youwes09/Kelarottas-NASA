// ===== STATE MANAGEMENT =====
class AppState {
  constructor() {
    this.map = null;
    this.map2 = null;
    this.tileLayer = null;
    this.compareTileLayer = null;
    this.sideTileLayer = null;
    this.currentBody = "earth";
    this.currentLayerId = null;
    this.currenTileLayer = null;
    this.compareLayerId = null;
    this.compareTileLayer = null;
    this.currentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    this.compareMode = false;
    this.sideBySideMode = false;
    this.syncMode = false;
    this.sideLayerId = null;
    this.sideTileLayer = null;
    this.apiConfig = {};
    this.pendingLabel = null;
    this.allLayers = [];
    this.maxDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    this.minDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    this.bodyBounds = {
      earth: [
        [-90, -180],
        [90, 180],
      ],
      mars: [
        [-90, -180],
        [90, 180],
      ],
      moon: [
        [-90, -180],
        [90, 180],
      ],
    };
    this.tileLoadErrors = 0;
    this.tileLoadAttempts = 0;
  }
}

const state = new AppState();

// ===== MAP INITIALIZATION =====
const MapModule = {
  init() {
    state.map = L.map("map", {
      center: [20, 0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 9,
      zoomControl: false,
      maxBounds: state.bodyBounds[state.currentBody] || state.bodyBounds.earth,
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
    });
  },

  initSecondary() {
    state.map2 = L.map("map2", {
      center: [20, 0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 9,
      zoomControl: false,
      maxBounds: state.bodyBounds[state.currentBody] || state.bodyBounds.earth,
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
    });
  },
};

const loadConfig = async (body) => {
  const res = await fetch(`/api/config/${body}`);
  const config = await res.json();
  console.log(config);

  // The server now returns the processed config with categories
  state.apiConfig = config;

  // Extract all layers from the config
  state.allLayers = config.layers;

  // Set the first layer as the default current layer
  if (Object.keys(state.allLayers).length > 0) {
    state.currentLayerId = Object.keys(state.allLayers)[0];
  }

  // Populate the layer dropdown
  populateLayerDropdown();
};

const loadLayer = () => {
  // remove existing layers
  if (state.tileLayer) {
    state.map.removeLayer(state.tileLayer);
    state.tileLayer = null;
  }
  if (state.compareTileLayer) {
    state.map.removeLayer(state.compareTileLayer);
    state.compareTileLayer = null;
  }

  if (!state.map) MapModule.init();

  const layer = state.apiConfig.layers[state.currentLayerId];
  const dateStr = layer.supportsTime
    ? state.currentDate.toISOString().split("T")[0]
    : "none";
  const url = `/tiles/${state.currentBody}/${state.currentLayerId}/${dateStr}/{z}/{y}/{x}`;

  state.tileLayer = L.tileLayer(url, {
    attribution: "NASA GIBS",
    maxZoom: layer.maxZoom,
    errorTileUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  }).addTo(state.map);

  state.map.setMaxZoom(layer.maxZoom);

  // load compare layer if in compare mode

  if (state.compareMode && state.compareLayerId) {
    const compareLayer = state.apiConfig.layers[state.compareLayerId];
    console.log("compareLayer", compareLayer);
    const compareDateStr = compareLayer.supportsTime
      ? state.currentDate.toISOString().split("T")[0]
      : "none";
    const compareUrl = `/tiles/${state.currentBody}/${state.compareLayerId}/${compareDateStr}/{z}/{y}/{x}`;

    const opacity = document.getElementById("opacitySlider").value / 100;

    state.compareTileLayer = L.tileLayer(compareUrl, {
      attribution: "NASA GIBS",
      maxZoom: compareLayer.maxZoom,
      opacity: opacity,
      errorTileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    }).addTo(state.map);
  }

  // side by side mode - render on second map
  if (state.sideBySideMode && state.sideLayerId) {
    
    if (!state.map2) MapModule.initSecondary();
  

    const sideLayer = state.apiConfig.layers[state.sideLayerId];
    const dateStr = sideLayer.supportsTime
      ? state.currentDate.toISOString().split("T")[0]
      : "none";
    const url = `/tiles/${state.currentBody}/${state.sideLayerId}/${dateStr}/{z}/{y}/{x}`;

    state.sideTileLayer = L.tileLayer(url, {
      attribution: "NASA GIBS",
      maxZoom: sideLayer.maxZoom,
      opacity: 1,
      errorTileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    }).addTo(state.map2);

    state.map2.setMaxZoom(sideLayer.maxZoom);
  }
};

// ===== CONFIG MANAGEMENT =====
const ConfigModule = {
  async load(body) {
    try {
      const res = await fetch(`/api/config/${body}`);
      if (!res.ok) throw new Error(`Failed to load config for ${body}`);
      const config = await res.json();
      state.apiConfig = config;
      state.allLayers = config.layers;

      if (Object.keys(state.allLayers).length > 0) {
        state.currentLayerId = Object.keys(state.allLayers)[0];
      }
      return true;
    } catch (err) {
      console.error("Config load failed:", err);
      alert(`Failed to load configuration for ${body}`);
      return false;
    }
  },
};

// ===== ERROR HANDLING =====
const ErrorModule = {
  show404() {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: white;
      font-family: inherit;
    `;
    overlay.innerHTML = `
      <div style="text-align: center; max-width: 500px; padding: 40px;">
        <div style="font-size: 72px; font-weight: 600; margin-bottom: 20px;">404</div>
        <div style="font-size: 24px; font-weight: 500; margin-bottom: 16px;">Tiles Not Available</div>
        <div style="font-size: 14px; color: #aaa; line-height: 1.6; margin-bottom: 32px;">
          The requested layer tiles could not be loaded. This may be due to:<br>
          • Network connectivity issues<br>
          • Invalid NASA API token<br>
          • Layer temporarily unavailable<br>
          • Date out of range for this layer
        </div>
        <button onclick="location.reload()" style="
          background: #4285f4;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Reload Page</button>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  checkTileHealth() {
    if (
      state.tileLoadAttempts > 10 &&
      state.tileLoadErrors / state.tileLoadAttempts > 0.8
    ) {
      ErrorModule.show404();
    }
  },
};

// ===== LAYER MANAGEMENT =====
const LayerModule = {
  load() {
    // Reset error tracking
    state.tileLoadErrors = 0;
    state.tileLoadAttempts = 0;

    // Remove existing layers
    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
      state.tileLayer = null;
    }
    if (state.compareTileLayer) {
      state.map.removeLayer(state.compareTileLayer);
      state.compareTileLayer = null;
    }
    if (state.sideTileLayer && state.map2) {
      state.map2.removeLayer(state.sideTileLayer);
      state.sideTileLayer = null;
    }

    const layer = state.apiConfig.layers[state.currentLayerId];
    const dateStr = layer.supportsTime
      ? state.currentDate.toISOString().split("T")[0]
      : "none";
    const url = `/tiles/${state.currentBody}/${state.currentLayerId}/${dateStr}/{z}/{y}/{x}`;

    state.tileLayer = L.tileLayer(url, {
      attribution: "NASA GIBS",
      maxZoom: layer.maxZoom,
      errorTileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    });

    state.tileLayer.on("tileload", () => {
      state.tileLoadAttempts++;
    });

    state.tileLayer.on("tileerror", () => {
      state.tileLoadAttempts++;
      state.tileLoadErrors++;
      ErrorModule.checkTileHealth();
    });

    state.tileLayer.addTo(state.map);
    state.map.setMaxZoom(layer.maxZoom);

    // Load compare layer if in compare mode
    if (state.compareMode && state.compareLayerId) {
      const compareLayer = state.apiConfig.layers[state.compareLayerId];
      const compareDateStr = compareLayer.supportsTime
        ? state.currentDate.toISOString().split("T")[0]
        : "none";
      const compareUrl = `/tiles/${state.currentBody}/${state.compareLayerId}/${compareDateStr}/{z}/{y}/{x}`;
      const opacity = document.getElementById("opacitySlider").value / 100;

      state.compareTileLayer = L.tileLayer(compareUrl, {
        attribution: "NASA GIBS",
        maxZoom: compareLayer.maxZoom,
        opacity: opacity,
        errorTileUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      }).addTo(state.map);
    }

    // Side by side mode - render on second map
    if (state.sideBySideMode && state.sideLayerId) {
      const sideLayer = state.apiConfig.layers[state.sideLayerId];
      const sideDateStr = sideLayer.supportsTime
        ? state.currentDate.toISOString().split("T")[0]
        : "none";
      const sideUrl = `/tiles/${state.currentBody}/${state.sideLayerId}/${sideDateStr}/{z}/{y}/{x}`;
      const opacity = document.getElementById("opacitySlider").value / 100;
      const maxZoom = sideLayer.maxZoom != undefined ? sideLayer.maxZoom : 9;

      state.sideTileLayer = L.tileLayer(sideUrl, {
        attribution: "NASA GIBS",
        maxZoom: maxZoom,
        opacity: opacity,
        errorTileUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      }).addTo(state.map2);

      state.map2.setMaxZoom(maxZoom);
    }
  },

  select(layerId) {
    if (!state.compareMode) {
      state.currentLayerId = layerId;
      LayerModule.load();
      TimeModule.updateUI();
    } else {
      if (layerId === state.currentLayerId) return;
      if (layerId === state.compareLayerId) {
        LayerModule.swap();
      } else if (state.sideBySideMode) {
        if (state.map2 && state.sideTileLayer) {
          state.map2.removeLayer(state.sideTileLayer);
        }
        state.sideLayerId = layerId;
        LayerModule.load();
      } else {
        state.compareLayerId = layerId;
        LayerModule.load();
      }
    }
    UIModule.renderLayerList();
  },

  swap() {
    if (!state.compareMode || !state.compareLayerId) return;
    [state.currentLayerId, state.compareLayerId] = [
      state.compareLayerId,
      state.currentLayerId,
    ];
    LayerModule.load();
    UIModule.renderLayerList();
  },
};

// ===== UI RENDERING =====
const UIModule = {
  renderLayerList() {
    const layerList = document.getElementById("layerList");
    layerList.innerHTML = "";

    // Add current layer to the list
    const currentLayer = document.createElement("div");
    currentLayer.className = "layer-item primary";
    currentLayer.dataset.layer = state.currentLayerId;
    currentLayer.dataset.name = state.currentLayerId;
    currentLayer.innerHTML = `
      <div class="layer-info">
        <div class="layer-name">${state.currentLayerId}</div>
        <div class="layer-category">${state.currentBody}</div>
      </div>
      <div style="display: flex; gap: 6px;">
        <span class="layer-badge primary">1</span>
      </div>
    `;
    layerList.appendChild(currentLayer);

    // Create planet sections
    const planets = [
      { id: "earth", name: "Earth" },
      { id: "mars", name: "Mars" },
      { id: "moon", name: "Moon" },
    ];

    planets.forEach((planet) => {
      const section = document.createElement("div");
      section.className = "category-section planet-section";
      section.dataset.planet = planet.id;

      const header = document.createElement("div");
      header.className = "category-header planet-header";
      header.innerHTML = `
        <span>${planet.name}</span>
        <span class="material-symbols-outlined expand-icon">expand_more</span>
      `;

      const layerContainer = document.createElement("div");
      layerContainer.className = "planet-layers";
      layerContainer.style.display =
        planet.id === state.currentBody ? "block" : "none";

      header.onclick = async () => {
        const wasOpen = layerContainer.style.display === "block";
        document.querySelectorAll(".planet-layers").forEach((container) => {
          container.style.display = "none";
        });
        document
          .querySelectorAll(".planet-header .expand-icon")
          .forEach((icon) => {
            icon.textContent = "expand_more";
          });

        if (!wasOpen) {
          layerContainer.style.display = "block";
          header.querySelector(".expand-icon").textContent = "expand_less";
          if (planet.id !== state.currentBody) {
            await BodyModule.switch(planet.id);
          }
        }
      };

      section.appendChild(header);

      if (planet.id === state.currentBody) {
        header.querySelector(".expand-icon").textContent = "expand_less";
        Object.entries(state.allLayers).forEach(([layerId, layer]) => {
          const div = document.createElement("div");
          div.className = "layer-item";
          div.dataset.layer = layerId;
          div.dataset.name = layer.name;

          if (layerId === state.currentLayerId) div.classList.add("primary");
          if (
            layerId === state.compareLayerId ||
            layerId === state.sideLayerId
          ) {
            div.classList.add("secondary");
          }

          const badges = [];
          if (layerId === state.currentLayerId) {
            badges.push('<span class="layer-badge primary">1</span>');
          }
          if (
            layerId === state.compareLayerId ||
            layerId === state.sideLayerId
          ) {
            badges.push('<span class="layer-badge secondary">2</span>');
          }

          div.innerHTML = `
            <div class="layer-info">
              <div class="layer-name">${layer.name}</div>
              <div class="layer-category">${planet.name}</div>
            </div>
            ${
              badges.length
                ? `<div style="display: flex; gap: 6px;">${badges.join(
                    ""
                  )}</div>`
                : ""
            }
          `;

          div.onclick = () => LayerModule.select(layerId);
          layerContainer.appendChild(div);
        });
      }

      section.appendChild(layerContainer);
      layerList.appendChild(section);
    });
  },

  filterLayers(query) {
    const searchTerm = query.toLowerCase().trim();
    const layerItems = document.querySelectorAll(".layer-item");
    const categoryHeaders = document.querySelectorAll(".category-section");

    if (!searchTerm) {
      layerItems.forEach((item) => item.classList.remove("hidden"));
      categoryHeaders.forEach((header) => (header.style.display = "block"));
      document.getElementById("noResults")?.remove();
      return;
    }

    let hasResults = false;
    layerItems.forEach((item) => {
      const layerName = item.dataset.name.toLowerCase();
      const categoryName =
        item.querySelector(".layer-category")?.textContent.toLowerCase() || "";

      if (layerName.includes(searchTerm) || categoryName.includes(searchTerm)) {
        item.classList.remove("hidden");
        hasResults = true;
      } else {
        item.classList.add("hidden");
      }
    });

    categoryHeaders.forEach((section) => {
      const visibleItems = section.querySelectorAll(".layer-item:not(.hidden)");
      section.style.display = visibleItems.length > 0 ? "block" : "none";
    });

    const existingMsg = document.getElementById("noResults");
    if (!hasResults && !existingMsg) {
      const noResults = document.createElement("div");
      noResults.id = "noResults";
      noResults.className = "no-results";
      noResults.textContent = "No layers found";
      document.getElementById("layerList").appendChild(noResults);
    } else if (hasResults && existingMsg) {
      existingMsg.remove();
    }
  },
};

// ===== COMPARISON MODE =====
const CompareModule = {
  toggle() {
    state.compareMode = !state.compareMode;
    const btn = document.getElementById("toggleCompare");
    const indicator = document.getElementById("modeIndicator");
    const compControl = document.getElementById("comparisonControl");

    if (state.compareMode) {
      btn.classList.add("active");
      indicator.textContent = "Compare Mode";
      compControl.classList.add("active");
      if (Object.keys(state.allLayers).length > 1) {
        state.compareLayerId = Object.keys(state.allLayers)[1];
      }
      LayerModule.load();
    } else {
      CompareModule.exit();
    }
    UIModule.renderLayerList();
  },

  exit() {
    state.compareMode = false;
    state.compareLayerId = null;

    if (state.sideBySideMode) {
      if (state.map2 && state.sideTileLayer) {
        state.map2.removeLayer(state.sideTileLayer);
      }
      if (state.syncMode) {
        document.getElementById("syncMode")?.remove();
        state.syncMode = false;
        state.map?.off("move");
        state.map2?.off("move");
      }
      document.getElementById("sideBySide").classList.remove("active");
      state.sideBySideMode = false;
      state.sideTileLayer = null;
      state.sideLayerId = null;
      document.getElementById("map").style.width = "100%";
      document.getElementById("map2").style.width = "0%";
    }

    document.getElementById("toggleCompare").classList.remove("active");
    document.getElementById("modeIndicator").textContent = "Single Layer";
    document.getElementById("comparisonControl").classList.remove("active");

    if (state.compareTileLayer) {
      state.map.removeLayer(state.compareTileLayer);
      state.compareTileLayer = null;
    }

    LoadModule.load();
    UIModule.renderLayerList();
  },

  toggleSideBySide() {

    const btn = document.getElementById("sideBySide");
    var syncBtn = document.getElementById("syncMode");

    if (state.sideBySideMode) {
      // remove sync mode button

      if (syncBtn) {
        syncBtn.remove();
        state.syncMode = false;
      }

      // switch compare view to view 3
      btn.classList.remove("active");
      document.getElementById("map").style.width = "100%";
      document.getElementById("map2").style.width = "0%";

      state.compareTileLayer = state.sideTileLayer;
      state.compareLayerId = state.sideLayerId;

      state.sideTileLayer = null;
      state.sideLayerId = null;
    } else {
      // switch compare view to view 2
      console.log("switch compare view to view 2");

      //add button to toggle sync mode
      if (!syncBtn) {
        syncBtn = document.createElement("button");
        syncBtn.classList.add("btn");
        syncBtn.id = "syncMode";
        syncBtn.textContent = "Sync Mode";
        syncBtn.style.width = "100%";
        syncBtn.style.marginTop = "10px";
        syncBtn.style.justifyContent = "center";
        syncBtn.onclick = CompareModule.toggleSyncMode;
        console.log("syncBtn", syncBtn.onclick);
        document.getElementById("comparisonControl").appendChild(syncBtn);
      }

      btn.classList.add("active");
      document.getElementById("map").style.width = "50%";
      document.getElementById("map2").style.width = "50%";

      console.log("state.compareLayerId", state.compareLayerId);
      console.log("state.compareTileLayer", state.compareTileLayer);

      state.sideLayerId = state.compareLayerId;
      state.sideTileLayer = state.compareTileLayer;

      state.map.removeLayer(state.compareTileLayer);

      state.compareLayerId = null;
      state.compareTileLayer = null;

      console.log("END OF SWITCH TO VIEW 2");
    }
    state.sideBySideMode = !state.sideBySideMode;
    loadLayer();

  },

  toggleSyncMode() {
    const btn = document.getElementById("syncMode");

    state.syncMode = !state.syncMode;
    if (!state.map || !state.map2) return;
    console.log("toggleSyncMode", state.syncMode);
    if (state.syncMode) {
      btn.classList.add("active");

      state.map.on("move", () => {
        state.map2.setView(state.map.getCenter(), state.map.getZoom(), {
          animate: false,
        });
      });

      state.map2.on("move", () => {
        state.map.setView(state.map2.getCenter(), state.map2.getZoom(), {
          animate: false,
        });
      });
    } else {
      btn.classList.remove("active");
      state.map2.off("move");
      state.map.off("move");
    }
  },

  // // update the dropdown selection
  // const dropdown = document.getElementById("layerDropdown");
  // if (dropdown) {
  //   dropdown.value = layerId;
  // }
};

function filterLayers(query) {
  const searchTerm = query.toLowerCase().trim();
  const layerItems = document.querySelectorAll(".layer-item");
  const categoryHeaders = document.querySelectorAll(".category-section");

  if (!searchTerm) {
    layerItems.forEach((item) => item.classList.remove("hidden"));
    categoryHeaders.forEach((header) => (header.style.display = "block"));
    document.getElementById("noResults")?.remove();
    return;
  }

  let hasResults = false;

  layerItems.forEach((item) => {
    const layerName = item.dataset.name.toLowerCase();
    const categoryName =
      item.querySelector(".layer-category")?.textContent.toLowerCase() || "";

    if (layerName.includes(searchTerm) || categoryName.includes(searchTerm)) {
      item.classList.remove("hidden");
      hasResults = true;
    } else {
      item.classList.add("hidden");
    }
  });

  categoryHeaders.forEach((section) => {
    const visibleItems = section.querySelectorAll(".layer-item:not(.hidden)");
    section.style.display = visibleItems.length > 0 ? "block" : "none";
  });

  const existingMsg = document.getElementById("noResults");
  if (!hasResults && !existingMsg) {
    const noResults = document.createElement("div");
    noResults.id = "noResults";
    noResults.className = "no-results";
    noResults.textContent = "No layers found";
    document.getElementById("layerList").appendChild(noResults);
  } else if (hasResults && existingMsg) {
    existingMsg.remove();
  }
}


// function exitCompareMode() {
//   state.compareMode = false;
//   state.compareLayerId = null;
//   if (state.sideBySideMode) {
//     if (state.map2 && state.sideTileLayer) {
//       state.map2.removeLayer(state.sideTileLayer);
//       // Enter side by side
//       if (!syncBtn) {
//         syncBtn = document.createElement("button");
//         syncBtn.classList.add("btn");
//         syncBtn.id = "syncMode";
//         syncBtn.textContent = "Sync Mode";
//         syncBtn.style.width = "100%";
//         syncBtn.style.marginTop = "10px";
//         syncBtn.style.justifyContent = "center";
//         syncBtn.onclick = CompareModule.toggleSync;
//         document.getElementById("comparisonControl").appendChild(syncBtn);
//       }
//       btn.classList.add("active");
//       document.getElementById("map").style.width = "50%";
//       document.getElementById("map2").style.width = "50%";

//       // Move compare layer to side
//       state.sideLayerId = state.compareLayerId;
//       state.compareLayerId = null;

//       if (state.compareTileLayer) {
//         state.map.removeLayer(state.compareTileLayer);
//         state.compareTileLayer = null;
//       }

//       state.sideBySideMode = true;
//     }
//     LayerModule.load();
//   }
// }

// ===== TIME CONTROLS =====
const TimeModule = {
  updateUI() {
    const dateStr = state.currentDate.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    document.getElementById("timeLabel").textContent = dateStr;

    // Sync date picker
    const datePicker = document.getElementById("datePicker");
    if (datePicker) {
      const year = state.currentDate.getFullYear();
      const month = String(state.currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(state.currentDate.getDate()).padStart(2, "0");
      datePicker.value = `${year}-${month}-${day}`;
    }

    document.getElementById("prevDay").disabled =
      state.currentDate <= state.minDate;
    document.getElementById("nextDay").disabled =
      state.currentDate >= state.maxDate;
  },

  changeDate(days) {
    const newDate = new Date(state.currentDate);
    newDate.setDate(newDate.getDate() + days);
    if (newDate > state.maxDate) state.currentDate = new Date(state.maxDate);
    else if (newDate < state.minDate)
      state.currentDate = new Date(state.minDate);
    else state.currentDate = newDate;
    LayerModule.load();
    TimeModule.updateUI();
  },

  setToday() {
    state.currentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    LayerModule.load();
    TimeModule.updateUI();
  },
};

// ===== BODY SWITCHING =====
const BodyModule = {
  async switch(body) {
    if (body === state.currentBody) return;
    state.currentBody = body;
    state.currentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    state.compareMode = false;
    state.compareLayerId = null;

    const success = await ConfigModule.load(body);
    if (!success) return;

    LayerModule.load();
    TimeModule.updateUI();
    UIModule.renderLayerList();
    CompareModule.exit();
  },
};

// ===== LABEL MANAGEMENT =====
const LabelModule = {
  open(e) {
    state.pendingLabel = { lat: e.latlng.lat, lng: e.latlng.lng };
    document.getElementById("labelTitle").value = "";
    document.getElementById("labelDescription").value = "";
    document.getElementById(
      "coordDisplay"
    ).textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    document.getElementById("labelModal").classList.add("active");
  },

  close() {
    state.pendingLabel = null;
    document.getElementById("labelModal").classList.remove("active");
  },

  async save(e) {
    e.preventDefault();
    if (!state.pendingLabel) return;

    const title = document.getElementById("labelTitle").value.trim();
    const description = document
      .getElementById("labelDescription")
      .value.trim();
    if (!title) return;

    try {
      await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: state.pendingLabel.lat,
          lng: state.pendingLabel.lng,
          title,
          description,
        }),
      });

      const marker = L.marker([
        state.pendingLabel.lat,
        state.pendingLabel.lng,
      ]).addTo(state.map);
      marker.bindPopup(`
        <div class="popup-title">${title}</div>
        ${
          description
            ? `<div class="popup-description">${description}</div>`
            : ""
        }
      `);
      LabelModule.close();
    } catch (err) {
      console.error("Label save failed:", err);
      alert("Failed to save label");
    }
  },

  async loadAll() {
    try {
      const res = await fetch("/api/labels");
      const labels = await res.json();
      labels.forEach((label) => {
        const marker = L.marker([label.lat, label.lng]).addTo(state.map);
        marker.bindPopup(`
          <div class="popup-title">${label.title}</div>
          ${
            label.description
              ? `<div class="popup-description">${label.description}</div>`
              : ""
          }
        `);
      });
    } catch (err) {
      console.error("Label load failed:", err);
    }
  },
};

// ===== COORDINATE NAVIGATION =====
const CoordModule = {
  goTo(e) {
    e.preventDefault();
    const latStr = document.getElementById("latInput").value.trim();
    const lngStr = document.getElementById("lngInput").value.trim();

    if (!latStr || !lngStr) {
      alert("Please enter both latitude and longitude.");
      return;
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid numeric coordinates.");
      return;
    }

    if (lat < -90 || lat > 90) {
      alert("Latitude must be between -90 and 90.");
      return;
    }

    if (lng < -180 || lng > 180) {
      alert("Longitude must be between -180 and 180.");
      return;
    }

    state.map.setView([lat, lng], 5);
    if (state.sideBySideMode && state.map2) {
      state.map2.setView([lat, lng], 5);
    }

    document.getElementById("latInput").value = "";
    document.getElementById("lngInput").value = "";
  },
};

// ===== EVENT HANDLERS =====
const EventModule = {
  attach() {
    // Toolbar
    document.getElementById("toggleSidebar").onclick = () =>
      document.getElementById("sidebar").classList.toggle("hidden");
    document.getElementById("toggleCompare").onclick = CompareModule.toggle;

    // Comparison controls
    document.getElementById("exitCompare").onclick = CompareModule.exit;
    document.getElementById("swapLayers").onclick = LayerModule.swap;
    document.getElementById("sideBySide").onclick =
      CompareModule.toggleSideBySide;

    // Coordinates
    document.getElementById("coordForm").onsubmit = CoordModule.goTo;

    // Opacity slider
    document.getElementById("opacitySlider").oninput = (e) => {
      const opacity = e.target.value / 100;
      document.getElementById("opacityValue").textContent =
        e.target.value + "%";
      if (state.compareTileLayer) state.compareTileLayer.setOpacity(opacity);
      if (state.sideTileLayer) state.sideTileLayer.setOpacity(opacity);
    };

    // Date picker
    const datePicker = document.getElementById("datePicker");
    if (datePicker) {
      const toYMD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      datePicker.min = toYMD(state.minDate);
      datePicker.max = toYMD(state.maxDate);
      datePicker.value = toYMD(state.currentDate);

      datePicker.onchange = (e) => {
        const val = e.target.value;
        const picked = new Date(val + "T12:00:00Z");
        if (!isNaN(picked.getTime())) {
          if (picked > state.maxDate) {
            state.currentDate = new Date(state.maxDate);
          } else if (picked < state.minDate) {
            state.currentDate = new Date(state.minDate);
          } else {
            state.currentDate = picked;
          }
          LayerModule.load();
          TimeModule.updateUI();
        }
      };
    }

    // Time controls
    document.getElementById("prevDay").onclick = () =>
      TimeModule.changeDate(-1);
    document.getElementById("nextDay").onclick = () => TimeModule.changeDate(1);
    document.getElementById("today").onclick = TimeModule.setToday;

    // Search
    document.getElementById("searchInput").oninput = (e) =>
      UIModule.filterLayers(e.target.value);

    // Labels
    state.map.on("contextmenu", LabelModule.open);
    document.getElementById("closeModal").onclick = LabelModule.close;
    document.getElementById("cancelLabel").onclick = LabelModule.close;
    document.getElementById("labelForm").onsubmit = LabelModule.save;
  },
};

// ===== INITIALIZATION =====
const init = async () => {
  MapModule.init();
  await ConfigModule.load(state.currentBody);
  LayerModule.load();
  TimeModule.updateUI();
  UIModule.renderLayerList();
  await LabelModule.loadAll();
  EventModule.attach();
};

init();
