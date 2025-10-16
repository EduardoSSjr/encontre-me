-- Ativar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de usuários (simplificada para MVP)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela principal de animais (perdidos/encontrados)
CREATE TABLE IF NOT EXISTS animals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  image_url TEXT NOT NULL,
  embedding vector(512),  -- CLIP embeddings são 512-dim (ajustar se usar modelo diferente)
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  description TEXT,
  status VARCHAR(10) CHECK (status IN ('lost', 'found')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de matches/correspondências
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  animal_lost_id INTEGER REFERENCES animals(id),
  animal_found_id INTEGER REFERENCES animals(id),
  similarity_score DECIMAL(5, 4),  -- 0.0000 a 1.0000
  distance_km DECIMAL(8, 2),
  combined_score DECIMAL(5, 4),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, rejected
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(animal_lost_id, animal_found_id)
);

-- Índice vetorial para busca por similaridade (IVFFlat)
-- lists = 100 é adequado para ~10k-100k vetores; ajustar conforme crescimento
CREATE INDEX IF NOT EXISTS animals_embedding_idx 
ON animals 
USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);

-- Índice geográfico (B-tree composto para lat/lon)
CREATE INDEX IF NOT EXISTS animals_location_idx 
ON animals (latitude, longitude);

-- Índice de status para filtros rápidos
CREATE INDEX IF NOT EXISTS animals_status_idx 
ON animals (status);

-- Índice de timestamp para ordenação
CREATE INDEX IF NOT EXISTS animals_created_at_idx 
ON animals (created_at DESC);

-- Comentários explicativos
COMMENT ON COLUMN animals.embedding IS 'Vetor de embedding CLIP 512-dimensional para busca por similaridade visual';
COMMENT ON INDEX animals_embedding_idx IS 'Índice IVFFlat para busca vetorial eficiente; ajustar lists conforme escala';
COMMENT ON TABLE matches IS 'Armazena correspondências potenciais entre animais perdidos e encontrados';
