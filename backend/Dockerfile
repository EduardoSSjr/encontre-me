FROM node:20-alpine

WORKDIR /app

# Instalar dependências primeiro (cache layer)
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Criar diretório para uploads temporários
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "src/server.js"]
