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

        // Terreno (OpenTopoMap)
        this.baseLayers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, © OpenTopoMap',
            maxZoom: 17
        });

        // Satélite (ESRI World Imagery)
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
            await this.processKMLContent(fileContent, file.name);
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
            reader.readAsText(file, 'UTF-8');
        });
    }

    // Processar conteúdo KML
    async processKMLContent(kmlContent, fileName) {
        try {
            // Tentar primeiro com o parser manual (mais confiável)
            this.processKMLManual(kmlContent, fileName);
        } catch (error) {
            console.error('Erro no processamento manual:', error);
            // Fallback para omnivore
            this.tryOmnivoreKML(kmlContent, fileName);
        }
    }

    // Tentar processar com Omnivore
    async tryOmnivoreKML(kmlContent, fileName) {
        try {
            const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
            const url = URL.createObjectURL(blob);

            const kmlLayer = omnivore.kml(url)
                .on('ready', () => {
                    this.onKMLReady(kmlLayer, fileName);
                    URL.revokeObjectURL(url);
                })
                .on('error', (error) => {
                    console.error('Erro omnivore:', error);
                    URL.revokeObjectURL(url);
                    alert('Erro ao processar KML com omnivore. Tentando método alternativo...');
                    this.processKMLManual(kmlContent, fileName);
                });

            kmlLayer.addTo(this.map);
            this.kmlLayers.push(kmlLayer);

        } catch (error) {
            console.error('Erro no omnivore:', error);
            this.processKMLManual(kmlContent, fileName);
        }
    }

    // Processar KML manualmente (método principal)
    processKMLManual(kmlContent, fileName) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
            
            // Verificar erros de parsing XML
            const parseError = xmlDoc.getElementsByTagName('parsererror');
            if (parseError.length > 0) {
                throw new Error('Erro de parsing XML: ' + parseError[0].textContent);
            }

            const features = this.extractFeaturesFromKML(xmlDoc);
            
            if (features.length === 0) {
                throw new Error('Nenhuma geometria válida encontrada no KML');
            }

            this.createKMLayer(features, fileName);
            
        } catch (error) {
            console.error('Erro no parsing manual:', error);
            alert('Erro ao processar arquivo KML: ' + error.message);
            this.showLoading(false);
        }
    }

    // Extrair features do KML
    extractFeaturesFromKML(xmlDoc) {
        const features = [];
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        
        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];
            const feature = this.parsePlacemark(placemark);
            if (feature) {
                features.push(feature);
            }
        }
        
        return features;
    }

    // Parse individual de Placemark
    parsePlacemark(placemark) {
        try {
            const name = this.getTextContent(placemark, 'name') || 'Sem nome';
            const description = this.getTextContent(placemark, 'description') || '';
            
            const geometry = this.parseGeometry(placemark);
            if (!geometry) return null;

            return {
                type: 'Feature',
                properties: { 
                    name: name,
                    description: description
                },
                geometry: geometry
            };
        } catch (error) {
            console.warn('Erro ao parsear placemark:', error);
            return null;
        }
    }

    // Obter conteúdo de texto de um elemento
    getTextContent(element, tagName) {
        const elements = element.getElementsByTagName(tagName);
        return elements.length > 0 ? elements[0].textContent.trim() : null;
    }

    // Parse de geometria
    parseGeometry(placemark) {
        // Tentar diferentes tipos de geometria na ordem
        const geometryTypes = [
            { tag: 'Polygon', parser: this.parsePolygon.bind(this) },
            { tag: 'LineString', parser: this.parseLineString.bind(this) },
            { tag: 'Point', parser: this.parsePoint.bind(this) },
            { tag: 'MultiGeometry', parser: this.parseMultiGeometry.bind(this) }
        ];

        for (let geomType of geometryTypes) {
            const element = placemark.getElementsByTagName(geomType.tag)[0];
            if (element) {
                return geomType.parser(element);
            }
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
        if (!coordinates || coordinates.length === 0) return null;

        return {
            type: 'Point',
            coordinates: coordinates[0]
        };
    }

    // Parse de MultiGeometry
    parseMultiGeometry(multiGeometry) {
        const geometries = [];
        
        // Processar polígonos
        const polygons = multiGeometry.getElementsByTagName('Polygon');
        for (let polygon of polygons) {
            const geom = this.parsePolygon(polygon);
            if (geom) geometries.push(geom);
        }
        
        // Processar linhas
        const lineStrings = multiGeometry.getElementsByTagName('LineString');
        for (let lineString of lineStrings) {
            const geom = this.parseLineString(lineString);
            if (geom) geometries.push(geom);
        }
        
        // Processar pontos
        const points = multiGeometry.getElementsByTagName('Point');
        for (let point of points) {
            const geom = this.parsePoint(point);
            if (geom) geometries.push(geom);
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
        const coordinates = [];
        
        // Processar coordenadas - pode ter múltiplas linhas e espaços
        const coordGroups = coordText.split(/\s+/);
        
        for (let coordStr of coordGroups) {
            if (coordStr.trim()) {
                const parts = coordStr.split(',');
                if (parts.length >= 2) {
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        coordinates.push([lng, lat]);
                    }
                }
            }
        }

        return coordinates.length > 0 ? coordinates : null;
    }

    // Criar camada KML no mapa
    createKMLayer(features, fileName) {
        const geoJSON = {
            type: 'FeatureCollection',
            features: features
        };
        
        // Estilos para diferentes tipos de geometria
        const pointStyle = {
            radius: 8,
            fillColor: "#ff7800",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        };

        const lineStyle = {
            color: "#3388ff",
            weight: 3,
            opacity: 0.8
        };

        const polygonStyle = {
            color: "#3388ff",
            weight: 2,
            fillColor: "#3388ff",
            fillOpacity: 0.2
        };

        const kmlLayer = L.geoJSON(geoJSON, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, pointStyle);
            },
            style: (feature) => {
                switch (feature.geometry.type) {
                    case 'LineString':
                        return lineStyle;
                    case 'Polygon':
                        return polygonStyle;
                    default:
                        return polygonStyle;
                }
            },
            onEachFeature: (feature, layer) => {
                // Popup com informações
                let popupContent = `<b>${feature.properties.name || 'Feature'}</b>`;
                if (feature.properties.description) {
                    popupContent += `<br>${feature.properties.description}`;
                }
                
                const geomInfo = this.calculateGeometry(feature);
                popupContent += `<br><small>Tipo: ${geomInfo.type}</small>`;
                
                if (geomInfo.area !== null) {
                    popupContent += `<br>Área: ${(geomInfo.area / 1000000).toFixed(2)} km²`;
                }
                if (geomInfo.length !== null) {
                    popupContent += `<br>Comprimento: ${geomInfo.length.toFixed(2)} km`;
                }
                
                layer.bindPopup(popupContent);
            }
        });

        this.kmlLayers.push(kmlLayer);
        kmlLayer.addTo(this.map);
        
        // Ajustar view para a camada
        if (kmlLayer.getBounds().isValid()) {
            this.map.fitBounds(kmlLayer.getBounds());
        }
        
        // Exibir informações geométricas
        this.displayGeometryInfo(geoJSON);
        this.showLoading(false);
        
        console.log(`KML carregado: ${fileName}`, geoJSON);
    }

    // Quando KML está pronto (omnivore)
    onKMLReady(kmlLayer, fileName) {
        try {
            const geoJSON = kmlLayer.toGeoJSON();
            this.displayGeometryInfo(geoJSON);
            
            if (kmlLayer.getBounds && kmlLayer.getBounds().isValid()) {
                this.map.fitBounds(kmlLayer.getBounds());
            }
            
            this.showLoading(false);
            console.log(`KML carregado com omnivore: ${fileName}`, geoJSON);
        } catch (error) {
            console.error('Erro ao processar KML pronto:', error);
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
        const name = properties.name || `Feature ${feature.id || Date.now()}`;
        
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
            console.error('Erro no cálculo geométrico:', error);
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
        this.clearHighlights();
        
        const highlightLayer = L.geoJSON(feature, {
            style: {
                color: '#ff0000',
                weight: 4,
                fillColor: '#ff0000',
                fillOpacity: 0.3
            }
        }).addTo(this.map);
        
        this.kmlLayers.push(highlightLayer);
        
        if (highlightLayer.getBounds) {
            this.map.fitBounds(highlightLayer.getBounds(), { padding: [20, 20] });
        }
    }

    // Limpar destaques
    clearHighlights() {
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