🐾 Encontre-me: Sistema Inteligente de Busca de Animais
Encontre-me é um sistema de identificação inteligente projetado para ajudar a reunir animais perdidos com suas famílias. A aplicação utiliza busca vetorial com embeddings de imagem (CLIP), um banco de dados geoespacial (PostgreSQL com pgvector) e armazenamento de objetos (MinIO) para conectar pessoas que encontraram um animal com aquelas que o procuram.

🎯 Funcionalidades Principais
✅ Upload de imagens de animais perdidos e encontrados.

✅ Geração de "impressão digital" visual com IA (Embeddings CLIP).

✅ Busca vetorial híbrida: Combina similaridade visual com proximidade geográfica.

✅ Armazenamento de imagens escalável com MinIO (compatível com S3).

✅ Interface de usuário web e uma API REST completa para interação.

🏗️ Arquitetura
A aplicação é dividida em microsserviços, orquestrados com Docker para garantir escalabilidade e separação de responsabilidades.

┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend   │────▶│  Backend (Node)  │────▶│ Embedding (CLIP)│
│   (React)   │◀────│  Express + PG    │◀────│   Python/Flask  │
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
Frontend: Interface de usuário construída com React e Vite.

Backend (API): Um servidor Node.js com Express que gerencia todas as requisições.

Serviço de Embedding: Uma API em Python/Flask que usa o modelo CLIP para transformar imagens em vetores.

Banco de Dados: PostgreSQL com a extensão pgvector para busca por similaridade.

Armazenamento de Objetos: MinIO para guardar os arquivos de imagem.

🚀 Como Rodar Localmente (Guia Rápido)
Siga estes passos para ter a aplicação completa rodando na sua máquina.

Pré-requisitos
Git

Node.js e npm

Docker e Docker Compose (versão V2, comando docker compose)

Pelo menos 4GB de RAM disponível.

Passo a Passo
Clone o repositório:

Bash

git clone <URL_DO_SEU_REPOSITORIO>
cd encontre-me # Ou o nome da pasta do projeto
Prepare o Backend (Passo único): O Docker precisa de um arquivo package-lock.json para construir a imagem do backend. Vamos gerá-lo.

Bash

cd backend
npm install
cd ..
Inicie todos os serviços de backend com Docker: Este comando irá construir e iniciar os contêineres do banco de dados, armazenamento, serviço de IA e a API.

Bash

docker compose up --build
Deixe este terminal rodando. Na primeira execução, pode demorar alguns minutos para baixar o modelo de IA.

Inicie o Frontend (em um novo terminal): Abra um segundo terminal, navegue até a pasta do projeto e execute:

Bash

# Instala as dependências do frontend
npm install

# Inicia o servidor de desenvolvimento
npm run dev
Acesse a Aplicação:

Site Principal: Abra seu navegador e acesse http://localhost:8080.

Console de Imagens (MinIO): Acesse http://localhost:9001 (Login: minioadmin, Senha: minioadmin).

📡 Endpoints da API
Você pode interagir diretamente com a API usando ferramentas como curl ou Postman.

1. Registrar Animal
Bash

curl -X POST "http://localhost:3000/api/register" \
  -F "image=@/caminho/para/cachorro.jpg" \
  -F "latitude=-23.55052" \
  -F "longitude=-46.633308" \
  -F "description=Vira-lata marrom, porte médio" \
  -F "status=lost"
2. Buscar Animais Similares
Bash

curl -X POST "http://localhost:3000/api/search" \
  -F "image=@/caminho/para/encontrado.jpg" \
  -F "lat=-23.556" \
  -F "lon=-46.64" \
  -F "status=lost" \
  -F "maxDistanceKm=15" \
  -F "topK=5"
Desenvolvido com ❤️ para ajudar a reunir animais com suas famílias.
