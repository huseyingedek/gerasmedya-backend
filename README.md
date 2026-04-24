# Geras Medya Backend

Node.js + Express + Prisma + Neon PostgreSQL + iyzico

## Kurulum

```bash
npm install
npx prisma generate
```

## .env Ayarları

`.env.example` dosyasını `.env` olarak kopyala ve doldur:

```bash
cp .env.example .env
```

### Neon PostgreSQL bağlantısı:
1. neon.tech → Yeni proje oluştur
2. Dashboard → Connection string → `DATABASE_URL`'yi kopyala
3. `.env`'e yapıştır

### Prisma DB oluştur:
```bash
npm run db:push       # Tabloları Neon'a oluşturur
npm run db:studio     # Görsel DB yönetimi
```

## Çalıştır

```bash
npm run dev    # Development (nodemon)
npm start      # Production
```

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/auth/login | Giriş yap |
| GET | /api/auth/me | Kullanıcı bilgisi (token gerekli) |
| POST | /api/payment/create | Ödeme + üyelik oluştur |

## iyzico Test Kartı (Sandbox)

```
Kart No: 5528790000000008
SKT: 12/30
CVV: 123
```

## Deploy

Railway, Render veya Heroku'ya deploy edebilirsin.
Deploy sonrası `IYZICO_BASE_URL`'yi değiştir:
```
https://api.iyzipay.com   (canlı)
```
