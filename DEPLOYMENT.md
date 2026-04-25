# Deployment

## Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run `sql/inventory_laptop_schema.sql`.
4. Open **Project Settings > Database** and copy your Postgres connection string.

Use the direct connection string for Vercel if available. If your Supabase project requires SSL, keep `DB_SSL=true`.

## Vercel

Set these environment variables in **Project Settings > Environment Variables**:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres
DB_SSL=true
DB_SCHEMA=inventory_laptop
```

Do not set `VITE_API_URL` when the frontend and API are deployed in this same Vercel project. The app will call `/api` on the same domain.

## Vercel Build Settings

Use the defaults:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

After deployment, test:

```text
https://your-vercel-domain.vercel.app/api/health
```

Expected response:

```json
{"ok":true}
```

Default login after running the SQL seed:

```text
Email: herald@gmail.com
Password: 1234
```
