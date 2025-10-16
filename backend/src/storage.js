import { Client } from 'minio';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const BUCKET_NAME = process.env.MINIO_BUCKET || 'animal-images';

// Cliente MinIO (compatível com S3)
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

/**
 * Inicializa o bucket se não existir
 */
export const initializeBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✅ Bucket '${BUCKET_NAME}' criado com sucesso`);
      
      // Definir política pública para leitura
      const policy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
        }]
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    } else {
      console.log(`✅ Bucket '${BUCKET_NAME}' já existe`);
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar bucket:', error);
    throw error;
  }
};

/**
 * Faz upload de arquivo para o MinIO
 * @param {string} filePath - Caminho local do arquivo
 * @param {string} destName - Nome de destino no bucket (ex: 'animals/uuid.jpg')
 * @returns {string} URL pública do arquivo
 */
export const uploadFile = async (filePath, destName) => {
  try {
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Determinar content-type
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    }[ext] || 'application/octet-stream';

    await minioClient.putObject(
      BUCKET_NAME,
      destName,
      fileStream,
      stats.size,
      { 'Content-Type': contentType }
    );

    // Construir URL pública
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const publicUrl = `http://${endpoint}:${port}/${BUCKET_NAME}/${destName}`;

    console.log(`✅ Upload concluído: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Erro no upload para MinIO:', error);
    throw new Error(`Falha no upload: ${error.message}`);
  }
};

/**
 * Remove arquivo do MinIO
 */
export const deleteFile = async (objectName) => {
  try {
    await minioClient.removeObject(BUCKET_NAME, objectName);
    console.log(`🗑️  Arquivo removido: ${objectName}`);
  } catch (error) {
    console.error('❌ Erro ao remover arquivo:', error);
    throw error;
  }
};

// Inicializar bucket ao importar o módulo
initializeBucket();

export default minioClient;
