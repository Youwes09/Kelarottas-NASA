import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAYERS_DIR = path.join(__dirname, "resources");
const apiData = fs.readFileSync(path.join(LAYERS_DIR, "api.json"), 'utf8');
const apiConfig = JSON.parse(apiData);
const URL_PATTERNS = apiConfig.layerTypes;

class Layer {
  constructor(name, planet, supportsTime) {
    
    this.name = this.formatLayerName(name);
    
    this.planet = planet;
    this.supportsTime = supportsTime;
    
    
    const pattern = URL_PATTERNS[this.getType()];
    this.baseUrl = pattern.baseUrl;
    this.path = pattern.pathTemplate.replace("{layer}", name);
    this.maxZoom = pattern.maxZoom;
  }

  getType() {
    if (this.planet == "moon") return "Moon";
    if (this.planet == "mars") return "Mars";
    // Try to match layer prefix to a defined type
    const prefix = this.name.split("_")[0];

    // Check for exact prefix match
    if (URL_PATTERNS[prefix]) return prefix;

    // Check for special cases
    if (this.name.startsWith("BlueMarble")) return "BlueMarble";
    if (this.name.startsWith("Coastlines")) return "Coastlines";
    if (this.name.startsWith("Reference")) return "Reference";
    if (this.name.startsWith("IMERG")) return "IMERG";
    if (this.name.startsWith("TRMM")) return "TRMM";

    // Special handling for PACE instruments
    if (this.name.startsWith("OCI_PACE")) return "OCI";
    if (this.name.startsWith("HARP2_PACE")) return "HARP2";
    if (this.name.startsWith("SPEXONE_PACE")) return "SPEXONE";

    // Special handling for GOES satellites
    if (this.name.startsWith("GOES-")) return "GOES";
    if (this.name.startsWith("Himawari")) return "Himawari";

    return "DEFAULT";
  }

  formatLayerName(name) {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace(/ Day$/i, " (Day)")
      .replace(/ Night$/i, " (Night)");
  }
}

export class Config {
  constructor() {
    this.layerNames = [];
    this.layers = {};
    this.noTimeLayers = [];
    this.needsToken = true;
  }
}

export class EarthConfig extends Config {
  constructor() {
    super();
    this.noTimeLayers = ["Coastlines", "Reference", "BlueMarble"];
  }

  generateLayers() {
    this.layers = {};
    this.layerNames.forEach((layerName) => {
      
    const layer = new Layer(layerName, "earth", !this.noTimeLayers.includes(layerName));

    this.layers[layerName] = layer;
    });
  }
}

export class MoonConfig extends Config {
  constructor() {
    super();
    this.needsToken = false;
  }

  generateLayers() {
    this.layers = {};
    this.layerNames.forEach((layerName) => {
      const layer = new Layer(layerName, "moon", false);
      this.layers[layerName] = layer;
    });
  }
}

export class MarsConfig extends Config {
  constructor() {
    super();
    this.needsToken = false;
  }

  generateLayers() {
    this.layers = {};
    this.layerNames.forEach((layerName) => {
      const layer = new Layer(layerName, "mars", false);
      this.layers[layerName] = layer;
    });
  }
}

