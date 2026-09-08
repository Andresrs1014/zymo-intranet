FROM node:20-alpine
# openssl: prisma | antiword: fallback .doc | graphicsmagick + ghostscript: pdf2pic (rasteriza PDF para OCR)
# libreoffice + ttf-dejavu: convierte .doc -> .docx conservando tablas/encabezados antes de extraer
RUN apk add --no-cache openssl antiword graphicsmagick ghostscript libreoffice ttf-dejavu
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3003
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
