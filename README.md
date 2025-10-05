# Embiggen Your Eyes

Our challenge, Embiggen Your Eyes, focuses on revamping NASA's outdated satellite image display technology by combining multiple NASA image providers into one unified platform, allowing users to zoom in and out of large, complex image datasets. Through our contribution, both casual and professional users can intuitively compare them side by side, overlayed, across time, and in multiple viewing spectrums. Users are able to search for specific locations via coordinates and label features that persist accross planetary views.

## Installation & Running

(You will need node & npm for this project)

1. **Clone the repository**:

```bash
git clone https://github.com/Youwes09/Kelarottas-NASA.git
cd Kelarottas-NASA
```

2. **Install dependencies**:

```bash
npm install package.json
```

3. **Create a `.env` file** in the project root:

```env
NASA_API_KEY = (Key from api.nasa.gov)
```

4. **Start the server**:

```bash
node server.js
```

The server will run at:

```
http://localhost:3000
```
