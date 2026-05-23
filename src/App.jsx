import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fixed mock paths through Delhi mapping directly onto Route options
const ROUTE_GEOMETRIES = {
  'A': [
    [28.5921, 77.0460], [28.6100, 77.0650], [28.6250, 77.0880],
    [28.6420, 77.1200], [28.6510, 77.1550], [28.6480, 77.1850], [28.6289, 77.2090]
  ],
  'B': [
    [28.5921, 77.0460], [28.6050, 77.0820], [28.6180, 77.1150], [28.6289, 77.2090]
  ],
  'C': [
    [28.5921, 77.0460], [28.5810, 77.0950], [28.5990, 77.1450], [28.6289, 77.2090]
  ]
};

function App() {
  const [selectedRoute, setSelectedRoute] = useState('A');
  const [routeMetrics, setRouteMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('lighting'); // lighting, crowding, womensReviews
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const crimeMarkersRef = useRef([]);

  // Initialize map object canvas frame
  useEffect(() => {
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [28.6150, 77.1200],
        zoom: 12,
        zoomControl: false
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);

      mapInstanceRef.current = map;
      // Trigger baseline routing traces immediately on launch
      triggerRouteAnalysis('A');
    }
  }, []);

  const triggerRouteAnalysis = async (routeKey) => {
    setIsLoading(true);
    setSelectedRoute(routeKey);

    // Wipe past hazard pins
    crimeMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    crimeMarkersRef.current = [];

    // Clear and redraw vector lines to match design context color rules
    Object.keys(polylinesRef.current).forEach(k => mapInstanceRef.current.removeLayer(polylinesRef.current[k]));
    
    Object.keys(ROUTE_GEOMETRIES).forEach(key => {
      let lineColor = '#333344'; // inactive tracks background trace
      let lineWeight = 3;
      let lineDash = '5, 5';

      if (key === routeKey) {
        lineWeight = 6;
        lineDash = '0';
        if (key === 'A') lineColor = '#00ff88'; // Vibrant green safely path
        if (key === 'B') lineColor = '#ffb800'; // Amber alert detour track
        if (key === 'C') lineColor = '#ff4444'; // Red dangerous option
      }

      polylinesRef.current[key] = L.polyline(ROUTE_GEOMETRIES[key], {
        color: lineColor,
        weight: lineWeight,
        dashArray: lineDash,
        lineJoin: 'round'
      }).addTo(mapInstanceRef.current);
    });

    try {
      const response = await fetch('http://localhost:5000/api/calculate-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          routeCoordinates: ROUTE_GEOMETRIES[routeKey],
          routeLabel: routeKey
        })
      });
      
      const data = await response.json();
      setRouteMetrics(data);

      // Render Historical Crime Hotspot alert nodes if they exist on track
      if (data.crimeHotspots && data.crimeHotspots.length > 0) {
        data.crimeHotspots.forEach(crime => {
          const crimeIcon = L.divIcon({
            html: `<div style="background:#ff4444; width:14px; height:14px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #ff4444;"></div>`,
            className: 'crime-pin'
          });
          const marker = L.marker([crime.lat, crime.lng], { icon: crimeIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<div style="color:#000; font-size:12px;">⚠️ <b>Past Incident Area:</b><br/>${crime.description}</div>`);
          crimeMarkersRef.current.push(marker);
        });
      }

      // Smooth camera pan to view track boundary space 
      const bounds = L.latLngBounds(ROUTE_GEOMETRIES[routeKey]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });

    } catch (err) {
      console.error("Backend offline connection error context:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* LEFT CANVAS: FULL FRAME INTERACTIVE MAP */}
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        {/* Floating Top Status Header */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000, display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'rgba(26,26,26,0.9)', padding: '10px 16px', borderRadius: '8px', border: '1px solid #2b2b2b' }}>
          <span style={{ fontSize: '16px' }}>🗺️ Route Map</span>
          <span style={{ color: '#00ff88', fontSize: '13px' }}>● Live · Delhi, IN</span>
        </div>

        <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
        
        {/* Bottom Floating Route Path Badges */}
        <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 1000, display: 'flex', gap: '12px' }}>
          {['A', 'B', 'C'].map(label => (
            <div key={label} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #333',
              backgroundColor: label === 'A' ? '#072415' : label === 'B' ? '#2d1f00' : '#2d0505',
              color: label === 'A' ? '#00ff88' : label === 'B' ? '#ffb800' : '#ff4444'
            }}>
              Route {label}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT CANVAS: PREMIUM CONSOLIDATED METRICS PANEL */}
      <div style={{ width: '420px', borderLeft: '1px solid #222', backgroundColor: '#181818', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        
        {/* ROW 1: PATH BUTTON SELECTOR MATRIX */}
        <div>
          <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#777', letterSpacing: '1px', marginBottom: '10px' }}>⚡ Select Route Variant</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: '#111', padding: '4px', borderRadius: '8px' }}>
            {['A', 'B', 'C'].map(routeKey => (
              <button key={routeKey} onClick={() => triggerRouteAnalysis(routeKey)}
                style={{ padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                  backgroundColor: selectedRoute === routeKey ? '#2a2a2a' : 'transparent',
                  color: selectedRoute === routeKey ? '#fff' : '#666'
                }}>
                Route {routeKey}
              </button>
            ))}
          </div>
        </div>

        {/* ROW 2: RADIAL PROGRESS WHEEL FRAME MODULE */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#111', padding: '24px', borderRadius: '16px', border: '1px solid #222', position: 'relative' }}>
          {isLoading ? (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', color: '#667eea' }}>Parsing Live Parameters...</div>
          ) : routeMetrics ? (
            <>
              {/* SVG Circular Dial Structure */}
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
                  <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{routeMetrics.safetyScore}</div>
                  <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase' }}>Safety Score</div>
                </div>
              </div>

              {/* Status Classification Badge */}
              <div style={{ marginTop: '16px', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                backgroundColor: routeMetrics.statusTag === 'Safe' ? '#072415' : routeMetrics.statusTag === 'Risky' ? '#2d1f00' : '#2d0505',
                color: routeMetrics.statusTag === 'Safe' ? '#00ff88' : routeMetrics.statusTag === 'Risky' ? '#ffb800' : '#ff4444'
              }}>
                {routeMetrics.statusTag} Corridor
              </div>

              {/* ETA / Distance Row */}
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: '20px', paddingLength: '10px', fontSize: '13px', color: '#aaa' }}>
                <div>🕒 ETA: <b>{selectedRoute === 'A' ? '12 min' : selectedRoute === 'B' ? '18 min' : '22 min'}</b></div>
                <div>📍 Distance: <b>{selectedRoute === 'A' ? '2.4 km' : selectedRoute === 'B' ? '3.8 km' : '4.1 km'}</b></div>
              </div>
            </>
          ) : (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', color: '#444' }}>Select a variant to begin</div>
          )}
        </div>

        {/* ROW 3: DETAILED SUB-TAB CONTROL DECK SELECTION CHIPS */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
          {[
            { id: 'lighting', label: '💡 Lighting' },
            { id: 'crowding', label: '👥 Density' },
            { id: 'womensReviews', label: '👩‍✈️ Women Reviews' }
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

        {/* ROW 4: DYNAMIC CARDS RENDERING COMPONENT OUTPUT DATA */}
        <div style={{ flex: 1, backgroundColor: '#111', borderRadius: '12px', padding: '16px', border: '1px solid #222' }}>
          {routeMetrics ? (
            <>
              {/* TAB CONTAINER 1: VISUAL LIGHTING METRIC PROPS */}
              {activeBottomTab === 'lighting' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span>💡 Street Light Coverage</span>
                      <b style={{ color: '#00ff88' }}>{routeMetrics.lightingCoverage}%</b>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#222', borderRadius: '3px' }}>
                      <div style={{ width: `${routeMetrics.lightingCoverage}%`, height: '100%', backgroundColor: '#00ff88', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '10px 0', borderBottom: '1px solid #222' }}>
                    <span>🌙 Isolated Dark Stretches</span>
                    <span style={{ color: routeMetrics.darkStretches > 2 ? '#ff4444' : '#fff' }}>{routeMetrics.darkStretches} segment(s)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>🏪 Active Open Shops Nearby</span>
                    <span style={{ color: '#00ff88' }}>{routeMetrics.openBusinesses} stores active</span>
                  </div>
                </div>
              )}

              {/* TAB CONTAINER 2: VISUAL CROWD LEVEL PROPS */}
              {activeBottomTab === 'crowding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span>🚶‍♂️ Pedestrian Foot Traffic</span>
                      <b>{routeMetrics.footTraffic}</b>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#222', borderRadius: '3px' }}>
                      <div style={{ width: `${routeMetrics.trafficLevel}%`, height: '100%', backgroundColor: '#667eea', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span>👁️ Public Bystander Safety Presence</span>
                      <b>{routeMetrics.bystanderPresence}</b>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#222', borderRadius: '3px' }}>
                      <div style={{ width: `${routeMetrics.bystanderLevel}%`, height: '100%', backgroundColor: '#667eea', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '6px', borderTop: '1px solid #222' }}>
                    <span>🚨 Historic Incidents Alert Status</span>
                    <span style={{ color: routeMetrics.crimeHotspots.length > 0 ? '#ff4444' : '#00ff88', fontWeight: 'bold' }}>
                      {routeMetrics.incidentReports}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB CONTAINER 3: NEW WOMEN'S SAFETY FEEDBACK AUDIT LOGS DISPLAY */}
              {activeBottomTab === 'womensReviews' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                  {routeMetrics.womensReviews.map((review, i) => (
                    <div key={i} style={{ backgroundColor: '#1a1a2e', padding: '10px', borderRadius: '8px', border: '1px solid #2a2a3a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                        <span>👤 {review.user}</span>
                        <span style={{ color: '#ffb800' }}>{'★'.repeat(review.rating)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#ddd', lineHeight: '1.4' }}>"{review.text}"</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#444', fontSize: '13px', paddingTop: '40px' }}>Awaiting track metadata metrics pipeline...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App; 