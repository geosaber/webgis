#!/usr/bin/env python3
import os
import json
import shutil
from datetime import datetime
import markdown  # Se quiser usar Markdown

def load_template(template_name):
    """Carrega um template HTML"""
    with open(f'templates/{template_name}', 'r', encoding='utf-8') as f:
        return f.read()

def generate_webgis_page():
    """Gera a página principal do WebGIS"""
    template = load_template('base.html')
    
    # Contexto com variáveis dinâmicas
    context = {
        'site_title': 'Meu WebGIS Dinâmico',
        'build_date': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'last_commit': os.getenv('GITHUB_SHA', 'local'),
        'basemaps': [
            {'id': 'osm', 'name': 'OpenStreetMap'},
            {'id': 'satellite', 'name': 'Satélite'},
            {'id': 'topo', 'name': 'Topográfico'}
        ]
    }
    
    # Substituir placeholders no template
    for key, value in context.items():
        template = template.replace(f'{{{{ {key} }}}}', str(value))
    
    return template

def copy_static_files():
    """Copia arquivos estáticos (CSS, JS, imagens)"""
    static_dirs = ['css', 'js', 'images', 'data']
    
    for static_dir in static_dirs:
        if os.path.exists(static_dir):
            shutil.copytree(static_dir, f'docs/{static_dir}', dirs_exist_ok=True)

def generate_geojson_data():
    """Gera dados GeoJSON dinamicamente (opcional)"""
    sample_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Área de Exemplo",
                    "area": "1km²",
                    "last_updated": datetime.now().isoformat()
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
    }
    
    os.makedirs('docs/data', exist_ok=True)
    with open('docs/data/sample.geojson', 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, indent=2)

def main():
    """Função principal"""
    print("🚀 Iniciando build do site...")
    
    # Criar diretório de output
    os.makedirs('docs', exist_ok=True)
    
    # Gerar página principal
    html_content = generate_webgis_page()
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    # Gerar dados dinâmicos
    generate_geojson_data()
    
    # Copiar arquivos estáticos
    copy_static_files()
    
    print("✅ Build concluído com sucesso!")
    print(f"📁 Arquivos gerados em: {os.path.abspath('docs')}")

if __name__ == '__main__':
    main()
