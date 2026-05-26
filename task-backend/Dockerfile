FROM node:20-alpine
RUN apk add --no-cache openssl python3 py3-pip
RUN pip3 install --no-cache-dir --break-system-packages psycopg2-binary
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
RUN chmod +x /app/scripts/entrypoint.sh
EXPOSE 3002
CMD ["/bin/sh", "/app/scripts/entrypoint.sh"]
