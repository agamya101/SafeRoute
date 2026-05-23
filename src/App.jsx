import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Geospatial Coordinate Hubs for Delhi Navigation matrix
const HUB_COORDINATES = {
  'Dwarka Sector 12': [28.5921, 77.0460],
  'Connaught Place': [28.6304, 77.2177],
  'Hauz Khas Village': [28.5494, 77.2001],
  'Janakpuri Center': [28.6214, 77.0878],
  'Karol Bagh': [28.6514, 77.1907]
};

// High-impact safety profile logs matching route combinations
const SAFETY_FALLBACK_DB = {
  'A': {
    safetyScore: 94,
    statusTag: "Safe",
    lightingCoverage: 98,
    darkStretches: 1,
    openBusinesses: 14,
    footTraffic: "High Traffic",
    trafficLevel: 85,
    incidentReports: "0 recent incident logs",
    womensReviews: [
      { user: "Priya S.", rating: 5, text: "Extremely bright streetlights and lots of open neighborhood food vendors even around midnight." },
      { user: "Ananya R.", rating: 4, text: "Walked here with friends past 10 PM. Felt completely comfortable and well-guided." }
    ]
  },
  'B': {
    safetyScore: 65,
    statusTag: "Risky",
    lightingCoverage: 52,
    darkStretches: 3,
    openBusinesses: 3,
    footTraffic: "Low Traffic",
    trafficLevel: 30,
    incidentReports: "Snatching reported 1 month ago",
    womensReviews: [
      { user: "Sneha M.", rating: 3, text: "Some sectors under the metro flyover are completely unlit. Better to book a cab." }
    ]
  },
  'C': {
    safetyScore: 32,
    statusTag: "Danger",
    lightingCoverage: 8,
    darkStretches: 9,
    openBusinesses: 0,
    footTraffic: "Completely Abandoned",
    trafficLevel: 4,
    incidentReports: "High-risk corridor profile",
    womensReviews: [
      { user: "Kriti T.", rating: 1, text: "Zero working infrastructure lamps. Avoid walking down this isolated stretch altogether." }
    ]
  }
};

function App() {
  const [startHub, setStartHub] = useState('Dwarka Sector 12');
  const [endHub, setEndHub] = useState('Connaught Place');
  const [selectedRoute, setSelectedRoute] = useState('A');
  const [routeMetrics, setRouteMetrics] = useState(SAFETY_FALLBACK_DB['A']);
  const [isLoading, setIsLoading] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('lighting');
  
  // Emergency Toggles State Matrix
  const [emergencyFilters, setEmergencyFilters] = useState({
    police: false,
    pharmacy: false,
    petrol: false,
    washroom: false,
    restaurant: false
  });

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const markersRef = useRef([]);
  const emergencyMarkersRef = useRef([]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [28.6139, 77.1209],
        zoom: 12,
        zoomControl: false
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);

      mapInstanceRef.current = map;
      calculateNavigationPaths('Dwarka Sector 12', 'Connaught Place', 'A');
    }
  }, []);

  // Watch for emergency toggle triggers to dynamically draw or wipe safety icons
  useEffect(() => {
    if (mapInstanceRef.current) {
      renderEmergencyAssets();
    }
  }, [emergencyFilters, startHub, endHub, selectedRoute]);

  const toggleEmergency = (type) => {
    setEmergencyFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const renderEmergencyAssets = () => {
    // Wipe existing emergency asset icon layers from canvas map frame
    emergencyMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    emergencyMarkersRef.current = [];

    const startPt = HUB_COORDINATES[startHub];
    
    // Safety assets distribution clusters offset around active route map zones
    const assetLocations = {
      police: [
        { coords: [startPt[0] + 0.004, startPt[1] + 0.005], title: "24/7 Police Assistance Booth" },
        { coords: [startPt[0] + 0.012, startPt[1] + 0.015], title: "District Police Station HQ" }
      ],
      pharmacy: [
        { coords: [startPt[0] + 0.002, startPt[1] + 0.008], title: "Apollo Pharmacy (24 Hours)" },
        { coords: [startPt[0] + 0.009, startPt[1] + 0.003], title: "Medlife Emergency Chemists" }
      ],
      petrol: [
        { coords: [startPt[0] + 0.006, startPt[1] + 0.011], title: "HP Fuel Pump & Lit Station Oasis" }
      ],
      washroom: [
        { coords: [startPt[0] + 0.003, startPt[1] + 0.002], title: "Sulabh Public Sanitation Complex" }
      ],
      restaurant: [
        { coords: [startPt[0] + 0.007, startPt[1] + 0.004], title: "Chaayos Hub (Open 24/7)" },
        { coords: [startPt[0] + 0.011, startPt[1] + 0.009], title: "McDonald's Drive-Thru Perimeter" }
      ]
    };

    const iconsMap = { police: '👮', pharmacy: '💊', petrol: '⛽', washroom: '🚻', restaurant: '🍔' };

    Object.keys(emergencyFilters).forEach(type => {
      if (emergencyFilters[type]) {
        assetLocations[type].forEach(place => {
          const customIcon = L.divIcon({
            html: `<div style="font-size: 20px; background: #1a1a1a; padding: 4px; border-radius: 50%; border: 2px solid #00ff88; box-shadow: 0 0 8px #00ff88; text-align: center; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">${iconsMap[type]}</div>`,
            className: 'emergency-node-pin',
            iconSize: [32, 32]
          });

          const marker = L.marker(place.coords, { icon: customIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<div style="color: #000; font-family: sans-serif; font-size: 13px;"><b>${iconsMap[type]} Emergency Safe Stop:</b><br/>${place.title}</div>`);
          
          emergencyMarkersRef.current.push(marker);
        });
      }
    });
  };

  const calculateNavigationPaths = async (start, end, routeKey) => {
    setIsLoading(true);
    setSelectedRoute(routeKey);
    setRouteMetrics(SAFETY_FALLBACK_DB[routeKey]);

    markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    markersRef.current = [];
    Object.keys(polylinesRef.current).forEach(k => mapInstanceRef.current.removeLayer(polylinesRef.current[k]));

    const startPt = HUB_COORDINATES[start];
    const endPt = HUB_COORDINATES[end];

    const routesGeometries = {
      'A': [startPt, [(startPt[0] + endPt[0]) / 2 + 0.01, (startPt[1] + endPt[1]) / 2 + 0.01], endPt],
      'B': [startPt, [(startPt[0] + endPt[0]) / 2 - 0.01, (startPt[1] + endPt[1]) / 2 - 0.01], endPt],
      'C': [startPt, [(startPt[0] + endPt[0]) / 2, (startPt[1] + endPt[1]) / 2 + 0.02], endPt]
    };

    Object.keys(routesGeometries).forEach(key => {
      let lineColor = '#333344';
      let lineWeight = 3;
      let lineDash = '5, 5';

      if (key === routeKey) {
        lineWeight = 6;
        lineDash = '0';
        if (key === 'A') lineColor = '#00ff88';
        if (key === 'B') lineColor = '#ffb800';
        if (key === 'C') lineColor = '#ff4444';
      }

      polylinesRef.current[key] = L.polyline(routesGeometries[key], {
        color: lineColor,
        weight: lineWeight,
        dashArray: lineDash,
        lineJoin: 'round'
      }).addTo(mapInstanceRef.current);
    });

    const startIcon = L.divIcon({ html: '🟢', className: 'node-pin', iconSize: [20, 20] });
    const startMarker = L.marker(startPt, { icon: startIcon }).addTo(mapInstanceRef.current).bindPopup(`<b>Origin Hub:</b> ${start}`);
    
    const endIcon = L.divIcon({ html: '🏁', className: 'node-pin', iconSize: [20, 20] });
    const endMarker = L.marker(endPt, { icon: endIcon }).addTo(mapInstanceRef.current).bindPopup(`<b>Destination Hub:</b> ${end}`);
    
    markersRef.current.push(startMarker, endMarker);

    if (routeKey !== 'A') {
      const hazardIcon = L.divIcon({
        html: `<div style="background:#ff4444; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 8px #ff4444;"></div>`,
        className: 'crime-pin'
      });
      const hazardPt = routesGeometries[routeKey][1];
      const crimeMarker = L.marker(hazardPt, { icon: hazardIcon }).addTo(mapInstanceRef.current)
        .bindPopup(`<div style="color:#000; font-size:12px;">⚠️ <b>Past Incident Area:</b><br/>Snatching reported here in dark corridor stretches.</div>`);
      markersRef.current.push(crimeMarker);
    }

    const bounds = L.latLngBounds([startPt, endPt]);
    mapInstanceRef.current.fitBounds(bounds, { padding: [80, 80] });

    try {
      const response = await fetch('https://saferoute-backend.onrender.com/api/calculate-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeCoordinates: routesGeometries[routeKey], routeLabel: routeKey })
      });
      if (response.ok) {
        const data = await response.json();
        setRouteMetrics(data);
      }
    } catch (err) {
      console.error("Using fallback model matrix profile indices data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* LEFT CANVAS WORKSPACE: INTERACTIVE GEO MAP */}
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        
        {/* Floating Controller Cluster (Inputs + Emergency Filter Toggles) */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'rgba(26,26,26,0.95)', padding: '14px', borderRadius: '12px', border: '1px solid #2b2b2b', boxShadow: '0 4px 25px rgba(0,0,0,0.5)', width: '270px' }}>
          
          {/* Navigation Dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>START</span>
            <select value={startHub} onChange={(e) => { setStartHub(e.target.value); calculateNavigationPaths(e.target.value, endHub, selectedRoute); }} style={{ backgroundColor: '#181818', color: '#fff', border: '1px solid #444', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', width: '200px', outline: 'none' }}>
              {Object.keys(HUB_COORDINATES).map(loc => (loc !== endHub && <option key={loc} value={loc}>{loc}</option>))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>END</span>
            <select value={endHub} onChange={(e) => { setEndHub(e.target.value); calculateNavigationPaths(startHub, e.target.value, selectedRoute); }} style={{ backgroundColor: '#181818', color: '#fff', border: '1px solid #444', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', width: '200px', outline: 'none' }}>
              {Object.keys(HUB_COORDINATES).map(loc => (loc !== startHub && <option key={loc} value={loc}>{loc}</option>))}
            </select>
          </div>

          {/* Emergency Safety Safe Haven Overlays Title */}
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#00ff88', letterSpacing: '1px', fontWeight: 'bold', marginTop: '2px' }}>🚨 Emergency Safe Havens</span>
          
          {/* Grid Action Toggle Matrix Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { id: 'police', label: '👮 Police', color: '#3b82f6' },
              { id: 'pharmacy', label: '💊 Pharmacy', color: '#ec4899' },
              { id: 'petrol', label: '⛽ Fuel', color: '#eab308' },
              { id: 'washroom', label: '🚻 Toilet', color: '#a855f7' },
              { id: 'restaurant', label: '🍔 Food 24h', color: '#f97316' }
            ].map(btn => (
              <button key={btn.id} onClick={() => toggleEmergency(btn.id)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.15s',
                  backgroundColor: emergencyFilters[btn.id] ? btn.color : '#1a1a1a',
                  color: emergencyFilters[btn.id] ? '#fff' : '#aaa',
                  border: `1px solid ${emergencyFilters[btn.id] ? btn.color : '#444'}`
                }}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* RIGHT WORKSPACE AREA: INSIGHT DATA COLUMNS */}
      <div style={{ width: '420px', borderLeft: '1px solid #222', backgroundColor: '#181818', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        
        {/* ALTERNATIVE TRACK VARIANT BUTTONS */}
        <div>
          <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#777', letterSpacing: '1px', marginBottom: '10px' }}>⚡ Evaluate Alternative Paths</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: '#111', padding: '4px', borderRadius: '8px' }}>
            {['A', 'B', 'C'].map(routeKey => (
              <button key={routeKey} onClick={() => calculateNavigationPaths(startHub, endHub, routeKey)}
                style={{ padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                  backgroundColor: selectedRoute === routeKey ? '#2a2a2a' : 'transparent',
                  color: selectedRoute === routeKey ? '#fff' : '#666'
                }}>
                Route {routeKey}
              </button>
            ))}
          </div>
        </div>

        {/* RADIAL CHART DESIGN RING ELEMENT */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#111', padding: '24px', borderRadius: '16px', border: '1px solid #222' }}>
          {routeMetrics ? (
            <>
              <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                <svg width="130" height="130" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#222" strokeWidth="8" fill="transparent" />
                  <circle cx="50" cy="50" r="40" 
                    stroke={selectedRoute === 'A' ? '#00ff88' : selectedRoute === 'B' ? '#ffb800' : '#ff4444'} 
                    strokeWidth="8" fill="transparent" 
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * routeMetrics.safetyScore) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)" 
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{routeMetrics.safetyScore}%</div>
                  <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Safety Index</div>
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                backgroundColor: routeMetrics.statusTag === 'Safe' ? '#072415' : routeMetrics.statusTag === 'Risky' ? '#2d1f00' : '#2d0505',
                color: routeMetrics.statusTag === 'Safe' ? '#00ff88' : routeMetrics.statusTag === 'Risky' ? '#ffb800' : '#ff4444'
              }}>
                {routeMetrics.statusTag} Corridor Profile
              </div>
            </>
          ) : (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', color: '#444' }}>Formatting parameters...</div>
          )}
        </div>

        {/* DETAILS SUB-TABS SELECTOR DECK */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
          {[
            { id: 'lighting', label: '💡 Lighting' },
            { id: 'crowding', label: '👥 Density' },
            { id: 'womensReviews', label: '👩‍✈️ Women Feedback' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveBottomTab(tab.id)}
              style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                backgroundColor: activeBottomTab === tab.id ? '#2b2b2b' : 'transparent',
                color: activeBottomTab === tab.id ? '#fff' : '#888'
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* CARDS DISPLAY PANEL DATA WRAPPER */}
        <div style={{ flex: 1, backgroundColor: '#111', borderRadius: '12px', padding: '16px', border: '1px solid #222' }}>
          {routeMetrics ? (
            <>
              {activeBottomTab === 'lighting' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span>Street Light Coverage</span>
                      <b style={{ color: '#00ff88' }}>{routeMetrics.lightingCoverage}%</b>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#222', borderRadius: '3px' }}>
                      <div style={{ width: `${routeMetrics.lightingCoverage}%`, height: '100%', backgroundColor: '#00ff88', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>🌙 Isolated Unlit Corridors</span>
                    <span>{routeMetrics.darkStretches} segment(s) on route</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>🏪 Active Commercial Guard Nodes</span>
                    <span>{routeMetrics.openBusinesses} businesses open</span>
                  </div>
                </div>
              )}

              {activeBottomTab === 'crowding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span>Pedestrian Foot Traffic Pattern</span>
                      <b>{routeMetrics.footTraffic}</b>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#222', borderRadius: '3px' }}>
                      <div style={{ width: `${routeMetrics.trafficLevel}%`, height: '100%', backgroundColor: '#667eea', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>🚨 Crime Dossier Alert Logs</span>
                    <span style={{ color: selectedRoute === 'A' ? '#00ff88' : '#ff4444', fontWeight: 'bold' }}>
                      {routeMetrics.incidentReports}
                    </span>
                  </div>
                </div>
              )}

              {activeBottomTab === 'womensReviews' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {routeMetrics.womensReviews.map((review, i) => (
                    <div key={i} style={{ backgroundColor: '#1a1a2e', padding: '12px', borderRadius: '8px', border: '1px solid #2a2a3a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                        <span>👤 Verified Traveller: {review.user}</span>
                        <span style={{ color: '#ffb800' }}>{'★'.repeat(review.rating)}</span>
                      </div>
                      <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#ddd', fontStyle: 'italic', lineHeight: '1.4' }}>
                        "{review.text}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#444', fontSize: '13px' }}>Syncing data parameters...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;