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

const COORDS = {
  'Chengalpattu': [12.6924, 79.9761], 'Uthiramerur': [12.6079, 79.7542],
  'Sriperumbudur': [12.9672, 79.9436], 'Mannargudi': [10.6658, 79.4522],
  'Papanasam': [10.9236, 79.2718], 'Manachanallur': [10.8167, 78.8833],
  'Musiri': [10.9522, 78.4482], 'Arani': [12.6700, 79.2800],
  'Vandavasi': [12.5000, 79.6200], 'Tiruvallur Rural': [13.1430, 79.9050],
  'Kumbakonam Outskirts': [10.9600, 79.3900], 'Madurantakam': [12.4960, 79.8930],
  'Needamangalam': [10.7667, 79.4500], 'Thiruverumbur': [10.8700, 78.7300],
  'Lalgudi': [10.8667, 78.8167], 'Kanchipuram': [12.8342, 79.7036],
  'Tiruvannamalai': [12.2253, 79.0747], 'Vellore': [12.9165, 79.1325],
  'Tiruvallur': [13.1430, 79.9050], 'Thiruttani': [13.1750, 79.6170],
  'Pulivanam': [12.5500, 79.8000], 'Thiruvalangadu': [13.1800, 79.8500],
  'Takkolam': [13.0000, 79.8000], 'Kelambakkam': [12.7840, 80.2200],
  'Poonamallee': [13.0460, 80.1100], 'Kooram': [12.8000, 79.9000],
  'Erumaivettipalayam': [11.3500, 77.7200], 'Sholingur': [13.1180, 79.4230],
  'Narthamalai outskirts': [10.9200, 78.8700], 'Kalavakkam': [12.7000, 80.1000],
  'Salavakkam': [12.8500, 79.8000], 'Tirumalai': [11.0500, 78.5500],
  'Tiruvidanthai': [12.5340, 80.2140], 'Kilputhur': [11.8000, 79.1000],
  'Kuvathur': [12.3500, 79.9000], 'Siyamangalam': [12.7500, 79.5500],
  'Maduranthakam': [12.4960, 79.8930], 'Vilappakkam': [12.5500, 79.5000],
  'Melpadi': [13.0200, 79.5500], 'Arcot': [12.9060, 79.3170],
  'Kiranur': [10.9800, 78.7500], 'Kattur': [10.9000, 78.8000],
  'Tiruninravur': [13.1180, 80.0530], 'Acharapakkam': [12.4890, 79.9650],
  'Tirukarugavur Remote': [10.9300, 79.3500], 'Mamallapuram': [12.6200, 80.1930],
  'Panapakkam': [12.9000, 79.6000], 'Kiliyur': [11.9500, 79.4000],
  'Neman': [12.4000, 79.8500], 'Kaverypakkam': [12.9500, 79.8000],
  'Thaiyur': [12.7500, 80.1500], 'Vallimalai': [12.8000, 79.1000],
  'Walajabad': [12.7960, 79.8580], 'Manimangalam': [12.9000, 80.0500],
  'Nangupatti': [10.9000, 78.6000], 'Kodumbalur': [10.9940, 78.7940],
  'Tenneri': [11.8500, 79.2000],
  'Tamil Nadu': [11.1271, 78.6569]
};

const parseCSV = (text) => {
  const lines = [];
  let row = [""];
  let insideQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].map(h => h.trim());
  const rows = lines.slice(1).filter(r => r.length > 0 && r.some(cell => cell.trim() !== ''));
  
  return { headers, rows };
};

const dfToRecords = (rows, headers) => {
  return rows.map(row => {
    const rec = {};
    headers.forEach((header, index) => {
      rec[header] = row[index] !== undefined ? String(row[index]).trim() : '';
    });
    
    let latVal = rec._lat || rec.latitude || rec.lat || rec.lat_dec || rec.y;
    let lonVal = rec._lon || rec.longitude || rec.lon || rec.lng || rec.lon_dec || rec.x;
    
    let lat = parseFloat(latVal);
    let lon = parseFloat(lonVal);
    
    if (isNaN(lat) || isNaN(lon)) {
      const loc = (rec['Location'] || '').trim();
      let coords = COORDS[loc];
      if (!coords) {
        for (const [k, v] of Object.entries(COORDS)) {
          if (k.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(k.toLowerCase())) {
            coords = v;
            break;
          }
        }
      }
      if (!coords) {
        coords = [11.1271 + (Math.random() * 2 - 1), 78.6569 + (Math.random() * 2 - 1)];
      }
      
      lat = coords[0] + (Math.random() * 0.036 - 0.018);
      lon = coords[1] + (Math.random() * 0.036 - 0.018);
    }
    
    rec['_lat'] = Number(lat.toFixed(6));
    rec['_lon'] = Number(lon.toFixed(6));
    rec['_color'] = CONDITION_COLOR[rec['Condition']] || '#95a5a6';
    rec['_region_color'] = REGION_COLOR[rec['Region']] || '#95a5a6';
    
    return rec;
  });
};

const calculateStats = (filteredRecords) => {
  const stats = {
    total: filteredRecords.length,
    Region: {},
    Condition: {}
  };
  
  filteredRecords.forEach(rec => {
    const reg = rec['Region'];
    if (reg) {
      stats.Region[reg] = (stats.Region[reg] || 0) + 1;
    }
    
    const cond = rec['Condition'];
    if (cond) {
      stats.Condition[cond] = (stats.Condition[cond] || 0) + 1;
    }
  });
  
  return stats;
};

function App() {
  const [allRecords, setAllRecords] = useState([]);
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

  // Client-side filtering
  const applyClientSideFilters = (data, activeFilters) => {
    let filtered = [...data];
    
    Object.entries(activeFilters).forEach(([category, selectedValues]) => {
      if (selectedValues && selectedValues.length > 0) {
        filtered = filtered.filter(rec => {
          const val = rec[category];
          return val && selectedValues.includes(val);
        });
      }
    });
    
    const calculatedStats = calculateStats(filtered);
    setRecords(filtered);
    setStats(calculatedStats);
  };

  const loadMap = (activeFiltersObj) => {
    setLoading(true);
    setTimeout(() => {
      applyClientSideFilters(allRecords, activeFiltersObj);
      setLoading(false);
    }, 150);
  };

  // Fetch Landmarks for a focused Temple via public Overpass API client-side
  const fetchAndRenderLandmarks = (lat, lon) => {
    if (!landmarkMarkersRef.current) return;
    landmarkMarkersRef.current.clearLayers();
    showToast('Searching nearby landmarks...');

    const query = `
    [out:json];
    (
      node["amenity"](around:5000,${lat},${lon});
      node["shop"](around:5000,${lat},${lon});
      node["tourism"](around:5000,${lat},${lon});
      node["natural"](around:5000,${lat},${lon});
      node["leisure"](around:5000,${lat},${lon});
    );
    out center;
    `;

    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query
    })
      .then(r => {
        if (!r.ok) throw new Error("Overpass error");
        return r.json();
      })
      .then(osmData => {
        if (osmData.elements && landmarkMarkersRef.current) {
          const landmarks = [];
          osmData.elements.slice(0, 100).forEach(elem => {
            let lat_l, lon_l;
            if (elem.center) {
              lat_l = elem.center.lat;
              lon_l = elem.center.lon;
            } else if (elem.lat) {
              lat_l = elem.lat;
              lon_l = elem.lon;
            } else {
              return;
            }

            const tags = elem.tags || {};
            const name = tags.name || 'Unnamed Landmark';
            const amenity = tags.amenity || '';
            const shop = tags.shop || '';
            const tourism = tags.tourism || '';
            const landmark_type = amenity || shop || tourism || 'landmark';

            landmarks.push({
              name,
              type: landmark_type,
              lat: lat_l,
              lon: lon_l
            });
          });

          landmarks.forEach(landmark => {
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
          showToast(`Found ${landmarks.length} landmarks!`);
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

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const { headers, rows } = parseCSV(text);
        
        if (headers.length === 0 || rows.length === 0) {
          showToast('CSV is empty or invalid', 'error');
          setLoading(false);
          return;
        }
        
        // Convert rows to records with injected coordinates
        const parsedRecords = dfToRecords(rows, headers);
        
        // Filter options for columns
        const opts = {};
        const colsToFilter = ['Region', 'Era', 'Condition', 'Primary Threat', 'Deity', 'Location'];
        colsToFilter.forEach(col => {
          if (headers.includes(col)) {
            const uniqueVals = Array.from(new Set(parsedRecords.map(r => r[col]).filter(Boolean))).sort();
            opts[col] = uniqueVals;
          }
        });
        
        setAllRecords(parsedRecords);
        setFilters(opts);
        setUploadedFile({ name: file.name, rows: parsedRecords.length });
        setStagedFilters({});
        setAppliedFilters({});
        
        const initialStats = calculateStats(parsedRecords);
        setRecords(parsedRecords);
        setStats(initialStats);
        
        setLoading(false);
        showToast('Upload successful!');
      } catch (err) {
        setLoading(false);
        showToast('Failed to parse CSV file', 'error');
      }
    };
    reader.onerror = () => {
      setLoading(false);
      showToast('Failed to read CSV file', 'error');
    };
    reader.readAsText(file);
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
    if (records.length === 0) {
      showToast('No records to export', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const headers = Object.keys(records[0]).filter(key => !key.startsWith('_'));
      const csvRows = [];
      csvRows.push(headers.join(','));
      
      records.forEach(rec => {
        const values = headers.map(header => {
          let val = rec[header] || '';
          if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        csvRows.push(values.join(','));
      });
      
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'filtered_temples.csv';
      a.click();
      URL.revokeObjectURL(url);
      
      setLoading(false);
      showToast('Export ready!');
    } catch (err) {
      setLoading(false);
      showToast('Export failed', 'error');
    }
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

    setTimeout(() => {
      const q = text.toLowerCase();
      let botResponse = "";

      if (!allRecords || allRecords.length === 0) {
        botResponse = "Please upload a temple CSV dataset first using the panel on the left, so I can analyze and filter the map for you!";
      }
      else if (q.includes("reset") || q.includes("clear") || q.includes("show all") || q.includes("show-all")) {
        setStagedFilters({});
        setAppliedFilters({});
        applyClientSideFilters(allRecords, {});
        botResponse = "I have reset all filters. Map shows all temples.";
      } 
      else if (q.includes("chola") || q.includes("pallava") || q.includes("thondai")) {
        let region = "";
        if (q.includes("chola")) region = "Chola Mandala";
        else if (q.includes("pallava")) region = "Pallava Mandala";
        else if (q.includes("thondai")) region = "Thondaimandala";
        
        const newFilters = { Region: [region] };
        setStagedFilters(newFilters);
        setAppliedFilters(newFilters);
        applyClientSideFilters(allRecords, newFilters);
        botResponse = `Filtered map for ${region} temples.`;
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
        applyClientSideFilters(allRecords, newFilters);
        botResponse = `Filtered map for temples in ${cond} condition.`;
      }
      else {
        // Simple search in temple names or location
        const match = allRecords.find(rec => 
          (rec['Temple Name'] && rec['Temple Name'].toLowerCase().includes(q)) ||
          (rec['Location'] && rec['Location'].toLowerCase().includes(q))
        );
        if (match) {
          botResponse = `Found temple: ${match['Temple Name']} located in ${match['Location'] || 'Unknown location'}. Era: ${match['Era'] || 'Unknown'}, Condition: ${match['Condition'] || 'Unknown'}. Deity: ${match['Deity'] || 'Unknown'}.`;
        } else {
          botResponse = `I processed your message: "${text}". I couldn't find a direct match. Try asking to filter by region (e.g. Chola, Pallava) or condition (e.g. ruined, neglected), or enter a temple name!`;
        }
      }

      setChatMessages(prev => prev.filter(m => m.id !== tempBotMessageId).concat({
        sender: 'bot',
        text: botResponse
      }));
    }, 600);
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
