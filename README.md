# 🐾 IA Identificar Animais Perdidos

Sistema de identificação inteligente de animais perdidos usando busca vetorial com embeddings CLIP, PostgreSQL com pgvector e armazenamento de imagens no MinIO.

## 🎯 Funcionalidades (MVP)

- ✅ **Upload de imagens** de animais perdidos/encontrados
- ✅ **Geração automática de embeddings** com CLIP (OpenAI)
- ✅ **Busca vetorial híbrida**: similaridade visual + proximidade geográfica
- ✅ **Armazenamento escalável** com MinIO (S3-compatible)
- ✅ **API REST** completa para integração

## 🏗️ Arquitetura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Cliente   │────▶│  Backend (Node)  │────▶│ Embedding (CLIP)│
│   (API)     │◀────│  Express + PG    │◀────│   Python/Flask  │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │
                    │   + pgvector  │
                    └───────────────┘
                            │
                    ┌───────────────┐
                    │     MinIO     │
                    │  (S3 Storage) │
                    └───────────────┘
```

## 🚀 Como Rodar

### Pré-requisitos

- Docker & Docker Compose instalados
- 4GB+ RAM disponível (recomendado 8GB para CLIP)
- Portas disponíveis: 3000, 5432, 8000, 9000, 9001

### Passo a Passo

1. **Clone o repositório**
```bash
git clone <seu-repositorio>
cd ia-identificar-animais-perdidos
```

2. **Suba os serviços**
```bash
docker-compose up --build
```

Aguarde o download dos modelos CLIP (~1-2 minutos na primeira execução).

3. **Verifique os serviços**

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Backend | http://localhost:3000/health | API principal |
| Embeddings | http://localhost:8000/health | Serviço CLIP |
| MinIO Console | http://localhost:9001 | Interface web (minioadmin/minioadmin) |
| PostgreSQL | localhost:5432 | Banco de dados |

## 📡 Endpoints da API

### 1. Registrar Animal (Perdido/Encontrado)

```bash
curl -X POST "http://localhost:3000/api/register" \
  -F "image=@/caminho/para/cachorro.jpg" \
  -F "latitude=-23.55052" \
  -F "longitude=-46.633308" \
  -F "description=Vira-lata marrom, porte médio, coleira azul" \
  -F "status=lost"
```

**Parâmetros:**
- `image` (file): Arquivo da imagem (JPG, PNG, WEBP)
- `latitude` (float): Coordenada de latitude
- `longitude` (float): Coordenada de longitude
- `description` (string): Descrição do animal
- `status` (string): `"lost"` ou `"found"`

**Resposta:**
```json
{
  "message": "Animal registrado com sucesso",
  "animal": {
    "id": 1,
    "image_url": "http://minio:9000/animal-images/animals/1234567890-dog.jpg",
    "latitude": -23.55052,
    "longitude": -46.633308,
    "description": "Vira-lata marrom...",
    "status": "lost",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### 2. Buscar Animais Similares

```bash
curl -X POST "http://localhost:3000/api/search" \
  -F "image=@/caminho/para/encontrado.jpg" \
  -F "lat=-23.556" \
  -F "lon=-46.64" \
  -F "status=lost" \
  -F "maxDistanceKm=15" \
  -F "topK=5"
```

**Parâmetros:**
- `image` (file): Imagem para buscar
- `lat` (float): Latitude de referência
- `lon` (float): Longitude de referência
- `status` (string): `"lost"` (busca em encontrados) ou `"found"` (busca em perdidos)
- `maxDistanceKm` (float, opcional): Raio máximo em km (default: 10)
- `topK` (int, opcional): Número de resultados (default: 10)

**Resposta:**
```json
{
  "query": {
    "latitude": -23.556,
    "longitude": -46.64,
    "maxDistanceKm": 15,
    "searchStatus": "lost",
    "resultsStatus": "found"
  },
  "candidates": [
    {
      "id": 123,
      "image_url": "http://minio:9000/animal-images/animals/abc.jpg",
      "latitude": -23.55,
      "longitude": -46.63,
      "description": "Vira-lata marrom...",
      "status": "found",
      "distance_km": "2.30",
      "similarity": "0.8234",
      "combined_score": "0.7864",
      "created_at": "2025-01-14T15:20:00Z"
    }
  ],
  "total": 1
}
```

### 3. Listar Animais

```bash
# Todos
curl "http://localhost:3000/api/animals"

# Apenas perdidos
curl "http://localhost:3000/api/animals?status=lost&limit=20"
```

### 4. Detalhes de um Animal

```bash
curl "http://localhost:3000/api/animals/123"
```

## 🎯 Scores e Thresholds

### Scores Retornados

- **similarity**: Similaridade visual (0-1, baseado em distância L2 normalizada)
  - `>= 0.85`: Match muito forte (alta confiança)
  - `0.75 - 0.85`: Match bom (revisão recomendada)
  - `< 0.75`: Match fraco (baixa confiança)

- **distance_km**: Distância geográfica em quilômetros

- **combined_score**: Score híbrido (70% visual + 30% proximidade)
  - `>= 0.80`: Candidato excelente
  - `0.70 - 0.80`: Candidato promissor
  - `< 0.70`: Candidato improvável

### Ajustando Thresholds

Para filtrar resultados no cliente:

```javascript
const highConfidenceMatches = candidates.filter(c => 
  parseFloat(c.similarity) >= 0.80 && 
  parseFloat(c.distance_km) <= 5
);
```

## 🔧 Configuração Avançada

### Variáveis de Ambiente (backend/.env)

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/animais_perdidos
EMBEDDING_URL=http://embedding-service:8000
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
PORT=3000
```

### Ajustar Dimensão dos Embeddings

Se usar modelo CLIP diferente (ex: 768 dimensões):

1. **Modificar `init/init.sql`:**
```sql
embedding vector(768)  -- Alterar de 512 para 768
```

2. **Recriar banco:**
```bash
docker-compose down -v
docker-compose up --build
```

### Otimizar Índice Vetorial

Para escala (>100k registros), ajustar `lists` no `init.sql`:

```sql
-- Para ~1M vetores, use lists = 1000
CREATE INDEX animals_embedding_idx 
ON animals 
USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 1000);
```

Ou trocar para HNSW (mais rápido, mais memória):

```sql
CREATE INDEX animals_embedding_idx 
ON animals 
USING hnsw (embedding vector_l2_ops);
```

## 🐛 Troubleshooting

### Serviço de Embeddings Lento

**Causa:** Download do modelo CLIP na primeira execução.

**Solução:** Aguardar 1-2 minutos. Logs:
```bash
docker-compose logs -f embedding-service
```

### Erro "Bucket não existe"

**Causa:** MinIO não inicializou.

**Solução:**
```bash
docker-compose restart backend
```

### Erro "vector type not found"

**Causa:** Extensão pgvector não instalada.

**Solução:** Verificar imagem do Postgres:
```yaml
postgres:
  image: ankane/pgvector:latest  # Usar esta imagem
```

### Consumo Alto de Memória

**Causa:** Modelo CLIP carregado na RAM.

**Solução:** Alocar pelo menos 4GB ao Docker Desktop.

## 📊 Banco de Dados

### Schema Principal

```sql
-- Tabela de animais
CREATE TABLE animals (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  embedding vector(512),           -- Vetor CLIP
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  description TEXT,
  status VARCHAR(10),               -- 'lost' ou 'found'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice vetorial IVFFlat
CREATE INDEX ON animals 
USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);
```

### Consulta Vetorial Direta

```sql
-- Buscar top 10 mais similares a um embedding
SELECT 
  id, 
  image_url,
  1 - (embedding <-> '[0.1, 0.2, ...]'::vector) AS similarity
FROM animals
WHERE status = 'found'
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

## 🚀 Próximos Passos (Produção)

1. **Escala de Embeddings:**
   - Migrar para Milvus, Pinecone ou Qdrant (bilhões de vetores)
   - Implementar cache de embeddings

2. **Autenticação:**
   - Adicionar JWT/OAuth para usuários
   - Rate limiting por API key

3. **Melhorias de Busca:**
   - Embeddings textuais (descrições)
   - Filtros por raça, cor, tamanho
   - Re-ranking com modelo CLIP mais fino

4. **Infraestrutura:**
   - Kubernetes para orquestração
   - CDN para imagens (CloudFront + S3)
   - Monitoramento (Prometheus + Grafana)

## 📝 Licença

MIT

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças grandes, abra uma issue primeiro.

---

**Desenvolvido com ❤️ para ajudar a reunir animais com suas famílias**
