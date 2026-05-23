import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayersRef = useRef([]);
  const markerLayersRef = useRef([]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [28.6139, 77.2090], // Delhi center
        zoom: 12,
        zoomControl: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleFindRoute = async () => {
    // Clear old route lines and emergency markers from map
    routeLayersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
    markerLayersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
    routeLayersRef.current = [];
    markerLayersRef.current = [];
    setActiveEmergency(null);

    // Hardcoded demonstration paths (Dwarka Sector 21 → Connaught Place)
    const fastestRouteCoords = [
      [28.5921, 77.0460],
      [28.6050, 77.0820],
      [28.6180, 77.1150],
      [28.6290, 77.1480],
      [28.6350, 77.1750],
      [28.6289, 77.2090]
    ];

    const safestRouteCoords = [
      [28.5921, 77.0460],
      [28.6100, 77.0650],
      [28.6250, 77.0880],
      [28.6420, 77.1200],
      [28.6510, 77.1550],
      [28.6480, 77.1850],
      [28.6380, 77.2050],
      [28.6289, 77.2090]
    ];

    // Draw Fastest Route (Red, dashed line)
    const fastestRouteLine = L.polyline(fastestRouteCoords, {
      color: '#ff4444',
      weight: 4,
      opacity: 0.7,
      dashArray: '10, 10',
      lineJoin: 'round'
    }).addTo(mapInstanceRef.current);

    // Draw Safest Route (Green, solid line)
    const safestRouteLine = L.polyline(safestRouteCoords, {
      color: '#00ff88',
      weight: 6,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(mapInstanceRef.current);

    // Track layers for dynamic cleanup later
    routeLayersRef.current = [fastestRouteLine, safestRouteLine];

    // Fit map view tightly around the new paths
    const allCoords = [...fastestRouteCoords, ...safestRouteCoords];
    const bounds = L.latLngBounds(allCoords);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });

    setIsLoading(true);
    setRouteData(null);

    try {
      // Send the safest coordinates array to our live Node.js backend
      const response = await fetch('https://saferoute-backend.onrender.com/api/calculate-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeCoordinates: safestRouteCoords })
      });

      if (!response.ok) throw new Error('API down');
      const data = await response.json();

      setRouteData({
        distance: "14.50",
        travelTime: 22,
        safetyScore: data.safetyScore,
        elementsFound: data.elementsFound
      });
    } catch (error) {
      console.error('Error contacting backend:', error);
      // Fallback display matrix if backend tab isn't active
      setRouteData({ distance: "14.50", travelTime: 22, safetyScore: 'N/A', elementsFound: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyClick = (type, label, emoji, lat, lng) => {
    if (!routeData) {
      alert('Please click "Find Safe Route" first to trace the baseline track.');
      return;
    }
    setActiveEmergency(type);

    // Clear old active safety markers
    markerLayersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));

    // Generate a sleek emoji HTML pin layout
    const customDivIcon = L.divIcon({
      html: `<div style="font-size: 22px; background: #1a1a2e; padding: 6px; border-radius: 50%; border: 2px solid #667eea; text-align: center; width: 28px; height: 28px; line-height: 28px;">${emoji}</div>`,
      className: 'custom-emergency-marker',
      iconSize: [40, 40]
    });

    // Place marker near our active Delhi route segment
    const emergencyMarker = L.marker([lat, lng], { icon: customDivIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`<div style="color: #111; font-family: sans-serif;"><b>Nearest Emergency Stop:</b><br/>${label}</div>`)
      .openPopup();

    markerLayersRef.current = [emergencyMarker];
    
    // Zoom map camera focus smoothly onto the found safe-haven stop
    mapInstanceRef.current.setView([lat, lng], 14);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar Section */}
      <div style={{
        width: '380px',
        background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)',
        color: '#e0e0e0',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.5)',
        overflowY: 'auto'
      }}>
        {/* Branding Header */}
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            SafeRoute
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#a0a0b0' }}>
            Navigate safely, arrive confidently
          </p>
        </div>

        {/* User Inputs Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#b0b0c0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Start Location
            </label>
            <input
              type="text"
              value={startLocation}
              onChange={(e) => setStartLocation(e.target.value)}
              placeholder="e.g. Dwarka Sector 21"
              style={{ width: '100%', padding: '12px 16px', fontSize: '14px', background: '#16213e', border: '1px solid #2a3f5f', borderRadius: '8px', color: '#e0e0e0', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#b0b0c0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Destination
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Connaught Place"
              style={{ width: '100%', padding: '12px 16px', fontSize: '14px', background: '#16213e', border: '1px solid #2a3f5f', borderRadius: '8px', color: '#e0e0e0', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={handleFindRoute}
            disabled={isLoading}
            style={{
              width: '100%', padding: '14px', fontSize: '15px', fontWeight: '600',
              background: isLoading ? '#4a5568' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
            }}
          >
            {isLoading ? '⏳ Calculating...' : '🚀 Find Safe Route'}
          </button>
        </div>

        {/* Emergency Quick Toggles Panel */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#b0b0c0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Emergency Waypoints
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { emoji: '➕', label: 'Pharmacy', type: 'pharmacy', info: 'Apollo Pharmacy 24/7 (Janakpuri)', lat: 28.6250, lng: 77.0880 },
              { emoji: '⛽', label: 'Petrol Pump', type: 'petrol', info: 'HP Fuel Station Center (Dhaula Kuan)', lat: 28.6420, lng: 77.1200 },
              { emoji: '🚓', label: 'Police Station', type: 'police', info: 'Delhi Police Command Center (CP HQ)', lat: 28.6289, lng: 77.2020 }
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => handleEmergencyClick(item.type, item.info, item.emoji, item.lat, item.lng)}
                style={{
                  padding: '12px 16px', fontSize: '14px', fontWeight: '500',
                  background: activeEmergency === item.type ? '#2a3f5f' : '#16213e',
                  color: '#e0e0e0', borderRadius: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                  border: activeEmergency === item.type ? '1px solid #00ff88' : '1px solid #2a3f5f', cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '18px' }}>{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Route Metrics Dynamic Content Box */}
        <div style={{ marginTop: 'auto' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#b0b0c0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Route Metrics
          </h3>
          <div style={{ background: '#16213e', border: '1px solid #2a3f5f', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#667eea', fontSize: '13px' }}>
                <div style={{ marginBottom: '8px', fontSize: '24px' }}>🔍</div>
                <div>Analyzing open street infrastructures...</div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#a0a0b0' }}>Querying OpenStreetMap data</div>
              </div>
            ) : routeData ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#a0a0b0' }}>Distance</span>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: '#e0e0e0' }}>{routeData.distance} km</span>
                </div>
                <div style={{ height: '1px', background: '#2a3f5f' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#a0a0b0' }}>Travel Time</span>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: '#e0e0e0' }}>{routeData.travelTime} mins</span>
                </div>
                <div style={{ height: '1px', background: '#2a3f5f' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#a0a0b0' }}>Safety Score</span>
                  <span style={{
                    fontSize: '18px', fontWeight: '700',
                    background: 'linear-gradient(135deg, #00ff88 0%, #667eea 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                  }}>{routeData.safetyScore}%</span>
                </div>
                {routeData.elementsFound !== undefined && (
                  <>
                    <div style={{ height: '1px', background: '#2a3f5f' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#a0a0b0' }}>Infrastructure Found</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#e0e0e0' }}>{routeData.elementsFound} assets</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px', color: '#606070', fontSize: '13px' }}>
                No route calculated yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Content Frame */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
      </div>
    </div>
  );
}

export default App;