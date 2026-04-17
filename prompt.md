# Vercel Deployment Fix

The current `vercel.json` is broken. Please make the following changes:

## 1. Update `vercel.json`

Replace the entire contents of `vercel.json` with:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" }
  ]
}
```

Remove `installCommand`, `buildCommand`, `outputDirectory`, and any other properties — these will be configured directly in the Vercel dashboard instead.

## 2. Set build settings in Vercel dashboard

In the Vercel project dashboard go to **Settings → General → Build & Development Settings** and set:

- **Framework Preset**: Create React App
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `build`
- **Install Command**: `npm install --legacy-peer-deps`

Setting Root Directory to `frontend` in the dashboard (rather than in `vercel.json`) is the correct approach — Vercel does not support `rootDirectory` as a `vercel.json` property.

## 3. Verify `api/index.py` exists at the project root

Make sure the file structure looks like this:

```
/ (project root)
├── api/
│   └── index.py
├── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
└── vercel.json
```

If `api/index.py` does not exist, create it with:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/")
async def root():
    return {"message": "Entity Mapping API — upload CSVs via the frontend to get started."}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

handler = Mangum(app)
```

And make sure `requirements.txt` at the project root contains:

```
fastapi==0.110.1
mangum>=0.17.0
python-dotenv>=1.0.1
```

## 4. Commit and push

After making these changes, commit and push to trigger a new Vercel deployment.