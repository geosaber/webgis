// Inicialização do mapa
class WebGIS {
    constructor() {
        this.map = null;
        this.baseLayers = {};
        this.kmlLayers = [];
        this.currentBaseLayer = null;
        
        this.initMap();
        this.initBaseLayers();
        this.initEventListeners();
    }

    // Inicializar o mapa
    initMap() {
        // Centro do mapa (Brasil)
        const center = [-15.7942, -47.8822];
        const zoom = 4;

        // Criar mapa Leaflet
        this.map = L.map('map', {
            center: center,
            zoom: zoom,
            zoomControl: false
        });

        // Adicionar controle de zoom
        L.control.zoom({
            position: 'topright'
        }).addTo(this.map);
    }

    // Inicializar camadas base
    initBaseLayers() {
        // OpenStreetMap
        this.baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        // Terreno (MapLibre)
        this.baseLayers.terrain = L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=get_your_own_OpIi9ZULNHzrESv6T2vL', {
            attribution: '© MapTiler © OpenStreetMap contributors',
            maxZoom: 19
        });

        // Satélite
        this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        });

        // Adicionar OSM como padrão
        this.baseLayers.osm.addTo(this.map);
        this.currentBaseLayer = 'osm';
    }

    // Inicializar event listeners
    initEventListeners() {
        // Controle de mapas base
        document.querySelectorAll('input[name="basemap"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.switchBaseLayer(e.target.value);
            });
        });

        // Upload de arquivo KML
        document.getElementById('kmlFile').addEventListener('change', (e) => {
            this.loadKMLFile(e.target.files[0]);
        });

        // Limpar camadas
        document.getElementById('clearLayers').addEventListener('click', () => {
            this.clearKMLayers();
        });
    }

    // Trocar mapa base
    switchBaseLayer(layerName) {
        if (this.currentBaseLayer && this.baseLayers[this.currentBaseLayer]) {
            this.map.removeLayer(this.baseLayers[this.currentBaseLayer]);
        }
        
        if (this.baseLayers[layerName]) {
            this.baseLayers[layerName].addTo(this.map);
            this.currentBaseLayer = layerName;
        }
    }

    // Carregar arquivo KML
    async loadKMLFile(file) {
        if (!file) return;

        this.showLoading(true);

        try {
            const kmlLayer = omnivore.kml(file)
                .on('ready', () => {
                    this.processKMLayer(kmlLayer);
                    this.showLoading(false);
                })
                .on('error', (error) => {
                    console.error('Erro ao carregar KML:', error);
                    alert('Erro ao carregar arquivo KML. Verifique o formato do arquivo.');
                    this.showLoading(false);
                });

            kmlLayer.addTo(this.map);
            this.kmlLayers.push(kmlLayer);

            // Ajustar view para a camada
            this.map.fitBounds(kmlLayer.getBounds());

        } catch (error) {
            console.error('Erro no processamento do KML:', error);
            alert('Erro no processamento do arquivo KML.');
            this.showLoading(false);
        }
    }

    // Processar camada KML e calcular geometrias
    processKMLayer(kmlLayer) {
        const features = kmlLayer.toGeoJSON().features;
        const geometryInfo = document.getElementById('geometryInfo');
        
        geometryInfo.innerHTML = '<h5>📊 Informações Geométricas</h5>';

        features.forEach((feature, index) => {
            const geomInfo = this.calculateGeometry(feature);
            const featureElement = this.createFeatureInfoElement(feature, geomInfo, index);
            geometryInfo.appendChild(featureElement);
        });
    }

    // Calcular propriedades geométricas
    calculateGeometry(feature) {
        const geometry = feature.geometry;
        const properties = feature.properties || {};
        const name = properties.name || `Feature ${Date.now()}`;
        
        let info = {
            name: name,
            type: geometry.type,
            area: null,
            length: null,
            coordinates: null
        };

        try {
            switch (geometry.type) {
                case 'Polygon':
                    info.area = this.calculateArea(geometry);
                    info.length = this.calculatePerimeter(geometry);
                    info.coordinates = this.getCenterCoordinates(geometry);
                    break;

                case 'LineString':
                    info.length = this.calculateLength(geometry);
                    info.coordinates = this.getLineCoordinates(geometry);
                    break;

                case 'Point':
                    info.coordinates = this.getPointCoordinates(geometry);
                    break;

                case 'MultiPolygon':
                    info.area = this.calculateMultiPolygonArea(geometry);
                    info.length = this.calculateMultiPolygonPerimeter(geometry);
                    info.coordinates = this.getMultiPolygonCenter(geometry);
                    break;

                default:
                    console.warn('Tipo de geometria não suportado:', geometry.type);
            }
        } catch (error) {
            console.error('Erro no cálculo geométrico:', error);
        }

        return info;
    }

    // Calcular área (Polígono)
    calculateArea(geometry) {
        return turf.area(geometry);
    }

    // Calcular perímetro (Polígono)
    calculatePerimeter(geometry) {
        const line = turf.polygonToLine(geometry);
        return turf.length(line, { units: 'kilometers' });
    }

    // Calcular comprimento (Linha)
    calculateLength(geometry) {
        return turf.length(geometry, { units: 'kilometers' });
    }

    // Calcular área para MultiPolygon
    calculateMultiPolygonArea(geometry) {
        return turf.area(geometry);
    }

    // Calcular perímetro para MultiPolygon
    calculateMultiPolygonPerimeter(geometry) {
        let totalPerimeter = 0;
        geometry.coordinates.forEach(polygon => {
            const poly = turf.polygon(polygon);
            const line = turf.polygonToLine(poly);
            totalPerimeter += turf.length(line, { units: 'kilometers' });
        });
        return totalPerimeter;
    }

    // Obter coordenadas do centro (Polígono)
    getCenterCoordinates(geometry) {
        const center = turf.center(geometry);
        return center.geometry.coordinates;
    }

    // Obter coordenadas (Linha)
    getLineCoordinates(geometry) {
        // Retorna o ponto médio da linha
        const along = turf.along(geometry, turf.length(geometry) / 2);
        return along.geometry.coordinates;
    }

    // Obter coordenadas (Ponto)
    getPointCoordinates(geometry) {
        return geometry.coordinates;
    }

    // Obter centro para MultiPolygon
    getMultiPolygonCenter(geometry) {
        const center = turf.center(geometry);
        return center.geometry.coordinates;
    }

    // Criar elemento HTML para informações da feature
    createFeatureInfoElement(feature, geomInfo, index) {
        const div = document.createElement('div');
        div.className = 'geometry-item';
        
        let content = `<strong>${geomInfo.name}</strong><br>`;
        content += `<small>Tipo: ${geomInfo.type}</small><br>`;

        if (geomInfo.area !== null) {
            content += `Área: ${(geomInfo.area / 1000000).toFixed(2)} km²<br>`;
        }

        if (geomInfo.length !== null) {
            content += `Comprimento: ${geomInfo.length.toFixed(2)} km<br>`;
        }

        if (geomInfo.coordinates) {
            const [lng, lat] = geomInfo.coordinates;
            content += `Coordenadas: ${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
        }

        div.innerHTML = content;
        return div;
    }

    // Limpar camadas KML
    clearKMLayers() {
        this.kmlLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.kmlLayers = [];
        
        document.getElementById('geometryInfo').innerHTML = 
            '<p>Carregue um arquivo KML para ver as informações geométricas</p>';
        
        document.getElementById('kmlFile').value = '';
    }

    // Mostrar/ocultar loading
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
}

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new WebGIS();
});

// Adicionar informações sobre como usar
console.log(`
🌍 WebGIS Inicializado!

Funcionalidades:
- Múltiplos mapas base (OSM, Terreno, Satélite)
- Upload de arquivos KML
- Cálculo automático de áreas e comprimentos
- Visualização de coordenadas
- Interface responsiva

Como usar:
1. Escolha um mapa base
2. Faça upload de um arquivo KML
3. Veja as informações geométricas no painel lateral
4. Use o botão "Limpar" para remover camadas
`);