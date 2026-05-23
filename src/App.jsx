import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 5 Different Delhi Locations with Route Options (A, B, C) for each
const LOCATION_DATABASE = {
  'Dwarka Sector 12': {
    center: [28.5921, 77.0460],
    routes: {
      'A': [[28.5921, 77.0460], [28.5950, 77.0520], [28.5980, 77.0590]],
      'B': [[28.5921, 77.0460], [28.5890, 77.0420], [28.5850, 77.0390]],
      'C': [[28.5921, 77.0460], [28.5990, 77.0350], [28.6050, 77.0300]]
    }
  },
  'Connaught Place': {
    center: [28.6304, 77.2177],
    routes: {
      'A': [[28.6304, 77.2177], [28.6320, 77.2220], [28.6350, 77.2250]],
      'B': [[28.6304, 77.2177], [28.6280, 77.2120], [28.6250, 77.2080]],
      'C': [[28.6304, 77.2177], [28.6380, 77.2100], [28.6420, 77.2050]]
    }
  },
  'Hauz Khas Village': {
    center: [28.5494, 77.2001],
    routes: {
      'A': [[28.5494, 77.2001], [28.5520, 77.2050], [28.5550, 77.2100]],
      'B': [[28.5494, 77.2001], [28.5450, 77.1950], [28.5410, 77.1900]],
      'C': [[28.5494, 77.2001], [28.5510, 77.1850], [28.5530, 77.1750]]
    }
  },
  'Qutub Minar Area': {
    center: [28.5245, 77.1855],
    routes: {
      'A': [[28.5245, 77.1855], [28.5280, 77.1900], [28.5320, 77.1950]],
      'B': [[28.5245, 77.1855], [28.5200, 77.1800], [28.5150, 77.1750]],
      'C': [[28.5245, 77.1855], [28.5210, 77.1950], [28.5180, 77.2050]]
    }
  },
  'Karol Bagh': {
    center: [28.6514, 77.1907],
    routes: {
      'A': [[28.6514, 77.1907], [28.6550, 77.1950], [28.6580, 77.2000]],
      'B': [[28.6514, 77.1907], [28.6480, 77.1850], [28.6440, 77.1800]],
      'C': [[28.6514, 77.1907], [28.6530, 77.1800], [28.6550, 77.1700]]
    }
  }
};

function App() {
  const [selectedLocation, setSelectedLocation] = useState('Dwarka Sector 12');
  const [selectedRoute, setSelectedRoute] = useState('A');
  const [routeMetrics, setRouteMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('lighting');
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const crimeMarkersRef = useRef([]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: LOCATION_DATABASE[selectedLocation].center,
        zoom: 14,
        zoomControl: false
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);

      mapInstanceRef.current = map;
      triggerRouteAnalysis('Dwarka Sector 12', 'A');
    }
  }, []);

  const handleLocationChange = (e) => {
    const newLoc = e.target.value;
    setSelectedLocation(newLoc);
    triggerRouteAnalysis(newLoc, 'A');
  };

  const triggerRouteAnalysis = async (locationKey, routeKey) => {
    setIsLoading(true);
    setSelectedRoute(routeKey);

    const activeRoutes = LOCATION_DATABASE[locationKey].routes;

    // Clear old crime markers
    crimeMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    crimeMarkersRef.current = [];

    // Clear old route lines
    Object.keys(polylinesRef.current).forEach(k => mapInstanceRef.current.removeLayer(polylinesRef.current[k]));
    
    Object.keys(activeRoutes).forEach(key => {
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

      polylinesRef.current[key] = L.polyline(activeRoutes[key], {
        color: lineColor,
        weight: lineWeight,
        dashArray: lineDash,
        lineJoin: 'round'
      }).addTo(mapInstanceRef.current);
    });

    try {
      // NOTE: Changed to hit your production backend server so stats work live!
      const response = await fetch('https://saferoute-backend.onrender.com/api/calculate-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          routeCoordinates: activeRoutes[routeKey],
          routeLabel: routeKey
        })
      });
      
      const data = await response.json();
      setRouteMetrics(data);

      if (data.crimeHotspots && data.crimeHotspots.length > 0) {
        data.crimeHotspots.forEach(crime => {
          const crimeIcon = L.divIcon({
            html: `<div style="background:#ff4444; width:14px; height:14px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #ff4444;"></div>`,
            className: 'crime-pin'
          });
          const marker = L.marker([crime.lat, crime.lng], { icon: crimeIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<div style="color:#000; font-size:12px;">⚠️ <b>Past Incident:</b><br/>${crime.description}</div>`);
          crimeMarkersRef.current.push(marker);
        });
      }

      const bounds = L.latLngBounds(activeRoutes[routeKey]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });

    } catch (err) {
      console.error("Backend connection error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* LEFT CANVAS: MAP */}
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        {/* Floating Dropdown Selector */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000, display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'rgba(26,26,26,0.9)', padding: '10px 16px', borderRadius: '8px', border: '1px solid #2b2b2b' }}>
          <span style={{ fontSize: '14px', color: '#aaa' }}>📍 Location:</span>
          <select value={selectedLocation} onChange={handleLocationChange} style={{ backgroundColor: '#181818', color: '#fff', border: '1px solid #444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
            {Object.keys(LOCATION_DATABASE).map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* RIGHT CANVAS: METRICS PANEL */}
      <div style={{ width: '420px', borderLeft: '1px solid #222', backgroundColor: '#181818', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        
        {/* ROUTE SELECTOR BUTTONS */}
        <div>
          <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#777', letterSpacing: '1px', marginBottom: '10px' }}>⚡ Select Route Option</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: '#111', padding: '4px', borderRadius: '8px' }}>
            {['A', 'B', 'C'].map(routeKey => (
              <button key={routeKey} onClick={() => triggerRouteAnalysis(selectedLocation, routeKey)}
                style={{ padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                  backgroundColor: selectedRoute === routeKey ? '#2a2a2a' : 'transparent',
                  color: selectedRoute === routeKey ? '#fff' : '#666'
                }}>
                Route {routeKey}
              </button>
            ))}
          </div>
        </div>

        {/* RADIAL PROGRESS WHEEL */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#111', padding: '24px', borderRadius: '16px', border: '1px solid #222' }}>
          {isLoading ? (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', color: '#00ff88' }}>Calculating Safety Data...</div>
          ) : routeMetrics ? (
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
                {routeMetrics.statusTag} Track
              </div>
            </>
          ) : (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', color: '#444' }}>Awaiting connection...</div>
          )}
        </div>

        {/* METRIC SUB-TABS */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
          {[
            { id: 'lighting', label: '💡 Lighting' },
            { id: 'crowding', label: '👥 Density' },
            { id: 'womensReviews', label: '👩 Feedback' }
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

        {/* STATS DISPLAY CARD */}
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
                    <span>🌙 Dark Stretches</span>
                    <span>{routeMetrics.darkStretches} segments</span>
                  </div>
                </div>
              )}

              {activeBottomTab === 'crowding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span>Pedestrian Foot Traffic</span>
                      <b>{routeMetrics.footTraffic}</b>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#222', borderRadius: '3px' }}>
                      <div style={{ width: `${routeMetrics.trafficLevel}%`, height: '100%', backgroundColor: '#667eea', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>🚨 Crime History Log</span>
                    <span style={{ color: routeMetrics.crimeHotspots.length > 0 ? '#ff4444' : '#00ff88' }}>
                      {routeMetrics.incidentReports}
                    </span>
                  </div>
                </div>
              )}

              {activeBottomTab === 'womensReviews' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {routeMetrics.womensReviews.map((review, i) => (
                    <div key={i} style={{ backgroundColor: '#1a1a2e', padding: '10px', borderRadius: '8px', border: '1px solid #2a2a3a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                        <span>👤 {review.user}</span>
                        <span style={{ color: '#ffb800' }}>{'★'.repeat(review.rating)}</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#ddd' }}>"{review.text}"</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#444', fontSize: '13px' }}>Waiting for data...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;