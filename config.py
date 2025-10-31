# config.py - Configurações para o WebGIS

# Configurações do Supabase (substitua com suas credenciais)
SUPABASE_CONFIG = {
    "url": "https://seu-projeto.supabase.co",
    "key": "sua-chave-anon-public"
}

# Configurações do mapa
MAP_CONFIG = {
    "default_center": [-23.5505, -46.6333],
    "default_zoom": 10,
    "tile_layer": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
}

# Configurações da aplicação
APP_CONFIG = {
    "name": "WebGIS Python + Supabase",
    "version": "1.0.0",
    "description": "Sistema de Informação Geográfica com frontend Python"
}
