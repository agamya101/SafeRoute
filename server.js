import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Mock Data Database for Hackathon Simulation
const routeSafetyDatabase = {
  'A': {
    lightingCoverage: 98,
    darkStretches: 1,
    openBusinesses: 12,
    footTraffic: "Moderate",
    trafficLevel: 65,
    bystanderPresence: "High",
    bystanderLevel: 85,
    incidentReports: "0 recent",
    incidentLevel: 10,
    statusTag: "Safe",
    crimeHotspots: [],
    womensReviews: [
      { user: "Priya S.", rating: 5, text: "Very well lit, walking here at 10 PM felt completely comfortable due to open shops." },
      { user: "Ananya R.", rating: 4, text: "Lots of families out near the market sector. Highly recommend this track." }
    ]
  },
  'B': {
    lightingCoverage: 45,
    darkStretches: 4,
    openBusinesses: 2,
    footTraffic: "Low",
    trafficLevel: 25,
    bystanderPresence: "Isolated",
    bystanderLevel: 30,
    incidentReports: "2 months ago",
    incidentLevel: 75,
    statusTag: "Risky",
    crimeHotspots: [
      { lat: 28.6180, lng: 77.1150, description: "Snatching incident reported here in unlit sector." }
    ],
    womensReviews: [
      { user: "Sneha M.", rating: 2, text: "Extremely dark under the flyover sector. Had to take an auto instead of walking." }
    ]
  },
  'C': {
    lightingCoverage: 15,
    darkStretches: 7,
    openBusinesses: 0,
    footTraffic: "Empty",
    trafficLevel: 5,
    bystanderPresence: "None",
    bystanderLevel: 5,
    incidentReports: "High risk zone",
    incidentLevel: 95,
    statusTag: "Danger",
    crimeHotspots: [
      { lat: 28.6050, lng: 77.0820, description: "Historical dark corridor - avoid walking after 8 PM." },
      { lat: 28.6290, lng: 77.1480, description: "Pickpocketing hotspot in isolated industrial zone." }
    ],
    womensReviews: [
      { user: "Kriti T.", rating: 1, text: "Avoid at all costs at night. Completely abandoned industrial stretch with zero working lights." }
    ]
  }
};

app.post('/api/calculate-safety', async (req, res) => {
  try {
    const { routeCoordinates, routeLabel } = req.body;
    const selectedLabel = routeLabel || 'A'; 
    const routeMeta = routeSafetyDatabase[selectedLabel];

    if (!routeCoordinates || !Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
      return res.status(400).json({ error: 'Invalid routeCoordinates array' });
    }

    const latitudes = routeCoordinates.map(coord => coord[0]);
    const longitudes = routeCoordinates.map(coord => coord[1]);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    // Dynamic Overpass API Scanner config
    const overpassQuery = `
      [out:json][timeout:6];
      (
        node["highway"="street_lamp"](${minLat - 0.003},${minLon - 0.003},${maxLat + 0.003},${maxLon + 0.003});
        node["amenity"="police"](${minLat - 0.003},${minLon - 0.003},${maxLat + 0.003},${maxLon + 0.003});
      );
      out body;
    `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let baseAssets = 0;
    try {
      const response = await fetch(overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SafeRoutePremiumDemo/1.0'
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        baseAssets = data.elements ? data.elements.length : 0;
      }
    } catch (e) {
      console.log("OSM fetch controller bypassed. Using local framework metrics.");
    }

    // Dynamic calculation formula tying live assets to database state layers
    let calculatedScore = 69; 
    if (selectedLabel === 'A') calculatedScore = Math.min(96, 75 + (baseAssets * 2));
    if (selectedLabel === 'B') calculatedScore = Math.max(48, 55 - (baseAssets * 1));
    if (selectedLabel === 'C') calculatedScore = Math.max(24, 35 - (baseAssets * 1));

    res.json({
      safetyScore: calculatedScore,
      elementsFound: baseAssets,
      ...routeMeta
    });

  } catch (error) {
    res.status(500).json({ error: 'Server parsing error', message: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'Server running perfectly' }));

app.listen(PORT, () => console.log(`Premium SafeRoute backend working on Port ${PORT}`));