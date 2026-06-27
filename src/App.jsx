import { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './App.css';

const COLS_SHOW = ['Temple Name', 'Region', 'Location', 'Era', 'Condition', 'Primary Threat', 'Deity'];

const CONDITION_COLOR = {
  'Ruined': '#e74c3c', 'Critically Endangered': '#c0392b', 'Advanced Decay': '#e67e22',
  'Dilapidated': '#f39c12', 'Neglected': '#f1c40f', 'Buried': '#8e44ad',
  'Endangered': '#e74c3c', 'Buried/Sand Ingress': '#8e44ad', 'Structural Cracks': '#e67e22',
  'Ruined Vimana': '#e74c3c', 'Foundations Only': '#c0392b', 'Structural Distress': '#e67e22',
};

const REGION_COLOR = {
  'Chola Mandala': '#e74c3c', 'Thondaimandala': '#3498db', 'Pallava Mandala': '#27ae60',
};

const LANDMARK_COLORS = {
  'hospital': '#e74c3c',
  'school': '#3498db',
  'shop': '#f39c12',
  'restaurant': '#e67e22',
  'tourism': '#27ae60',
  'park': '#16a085',
  'temple': '#8e44ad',
  'church': '#d35400',
  'mosque': '#2980b9',
};

function App() {
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState(null);
  const [stagedFilters, setStagedFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [stats, setStats] = useState(null);
  const [currentView, setCurrentView] = useState('cluster');
  const [gridVisible, setGridVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedTemple, setSelectedTemple] = useState(null);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Grid sorting and searching
  const [gridSearch, setGridSearch] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // Chat Interface state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Namaste! I am the Narada Assistant. You can ask me to filter temples or search details. Try:\n• "Show ruined temples"\n• "Filter Chola region"\n• "Tell me about Sriperumbudur"\n• "Reset map"' }
  ]);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const landmarkMarkersRef = useRef(null);
  const chatEndRef = useRef(null);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false, // Turn off default zoom to custom style it
        attributionControl: true
      }).setView([11.5, 79.2], 8);
      
      mapRef.current = map;

      const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      });

      const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      });

      const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      });

      googleStreets.addTo(map);

      L.control.layers({
        "Google Streets": googleStreets,
        "Google Satellite": googleSatellite,
        "Google Hybrid": googleHybrid
      }, null, { position: 'bottomleft' }).addTo(map);

      // Add zoom control manually at bottom-left or bottom-right
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 45,
        disableClusteringAtZoom: 12
      });
      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;

      const landmarkMarkers = L.featureGroup();
      map.addLayer(landmarkMarkers);
      landmarkMarkersRef.current = landmarkMarkers;

      // Clear landmarks when popup closes
      map.on('popupclose', () => {
        if (landmarkMarkersRef.current) {
          landmarkMarkersRef.current.clearLayers();
        }
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Fetch data from Flask backend
  const loadMap = (activeFiltersObj) => {
    setLoading(true);
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activeFiltersObj)
    })
      .then(r => r.json())
      .then(data => {
        setRecords(data.records || []);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => {
        showToast('Failed to load data', 'error');
        setLoading(false);
      });
  };

  // Fetch Landmarks for a focused Temple
  const fetchAndRenderLandmarks = (lat, lon) => {
    if (!landmarkMarkersRef.current) return;
    landmarkMarkersRef.current.clearLayers();
    showToast('Searching nearby landmarks...');

    fetch('/api/landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon })
    })
      .then(r => r.json())
      .then(data => {
        if (data.landmarks && landmarkMarkersRef.current) {
          data.landmarks.forEach(landmark => {
            const color = LANDMARK_COLORS[landmark.type] || '#95a5a6';
            const landmarkMarker = L.circleMarker([landmark.lat, landmark.lon], {
              radius: 4.5,
              fillColor: color,
              color: '#fff',
              weight: 1,
              fillOpacity: 0.75,
            });

            landmarkMarker.bindPopup(`
              <div class="popup-inner" style="max-width:200px">
                <div class="popup-title" style="color:#e8b84b;font-size:12.5px;">📍 ${landmark.name}</div>
                <div class="popup-row"><span class="popup-key">Type</span><span class="popup-val">${landmark.type}</span></div>
              </div>
            `, { maxWidth: 220 });

            landmarkMarkersRef.current.addLayer(landmarkMarker);
          });
          showToast(`Found ${data.landmarks.length} landmarks!`);
        }
      })
      .catch(() => {
        showToast('Failed to load landmarks', 'error');
      });
  };

  // Render markers whenever records or view mode changes
  useEffect(() => {
    if (!clusterGroupRef.current) return;
    
    clusterGroupRef.current.clearLayers();
    if (landmarkMarkersRef.current) {
      landmarkMarkersRef.current.clearLayers();
    }

    records.forEach(rec => {
      const lat = parseFloat(rec._lat);
      const lon = parseFloat(rec._lon);
      if (isNaN(lat) || isNaN(lon)) return;

      const color = currentView === 'region'
        ? (REGION_COLOR[rec['Region']] || '#95a5a6')
        : (CONDITION_COLOR[rec['Condition']] || '#95a5a6');

      const marker = L.circleMarker([lat, lon], {
        radius: 6.5,
        fillColor: color,
        color: '#000',
        weight: 0.5,
        fillOpacity: 0.85,
      });

      marker.bindTooltip(
        `<span style="font-family:'Crimson Pro',serif;font-size:12.5px;font-weight:600">${rec['Temple Name'] || 'Temple'}</span>`,
        { direction: 'top', offset: [0, -6] }
      );

      // On Click, act like Google Maps: select temple, open detailed sidebar, pan map
      marker.on('click', () => {
        setSelectedTemple(rec);
        fetchAndRenderLandmarks(lat, lon);
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 12);
        }
      });

      clusterGroupRef.current.addLayer(marker);
    });
  }, [records, currentView]);

  // File Upload Handlers
  const handleFileUpload = (file) => {
    if (!file.name.endsWith('.csv')) {
      showToast('Please upload a CSV file', 'error');
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);

    fetch('/api/upload', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          showToast(data.error, 'error');
          return;
        }
        setFilters(data.filters);
        setUploadedFile({ name: file.name, rows: data.rows });
        setStagedFilters({});
        setAppliedFilters({});
        loadMap({});
        showToast('Upload successful!');
      })
      .catch(() => {
        setLoading(false);
        showToast('Upload failed', 'error');
      });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // Instant chip clicking filters the map
  const toggleChipFilter = (category, val) => {
    setStagedFilters(prev => {
      const activeList = prev[category] || [];
      let updatedList;
      if (activeList.includes(val)) {
        updatedList = activeList.filter(item => item !== val);
      } else {
        updatedList = [...activeList, val];
      }
      
      const newFilters = { ...prev, [category]: updatedList };
      if (updatedList.length === 0) {
        delete newFilters[category];
      }
      
      setAppliedFilters(newFilters);
      loadMap(newFilters);
      return newFilters;
    });
  };

  const resetFilters = () => {
    setStagedFilters({});
    setAppliedFilters({});
    loadMap({});
    showToast('Filters reset');
  };

  const clearStagedCategory = (category) => {
    setStagedFilters(prev => {
      const next = { ...prev };
      delete next[category];
      setAppliedFilters(next);
      loadMap(next);
      return next;
    });
  };

  // CSV Export
  const exportCSV = () => {
    setLoading(true);
    fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appliedFilters)
    })
      .then(r => r.blob())
      .then(blob => {
        setLoading(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'filtered_temples.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Export ready!');
      })
      .catch(() => {
        setLoading(false);
        showToast('Export failed', 'error');
      });
  };

  // Chat message submission
  const handleSendChatMessage = (forcedText) => {
    const text = forcedText || chatInput;
    if (!text.trim()) return;

    // Add user message
    setChatMessages(prev => [...prev, { sender: 'user', text }]);
    if (!forcedText) setChatInput('');

    // Show temporary bot typing indicator
    const tempBotMessageId = Date.now();
    setChatMessages(prev => [...prev, { id: tempBotMessageId, sender: 'bot', text: 'Typing...' }]);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
      .then(res => {
        if (!res.ok) throw new Error("Offline");
        return res.json();
      })
      .then(data => {
        // Remove typing indicator and add real bot reply
        setChatMessages(prev => prev.filter(m => m.id !== tempBotMessageId).concat({
          sender: 'bot',
          text: data.response || "No reply from assistant."
        }));
      })
      .catch(() => {
        // Fallback mock responses when API is offline (RAG disconnected mode)
        setTimeout(() => {
          const q = text.toLowerCase();
          let botResponse = "";

          if (!records || records.length === 0) {
            botResponse = "[RAG Offline Mode] Please upload a temple CSV dataset first using the panel on the left, so I can analyze and filter the map for you!";
          }
          else if (q.includes("reset") || q.includes("clear") || q.includes("show all")) {
            setStagedFilters({});
            setAppliedFilters({});
            loadMap({});
            botResponse = "[RAG Offline Mode] I have reset all filters. Map shows all temples.";
          } 
          else if (q.includes("chola") || q.includes("pallava") || q.includes("thondai")) {
            let region = "";
            if (q.includes("chola")) region = "Chola Mandala";
            else if (q.includes("pallava")) region = "Pallava Mandala";
            else if (q.includes("thondai")) region = "Thondaimandala";
            
            const newFilters = { Region: [region] };
            setStagedFilters(newFilters);
            setAppliedFilters(newFilters);
            loadMap(newFilters);
            botResponse = `[RAG Offline Mode] Filtered map for ${region} temples.`;
          }
          else if (q.includes("ruined") || q.includes("critically endangered") || q.includes("decay") || q.includes("neglected") || q.includes("dilapidated") || q.includes("buried")) {
            let cond = "";
            if (q.includes("ruined")) cond = "Ruined";
            else if (q.includes("critically endangered")) cond = "Critically Endangered";
            else if (q.includes("decay")) cond = "Advanced Decay";
            else if (q.includes("neglected")) cond = "Neglected";
            else if (q.includes("dilapidated")) cond = "Dilapidated";
            else if (q.includes("buried")) cond = "Buried";
            
            const newFilters = { Condition: [cond] };
            setStagedFilters(newFilters);
            setAppliedFilters(newFilters);
            loadMap(newFilters);
            botResponse = `[RAG Offline Mode] Filtered map for temples in ${cond} condition.`;
          }
          else {
            botResponse = `[RAG Offline Mode] Assistant RAG API is not connected. User message: "${text}". Once connected, I will search your vector database to answer!`;
          }

          setChatMessages(prev => prev.filter(m => m.id !== tempBotMessageId).concat({
            sender: 'bot',
            text: botResponse
          }));
        }, 600);
      });
  };

  // Directory Selection
  const handleSelectTemple = (rec) => {
    setSelectedTemple(rec);
    const lat = parseFloat(rec._lat);
    const lon = parseFloat(rec._lon);
    if (mapRef.current) {
      mapRef.current.setView([lat, lon], 13);
    }
    fetchAndRenderLandmarks(lat, lon);
  };

  // Computed directory list filtered by Search Query + Filters
  const filteredAndSortedRecords = useMemo(() => {
    let list = [...records];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(rec =>
        rec['Temple Name'].toLowerCase().includes(q) ||
        rec['Location'].toLowerCase().includes(q) ||
        rec['Region'].toLowerCase().includes(q) ||
        rec['Deity'].toLowerCase().includes(q)
      );
    }
    if (sortCol) {
      list.sort((a, b) => {
        const av = (a[sortCol] || '').toLowerCase();
        const bv = (b[sortCol] || '').toLowerCase();
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return list;
  }, [records, searchQuery, sortCol, sortAsc]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  return (
    <>
      {/* Loading Overlay */}
      {loading && (
        <div id="loading-overlay" className="active">
          <div className="loading-icon">⏳</div>
          <div className="loading-text">PROCESSING DATA</div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div id="toast" className="show" style={{ borderColor: toast.type === 'error' ? '#e74c3c' : 'var(--border)' }}>
          {toast.message}
        </div>
      )}

      {/* Full-Screen Canvas Map */}
      <div id="map" ref={mapContainerRef}></div>

      {/* Floating Left Panel (Google Maps Style) */}
      <div className="floating-left-panel">
        
        {/* Search & Brand Card */}
        <div className="search-card">
          <div className="search-header">
            <span className="brand-logo" onClick={() => setSelectedTemple(null)}>🛕</span>
            <input
              type="text"
              placeholder="Search temple, location, deity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="search-btn">🔍</button>
          </div>
          
          <div className="search-actions">
            <button className="search-action-btn" onClick={() => document.getElementById('file-input').click()}>
              {uploadedFile ? `📂 ${uploadedFile.name.substring(0, 15)}...` : "📂 Load Dataset"}
            </button>
            <input
              type="file"
              id="file-input"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            {uploadedFile && (
              <>
                <button className="search-action-btn" onClick={() => setStatsVisible(!statsVisible)}>
                  📊 Stats {statsVisible ? '✕' : ''}
                </button>
                <button className="search-action-btn highlight" onClick={() => setGridVisible(true)}>
                  ☰ Table
                </button>
              </>
            )}
          </div>
        </div>

        {/* Horizontal Scrolling Filter Chips */}
        {filters && (
          <div className="filter-chips-container">
            <button className="chip-btn reset" onClick={resetFilters}>
              Reset
            </button>
            {Object.entries(filters).map(([category, values]) => {
              if (category === 'Location') return null; // Avoid flooding chip row with 100 locations
              return values.slice(0, 4).map((val) => {
                const isActive = (appliedFilters[category] || []).includes(val);
                return (
                  <button
                    key={val}
                    className={`chip-btn ${isActive ? 'active' : ''}`}
                    onClick={() => toggleChipFilter(category, val)}
                  >
                    {val}
                  </button>
                );
              });
            })}
          </div>
        )}

        {/* Directory/Results List */}
        {uploadedFile && (
          <div className="directory-panel">
            <div className="directory-header">
              <span>{filteredAndSortedRecords.length} temples in view</span>
              <span>Sorted by Name</span>
            </div>
            <div className="directory-list">
              {filteredAndSortedRecords.length > 0 ? (
                filteredAndSortedRecords.map((rec) => {
                  const isActive = selectedTemple && selectedTemple['Temple Name'] === rec['Temple Name'];
                  const color = CONDITION_COLOR[rec['Condition']] || '#95a5a6';
                  return (
                    <div
                      key={rec['Temple Name']}
                      className={`directory-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectTemple(rec)}
                    >
                      <div className="item-title">🛕 {rec['Temple Name']}</div>
                      <div className="item-meta">
                        <span>📍 {rec['Location']}</span>
                        <span>⏳ {rec['Era'] || 'Unknown Era'}</span>
                      </div>
                      <div className="item-bottom">
                        <span className="cond-badge" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}33` }}>
                          {rec['Condition']}
                        </span>
                        <span className="item-deity">🔱 {rec['Deity'] || 'General'}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="directory-empty">No matching temples found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slide-In Details Panel (Google Maps Style) */}
      {selectedTemple && (
        <div className="detail-sheet">
          <button className="close-sheet-btn" onClick={() => setSelectedTemple(null)}>✕</button>
          
          <div className="detail-hero">
            <div className="detail-hero-icon">🛕</div>
            <div className="detail-hero-title">{selectedTemple['Temple Name']}</div>
            <div className="detail-hero-sub">
              <span>📍 {selectedTemple['Location']}</span>
              <span>🏛️ {selectedTemple['Region']}</span>
            </div>
          </div>

          <div className="detail-actions">
            <button className="action-btn" onClick={() => {
              if (mapRef.current) {
                mapRef.current.setView([parseFloat(selectedTemple._lat), parseFloat(selectedTemple._lon)], 14);
              }
            }}>
              🎯 Center
            </button>
            <button className="action-btn" onClick={() => fetchAndRenderLandmarks(parseFloat(selectedTemple._lat), parseFloat(selectedTemple._lon))}>
              🔍 Landmarks
            </button>
            <button className="action-btn" onClick={exportCSV}>
              ⬇ Export
            </button>
          </div>

          <div className="detail-body">
            <div className="info-section">
              <h3>Key Specifications</h3>
              <div className="info-row">
                <span className="info-key">🔱 Deity</span>
                <span className="info-val">{selectedTemple['Deity'] || '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-key">⏳ Era</span>
                <span className="info-val">{selectedTemple['Era'] || '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-key">🔥 Threat</span>
                <span className="info-val">{selectedTemple['Primary Threat'] || '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-key">⚠️ Condition</span>
                <span className="info-val">
                  <span className="cond-badge" style={{
                    color: CONDITION_COLOR[selectedTemple['Condition']] || '#95a5a6',
                    border: `1px solid ${CONDITION_COLOR[selectedTemple['Condition']] || '#95a5a6'}55`,
                    backgroundColor: `${CONDITION_COLOR[selectedTemple['Condition']] || '#95a5a6'}11`
                  }}>
                    {selectedTemple['Condition']}
                  </span>
                </span>
              </div>
            </div>

            {selectedTemple['Description'] && (
              <div className="info-section desc-section">
                <h3>Historical Significance</h3>
                <p>{selectedTemple['Description']}</p>
              </div>
            )}
            
            {selectedTemple['Details'] && (
              <div className="info-section desc-section">
                <h3>Architecture details</h3>
                <p>{selectedTemple['Details']}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Toolbar for Map Settings (Top-Right) */}
      {uploadedFile && (
        <div className="map-view-toggles">
          <button
            className={`map-toggle-btn ${currentView === 'cluster' ? 'active' : ''}`}
            onClick={() => setCurrentView('cluster')}
          >
            ⬤ Cluster
          </button>
          <button
            className={`map-toggle-btn ${currentView === 'region' ? 'active' : ''}`}
            onClick={() => setCurrentView('region')}
          >
            ◈ Region
          </button>
          <button
            className={`map-toggle-btn ${currentView === 'condition' ? 'active' : ''}`}
            onClick={() => setCurrentView('condition')}
          >
            ◉ Condition
          </button>
        </div>
      )}

      {/* Legend (Floating Bottom-Left) */}
      {uploadedFile && (
        <div id="legend">
          <div className="legend-title">Condition</div>
          <div className="legend-row">
            <div className="legend-dot" style={{ backgroundColor: '#c0392b' }}></div>
            Critically Endangered / Ruined
          </div>
          <div className="legend-row">
            <div className="legend-dot" style={{ backgroundColor: '#e67e22' }}></div>
            Advanced Decay
          </div>
          <div className="legend-row">
            <div className="legend-dot" style={{ backgroundColor: '#f39c12' }}></div>
            Dilapidated
          </div>
          <div className="legend-row">
            <div className="legend-dot" style={{ backgroundColor: '#f1c40f' }}></div>
            Neglected
          </div>
          <div className="legend-row">
            <div className="legend-dot" style={{ backgroundColor: '#8e44ad' }}></div>
            Buried
          </div>
          <div className="legend-row">
            <div className="legend-dot" style={{ backgroundColor: '#95a5a6' }}></div>
            Unknown
          </div>
        </div>
      )}

      {/* Stats Overlay Panel (Google Maps Style) */}
      {statsVisible && stats && (
        <div id="stats-panel">
          <div className="stats-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📊 View Stats</span>
            <button className="close-sheet-btn" style={{ position: 'relative', top: 0, right: 0 }} onClick={() => setStatsVisible(false)}>✕</button>
          </div>
          <div className="stat-row">
            <span className="stat-label">Total Temples</span>
            <span className="stat-value">{stats.total || 0}</span>
          </div>
          
          {stats['Region'] && (
            <div className="bar-wrap">
              {Object.entries(stats['Region']).map(([k, v]) => {
                const pct = Math.round((v / (stats.total || 1)) * 100);
                const color = REGION_COLOR[k] || '#95a5a6';
                return (
                  <div key={k}>
                    <div className="bar-label">
                      <span style={{ color }}>{k}</span>
                      <span>{v}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: color }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {stats['Condition'] && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-gold)' }}>
              <div className="bar-wrap">
                {Object.entries(stats['Condition'])
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([k, v]) => {
                    const pct = Math.round((v / (stats.total || 1)) * 100);
                    const color = CONDITION_COLOR[k] || '#95a5a6';
                    return (
                      <div key={k}>
                        <div className="bar-label">
                          <span style={{ color, fontSize: '10px' }}>{k}</span>
                          <span>{v}</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: color }}></div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid View Panel Overlay */}
      <div id="grid-panel" className={gridVisible ? 'visible' : ''}>
        <div id="grid-toolbar">
          <input
            type="text"
            id="grid-search"
            placeholder="Search temples table..."
            value={gridSearch}
            onChange={(e) => setGridSearch(e.target.value)}
          />
          <button className="tool-btn" onClick={() => setGridVisible(false)}>
            ✕ Close
          </button>
        </div>
        <div id="grid-table-wrap">
          <table id="grid-table">
            <thead>
              <tr>
                {COLS_SHOW.map((col) => (
                  <th key={col} onClick={() => handleSort(col)}>
                    {col} {sortCol === col ? (sortAsc ? '▲' : '▼') : '↕'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRecords.slice(0, 500).map((rec, index) => (
                <tr key={index} style={{ cursor: 'pointer' }} onClick={() => {
                  handleSelectTemple(rec);
                  setGridVisible(false);
                }}>
                  {COLS_SHOW.map((col) => {
                    const val = rec[col] || '—';
                    if (col === 'Condition') {
                      const color = CONDITION_COLOR[val] || '#95a5a6';
                      return (
                        <td key={col}>
                          <span className="cond-badge" style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}>
                            {val}
                          </span>
                        </td>
                      );
                    }
                    return <td key={col}>{val}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retractable Chat Widget (Bottom-Right Corner) */}
      <div className={`chat-widget-container ${chatOpen ? 'open' : ''}`}>
        
        {/* Chat Toggle Button */}
        <button className="chat-toggle-btn" onClick={() => setChatOpen(!chatOpen)}>
          <span className="chat-icon">{chatOpen ? '✕' : '💬'}</span>
          {!chatOpen && <span className="chat-text">Ask Narada</span>}
        </button>

        {/* Expanded Chat Box */}
        {chatOpen && (
          <div className="chat-box">
            <div className="chat-box-header">
              <div className="bot-avatar">🤖</div>
              <div>
                <div className="chat-box-title">Narada Assistant</div>
                <div className="chat-box-subtitle">Database Assistant · Active</div>
              </div>
            </div>
            
            <div className="chat-box-messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.sender}`}>
                  <div className="message-text">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Reply suggestion chips */}
            <div className="chat-quick-chips">
              <button onClick={() => handleSendChatMessage("Show ruined temples")}>⚠️ Ruined</button>
              <button onClick={() => handleSendChatMessage("Filter Chola region")}>🏛️ Chola</button>
              <button onClick={() => handleSendChatMessage("Reset filters")}>🔄 Reset Map</button>
            </div>

            <div className="chat-box-input">
              <input
                type="text"
                placeholder="Ask about temples, locations, or deities..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChatMessage();
                }}
              />
              <button onClick={() => handleSendChatMessage()}>Send</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
