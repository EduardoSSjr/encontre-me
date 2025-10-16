from flask import Flask, request, jsonify
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import requests
import torch
import io
import traceback

app = Flask(__name__)

# Carregar modelo CLIP na inicialização
print("🔄 Carregando modelo CLIP...")
MODEL_NAME = "openai/clip-vit-base-patch32"
processor = CLIPProcessor.from_pretrained(MODEL_NAME)
model = CLIPModel.from_pretrained(MODEL_NAME)
model.eval()  # Modo de inferência
print("✅ Modelo CLIP carregado com sucesso!")

# Verificar se há GPU disponível
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
print(f"🖥️  Usando dispositivo: {device}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'embedding-service',
        'model': MODEL_NAME,
        'device': device
    }), 200

@app.route('/embed', methods=['POST'])
def generate_embedding():
    """
    Gera embedding de uma imagem.
    
    Request JSON:
    {
        "image_url": "http://example.com/image.jpg"
    }
    
    Response JSON:
    {
        "embedding": [float, float, ...],
        "dimensions": 512
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'image_url' not in data:
            return jsonify({'error': 'Campo "image_url" é obrigatório'}), 400
        
        image_url = data['image_url']
        
        # Download da imagem
        try:
            print(f"📥 Baixando imagem: {image_url}")
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()
            image = Image.open(io.BytesIO(response.content)).convert('RGB')
        except requests.exceptions.RequestException as e:
            return jsonify({'error': f'Falha ao baixar imagem: {str(e)}'}), 400
        except Exception as e:
            return jsonify({'error': f'Imagem inválida: {str(e)}'}), 400
        
        # Processar imagem e gerar embedding
        with torch.no_grad():
            inputs = processor(images=image, return_tensors="pt").to(device)
            image_features = model.get_image_features(**inputs)
            
            # Normalizar embedding (importante para busca por similaridade)
            embedding = image_features / image_features.norm(dim=-1, keepdim=True)
            embedding = embedding.cpu().numpy().flatten().tolist()
        
        print(f"✅ Embedding gerado: {len(embedding)} dimensões")
        
        return jsonify({
            'embedding': embedding,
            'dimensions': len(embedding)
        }), 200
        
    except Exception as e:
        print(f"❌ Erro ao gerar embedding: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': 'Erro interno ao processar imagem',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    # Rodar em modo produção
    app.run(host='0.0.0.0', port=8000, debug=False)
