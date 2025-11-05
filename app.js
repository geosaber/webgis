// Configurações e variáveis globais
let map;
let draw;
let currentBasemap = 'osm';
let loadedLayers = [];
let drawnFeatures = [];

// Basemaps configuration
const basemaps = {
    osm: {
        name: 'OpenStreetMap',
        style: {
            version: 8,
            sources: {
                'osm-tiles': {
                    type: 'raster',
                    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenStreetMap contributors'
                }
            },
            layers: [{
                id: 'osm-tiles',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
                maxzoom: 19
            }]
        }
    },
    satellite: {
        name: 'Satélite ESRI',
        style: {
            version: 8,
            sources: {
                'esri-satellite': {
                    type: 'raster',
                    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256,
                    attribution: '© Esri, Earthstar Geographics'
                }
            },
            layers: [{
                id: 'esri-satellite',
                type: 'raster',
                source: 'esri-satellite',
                minzoom: 0,
                maxzoom: 19
            }]
        }
    },
    topo: {
        name: 'OpenTopoMap',
        style: {
            version: 8,
            sources: {
                'opentopomap': {
                    type: 'raster',
                    tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenTopoMap contributors'
                }
            },
            layers: [{
                id: 'opentopomap',
                type: 'raster',
                source: 'opentopomap',
                minzoom: 0,
                maxzoom: 17
            }]
        }
    },
    carto: {
        name: 'Carto DB',
        style: {
            version: 8,
            sources: {
                'carto-dark': {
                    type: 'raster',
                    tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© CARTO'
                }
            },
            layers: [{
                id: 'carto-dark',
                type: 'raster',
                source: 'carto-dark',
                minzoom: 0,
                maxzoom: 19
            }]
        }
    },
    vector: {
        name: 'Vector Tiles OSM',
        style: 'https://demotiles.maplibre.org/style.json'
    }
};

// Inicializar a aplicação
function initializeApp() {
    initializeMap();
    setupEventListeners();
    updateStatus('Aplicação inicializada. Pronto para usar!', 'info');
}

// Inicializar o mapa
function initializeMap() {
    try {
        map = new maplibregl.Map({
            container: 'map',
            style: basemaps.osm.style,
            center: [-46.6333, -23.5505], // São Paulo
            zoom: 10,
            attributionControl: true
        });

        // Adicionar controles de navegação
        map.addControl(new maplibregl.NavigationControl());

        // Inicializar ferramenta de desenho
        initializeDrawingTools();

        // Evento quando o mapa carregar
        map.on('load', () => {
            updateStatus('Mapa carregado com sucesso!', 'success');
            console.log('Mapa inicializado e carregado');
        });

    } catch (error) {
        updateStatus(`Erro ao inicializar mapa: ${error.message}`, 'error');
        console.error('Erro na inicialização do mapa:', error);
    }
}

// Inicializar ferramentas de desenho
function initializeDrawingTools() {
    draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true
        },
        styles: [
            {
                'id': 'gl-draw-polygon-fill',
                'type': 'fill',
                'filter': ['all', ['==', '$type', 'Polygon']],
                'paint': {
                    'fill-color': '#ff0000',
                    'fill-opacity': 0.3
                }
            },
            {
                'id': 'gl-draw-polygon-stroke',
                'type': 'line',
                'filter': ['all', ['==', '$type', 'Polygon']],
                'paint': {
                    'line-color': '#ff0000',
                    'line-width': 2
                }
            }
        ]
    });

    map.addControl(draw);

    // Eventos do desenho
    map.on('draw.create', updateArea);
    map.on('draw.update', updateArea);
    map.on('draw.delete', updateArea);
}

// Atualizar basemap
function updateBasemap(basemapKey) {
    if (!map) return;

    const basemap = basemaps[basemapKey];
    if (!basemap) {
        updateStatus('Basemap não encontrado', 'error');
        return;
    }

    try {
        if (basemapKey === 'vector') {
            map.setStyle(basemap.style);
        } else {
            map.setStyle(basemap.style);
        }
        
        currentBasemap = basemapKey;
        updateStatus(`Mapa base alterado para: ${basemap.name}`, 'info');

        // Re-adicionar o controle de desenho após mudar o estilo
        setTimeout(() => {
            if (map.getControl('MapboxDraw')) {
                map.removeControl(draw);
            }
            map.addControl(draw);
        }, 500);

    } catch (error) {
        updateStatus(`Erro ao alterar mapa base: ${error.message}`, 'error');
    }
}

// Carregar arquivo GeoJSON ou KML
function handleFileUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                let geojsonData;
                
                if (file.name.toLowerCase().endsWith('.kml') || file.name.toLowerCase().endsWith('.kmz')) {
                    // Converter KML para GeoJSON (simulação - em produção use togeojson library)
                    geojsonData = parseKML(e.target.result);
                } else {
                    geojsonData = JSON.parse(e.target.result);
                }
                
                addGeoJSONToMap(geojsonData, file.name);
                updateFileInfo(file.name, geojsonData);
                
            } catch (error) {
                updateStatus(`Erro ao processar arquivo ${file.name}: ${error.message}`, 'error');
                console.error('Erro no processamento:', error);
            }
        };
        
        reader.onerror = function() {
            updateStatus(`Erro ao ler arquivo ${file.name}`, 'error');
        };
        
        reader.readAsText(file);
    });
}

// Simulação de parser KML (em produção, use a biblioteca togeojson)
function parseKML(kmlText) {
    // Esta é uma simulação simples. Em produção, use:
    // npm install @tmcw/togeojson
    updateStatus('Conversão KML para GeoJSON simulada. Em produção, use a biblioteca togeojson.', 'warning');
    
    // Retornar um GeoJSON de exemplo
    return {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            properties: {
                name: "Área do KML",
                description: "Arquivo KML carregado"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-46.6333, -23.5505],
                    [-46.6333, -23.5405],
                    [-46.6233, -23.5405],
                    [-46.6233, -23.5505],
                    [-46.6333, -23.5505]
                ]]
            }
        }]
    };
}

// Adicionar GeoJSON ao mapa
function addGeoJSONToMap(geojsonData, fileName) {
    if (!map || !geojsonData) return;

    const sourceId = `geojson-${fileName}-${Date.now()}`;
    const layerId = `layer-${sourceId}`;

    try {
        // Adicionar fonte
        map.addSource(sourceId, {
            type: 'geojson',
            data: geojsonData
        });

        // Adicionar camada de preenchimento para polígonos
        if (geojsonData.features.some(f => f.geometry.type === 'Polygon')) {
            map.addLayer({
                id: `${layerId}-fill`,
                type: 'fill',
                source: sourceId,
                paint: {
                    'fill-color': '#0080ff',
                    'fill-opacity': 0.4
                },
                filter: ['==', '$type', 'Polygon']
            });
        }

        // Adicionar camada de linha
        map.addLayer({
            id: `${layerId}-line`,
            type: 'line',
            source: sourceId,
            paint: {
                'line-color': '#0066cc',
                'line-width': 2
            }
        });

        // Adicionar camada de pontos
        if (geojsonData.features.some(f => f.geometry.type === 'Point')) {
            map.addLayer({
                id: `${layerId}-point`,
                type: 'circle',
                source: sourceId,
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#ff0000',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                },
                filter: ['==', '$type', 'Point']
            });
        }

        // Salvar referência da camada
        loadedLayers.push({
            sourceId: sourceId,
            layerIds: [`${layerId}-fill`, `${layerId}-line`, `${layerId}-point`].filter(id => map.getLayer(id)),
            fileName: fileName,
            data: geojsonData
        });

        // Ajustar zoom para a extensão dos dados
        const coordinates = [];
        geojsonData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                coordinates.push(...getAllCoordinates(feature.geometry));
            }
        });

        if (coordinates.length > 0) {
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
            
            map.fitBounds(bounds, { padding: 20 });
        }

        updateStatus(`Arquivo ${fileName} carregado com sucesso!`, 'success');
        calculateTotalArea();

    } catch (error) {
        updateStatus(`Erro ao adicionar GeoJSON ao mapa: ${error.message}`, 'error');
        console.error('Erro ao adicionar camada:', error);
    }
}

// Extrair todas as coordenadas de uma geometria
function getAllCoordinates(geometry) {
    const coordinates = [];
    
    function extractCoords(coords) {
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            coordinates.push(coords);
        } else {
            coords.forEach(extractCoords);
        }
    }
    
    if (geometry.type === 'Point') {
        coordinates.push(geometry.coordinates);
    } else {
        extractCoords(geometry.coordinates);
    }
    
    return coordinates.flat();
}

// Atualizar informações do arquivo
function updateFileInfo(fileName, geojsonData) {
    const fileInfo = document.getElementById('file-info');
    const featureCount = geojsonData.features.length;
    const geometryTypes = {};
    
    geojsonData.features.forEach(feature => {
        const type = feature.geometry.type;
        geometryTypes[type] = (geometryTypes[type] || 0) + 1;
    });
    
    let infoHTML = `
        <div><strong>Arquivo:</strong> ${fileName}</div>
        <div><strong>Features:</strong> ${featureCount}</div>
        <div><strong>Tipos:</strong> ${Object.keys(geometryTypes).join(', ')}</div>
    `;
    
    fileInfo.innerHTML = infoHTML;
}

// Calcular área total
function calculateTotalArea() {
    let totalArea = 0;
    let polygonCount = 0;

    // Calcular área das features carregadas
    loadedLayers.forEach(layer => {
        layer.data.features.forEach(feature => {
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                const area = turf.area(feature.geometry); // Área em metros quadrados
                totalArea += area;
                polygonCount++;
            }
        });
    });

    // Calcular área dos desenhos
    const drawnData = draw.getAll();
    drawnData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            const area = turf.area(feature.geometry);
            totalArea += area;
            polygonCount++;
        }
    });

    // Converter para km² e hectares
    const areaKm2 = totalArea / 1000000;
    const areaHectares = totalArea / 10000;

    // Atualizar interface
    document.getElementById('total-area').textContent = areaKm2.toFixed(2);
    document.getElementById('area-hectares').textContent = areaHectares.toFixed(2);
    document.getElementById('polygon-count').textContent = polygonCount;

    updateStatus(`Área calculada: ${areaKm2.toFixed(2)} km² (${areaHectares.toFixed(2)} ha)`, 'info');
}

// Atualizar área quando desenhar
function updateArea() {
    calculateTotalArea();
}

// Limpar todos os dados
function clearAll() {
    // Remover camadas carregadas
    loadedLayers.forEach(layer => {
        layer.layerIds.forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
        });
        if (map.getSource(layer.sourceId)) {
            map.removeSource(layer.sourceId);
        }
    });
    
    loadedLayers = [];
    
    // Limpar desenhos
    draw.deleteAll();
    
    // Limpar interface
    document.getElementById('file-info').innerHTML = '';
    document.getElementById('total-area').textContent = '0.00';
    document.getElementById('area-hectares').textContent = '0.00';
    document.getElementById('polygon-count').textContent = '0';
    document.getElementById('file-input').value = '';
    
    updateStatus('Todos os dados foram removidos', 'info');
}

// Configurar event listeners
function setupEventListeners() {
    // Seletor de basemap
    document.getElementById('basemap-selector').addEventListener('change', (e) => {
        updateBasemap(e.target.value);
    });

    // Upload de arquivo
    document.getElementById('file-input').addEventListener('change', handleFileUpload);

    // Botão calcular área
    document.getElementById('calculate-area').addEventListener('click', calculateTotalArea);

    // Botão limpar tudo
    document.getElementById('clear-all').addEventListener('click', clearAll);

    // Ferramentas de desenho
    document.getElementById('draw-polygon').addEventListener('click', () => {
        draw.changeMode('draw_polygon');
        setActiveTool('draw-polygon');
    });

    document.getElementById('draw-rectangle').addEventListener('click', () => {
        draw.changeMode('draw_rectangle');
        setActiveTool('draw-rectangle');
    });

    document.getElementById('clear-drawing').addEventListener('click', () => {
        draw.deleteAll();
        updateArea();
    });
}

// Definir ferramenta ativa
function setActiveTool(toolId) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(toolId).classList.add('active');
}

// Atualizar status
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    const consoleOutput = document.getElementById('console-output');
    
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }
    
    if (consoleOutput) {
        const timestamp = new Date().toLocaleTimeString();
        consoleOutput.textContent += `[${timestamp}] ${message}\n`;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
    
    console.log(`[${type}] ${message}`);
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeApp);
