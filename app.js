// Inicializar o mapa
const map = L.map('map').setView([-23.5505, -46.6333], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];
let geoJsonLayers = [];
let currentGeoJsonData = null;
let pyodide;

// Inicializar Pyodide
async function initializePyodide() {
    try {
        updateStatus('Inicializando Python...', 'info');
        pyodide = await loadPyodide();
        
        updateStatus('Python inicializado com sucesso!', 'success');
        
        // Carregar nosso código Python
        await loadPythonCode();
        
    } catch (error) {
        updateStatus(`Erro ao inicializar Python: ${error}`, 'error');
    }
}

// Carregar código Python personalizado - VERSÃO COM GEOJSON
async function loadPythonCode() {
    try {
        const pythonCode = `
import js
from js import document, console
import json
import math

class GeoJSONAnalyzer:
    def __init__(self):
        self.features_data = []
    
    def load_geojson(self, geojson_str):
        """Carrega e analisa dados GeoJSON"""
        try:
            geojson_data = json.loads(geojson_str)
            analysis_result = self.analyze_geojson(geojson_data)
            return json.dumps({
                'success': True,
                'data': geojson_data,
                'analysis': analysis_result
            })
        except Exception as e:
            return json.dumps({
                'success': False,
                'error': str(e)
            })
    
    def analyze_geojson(self, geojson_data):
        """Analisa o GeoJSON e extrai informações"""
        analysis = {
            'type': geojson_data.get('type', 'Unknown'),
            'total_features': 0,
            'feature_types': {},
            'bounds': None,
            'areas': [],
            'centroids': []
        }
        
        if geojson_data['type'] == 'FeatureCollection':
            features = geojson_data.get('features', [])
            analysis['total_features'] = len(features)
            
            for feature in features:
                geom_type = feature['geometry']['type']
                analysis['feature_types'][geom_type] = analysis['feature_types'].get(geom_type, 0) + 1
                
                # Calcular área para polígonos
                if geom_type in ['Polygon', 'MultiPolygon']:
                    area = self.calculate_geojson_area(feature['geometry'])
                    analysis['areas'].append({
                        'type': geom_type,
                        'area_km2': area,
                        'area_hectares': area * 100
                    })
                
                # Calcular centroide
                centroid = self.calculate_centroid(feature['geometry'])
                if centroid:
                    analysis['centroids'].append(centroid)
        
        # Calcular bounds totais
        if analysis['centroids']:
            analysis['bounds'] = self.calculate_bounds(analysis['centroids'])
        
        return analysis
    
    def calculate_geojson_area(self, geometry):
        """Calcula área de geometrias GeoJSON em km²"""
        try:
            if geometry['type'] == 'Polygon':
                return self.calculate_polygon_area_geographic(geometry['coordinates'][0])
            elif geometry['type'] == 'MultiPolygon':
                total_area = 0
                for polygon in geometry['coordinates']:
                    total_area += self.calculate_polygon_area_geographic(polygon[0])
                return total_area
            else:
                return 0
        except Exception as e:
            return f"Erro: {str(e)}"
    
    def calculate_polygon_area_geographic(self, coordinates):
        """Calcula área de polígono em coordenadas geográficas usando método esférico"""
        try:
            if len(coordinates) < 3:
                return 0
            
            area = 0.0
            n = len(coordinates)
            
            for i in range(n):
                j = (i + 1) % n
                point1 = coordinates[i]  # [lng, lat]
                point2 = coordinates[j]  # [lng, lat]
                
                lat1 = math.radians(point1[1])
                lng1 = math.radians(point1[0])
                lat2 = math.radians(point2[1])
                lng2 = math.radians(point2[0])
                
                area += (lng2 - lng1) * (2 + math.sin(lat1) + math.sin(lat2))
            
            area = abs(area) * 6371 * 6371 / 2  # Raio da Terra ao quadrado dividido por 2
            return abs(area)
        except Exception as e:
            return f"Erro no cálculo: {str(e)}"
    
    def calculate_centroid(self, geometry):
        """Calcula o centroide de uma geometria"""
        try:
            if geometry['type'] == 'Point':
                coords = geometry['coordinates']
                return {'lat': coords[1], 'lng': coords[0]}
            elif geometry['type'] == 'Polygon':
                # Usar o primeiro anel do polígono (anel externo)
                coords = geometry['coordinates'][0]
                lats = [coord[1] for coord in coords]
                lngs = [coord[0] for coord in coords]
                return {
                    'lat': sum(lats) / len(lats),
                    'lng': sum(lngs) / len(lngs)
                }
            return None
        except:
            return None
    
    def calculate_bounds(self, points):
        """Calcula os limites de uma lista de pontos"""
        if not points:
            return None
        
        lats = [point['lat'] for point in points]
        lngs = [point['lng'] for point in points]
        
        return {
            'min_lat': min(lats),
            'max_lat': max(lats),
            'min_lng': min(lngs),
            'max_lng': max(lngs)
        }
    
    def calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calcula distância entre dois pontos (Haversine)"""
        try:
            R = 6371  # Raio da Terra em km
            
            lat1_rad = math.radians(float(lat1))
            lat2_rad = math.radians(float(lat2))
            delta_lat = math.radians(float(lat2) - float(lat1))
            delta_lng = math.radians(float(lng2) - float(lng1))
            
            a = (math.sin(delta_lat / 2) ** 2 + 
                 math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            
            return R * c
        except Exception as e:
            return f"Erro: {str(e)}"

# Criar instância global
geojson_analyzer = GeoJSONAnalyzer()
`;

        pyodide.runPython(pythonCode);
        updateStatus('Analisador GeoJSON carregado!', 'success');
        
    } catch (error) {
        updateStatus(`Erro ao carregar código Python: ${error}`, 'error');
    }
}

// Funções para manipulação de GeoJSON
function loadGeoJSONFile(file) {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const geojsonData = JSON.parse(e.target.result);
            currentGeoJsonData = geojsonData;
            
            // Exibir informações do arquivo
            displayFileInfo(geojsonData);
            
            // Adicionar ao mapa
            const layer = L.geoJSON(geojsonData, {
                style: function(feature) {
                    return {
                        color: getColorByGeometryType(feature.geometry.type),
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.3
                    };
                },
                onEachFeature: function(feature, layer) {
                    if (feature.properties) {
                        let popupContent = '<div class="popup-content">';
                        for (const [key, value] of Object.entries(feature.properties)) {
                            popupContent += `<strong>${key}:</strong> ${value}<br>`;
                        }
                        popupContent += `</div>`;
                        layer.bindPopup(popupContent);
                    }
                }
            }).addTo(map);
            
            geoJsonLayers.push({
                name: file.name,
                layer: layer,
                data: geojsonData
            });
            
            // Ajustar mapa para mostrar os dados
            map.fitBounds(layer.getBounds());
            
            updateStatus(`GeoJSON "${file.name}" carregado com sucesso!`, 'success');
            
        } catch (error) {
            updateStatus(`Erro ao carregar GeoJSON: ${error}`, 'error');
        }
    };
    
    reader.onerror = function() {
        updateStatus('Erro ao ler arquivo', 'error');
    };
    
    reader.readAsText(file);
}

function getColorByGeometryType(type) {
    const colors = {
        'Point': '#ff0000',
        'LineString': '#0000ff',
        'Polygon': '#00ff00',
        'MultiPolygon': '#008800'
    };
    return colors[type] || '#999999';
}

function displayFileInfo(geojsonData) {
    const fileInfo = document.getElementById('file-info');
    let infoHTML = '<h4>Informações do Arquivo:</h4>';
    
    if (geojsonData.type === 'FeatureCollection') {
        const featureCount = geojsonData.features.length;
        const geometryTypes = {};
        
        geojsonData.features.forEach(feature => {
            const type = feature.geometry.type;
            geometryTypes[type] = (geometryTypes[type] || 0) + 1;
        });
        
        infoHTML += `<p><strong>Total de Features:</strong> ${featureCount}</p>`;
        infoHTML += '<p><strong>Tipos de Geometria:</strong></p><ul>';
        
        for (const [type, count] of Object.entries(geometryTypes)) {
            infoHTML += `<li>${type}: ${count}</li>`;
        }
        infoHTML += '</ul>';
    }
    
    fileInfo.innerHTML = infoHTML;
}

// Função para calcular área usando Python
async function calculateGeoJSONArea() {
    if (!currentGeoJsonData) {
        updateStatus('Nenhum GeoJSON carregado para calcular área', 'error');
        return;
    }
    
    try {
        updateStatus('Calculando área com Python...', 'info');
        
        const result = await pyodide.runPythonAsync(`
geojson_analyzer.load_geojson('${JSON.stringify(currentGeoJsonData).replace(/'/g, "\\'")}')
`);
        
        const data = JSON.parse(result);
        
        if (data.success) {
            displayAnalysisResults(data.analysis);
            updateStatus('Análise concluída com sucesso!', 'success');
        } else {
            updateStatus(`Erro na análise: ${data.error}`, 'error');
        }
        
    } catch (error) {
        updateStatus(`Erro ao calcular área: ${error}`, 'error');
    }
}

function displayAnalysisResults(analysis) {
    const resultsElement = document.getElementById('results');
    let resultsHTML = '<h4>Resultados da Análise:</h4>';
    
    resultsHTML += `<p><strong>Tipo:</strong> ${analysis.type}</p>`;
    resultsHTML += `<p><strong>Total de Features:</strong> ${analysis.total_features}</p>`;
    
    if (Object.keys(analysis.feature_types).length > 0) {
        resultsHTML += '<p><strong>Distribuição por Tipo:</strong></p><ul>';
        for (const [type, count] of Object.entries(analysis.feature_types)) {
            resultsHTML += `<li>${type}: ${count}</li>`;
        }
        resultsHTML += '</ul>';
    }
    
    if (analysis.areas.length > 0) {
        resultsHTML += '<p><strong>Áreas Calculadas:</strong></p><ul>';
        analysis.areas.forEach((area, index) => {
            resultsHTML += `<li>Feature ${index + 1} (${area.type}): 
                ${typeof area.area_km2 === 'number' ? area.area_km2.toFixed(2) : area.area_km2} km² 
                (${typeof area.area_hectares === 'number' ? area.area_hectares.toFixed(2) : area.area_hectares} ha)</li>`;
        });
        
        // Calcular área total
        const totalArea = analysis.areas.reduce((sum, area) => {
            return typeof area.area_km2 === 'number' ? sum + area.area_km2 : sum;
        }, 0);
        
        resultsHTML += `<li><strong>Área Total: ${totalArea.toFixed(2)} km² (${(totalArea * 100).toFixed(2)} ha)</strong></li>`;
        resultsHTML += '</ul>';
    }
    
    resultsElement.innerHTML = resultsHTML;
}

// Event Listeners
document.getElementById('geojson-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        loadGeoJSONFile(file);
    }
});

document.getElementById('calculate-area').addEventListener('click', calculateGeoJSONArea);

document.getElementById('load-sample').addEventListener('click', function() {
    // GeoJSON de exemplo - um polígono simples
    const sampleGeoJSON = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Área de Exemplo",
                    "tipo": "polígono_teste"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-46.6333, -23.5505],
                        [-46.6333, -23.5405],
                        [-46.6233, -23.5405],
                        [-46.6233, -23.5505],
                        [-46.6333, -23.5505]
                    ]]
                }
            }
        ]
    };
    
    // Criar um arquivo virtual para simular upload
    const blob = new Blob([JSON.stringify(sampleGeoJSON)], { type: 'application/json' });
    const file = new File([blob], "exemplo.geojson");
    loadGeoJSONFile(file);
});

// ... (mantenha os outros event listeners anteriores para add-point, clear-map, etc.)

document.getElementById('add-point').addEventListener('click', async () => {
    const lat = document.getElementById('latitude').value;
    const lng = document.getElementById('longitude').value;
    const description = document.getElementById('description').value;
    
    if (!lat || !lng) {
        updateStatus('Por favor, preencha latitude e longitude', 'error');
        return;
    }
    
    try {
        // Adicionar marcador ao mapa
        const marker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`<b>${description}</b><br>Lat: ${lat}, Lng: ${lng}`);
        
        markers.push(marker);
        updateStatus('Marcador adicionado com sucesso!', 'success');
        
    } catch (error) {
        updateStatus(`Erro ao adicionar marcador: ${error}`, 'error');
    }
});

document.getElementById('clear-map').addEventListener('click', () => {
    // Limpar marcadores
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Limpar layers GeoJSON
    geoJsonLayers.forEach(item => map.removeLayer(item.layer));
    geoJsonLayers = [];
    
    currentGeoJsonData = null;
    document.getElementById('file-info').innerHTML = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('geojson-file').value = '';
    
    updateStatus('Mapa limpo', 'success');
});

// Funções de interface
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    
    const outputElement = document.getElementById('output');
    outputElement.textContent += `[${type.toUpperCase()}] ${message}\n`;
    outputElement.scrollTop = outputElement.scrollHeight;
}

// Inicializar a aplicação
initializePyodide();
