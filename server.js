import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Config, EarthConfig, MoonConfig, MarsConfig } from "./config.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const LABELS_FILE = path.join(__dirname, "data", "labels.json");
const LAYERS_DIR = path.join(__dirname, "resources");

// Load URL patterns from api.json
let URL_PATTERNS = {};

const loadApiConfig = async () => {
  try {
    const apiData = await fs.readFile(path.join(LAYERS_DIR, "api.json"), 'utf8');
    const apiConfig = JSON.parse(apiData);
    URL_PATTERNS = apiConfig.layerTypes;
    console.log('Loaded API configuration with', Object.keys(URL_PATTERNS).length, 'layer types');
  } catch (err) {
    console.error('Failed to load api.json, using defaults:', err);
    // Fallback to minimal defaults
    URL_PATTERNS = {
      DEFAULT: {
        baseUrl: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
        pathTemplate: "{layer}/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png",
        maxZoom: 7,
        needsToken: true
      }
    };
  }
};

const detectLayerType = (layerName) => {
  // Try to match layer prefix to a defined type
  const prefix = layerName.split('_')[0];
  
  // Check for exact prefix match
  if (URL_PATTERNS[prefix]) return prefix;
  
  // Check for special cases
  if (layerName.startsWith('BlueMarble')) return 'BlueMarble';
  if (layerName.startsWith('Coastlines')) return 'Coastlines';
  if (layerName.startsWith('Reference')) return 'Reference';
  if (layerName.startsWith('IMERG')) return 'IMERG';
  if (layerName.startsWith('TRMM')) return 'TRMM';
  
  // Special handling for PACE instruments
  if (layerName.startsWith('OCI_PACE')) return 'OCI';
  if (layerName.startsWith('HARP2_PACE')) return 'HARP2';
  if (layerName.startsWith('SPEXONE_PACE')) return 'SPEXONE';
  
  // Special handling for GOES satellites
  if (layerName.startsWith('GOES-')) return 'GOES';
  if (layerName.startsWith('Himawari')) return 'Himawari';
  
  return 'DEFAULT';
};

const generateConfig = (planet,layersData) => {
  let config = new Config;

  switch (planet) {
    case "earth":
      config = new EarthConfig();
      break;
    case "moon":
      config = new MoonConfig();
      break;
    case "mars":
      config = new MarsConfig();
      break;
  }
  
  config.layerNames = layersData;

  config.generateLayers();

 

  if (Object.keys(config.layers).length == 0) {
    throw new Error(`No layers found for ${planet}`);
  }

  return config;
};

//   // Check if layersData is a simple array (new format) or object with categories (old format)
//   if (Array.isArray(layersData)) {
//     // New format: simple array of layer names
//     // config.categories.all = {
//     //   name: "All Layers",
//     //   baseUrl: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
//     //   needsToken: true,
//     //   layers: {},
//     //   featured: true
//     // };
    
//     // layersData.forEach(layerName => {
//     //   const layerType = detectLayerType(layerName);
//     //   const pattern = URL_PATTERNS[layerType];
      
//     //   config.categories.all.layers[layerName] = {
//     //     name: formatLayerName(layerName),
//     //     path: pattern.pathTemplate.replace("{layer}", layerName),
//     //     maxZoom: pattern.maxZoom,
//     //     supportsTime: !layerName.includes("BlueMarble") && 
//     //                   !layerName.includes("Reference") && 
//     //                   !layerName.includes("Coastlines")
//     //   };
//     // });


//   } else {
//     // Old format: object with categories
//     Object.entries(layersData.categories || {}).forEach(([catKey, catData]) => {
//       config.categories[catKey] = {
//         name: catData.name,
//         baseUrl: catData.baseUrl || "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
//         needsToken: !catData.needsToken,
//         layers: {},
//         featured: catData.featured
//       };
      
//       catData.layers.forEach(layerName => {
//         const layerType = detectLayerType(layerName);
//         const pattern = URL_PATTERNS[layerType];
        
//         config.categories[catKey].layers[layerName] = {
//           name: formatLayerName(layerName),
//           path: pattern.pathTemplate.replace("{layer}", layerName),
//           maxZoom: pattern.maxZoom,
//           supportsTime: !layerName.includes("BlueMarble") && 
//                         !layerName.includes("Reference") && 
//                         !layerName.includes("Coastlines")
//         };
//       });
//     });
//   }
  
//   return config;
// };

let configs = {};

const loadConfigs = async () => {
  // Load API patterns first
  await loadApiConfig();
  
  const bodies = ['earth', 'mars', 'moon'];
  
  for (const body of bodies) {
    try {
      const data = await fs.readFile(path.join(LAYERS_DIR, `${body}.json`), 'utf8');
      configs[body] = generateConfig(body, JSON.parse(data));
      console.log(`Loaded ${body} config with ${Object.keys(configs[body].layers).length} layers`);
    } catch (err) {
      console.warn(`No config for ${body}, skipping`); 
    }
  }
  
  console.log(`Loaded configs for: ${Object.keys(configs).join(', ')}`);
};

await loadConfigs();

try {
  await fs.mkdir(path.join(__dirname, "data"), { recursive: true });
  await fs.access(LABELS_FILE);
} catch {
  await fs.writeFile(LABELS_FILE, JSON.stringify([], null, 2));
}

app.use(express.static("public"));
app.use(express.json());

const readLabels = async () => {
  try {
    const content = await fs.readFile(LABELS_FILE, 'utf8');
    return JSON.parse(content.trim() || '[]');
  } catch {
    return [];
  }
};

const writeLabels = (labels) => fs.writeFile(LABELS_FILE, JSON.stringify(labels, null, 2));

app.get("/api/config/:body", (req, res) => {
  const config = configs[req.params.body];
  config ? res.json(config) : res.status(404).json({ error: "Body not found" });
});

app.get("/api/bodies", (req, res) => {
  res.json(Object.keys(configs));
});

// New endpoint for simple array format (no category)
app.get("/tiles/:body/:layer/:time/:z/:y/:x", async (req, res) => {
  const { body, layer, z, y, x, time } = req.params;

  if (time !== "none" && !/^\d{4}-\d{2}-\d{2}$/.test(time)) {
    return res.status(400).send("Invalid date format");
  }

  const config = configs[body];
  if (!config) return res.status(404).send("Body not found");



  const layerConfig = config.layers[layer];
  if (!layerConfig) return res.status(404).send("Layer not found");

  let tileUrl = `${layerConfig.baseUrl}/${layerConfig.path}`
    .replace("{time}", time)
    .replace("{z}", z)
    .replace("{y}", y)
    .replace("{x}", x);

  if (config.needsToken && process.env.NASA_API_KEY) {
    tileUrl += `?token=${process.env.NASA_API_KEY}`;
  }


  try {
    const response = await fetch(tileUrl);
    if (!response.ok) {
      console.error(`Tile fetch failed: ${tileUrl} - Status: ${response.status}`);
      return res.status(response.status).send("Tile not available");
    }

    res.set({
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400"
    });

    response.body.pipe(res);
  } catch (err) {
    console.error('Tile server error:', err);
    res.status(500).send("Tile server error");
  }
});

// Legacy endpoint for old format (with category)
app.get("/tiles/:body/:category/:layer/:time/:z/:y/:x", async (req, res) => {
  const { body, layer, z, y, x, time } = req.params;

  if (time !== "none" && !/^\d{4}-\d{2}-\d{2}$/.test(time)) {
    return res.status(400).send("Invalid date format");
  }

  const config = configs[body];
  if (!config) return res.status(404).send("Body not found");

  const layerConfig = config.layers[layer];
  if (!layerConfig) return res.status(404).send("Layer not found");

  let tileUrl = `${config.baseUrl}/${layerConfig.path}`
    .replace("{time}", time)
    .replace("{z}", z)
    .replace("{y}", y)
    .replace("{x}", x);

  if (config.needsToken && process.env.NASA_API_KEY) {
    tileUrl += `?token=${process.env.NASA_API_KEY}`;
  }

  try {
    const response = await fetch(tileUrl);
    
    if (!response.ok) {
      console.error(`Tile fetch failed: ${tileUrl} - Status: ${response.status}`);
      return res.status(response.status).send("Tile not available");
    }

    res.set({
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400"
    });

    response.body.pipe(res);
  } catch (err) {
    console.error('Tile server error:', err);
    res.status(500).send("Tile server error");
  }
});

app.get("/api/labels", async (req, res) => {
  try {
    res.json(await readLabels());
  } catch {
    res.status(500).json({ error: "Failed to load labels" });
  }
});

app.post("/api/labels", async (req, res) => {
  const { lat, lng, title, description } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number" || !title) {
    return res.status(400).json({ error: "Invalid data" });
  }

  try {
    const labels = await readLabels();
    const newLabel = {
      id: Date.now().toString(),
      lat, lng, title,
      description: description || "",
      timestamp: new Date().toISOString()
    };
    labels.push(newLabel);
    await writeLabels(labels);
    res.status(201).json(newLabel);
  } catch {
    res.status(500).json({ error: "Failed to save" });
  }
});

app.delete("/api/labels/:id", async (req, res) => {
  try {
    const labels = await readLabels();
    const filtered = labels.filter(l => l.id !== req.params.id);
    if (labels.length === filtered.length) return res.status(404).json({ error: "Not found" });
    await writeLabels(filtered);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete" });
  }
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));