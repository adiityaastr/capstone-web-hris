# Setup HRIS di Linux/macOS

## 1) Clone dan masuk folder project

```bash
git clone https://github.com/adiityaastr/capstone-web-hris.git
cd capstone-web-hris
```

## 2) Install dependency

```bash
npm install
```

## 3) Buat file environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=5000
JWT_SECRET=super-secret-key
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hris_db
```

## 4) Setup database MySQL

```bash
npm run db:setup
```

## 5) Jalankan app

```bash
npm run dev:all
```

Buka:
- Frontend: `http://localhost:5173` (atau port lain jika bentrok)
- Backend health: `http://localhost:5000/health`

## 6) Login default

- NIK: `ADM001`
- Password: `admin123`

## 7) Cek kualitas code

```bash
npm run lint
npm run build
```
