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
        
        // Instalar pacotes necessários
        await pyodide.loadPackage('micropip');
        const micropip = pyodide.pyimport('micropip');
        await micropip.install(['supabase', 'asyncio']);
        
        updateStatus('Python inicializado com sucesso!', 'success');
        
        // Carregar nosso código Python
        await loadPythonCode();
        
    } catch (error) {
        updateStatus(`Erro ao inicializar Python: ${error}`, 'error');
    }
}

// Carregar código Python personalizado
async function loadPythonCode() {
    try {
        // Aqui você pode carregar código Python adicional
        const pythonCode = `
import js
from js import document, console
import json
from pyodide.ffi import create_proxy

# Configuração do Supabase (substitua com suas credenciais)
SUPABASE_URL = "https://fdqqflyrevxagpxxmjfj.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcXFmbHlyZXZ4YWdweHhtamZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDI0NjYsImV4cCI6MjA3NzUxODQ2Nn0.yiGbEYGzA3PuhUNdM-q6oYKQl2g2Kafmas0F6izkVk0"

class WebGIS:
    def __init__(self):
        self.markers = []
        self.supabase_url = SUPABASE_URL
        self.supabase_key = SUPABASE_KEY
    
    def add_marker(self, lat, lng, description):
        """Adiciona um marcador ao mapa"""
        try:
            marker_data = {
                'lat': float(lat),
                'lng': float(lng),
                'description': description,
                'type': 'point'
            }
            
            # Em um cenário real, aqui você salvaria no Supabase
            # Por enquanto, apenas retornamos os dados
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
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Raio da Terra em km
        
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lng = radians(lng2 - lng1)
        
        a = (sin(delta_lat / 2) ** 2 + 
             cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2)
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        distance = R * c
        return distance
    
    def process_geodata(self, data):
        """Processa dados geoespaciais"""
        if not data:
            return "Nenhum dado para processar"
        
        results = {
            'total_points': len(data),
            'bounds': self.calculate_bounds(data),
            'analysis': 'Análise básica concluída'
        }
        
        return json.dumps(results)
    
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

# Criar instância global
webgis = WebGIS()
`;

        pyodide.runPython(pythonCode);
        updateStatus('Código Python carregado!', 'success');
        
    } catch (error) {
        updateStatus(`Erro ao carregar código Python: ${error}`, 'error');
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
            { lat: -19.9167, lng: -43.9345, description: "Belo Horizonte" }
        ];
        
        // Processar dados com Python
        const result = await pyodide.runPythonAsync(`
webgis.process_geodata(${JSON.stringify(sampleData)})
`);
        
        const analysis = JSON.parse(result);
        updateStatus(`Análise: ${analysis.analysis} - ${analysis.total_points} pontos`, 'success');
        
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
        updateStatus(`Distância do centro: ${parseFloat(distance).toFixed(2)} km`, 'info');
    } catch (error) {
        console.error('Erro ao calcular distância:', error);
    }
});

// Inicializar a aplicação
initializePyodide();
