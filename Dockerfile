# ============================================================================
# viecpro – 1 image dùng chung cho API (NestJS), web và admin (Next.js)
# docker-compose chạy cùng image với lệnh khác nhau cho từng dịch vụ.
#   docker compose --profile app up -d --build
# ============================================================================
FROM node:24-alpine AS base
WORKDIR /app
# Prisma engine cần OpenSSL trên Alpine
RUN apk add --no-cache openssl libc6-compat

# ---------- Cài thư viện (tận dụng cache khi chỉ đổi mã nguồn) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
# postinstall (build shared, prisma generate) chạy sau khi đã có mã nguồn
RUN npm ci --ignore-scripts

# ---------- Build ----------
FROM deps AS build
COPY . .
# URL trình duyệt gọi tới – gắn vào bundle Next.js lúc build
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3100
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @viecpro/shared \
 && npm run db:generate -w @viecpro/api \
 && npm run build -w @viecpro/api \
 && npm run build -w @viecpro/web \
 && npm run build -w @viecpro/admin

# ---------- Chạy ----------
# Giữ devDependencies để chạy được prisma migrate / seed (tsx) ngay trong container
FROM build AS runtime
EXPOSE 4000 3100 3001
CMD ["node", "apps/api/dist/main"]
