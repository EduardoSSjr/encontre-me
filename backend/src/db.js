import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configuração do pool de conexões
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Teste de conexão inicial
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool PostgreSQL:', err);
});

/**
 * Executa uma query no banco
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executada:', { text, duration: `${duration}ms`, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Erro na query:', { text, error: error.message });
    throw error;
  }
};

/**
 * Busca animais por similaridade vetorial + filtro geográfico
 */
export const searchSimilarAnimals = async (embedding, latitude, longitude, maxDistanceKm, topK, oppositeStatus) => {
  // Cálculo aproximado de bounding box (1 grau lat ≈ 111km)
  const latRange = maxDistanceKm / 111;
  const lonRange = maxDistanceKm / (111 * Math.cos(latitude * Math.PI / 180));

  const text = `
    WITH filtered AS (
      SELECT 
        id,
        image_url,
        latitude,
        longitude,
        description,
        status,
        created_at,
        embedding,
        -- Cálculo aproximado de distância (Haversine simplificado)
        (
          6371 * acos(
            cos(radians($2)) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians($3)) + 
            sin(radians($2)) * sin(radians(latitude))
          )
        ) AS distance_km
      FROM animals
      WHERE status = $4
        AND latitude BETWEEN $2 - $5 AND $2 + $5
        AND longitude BETWEEN $3 - $6 AND $3 + $6
    )
    SELECT 
      id,
      image_url,
      latitude,
      longitude,
      description,
      status,
      created_at,
      distance_km,
      1 - (embedding <-> $1::vector) AS similarity,
      -- Score combinado: 70% similaridade + 30% proximidade invertida
      (0.7 * (1 - (embedding <-> $1::vector)) + 0.3 * (1 - LEAST(distance_km / $7, 1))) AS combined_score
    FROM filtered
    WHERE distance_km <= $7
    ORDER BY combined_score DESC
    LIMIT $8;
  `;

  const params = [
    `[${embedding.join(',')}]`,  // $1: embedding vetorial
    latitude,                     // $2: lat de referência
    longitude,                    // $3: lon de referência
    oppositeStatus,               // $4: status oposto (lost busca found, vice-versa)
    latRange,                     // $5: range de latitude
    lonRange,                     // $6: range de longitude
    maxDistanceKm,                // $7: distância máxima em km
    topK                          // $8: limite de resultados
  ];

  return query(text, params);
};

export default pool;
