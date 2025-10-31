# WebGIS

## Funcionalidades do WebGIS
- ✅ Visualização de mapa interativo
- ✅ Adição de marcadores
- ✅ Processamento de dados com Python
- ✅ Cálculo de distâncias
- ✅ Interface responsiva
- ✅ Conexão com PostgreSQL/Supabase

## Funcionalidades Implementadas:

### ✅ **Carregamento de GeoJSON**
- Upload de arquivos .geojson ou .json
- Visualização imediata no mapa
- Informações detalhadas do arquivo

### ✅ **Análise com Python**
- Identificação de tipos de geometria
- Cálculo de área para polígonos
- Cálculo de centroides
- Análise de bounds

### ✅ **Cálculo de Área**
- Algoritmo esférico para coordenadas geográficas
- Suporte a Polygon e MultiPolygon
- Resultados em km² e hectares

### ✅ **Visualização**
- Cores diferentes por tipo de geometria
- Popups com propriedades
- Ajuste automático do zoom

## Como usar:

1. **Carregue um GeoJSON**: Use o seletor de arquivos
2. **Veja no mapa**: Os dados aparecerão imediatamente
3. **Calcule área**: Clique em "Calcular Área do GeoJSON"
4. **Analise resultados**: Veja áreas, tipos de geometria e estatísticas

A aplicação agora pode carregar qualquer arquivo GeoJSON válido e calcular áreas usando Python diretamente no navegador!

> Este WebGIS demonstra como usar Python no frontend, combinado com um backend PostgreSQL no Supabase, tudo hospedado no GitHub Pages.
