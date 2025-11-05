// Configurações globais
let map;
let drawnItems;
let currentBasemap = 'osm';

// Basemaps
const basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap'
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO'
    })
};

// Inicializar aplicação
function initializeApp() {
    initializeMap();
    initializeDrawingTools();
    setupEventListeners();
    updateCoordinateDisplay(-23.5505, -46.6333);
}

// Inicializar mapa
function initializeMap() {
    map = L.map('map', {
        center: [-23.5505, -46.6333],
        zoom: 10,
        zoomControl: false  // Remover controle padrão para customizar posição
    });

    // Adicionar controle de zoom personalizado
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Mapa base inicial
    basemaps.osm.addTo(map);
    currentBasemap = 'osm';

    // Camada para desenhos
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Evento de movimento do mouse para coordenadas
    map.on('mousemove', (e) => {
        updateCoordinateDisplay(e.latlng.lat, e.latlng.lng);
    });

    // Evento de clique para informações
    map.on('click', (e) => {
        updateFeatureInfo('Clique em um elemento do mapa para ver detalhes');
    });
}

// Inicializar ferramentas de desenho
function initializeDrawingTools() {
    const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polygon: {
                shapeOptions: {
                    color: '#667eea',
                    fillColor: '#667eea',
                    fillOpacity: 0.3
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#e74c3c',
                    fillColor: '#e74c3c',
                    fillOpacity: 0.3
                }
            },
            marker: {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '📍',
                    iconSize: [24, 24]
                })
            },
            circle: false,
            circlemarker: false,
            polyline: false
        },
        edit: {
            featureGroup: drawnItems
        }
    });

    map.addControl(drawControl);

    // Eventos de desenho
    map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        calculateTotalArea();
        
        // Adicionar popup
        if (layer instanceof L.Polygon) {
            const area = turf.area(layer.toGeoJSON());
            layer.bindPopup(`Área: ${(area / 10000).toFixed(2)} ha`);
        }
    });

    map.on(L.Draw.Event.EDITED, calculateTotalArea);
    map.on(L.Draw.Event.DELETED, calculateTotalArea);
}

// Configurar event listeners
function setupEventListeners() {
    // Seletor de mapa base
    document.getElementById('basemap-selector').addEventListener('change', (e) => {
        updateBasemap(e.target.value);
    });

    // Upload de arquivo
    document.getElementById('file-input').addEventListener('change', handleFileUpload);

    // Botão calcular área
    document.getElementById('calculate-area').addEventListener('click', calculateTotalArea);

    // Ferramentas de desenho
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tool = e.currentTarget.dataset.tool;
            activateTool(tool);
        });
    });

    // Toggle panels
    document.querySelectorAll('.toggle-panel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panel = e.currentTarget.closest('.control-panel, .info-panel');
            panel.classList.toggle('panel-collapsed');
            e.currentTarget.textContent = panel.classList.contains('panel-collapsed') ? '+' : '−';
        });
    });
}

// Ativar ferramenta
function activateTool(tool) {
    // Remover classe active de todos os botões
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Adicionar classe active ao botão clicado
    event.currentTarget.classList.add('active');

    switch(tool) {
        case 'polygon':
            new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
            break;
        case 'rectangle':
            new L.Draw.Rectangle(map, drawControl.options.draw.rectangle).enable();
            break;
        case 'marker':
            new L.Draw.Marker(map, drawControl.options.draw.marker).enable();
            break;
        case 'clear':
            drawnItems.clearLayers();
            calculateTotalArea();
            break;
    }
}

// Atualizar mapa base
function updateBasemap(basemapKey) {
    if (basemaps[currentBasemap]) {
        map.removeLayer(basemaps[currentBasemap]);
    }
    
    if (basemaps[basemapKey]) {
        basemaps[basemapKey].addTo(map);
        currentBasemap = basemapKey;
    }
}

// ... (mantenha as outras funções do código anterior)

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeApp);
