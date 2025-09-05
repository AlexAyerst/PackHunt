import React, { useState, useCallback } from 'react';

const HexMapEditor = () => {
  const MAP_RADIUS = 16;
  
  // Cell types with colors and labels
  const CELL_TYPES = {
    unknown: { color: '#2a2a2a', label: '', name: 'Unknown' },
    camp: { color: '#4ade80', label: '🏕️', name: 'Camp' },
    field: {color:'#4ade80', label:'🌾', name: 'Field' },
    signal: { color: '#fbbf24', label: '📡', name: 'Unknown Signal' },
    mountain: { color: '#78716c', label: '⛰️', name: 'Mountain' },
    lake: { color: '#3b82f6', label: '💧', name: 'Lake' },
    chest: { color: '#f59e0b', label: '📦', name: 'Chest' },
    mine: { color: '#dc2626', label: '⛏️', name: 'Mine' },
    enemy: { color: '#dc2626', label: '🗡️', name: 'Enemy Encampment' }
  };

  // Generate hexagonal coordinates
  const generateHexCoords = () => {
    const coords = [];
    for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
      const r1 = Math.max(-MAP_RADIUS, -q - MAP_RADIUS);
      const r2 = Math.min(MAP_RADIUS, -q + MAP_RADIUS);
      for (let r = r1; r <= r2; r++) {
        coords.push({ q, r, s: -q - r });
      }
    }
    return coords;
  };

  const hexCoords = generateHexCoords();
  
  // Initialize map state with center as camp, rest as unknown
  const [mapState, setMapState] = useState(() => {
    const initialState = {};
    hexCoords.forEach(coord => {
      const key = `${coord.q},${coord.r}`;
      // Center hex (0,0) is camp
      initialState[key] = (coord.q === 0 && coord.r === 0) ? 'camp' : 'unknown';
    });
    return initialState;
  });

  const [selectedType, setSelectedType] = useState('unknown');
  const [showGrid, setShowGrid] = useState(true);
  const [pathfindingMode, setPathfindingMode] = useState(false);
  const [pathDestination, setPathDestination] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);

  // Convert hex coordinates to pixel coordinates (flat-top grid layout)
  const hexToPixel = (q, r) => {
    const size = 15;
    // Flat-top hexagon grid layout - hexagons arranged with flat tops/bottoms
    const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
    const y = size * (3/2 * r);
    return { x, y };
  };

  // Get neighboring hexes
  const getNeighbors = (q, r) => {
    const directions = [
      [1, 0], [1, -1], [0, -1],
      [-1, 0], [-1, 1], [0, 1]
    ];
    return directions.map(([dq, dr]) => ({
      q: q + dq,
      r: r + dr,
      s: -(q + dq) - (r + dr)
    })).filter(coord => {
      // Check if coordinate is within map bounds
      return Math.abs(coord.q) <= MAP_RADIUS && 
             Math.abs(coord.r) <= MAP_RADIUS && 
             Math.abs(coord.s) <= MAP_RADIUS;
    });
  };

  // Check if a cell is traversable (discovered and not mountain/lake)
  const isTraversable = (q, r) => {
    const key = `${q},${r}`;
    const cellType = mapState[key];
    // Must be discovered (not unknown) and not impassable terrain
    return cellType !== 'mountain' && cellType !== 'lake';
  };

  // A* pathfinding algorithm for hex grid
  const findPath = (startQ, startR, endQ, endR) => {
    const start = { q: startQ, r: startR };
    const end = { q: endQ, r: endR };
    
    // Check if destination is reachable
    if (!isTraversable(endQ, endR)) {
      return [];
    }

    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    const getKey = (coord) => `${coord.q},${coord.r}`;
    const hexDistance = (a, b) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
    
    gScore.set(getKey(start), 0);
    fScore.set(getKey(start), hexDistance(start, end));
    
    while (openSet.length > 0) {
      // Find node with lowest fScore
      let current = openSet[0];
      let currentIndex = 0;
      
      for (let i = 1; i < openSet.length; i++) {
        if (fScore.get(getKey(openSet[i])) < fScore.get(getKey(current))) {
          current = openSet[i];
          currentIndex = i;
        }
      }
      
      // Remove current from openSet
      openSet.splice(currentIndex, 1);
      
      // Check if we reached the goal
      if (current.q === end.q && current.r === end.r) {
        // Reconstruct path
        const path = [];
        let temp = current;
        
        while (temp) {
          path.unshift(temp);
          temp = cameFrom.get(getKey(temp));
        }
        
        return path;
      }
      
      // Check neighbors
      const neighbors = getNeighbors(current.q, current.r);
      
      for (const neighbor of neighbors) {
        if (!isTraversable(neighbor.q, neighbor.r)) {
          continue;
        }
        
        const tentativeGScore = gScore.get(getKey(current)) + 1;
        const neighborKey = getKey(neighbor);
        
        if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeGScore);
          fScore.set(neighborKey, tentativeGScore + hexDistance(neighbor, end));
          
          // Add to openSet if not already present
          if (!openSet.some(node => node.q === neighbor.q && node.r === neighbor.r)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    
    return []; // No path found
  };

  // Handle hex click
  const handleHexClick = (coord) => {
    const key = `${coord.q},${coord.r}`;
    
    if (pathfindingMode) {
      // Pathfinding mode - calculate route from camp to clicked hex
      const path = findPath(0, 0, coord.q, coord.r);
      setCurrentPath(path);
      setPathDestination(coord);
    } else {
      // Edit mode - set cell type
      // Don't allow changing the center camp
      if (coord.q === 0 && coord.r === 0) return;
      
      setMapState(prev => ({
        ...prev,
        [key]: selectedType
      }));
    }
  };

  // Export map data
  const exportMap = () => {
    const exportData = {
      radius: MAP_RADIUS,
      cells: mapState,
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'guild_map.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import map data
  const importMap = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData.cells) {
          setMapState(importedData.cells);
        }
      } catch (error) {
        alert('Error importing map data');
      }
    };
    reader.readAsText(file);
  };

  // Clear all cells (except camp)
  const clearMap = () => {
    setMapState(prev => {
      const newState = {};
      hexCoords.forEach(coord => {
        const key = `${coord.q},${coord.r}`;
        newState[key] = (coord.q === 0 && coord.r === 0) ? 'camp' : 'unknown';
      });
      return newState;
    });
    // Clear pathfinding when map is cleared
    setCurrentPath([]);
    setPathDestination(null);
  };

  // Toggle pathfinding mode
  const togglePathfinding = () => {
    setPathfindingMode(!pathfindingMode);
    setCurrentPath([]);
    setPathDestination(null);
  };

  // Generate hex path (rotate individual cells by 30 degrees)
  const generateHexPath = (size = 15) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      // Rotate each hexagon cell by 30 degrees
      const angle = (Math.PI / 3) * i + (Math.PI / 6);
      const x = size * Math.cos(angle);
      const y = size * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return `M${points.join('L')}Z`;
  };

  return (
    <div className="w-full min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Guild Map Editor</h1>
        
        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {Object.entries(CELL_TYPES).filter(([type]) => type !== 'camp').map(([type, config]) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedType === type 
                    ? 'border-blue-400 bg-blue-900' 
                    : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="text-2xl mb-1">{config.label || '⬡'}</div>
                <div className="text-sm">{config.name}</div>
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={togglePathfinding}
              className={`px-4 py-2 rounded-lg transition-colors ${
                pathfindingMode 
                  ? 'bg-purple-600 hover:bg-purple-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              {pathfindingMode ? '📍 Exit Pathfinding' : '🗺️ Find Route'}
            </button>
            
            <button
              onClick={() => setShowGrid(!showGrid)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              {showGrid ? 'Hide' : 'Show'} Grid
            </button>
            
            <button
              onClick={clearMap}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
            >
              Clear Map
            </button>
            
            <button
              onClick={exportMap}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
            >
              Export Map
            </button>
            
            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer">
              Import Map
              <input
                type="file"
                accept=".json"
                onChange={importMap}
                className="hidden"
              />
            </label>
          </div>
          
          {pathfindingMode && (
            <div className="mt-4 p-3 bg-purple-900 rounded-lg">
              <p className="text-sm">
                🗺️ <strong>Pathfinding Mode:</strong> Click on any cell to find the shortest route from your camp.
                {pathDestination && (
                  <span className="block mt-1">
                    Route to ({pathDestination.q}, {pathDestination.r}): {currentPath.length > 0 ? `${currentPath.length} steps` : 'No path available'}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="bg-gray-800 rounded-lg p-4 overflow-auto">
          <div className="flex justify-center">
            <svg 
              width="800" 
              height="800" 
              viewBox="-450 -450 900 900"
              className="border border-gray-600 rounded-lg bg-gray-900"
            >
              <g>
                {hexCoords.map(coord => {
                  const { x, y } = hexToPixel(coord.q, coord.r);
                  const key = `${coord.q},${coord.r}`;
                  const cellType = mapState[key];
                  const config = CELL_TYPES[cellType];
                  const isOnPath = currentPath.some(pathCoord => pathCoord.q === coord.q && pathCoord.r === coord.r);
                  const isDestination = pathDestination && pathDestination.q === coord.q && pathDestination.r === coord.r;
                  
                  return (
                    <g key={key} transform={`translate(${x}, ${y})`}>
                      {/* Path highlighting */}
                      {isOnPath && (
                        <path
                          d={generateHexPath(18)}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="3"
                          className="pointer-events-none"
                        />
                      )}
                      
                      {/* Destination highlighting */}
                      {isDestination && (
                        <path
                          d={generateHexPath(20)}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="4,2"
                          className="pointer-events-none"
                        />
                      )}
                      
                      {/* Hex cell */}
                      <path
                        d={generateHexPath()}
                        fill={config.color}
                        stroke={showGrid ? '#4b5563' : config.color}
                        strokeWidth={showGrid ? 0.5 : 0}
                        className={`transition-opacity ${
                          pathfindingMode 
                            ? 'cursor-crosshair hover:opacity-80' 
                            : 'cursor-pointer hover:opacity-80'
                        }`}
                        onClick={() => handleHexClick(coord)}
                      />
                      
                      {/* Cell label */}
                      <text
                        x="0"
                        y="5"
                        textAnchor="middle"
                        fontSize="12"
                        fill="white"
                        className="pointer-events-none select-none"
                      >
                        {config.label}
                      </text>
                      
                      {/* Path step number */}
                      {isOnPath && pathfindingMode && (
                        <text
                          x="8"
                          y="-8"
                          textAnchor="middle"
                          fontSize="8"
                          fill="#a855f7"
                          fontWeight="bold"
                          className="pointer-events-none select-none"
                        >
                          {currentPath.findIndex(pathCoord => pathCoord.q === coord.q && pathCoord.r === coord.r) + 1}
                        </text>
                      )}
                      
                      {/* Coordinates (for debugging) */}
                      {showGrid && (
                        <text
                          x="0"
                          y="-8"
                          textAnchor="middle"
                          fontSize="6"
                          fill="#9ca3af"
                          className="pointer-events-none select-none"
                        >
                          {coord.q},{coord.r}
                        </text>
                      )}
                    </g>
                  );
                })}
                
                {/* Path lines */}
                {currentPath.length > 1 && (
                  <g className="pointer-events-none">
                    {currentPath.slice(0, -1).map((coord, index) => {
                      const start = hexToPixel(coord.q, coord.r);
                      const end = hexToPixel(currentPath[index + 1].q, currentPath[index + 1].r);
                      
                      return (
                        <line
                          key={`path-${index}`}
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          stroke="#a855f7"
                          strokeWidth="2"
                          strokeDasharray="3,3"
                        />
                      );
                    })}
                  </g>
                )}
              </g>
            </svg>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
          <h3 className="text-lg font-semibold mb-3">Instructions</h3>
          <ul className="text-sm space-y-2">
            <li>• <strong>Edit Mode:</strong> Select a cell type from the controls above, then click on hexes to set their type</li>
            <li>• <strong>Pathfinding Mode:</strong> Click "Find Route" then click any discovered cell to see the shortest path from camp</li>
            <li>• The center hex is always your camp and cannot be changed</li>
            <li>• Routes only use discovered cells and avoid mountains/lakes (impassable terrain)</li>
            <li>• Purple highlights show the optimal path with step numbers</li>
            <li>• Use Export Map to save your progress as a JSON file</li>
            <li>• Use Import Map to load previously saved map data</li>
            <li>• Share exported files between guilds to collate exploration findings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HexMapEditor;