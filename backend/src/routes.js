import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, searchSimilarAnimals } from './db.js';
import { uploadFile } from './storage.js';
import embeddingClient from './embeddingClient.js';

const router = express.Router();

// Configuração do multer para upload de arquivos
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG ou WEBP.'));
    }
  }
});

/**
 * POST /api/register
 * Registra um novo animal (perdido ou encontrado)
 */
router.post('/register', upload.single('image'), async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    const { latitude, longitude, description, status } = req.body;
    const file = req.file;

    // Validações
    if (!file) {
      return res.status(400).json({ error: 'Imagem é obrigatória' });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude e longitude são obrigatórias' });
    }
    if (!status || !['lost', 'found'].includes(status)) {
      return res.status(400).json({ error: 'Status deve ser "lost" ou "found"' });
    }

    uploadedFilePath = file.path;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // 1. Upload da imagem para MinIO
    const fileName = `animals/${Date.now()}-${file.originalname}`;
    const imageUrl = await uploadFile(file.path, fileName);

    // 2. Gerar embedding da imagem
    const embedding = await embeddingClient.getImageEmbedding(imageUrl);

    // 3. Salvar no banco
    const result = await query(
      `INSERT INTO animals (image_url, embedding, latitude, longitude, description, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, image_url, latitude, longitude, description, status, created_at`,
      [imageUrl, `[${embedding.join(',')}]`, lat, lon, description || null, status]
    );

    // Limpar arquivo temporário
    fs.unlinkSync(file.path);

    res.status(201).json({
      message: 'Animal registrado com sucesso',
      animal: result.rows[0]
    });
  } catch (error) {
    // Limpar arquivo temporário em caso de erro
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
    
    console.error('Erro ao registrar animal:', error);
    res.status(500).json({ 
      error: 'Falha ao registrar animal',
      details: error.message 
    });
  }
});

/**
 * GET /api/search
 * Busca animais similares por imagem + proximidade geográfica
 */
router.post('/search', upload.single('image'), async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    const { lat, lon, maxDistanceKm = 10, topK = 10, status } = req.body;
    const file = req.file;

    // Validações
    if (!file) {
      return res.status(400).json({ error: 'Imagem é obrigatória para busca' });
    }
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude (lat) e longitude (lon) são obrigatórias' });
    }
    if (!status || !['lost', 'found'].includes(status)) {
      return res.status(400).json({ error: 'Status deve ser "lost" ou "found" (indica o que você está procurando)' });
    }

    uploadedFilePath = file.path;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const maxDist = parseFloat(maxDistanceKm);
    const limit = parseInt(topK);

    // Upload temporário da imagem de busca para gerar embedding
    const searchFileName = `search/${Date.now()}-${file.originalname}`;
    const searchImageUrl = await uploadFile(file.path, searchFileName);

    // Gerar embedding da imagem de busca
    const embedding = await embeddingClient.getImageEmbedding(searchImageUrl);

    // Status oposto: se está buscando perdidos, quer encontrados (e vice-versa)
    const oppositeStatus = status === 'lost' ? 'found' : 'lost';

    // Buscar animais similares
    const result = await searchSimilarAnimals(
      embedding,
      latitude,
      longitude,
      maxDist,
      limit,
      oppositeStatus
    );

    // Formatar resultados
    const candidates = result.rows.map(row => ({
      id: row.id,
      image_url: row.image_url,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      description: row.description,
      status: row.status,
      distance_km: parseFloat(row.distance_km).toFixed(2),
      similarity: parseFloat(row.similarity).toFixed(4),
      combined_score: parseFloat(row.combined_score).toFixed(4),
      created_at: row.created_at
    }));

    // Limpar arquivo temporário
    fs.unlinkSync(file.path);

    res.json({
      query: {
        latitude,
        longitude,
        maxDistanceKm: maxDist,
        searchStatus: status,
        resultsStatus: oppositeStatus
      },
      candidates,
      total: candidates.length
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
    
    console.error('Erro na busca:', error);
    res.status(500).json({ 
      error: 'Falha na busca',
      details: error.message 
    });
  }
});

/**
 * GET /api/animals
 * Lista todos os animais (com filtros opcionais)
 */
router.get('/animals', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let queryText = 'SELECT id, image_url, latitude, longitude, description, status, created_at FROM animals';
    const params = [];
    
    if (status && ['lost', 'found'].includes(status)) {
      queryText += ' WHERE status = $1';
      params.push(status);
    }
    
    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await query(queryText, params);
    
    res.json({
      animals: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    console.error('Erro ao listar animais:', error);
    res.status(500).json({ error: 'Falha ao listar animais' });
  }
});

/**
 * GET /api/animals/:id
 * Obtém detalhes de um animal específico
 */
router.get('/animals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT id, image_url, latitude, longitude, description, status, created_at FROM animals WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Animal não encontrado' });
    }

    res.json({ animal: result.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar animal:', error);
    res.status(500).json({ error: 'Falha ao buscar animal' });
  }
});

export default router;
