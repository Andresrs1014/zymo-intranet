FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3006
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
