import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import time
from datetime import datetime, timedelta

# Configuration
INPUT_FILE = "resources/moon.json"
API_CONFIG_FILE = "resources/api.json"
OUTPUT_FILE = "moon_validated.json"
MAX_WORKERS = 10  # Number of concurrent requests
TIMEOUT = 10  # Timeout for each request in seconds
NASA_API_KEY = ""  # Add your NASA API key here if needed

def load_api_config():
    """Load API configuration to get URL patterns"""
    try:
        with open(API_CONFIG_FILE, 'r') as f:
            config = json.load(f)
            return config.get('layerTypes', {})
    except FileNotFoundError:
        print(f"Warning: {API_CONFIG_FILE} not found. Using default pattern.")
        return {
            "DEFAULT": {
                "baseUrl": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
                "pathTemplate": "{layer}/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png",
                "maxZoom": 7
            }
        }

def detect_layer_type(layer_name, url_patterns):
    """Detect layer type based on layer name"""
    prefix = layer_name.split("_")[0]
    
    # Check for exact prefix match
    if prefix in url_patterns:
        return prefix
    
    # Special cases
    if layer_name.startswith("BlueMarble"):
        return "BlueMarble"
    if layer_name.startswith("Coastlines"):
        return "Coastlines"
    if layer_name.startswith("Reference"):
        return "Reference"
    if layer_name.startswith("IMERG"):
        return "IMERG"
    if layer_name.startswith("TRMM"):
        return "TRMM"
    if layer_name.startswith("OCI_PACE"):
        return "OCI"
    if layer_name.startswith("HARP2_PACE"):
        return "HARP2"
    if layer_name.startswith("SPEXONE_PACE"):
        return "SPEXONE"
    if layer_name.startswith("GOES-"):
        return "GOES"
    if layer_name.startswith("Himawari"):
        return "Himawari"
    
    return "DEFAULT"

def build_test_url(layer_name, url_patterns):
    """Build a test URL for the given layer"""
    layer_type = detect_layer_type(layer_name, url_patterns)
    pattern = url_patterns.get(layer_type, url_patterns.get("DEFAULT"))
    
    base_url = pattern['baseUrl']
    path_template = pattern['pathTemplate']
    
    # Use a recent date for testing (yesterday)
    test_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    
    # For layers that don't support time, use "default" or omit
    no_time_keywords = ["BlueMarble", "Coastlines", "Reference"]
    if any(keyword in layer_name for keyword in no_time_keywords):
        test_date = "default"
    
    # Build URL with test parameters
    # Use middle of the world (z=1, y=0, x=0) for testing
    path = path_template.replace("{layer}", layer_name)
    path = path.replace("{time}", test_date)
    path = path.replace("{z}", "1")
    path = path.replace("{y}", "0")
    path = path.replace("{x}", "0")
    
    url = f"{base_url}/{path}"
    
    # Add API key if provided
    if NASA_API_KEY:
        url += f"?token={NASA_API_KEY}"
    
    return url

def validate_layer(layer_name, url_patterns, session):
    """Validate a single layer by making an HTTP request"""
    try:
        url = build_test_url(layer_name, url_patterns)
        response = session.head(url, timeout=TIMEOUT, allow_redirects=True)
        
        # Accept 200 (OK) and 204 (No Content) as valid
        # Some layers might return 404 for specific dates but still be valid
        is_valid = response.status_code in [200, 204]
        
        return {
            'layer': layer_name,
            'valid': is_valid,
            'status_code': response.status_code,
            'url': url.replace(NASA_API_KEY, '[TOKEN]') if NASA_API_KEY else url
        }
    except requests.exceptions.Timeout:
        return {
            'layer': layer_name,
            'valid': False,
            'status_code': 'TIMEOUT',
            'url': 'Timeout occurred'
        }
    except requests.exceptions.RequestException as e:
        return {
            'layer': layer_name,
            'valid': False,
            'status_code': 'ERROR',
            'url': str(e)
        }

def main():
    print("Loading layer names...")
    with open(INPUT_FILE, 'r') as f:
        layer_names = json.load(f)
    
    print(f"Loaded {len(layer_names)} layers")
    
    print("Loading API configuration...")
    url_patterns = load_api_config()
    print(f"Loaded {len(url_patterns)} URL patterns")
    
    # Create a session for connection pooling
    session = requests.Session()
    
    valid_layers = []
    invalid_layers = []
    
    print(f"\nValidating layers with {MAX_WORKERS} workers...")
    print("This may take several minutes...\n")
    
    # Process layers concurrently
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_layer = {
            executor.submit(validate_layer, layer, url_patterns, session): layer 
            for layer in layer_names
        }
        
        completed = 0
        for future in as_completed(future_to_layer):
            result = future.result()
            completed += 1
            
            if result['valid']:
                valid_layers.append(result['layer'])
                status = "✓ VALID"
            else:
                invalid_layers.append(result)
                status = f"✗ INVALID ({result['status_code']})"
            
            print(f"[{completed}/{len(layer_names)}] {status}: {result['layer']}")
    
    # Save valid layers to output file
    print(f"\n\nSaving {len(valid_layers)} valid layers to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(valid_layers, f, indent=2)
    
    # Save validation report
    report_file = OUTPUT_FILE.replace('.json', '_report.json')
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_layers': len(layer_names),
        'valid_layers': len(valid_layers),
        'invalid_layers': len(invalid_layers),
        'invalid_details': invalid_layers
    }
    
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nValidation complete!")
    print(f"Valid layers: {len(valid_layers)}")
    print(f"Invalid layers: {len(invalid_layers)}")
    print(f"Success rate: {len(valid_layers)/len(layer_names)*100:.1f}%")
    print(f"\nResults saved to:")
    print(f"  - Valid layers: {OUTPUT_FILE}")
    print(f"  - Validation report: {report_file}")

if __name__ == "__main__":
    main()
