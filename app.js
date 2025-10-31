// Inicializar o mapa
const map = L.map('map').setView([-23.5505, -46.6333], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];
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

// Carregar código Python personalizado - VERSÃO CORRIGIDA
async function loadPythonCode() {
    try {
        const pythonCode = `
import js
from js import document, console
import json
import math

class WebGIS:
    def __init__(self):
        self.markers = []
    
    def add_marker(self, lat, lng, description):
        """Adiciona um marcador ao mapa"""
        try:
            marker_data = {
                'lat': float(lat),
                'lng': float(lng),
                'description': description,
                'type': 'point'
            }
            
            return json.dumps({
                'success': True,
                'data': marker_data,
                'message': 'Marcador adicionado com sucesso!'
            })
        except Exception as e:
            return json.dumps({
                'success': False,
                'error': str(e)
            })
    
    def calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calcula a distância entre dois pontos usando a fórmula de Haversine"""
        try:
            R = 6371  # Raio da Terra em km
            
            lat1_rad = math.radians(float(lat1))
            lat2_rad = math.radians(float(lat2))
            delta_lat = math.radians(float(lat2) - float(lat1))
            delta_lng = math.radians(float(lng2) - float(lng1))
            
            a = (math.sin(delta_lat / 2) ** 2 + 
                 math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            
            distance = R * c
            return distance
        except Exception as e:
            return f"Erro no cálculo: {str(e)}"
    
    def calculate_polygon_area(self, coordinates):
        """Calcula a área de um polígono usando a fórmula do shoelace"""
        try:
            if len(coordinates) < 3:
                return "Polígono precisa de pelo menos 3 pontos"
            
            area = 0.0
            n = len(coordinates)
            
            for i in range(n):
                j = (i + 1) % n
                lat1, lng1 = coordinates[i]
                lat2, lng2 = coordinates[j]
                
                # Fórmula do shoelace adaptada para coordenadas geográficas
                area += (math.radians(lng1) * math.radians(lat2) - 
                         math.radians(lng2) * math.radians(lat1))
            
            area = abs(area) * 6371 * 6371 / 2  # Aproximação em km²
            return area
        except Exception as e:
            return f"Erro no cálculo da área: {str(e)}"
    
    def process_geodata(self, data):
        """Processa dados geoespaciais"""
        if not data:
            return "Nenhum dado para processar"
        
        try:
            total_points = len(data)
            bounds = self.calculate_bounds(data)
            
            # Calcular centroide
            avg_lat = sum(point['lat'] for point in data) / total_points
            avg_lng = sum(point['lng'] for point in data) / total_points
            
            results = {
                'total_points': total_points,
                'bounds': bounds,
                'centroid': {'lat': avg_lat, 'lng': avg_lng},
                'analysis': 'Análise básica concluída'
            }
            
            return json.dumps(results)
        except Exception as e:
            return json.dumps({'error': str(e)})
    
    def calculate_bounds(self, data):
        """Calcula os limites dos dados"""
        if not data:
            return None
        
        lats = [point['lat'] for point in data]
        lngs = [point['lng'] for point in data]
        
        return {
            'min_lat': min(lats),
            'max_lat': max(lats),
            'min_lng': min(lngs),
            'max_lng': max(lngs)
        }
    
    def filter_points_by_radius(self, points, center_lat, center_lng, radius_km):
        """Filtra pontos dentro de um raio específico"""
        try:
            filtered_points = []
            for point in points:
                distance = self.calculate_distance(
                    center_lat, center_lng, 
                    point['lat'], point['lng']
                )
                if distance <= radius_km:
                    filtered_points.append({
                        **point,
                        'distance': distance
                    })
            
            return json.dumps({
                'points': filtered_points,
                'count': len(filtered_points),
                'radius': radius_km
            })
        except Exception as e:
            return json.dumps({'error': str(e)})

# Criar instância global
webgis = WebGIS()
`;

        pyodide.runPython(pythonCode);
        updateStatus('Código Python carregado!', 'success');
        
    } catch (error) {
        updateStatus(`Erro ao carregar código Python: ${error}`, 'error');
    }
}

// Função para comunicação com Supabase via JavaScript
async function saveToSupabase(markerData) {
    // Substitua com suas credenciais do Supabase
    const SUPABASE_URL = "https://fdqqflyrevxagpxxmjfj.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcXFmbHlyZXZ4YWdweHhtamZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDI0NjYsImV4cCI6MjA3NzUxODQ2Nn0.yiGbEYGzA3PuhUNdM-q6oYKQl2g2Kafmas0F6izkVk0";
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/geographic_points`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({
                latitude: markerData.lat,
                longitude: markerData.lng,
                description: markerData.description
            })
        });
        
        if (response.ok) {
            return { success: true, message: 'Dados salvos no Supabase!' };
        } else {
            const error = await response.text();
            return { success: false, error: error };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Funções de interface
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    
    // Adicionar ao console Python
    const outputElement = document.getElementById('output');
    outputElement.textContent += `[${type.toUpperCase()}] ${message}\\n`;
    outputElement.scrollTop = outputElement.scrollHeight;
}

// Event Listeners
document.getElementById('add-point').addEventListener('click', async () => {
    const lat = document.getElementById('latitude').value;
    const lng = document.getElementById('longitude').value;
    const description = document.getElementById('description').value;
    
    if (!lat || !lng) {
        updateStatus('Por favor, preencha latitude e longitude', 'error');
        return;
    }
    
    try {
        const result = await pyodide.runPythonAsync(`
webgis.add_marker(${lat}, ${lng}, "${description}")
`);
        
        const data = JSON.parse(result);
        
        if (data.success) {
            // Adicionar marcador ao mapa
            const marker = L.marker([lat, lng])
                .addTo(map)
                .bindPopup(`<b>${description}</b><br>Lat: ${lat}, Lng: ${lng}`);
            
            markers.push(marker);
            updateStatus(data.message, 'success');
            
            // Tentar salvar no Supabase
            const supabaseResult = await saveToSupabase(data.data);
            if (supabaseResult.success) {
                updateStatus(supabaseResult.message, 'success');
            } else {
                updateStatus(`Supabase: ${supabaseResult.error}`, 'warning');
            }
        } else {
            updateStatus(`Erro: ${data.error}`, 'error');
        }
        
    } catch (error) {
        updateStatus(`Erro ao adicionar marcador: ${error}`, 'error');
    }
});

document.getElementById('load-data').addEventListener('click', async () => {
    try {
        // Simular carregamento de dados
        const sampleData = [
            { lat: -23.5505, lng: -46.6333, description: "São Paulo" },
            { lat: -22.9068, lng: -43.1729, description: "Rio de Janeiro" },
            { lat: -19.9167, lng: -43.9345, description: "Belo Horizonte" },
            { lat: -23.5489, lng: -46.6388, description: "Centro de SP" }
        ];
        
        // Processar dados com Python
        const result = await pyodide.runPythonAsync(`
webgis.process_geodata(${JSON.stringify(sampleData)})
`);
        
        const analysis = JSON.parse(result);
        
        if (analysis.error) {
            updateStatus(`Erro na análise: ${analysis.error}`, 'error');
            return;
        }
        
        updateStatus(
            `Análise: ${analysis.analysis} - ${analysis.total_points} pontos - ` +
            `Centro: ${analysis.centroid.lat.toFixed(4)}, ${analysis.centroid.lng.toFixed(4)}`, 
            'success'
        );
        
        // Adicionar marcadores ao mapa
        sampleData.forEach(point => {
            const marker = L.marker([point.lat, point.lng])
                .addTo(map)
                .bindPopup(`<b>${point.description}</b>`);
            markers.push(marker);
        });
        
        // Ajustar zoom para mostrar todos os marcadores
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds());
        
    } catch (error) {
        updateStatus(`Erro ao carregar dados: ${error}`, 'error');
    }
});

document.getElementById('calculate-area').addEventListener('click', async () => {
    try {
        // Criar um polígono de exemplo (triângulo)
        const polygonCoords = [
            [-23.5505, -46.6333],  // São Paulo
            [-22.9068, -43.1729],  // Rio de Janeiro  
            [-19.9167, -43.9345]   // Belo Horizonte
        ];
        
        const result = await pyodide.runPythonAsync(`
webgis.calculate_polygon_area(${JSON.stringify(polygonCoords)})
`);
        
        updateStatus(`Área do polígono: ${parseFloat(result).toFixed(2)} km²`, 'success');
        
        // Desenhar o polígono no mapa
        const polygon = L.polygon(polygonCoords, {color: 'blue'}).addTo(map);
        markers.push(polygon);
        
    } catch (error) {
        updateStatus(`Erro ao calcular área: ${error}`, 'error');
    }
});

document.getElementById('clear-map').addEventListener('click', () => {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    updateStatus('Mapa limpo', 'success');
});

// Adicionar marcador ao clicar no mapa
map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    
    document.getElementById('latitude').value = lat.toFixed(6);
    document.getElementById('longitude').value = lng.toFixed(6);
    
    // Calcular distância do ponto central (exemplo)
    try {
        const distance = await pyodide.runPythonAsync(`
webgis.calculate_distance(-23.5505, -46.6333, ${lat}, ${lng})
`);
        updateStatus(`Distância do centro de SP: ${parseFloat(distance).toFixed(2)} km`, 'info');
    } catch (error) {
        console.error('Erro ao calcular distância:', error);
    }
});

// Inicializar a aplicação
initializePyodide();
