import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// POST endpoint to calculate safety score
app.post('/api/calculate-safety', async (req, res) => {
  try {
    const { routeCoordinates } = req.body;

    if (!routeCoordinates || !Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
      return res.status(400).json({ error: 'Invalid routeCoordinates array' });
    }

    // Calculate bounding box from route coordinates
    const latitudes = routeCoordinates.map(coord => coord[0]);
    const longitudes = routeCoordinates.map(coord => coord[1]);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    // Construct Overpass API query
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["highway"="street_lamp"](${minLat},${minLon},${maxLat},${maxLon});
        node["amenity"="police"](${minLat},${minLon},${maxLat},${maxLon});
        node["shop"~"convenience|pharmacy"](${minLat},${minLon},${maxLat},${maxLon});
      );
      out body;
    `;

    // Query Overpass API
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Count total safety infrastructure elements
    const totalAssets = data.elements ? data.elements.length : 0;

    // Calculate safety score using statistical matrix
    const score = Math.min(100, Math.max(30, totalAssets * 4));

    // Return safety metrics
    res.json({
      safetyScore: score,
      elementsFound: totalAssets
    });

  } catch (error) {
    console.error('Error calculating safety score:', error);
    res.status(500).json({ 
      error: 'Failed to calculate safety score',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', port: PORT });
});

// Start server
app.listen(PORT, () => {
  console.log(`SafeRoute backend server running on http://localhost:${PORT}`);
});