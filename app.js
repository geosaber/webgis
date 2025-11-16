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

        // Terreno (Usando OpenTopoMap como alternativa)
        this.baseLayers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, © OpenTopoMap',
            maxZoom: 17
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
            const fileContent = await this.readFileAsText(file);
            this.processKMLContent(fileContent, file.name);
        } catch (error) {
            console.error('Erro ao ler arquivo:', error);
            alert('Erro ao ler o arquivo. Verifique se é um KML válido.');
            this.showLoading(false);
        }
    }

    // Ler arquivo como texto
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // Processar conteúdo KML
    async processKMLContent(kmlContent, fileName) {
        try {
            // Criar um blob URL para o KML
            const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
            const url = URL.createObjectURL(blob);

            // Usar o plugin omnivore para carregar o KML
            const kmlLayer = omnivore.kml(url)
                .on('ready', () => {
                    this.onKMLReady(kmlLayer, fileName);
                    URL.revokeObjectURL(url); // Limpar URL
                })
                .on('error', (error) => {
                    console.error('Erro omnivore:', error);
                    this.tryAlternativeKMLParse(kmlContent, fileName);
                    URL.revokeObjectURL(url);
                });

            kmlLayer.addTo(this.map);
            this.kmlLayers.push(kmlLayer);

        } catch (error) {
            console.error('Erro no processamento KML:', error);
            this.tryAlternativeKMLParse(kmlContent, fileName);
        }
    }

    // Método alternativo para parsing KML
    tryAlternativeKMLParse(kmlContent, fileName) {
        try {
            // Tentar usar o parser de KML nativo do Leaflet
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
            
            // Verificar se há erros no XML
            const parseError = xmlDoc.getElementsByTagName('parsererror');
            if (parseError.length > 0) {
                throw new Error('Erro de parsing XML: ' + parseError[0].textContent);
            }

            // Processar manualmente o KML
            this.processKMLManual(xmlDoc, fileName);
            
        } catch (error) {
            console.error('Erro no parsing alternativo:', error);
            alert('Erro ao processar arquivo KML. Verifique o formato.');
            this.showLoading(false);
        }
    }

    // Processar KML manualmente
    processKMLManual(xmlDoc, fileName) {
        const places = xmlDoc.getElementsByTagName('Placemark');
        const features = [];

        for (let placemark of places) {
            const feature = this.parsePlacemark(placemark);
            if (feature) {
                features.push(feature);
            }
        }

        if (features.length > 0) {
            const geoJSON = {
                type: 'FeatureCollection',
                features: features
            };
            
            const kmlLayer = L.geoJSON(geoJSON, {
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup(`<b>${feature.properties.name}</b>`);
                    }
                },
                style: {
                    color: '#3388ff',
                    weight: 2,
                    fillColor: '#3388ff',
                    fillOpacity: 0.2
                }
            });

            this.kmlLayers.push(kmlLayer);
            kmlLayer.addTo(this.map);
            this.map.fitBounds(kmlLayer.getBounds());
            this.displayGeometryInfo(geoJSON);
        } else {
            alert('Nenhuma geometria válida encontrada no arquivo KML.');
        }

        this.showLoading(false);
    }

    // Parse individual de Placemark
    parsePlacemark(placemark) {
        try {
            const nameElement = placemark.getElementsByTagName('name')[0];
            const name = nameElement ? nameElement.textContent : 'Sem nome';
            
            // Tentar diferentes tipos de geometria
            const geometry = this.parseGeometry(placemark);
            if (!geometry) return null;

            return {
                type: 'Feature',
                properties: { name: name },
                geometry: geometry
            };
        } catch (error) {
            console.warn('Erro ao parsear placemark:', error);
            return null;
        }
    }

    // Parse de geometria
    parseGeometry(placemark) {
        // Polígono
        const polygon = placemark.getElementsByTagName('Polygon')[0];
        if (polygon) {
            return this.parsePolygon(polygon);
        }

        // Linha
        const lineString = placemark.getElementsByTagName('LineString')[0];
        if (lineString) {
            return this.parseLineString(lineString);
        }

        // Ponto
        const point = placemark.getElementsByTagName('Point')[0];
        if (point) {
            return this.parsePoint(point);
        }

        // MultiGeometry
        const multiGeometry = placemark.getElementsByTagName('MultiGeometry')[0];
        if (multiGeometry) {
            return this.parseMultiGeometry(multiGeometry);
        }

        return null;
    }

    // Parse de polígono
    parsePolygon(polygon) {
        const outerBoundary = polygon.getElementsByTagName('outerBoundaryIs')[0];
        if (!outerBoundary) return null;

        const linearRing = outerBoundary.getElementsByTagName('LinearRing')[0];
        if (!linearRing) return null;

        const coordinates = this.parseCoordinates(linearRing);
        if (!coordinates || coordinates.length < 3) return null;

        return {
            type: 'Polygon',
            coordinates: [coordinates]
        };
    }

    // Parse de linha
    parseLineString(lineString) {
        const coordinates = this.parseCoordinates(lineString);
        if (!coordinates || coordinates.length < 2) return null;

        return {
            type: 'LineString',
            coordinates: coordinates
        };
    }

    // Parse de ponto
    parsePoint(point) {
        const coordinates = this.parseCoordinates(point);
        if (!coordinates) return null;

        return {
            type: 'Point',
            coordinates: coordinates[0]
        };
    }

    // Parse de MultiGeometry
    parseMultiGeometry(multiGeometry) {
        const geometries = [];
        const types = ['Polygon', 'LineString', 'Point'];
        
        for (let type of types) {
            const elements = multiGeometry.getElementsByTagName(type);
            for (let element of elements) {
                let geometry = null;
                switch (type) {
                    case 'Polygon':
                        geometry = this.parsePolygon(element);
                        break;
                    case 'LineString':
                        geometry = this.parseLineString(element);
                        break;
                    case 'Point':
                        geometry = this.parsePoint(element);
                        break;
                }
                if (geometry) geometries.push(geometry);
            }
        }

        if (geometries.length === 0) return null;
        if (geometries.length === 1) return geometries[0];

        return {
            type: 'GeometryCollection',
            geometries: geometries
        };
    }

    // Parse de coordenadas
    parseCoordinates(element) {
        const coordElement = element.getElementsByTagName('coordinates')[0];
        if (!coordElement) return null;

        const coordText = coordElement.textContent.trim();
        const coordArray = [];
        
        const lines = coordText.split('\n');
        for (let line of lines) {
            const coords = line.trim().split(/\s+/);
            for (let coord of coords) {
                if (coord.trim()) {
                    const [lng, lat, alt] = coord.split(',').map(Number);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        coordArray.push([lng, lat]);
                    }
                }
            }
        }

        return coordArray.length > 0 ? coordArray : null;
    }

    // Quando KML está pronto (omnivore)
    onKMLReady(kmlLayer, fileName) {
        try {
            const geoJSON = kmlLayer.toGeoJSON();
            this.displayGeometryInfo(geoJSON);
            this.map.fitBounds(kmlLayer.getBounds());
            this.showLoading(false);
            
            console.log(`KML carregado com sucesso: ${fileName}`, geoJSON);
        } catch (error) {
            console.error('Erro ao processar KML pronto:', error);
            alert('Erro ao processar geometrias do KML.');
            this.showLoading(false);
        }
    }

    // Exibir informações geométricas
    displayGeometryInfo(geoJSON) {
        const geometryInfo = document.getElementById('geometryInfo');
        geometryInfo.innerHTML = '<h5>📊 Informações Geométricas</h5>';

        if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
            geometryInfo.innerHTML += '<p>Nenhuma geometria encontrada no arquivo</p>';
            return;
        }

        geoJSON.features.forEach((feature, index) => {
            const geomInfo = this.calculateGeometry(feature);
            const featureElement = this.createFeatureInfoElement(feature, geomInfo, index);
            geometryInfo.appendChild(featureElement);
        });
    }

    // Calcular propriedades geométricas
    calculateGeometry(feature) {
        const geometry = feature.geometry;
        const properties = feature.properties || {};
        const name = properties.name || `Feature ${feature.id || Date.now() + Math.random()}`;
        
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
                    info.area = turf.area(geometry);
                    const polygonLine = turf.polygonToLine(geometry);
                    info.length = turf.length(polygonLine, { units: 'kilometers' });
                    const polygonCenter = turf.center(geometry);
                    info.coordinates = polygonCenter.geometry.coordinates;
                    break;

                case 'LineString':
                    info.length = turf.length(geometry, { units: 'kilometers' });
                    const lineCenter = turf.center(geometry);
                    info.coordinates = lineCenter.geometry.coordinates;
                    break;

                case 'Point':
                    info.coordinates = geometry.coordinates;
                    break;

                case 'MultiPolygon':
                    info.area = turf.area(geometry);
                    const multiPolygonLine = turf.polygonToLine(geometry);
                    info.length = turf.length(multiPolygonLine, { units: 'kilometers' });
                    const multiPolygonCenter = turf.center(geometry);
                    info.coordinates = multiPolygonCenter.geometry.coordinates;
                    break;

                case 'GeometryCollection':
                    // Calcular para a primeira geometria válida
                    if (geometry.geometries && geometry.geometries.length > 0) {
                        const firstGeom = geometry.geometries[0];
                        const tempFeature = { type: 'Feature', geometry: firstGeom };
                        const tempInfo = this.calculateGeometry(tempFeature);
                        info.type = `Collection (${firstGeom.type})`;
                        info.area = tempInfo.area;
                        info.length = tempInfo.length;
                        info.coordinates = tempInfo.coordinates;
                    }
                    break;

                default:
                    console.warn('Tipo de geometria não suportado:', geometry.type);
            }
        } catch (error) {
            console.error('Erro no cálculo geométrico:', error, geometry);
        }

        return info;
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
        
        // Adicionar evento de clique para destacar no mapa
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
            this.highlightFeature(feature);
        });

        return div;
    }

    // Destacar feature no mapa
    highlightFeature(feature) {
        // Limpar destaque anterior
        this.clearHighlights();
        
        // Destacar feature
        const highlightLayer = L.geoJSON(feature, {
            style: {
                color: '#ff0000',
                weight: 4,
                fillColor: '#ff0000',
                fillOpacity: 0.3
            }
        }).addTo(this.map);
        
        this.kmlLayers.push(highlightLayer);
        
        // Centralizar no feature
        this.map.fitBounds(highlightLayer.getBounds(), { padding: [20, 20] });
    }

    // Limpar destaques
    clearHighlights() {
        // Manter apenas as camadas originais (não as de destaque)
        this.kmlLayers = this.kmlLayers.filter(layer => {
            if (layer._layers) {
                const firstLayer = Object.values(layer._layers)[0];
                if (firstLayer && firstLayer.options && firstLayer.options.color === '#ff0000') {
                    this.map.removeLayer(layer);
                    return false;
                }
            }
            return true;
        });
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