FROM node:20-alpine
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
RUN cd frontend && npm run build

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
RUN mkdir -p backend/public && cp -r frontend/dist/. backend/public/

ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 4002
CMD ["node", "src/server.js"]
