import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const EMBEDDING_URL = process.env.EMBEDDING_URL || 'http://localhost:8000';
const TIMEOUT_MS = 30000; // 30 segundos (CLIP pode demorar no primeiro load)

/**
 * Cliente para o serviço de embeddings
 */
class EmbeddingClient {
  constructor() {
    this.client = axios.create({
      baseURL: EMBEDDING_URL,
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Gera embedding de uma imagem via URL
   * @param {string} imageUrl - URL da imagem
   * @returns {Promise<number[]>} Array de floats (embedding)
   */
  async getImageEmbedding(imageUrl) {
    try {
      console.log(`🔍 Gerando embedding para: ${imageUrl}`);
      const response = await this.client.post('/embed', { image_url: imageUrl });
      
      if (!response.data || !response.data.embedding) {
        throw new Error('Resposta inválida do serviço de embeddings');
      }

      const embedding = response.data.embedding;
      console.log(`✅ Embedding gerado: ${embedding.length} dimensões`);
      return embedding;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout ao gerar embedding - serviço demorou demais');
      }
      if (error.response) {
        throw new Error(`Erro no serviço de embeddings: ${error.response.data?.error || error.response.statusText}`);
      }
      throw new Error(`Falha na comunicação com serviço de embeddings: ${error.message}`);
    }
  }

  /**
   * Verifica se o serviço está online
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('❌ Serviço de embeddings offline:', error.message);
      return { status: 'offline', error: error.message };
    }
  }
}

export default new EmbeddingClient();
