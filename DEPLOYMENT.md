# Riffboard Deployment Guide

This guide covers deploying Riffboard to production using Coolify on your Hetzner server.

## 🎯 Deployment Options

### Option A: Coolify (Recommended)
Deploy alongside OpenClaw on your existing Hetzner server with a web UI.

### Option B: Standalone Docker
Simple Docker deployment without Coolify.

---

## 📋 Prerequisites

- Hetzner VPS running Ubuntu (you already have: 46.62.214.84)
- SSH access: `ssh root@46.62.214.84`
- Git repository pushed to GitHub/GitLab

---

## 🚀 Option A: Deploy with Coolify

### Step 1: Install Coolify on Hetzner Server

```bash
# SSH into your server
ssh root@46.62.214.84

# Install Coolify (one command, takes ~5 minutes)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Coolify will be available at: http://46.62.214.84:8000
```

### Step 2: Initial Coolify Setup

1. Open browser: `http://46.62.214.84:8000`
2. Create admin account (first time only)
3. Set up server connection:
   - Click "Servers" → "Add Server"
   - Select "This Server (localhost)"
   - Coolify will connect to itself

### Step 3: Connect GitHub Repository

1. Click "Sources" → "Add Source"
2. Select "GitHub" → Authorize Coolify
3. Grant access to `hackwtb/riffboard` repository

### Step 4: Create Riffboard Application

1. Click "Projects" → "New Project"
2. Name: `Riffboard`
3. Click "Add Resource" → "Application"
4. Select your GitHub source
5. Repository: `hackwtb/riffboard`
6. Branch: `main`

### Step 5: Configure Build Settings

Coolify will auto-detect the Dockerfile. Verify:

- **Build Pack**: `Dockerfile`
- **Dockerfile Location**: `./Dockerfile`
- **Port**: `3456`

### Step 6: Set Environment Variables

In Coolify application settings:

```
NODE_ENV=production
PORT=3456
KEYS_FILE=/data/riffboard-keys.json
```

### Step 7: Configure Volumes (Important!)

Add persistent volume for API keys:

- **Source**: `riffboard-data`
- **Destination**: `/data`
- **Type**: `volume`

This ensures API keys persist across deployments.

### Step 8: Deploy

1. Click "Deploy"
2. Watch build logs
3. Wait for "Deployment successful"
4. Access at: `http://46.62.214.84:3456`

### Step 9: Enable HTTPS (Optional but Recommended)

In Coolify application settings:

1. Go to "Domains" section
2. Add custom domain: `riffboard.yourdomain.com`
3. Coolify automatically provisions Let's Encrypt SSL
4. Access securely at: `https://riffboard.yourdomain.com`

### Step 10: Configure Auto-Deployments

1. In application settings → "Git"
2. Enable "Auto Deploy on Push"
3. Every `git push` to `main` auto-deploys

---

## 🐳 Option B: Standalone Docker Deployment

If you prefer not to use Coolify:

### Step 1: Push to Server

```bash
# From your local machine
cd /Users/alexstein/hackwtb/riffboard

# Ensure code is committed
git add .
git commit -m "Add Docker configuration"
git push origin main

# SSH into server
ssh root@46.62.214.84

# Clone repository
cd ~
git clone https://github.com/YOUR_USERNAME/riffboard.git
cd riffboard
```

### Step 2: Build and Run

```bash
# Build the Docker image
docker build -t riffboard:latest .

# Run the container
docker run -d \
  --name riffboard \
  -p 3456:3456 \
  -v riffboard-data:/data \
  -e NODE_ENV=production \
  -e PORT=3456 \
  -e KEYS_FILE=/data/riffboard-keys.json \
  --restart unless-stopped \
  riffboard:latest

# Check logs
docker logs -f riffboard

# Verify it's running
curl http://localhost:3456/health
```

### Step 3: Update Deployment

```bash
# Pull latest code
cd ~/riffboard
git pull origin main

# Rebuild and restart
docker build -t riffboard:latest .
docker stop riffboard
docker rm riffboard

# Run with same command as Step 2
docker run -d --name riffboard -p 3456:3456 -v riffboard-data:/data -e NODE_ENV=production -e PORT=3456 -e KEYS_FILE=/data/riffboard-keys.json --restart unless-stopped riffboard:latest
```

### Using Docker Compose (Easier Updates)

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f

# Update
git pull origin main
docker compose up -d --build

# Stop
docker compose down
```

---

## 🔌 Integrate with Clawcast & OpenClaw

### Update OpenClaw API Script

The `~/bin/apikey` script needs to point to the deployed Riffboard:

```bash
ssh root@46.62.214.84

# Edit the script
nano ~/bin/apikey

# Change line 5:
RIFFBOARD_API="http://localhost:3456/api/keys"

# Save and exit (Ctrl+O, Enter, Ctrl+X)

# Test it
~/bin/apikey list
```

### Update Clawcast TV App

Edit `tv-web/src/useApiKeys.ts`:

```typescript
// Before (local dev):
const RIFFBOARD_API_URL = 'http://localhost:3456';

// After (production):
const RIFFBOARD_API_URL = 'http://46.62.214.84:3456';
// Or with domain:
const RIFFBOARD_API_URL = 'https://riffboard.yourdomain.com';
```

Then rebuild and redeploy Clawcast:

```bash
cd /Users/alexstein/clawcast/tv-web
npm run build

# Copy to Android assets
cp -r dist/* ../tv-android/app/src/main/assets/web/

# Rebuild APK (in Android Studio or via gradlew)
```

---

## 🔒 Security Hardening (Production)

### 1. Add Bearer Token Authentication

Create `/Users/alexstein/hackwtb/riffboard/server/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

const AUTH_TOKEN = process.env.AUTH_TOKEN;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_TOKEN) {
    return next(); // Skip auth if no token configured
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
```

Apply to API routes in `server/index.ts`:

```typescript
import { requireAuth } from './middleware/auth.js';

app.use("/api", requireAuth);
```

Add to environment variables:

```bash
AUTH_TOKEN=your-random-secure-token-here
```

### 2. Rate Limiting

```bash
cd /Users/alexstein/hackwtb/riffboard
pnpm add express-rate-limit
```

Add to `server/index.ts`:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);
```

### 3. CORS Configuration

Update CORS in `server/index.ts`:

```typescript
app.use(cors({
  origin: [
    'http://localhost:6001',           // Local Clawcast dev
    'http://46.62.214.84:3456',        // Production Riffboard
    'https://riffboard.yourdomain.com' // Custom domain
  ],
  credentials: true
}));
```

---

## 📊 Monitoring & Maintenance

### View Logs (Coolify)

1. Open Coolify dashboard
2. Click on Riffboard application
3. Go to "Logs" tab
4. View real-time logs

### View Logs (Docker)

```bash
# All logs
docker logs riffboard

# Follow live logs
docker logs -f riffboard

# Last 100 lines
docker logs --tail 100 riffboard
```

### Check Health

```bash
curl http://46.62.214.84:3456/health

# Expected response:
# {"status":"ok","service":"riffboard","port":3456}
```

### Backup API Keys

```bash
# The keys are stored in Docker volume
# To backup:
docker run --rm \
  -v riffboard-data:/data \
  -v $(pwd):/backup \
  alpine \
  cp /data/riffboard-keys.json /backup/riffboard-keys.backup.json

# To restore:
docker run --rm \
  -v riffboard-data:/data \
  -v $(pwd):/backup \
  alpine \
  cp /backup/riffboard-keys.backup.json /data/riffboard-keys.json
```

### Resource Usage

```bash
# Check container stats
docker stats riffboard

# Expected: ~100-200MB RAM, minimal CPU when idle
```

---

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs riffboard

# Common issues:
# - Port 3456 already in use
# - Missing environment variables
# - Build failed
```

### Can't Access from Browser

```bash
# Check if running
docker ps | grep riffboard

# Check if port is open
netstat -tlnp | grep 3456

# Test locally on server
curl http://localhost:3456/health

# Check firewall
ufw status
ufw allow 3456/tcp
```

### API Keys Not Persisting

```bash
# Verify volume exists
docker volume ls | grep riffboard

# Check volume contents
docker run --rm -v riffboard-data:/data alpine ls -la /data

# Expected: riffboard-keys.json with proper permissions
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a

# Remove old images
docker image prune -a
```

---

## 📈 Scaling to Multi-User (Future)

When you're ready to scale beyond single-user:

1. **Add Database**: PostgreSQL or Supabase
   - User accounts
   - Per-user API key storage
   - Session management

2. **Add Authentication**: Clerk or NextAuth
   - Email/password or OAuth
   - Protected API routes

3. **Encrypt API Keys**: AES-256 encryption at rest

4. **Add Rate Limits**: Per-user quotas

5. **Deploy to Multiple Regions**: Use Fly.io for edge deployment

---

## 💰 Cost Breakdown

**Current Setup (Coolify on Hetzner):**
- Hetzner CAX21: $7.59/mo (shared with OpenClaw)
- Domain (optional): ~$12/year
- SSL: Free (Let's Encrypt)
- **Total: $7.59/mo** (no additional cost!)

**If Scaling:**
- Separate Hetzner VPS: +$7.59/mo
- Database (Supabase): Free tier or ~$25/mo
- **Total: ~$15-40/mo**

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Health endpoint responds: `curl http://46.62.214.84:3456/health`
- [ ] Can set API key via curl or OpenClaw Telegram bot
- [ ] Keys persist after container restart
- [ ] Clawcast TV can fetch keys from deployed Riffboard
- [ ] Frontend loads correctly (if accessing web UI)
- [ ] Logs show no errors: `docker logs riffboard`
- [ ] Auto-deploy works (push to main, Coolify rebuilds)

---

## 🎉 Next Steps

1. Set up custom domain (optional)
2. Enable HTTPS via Coolify
3. Configure auth token for security
4. Test end-to-end with Telegram → OpenClaw → Riffboard → Clawcast
5. Monitor logs for a few days
6. Plan multi-user features (if needed)

---

## 📚 Resources

- **Coolify Docs**: https://coolify.io/docs
- **Docker Docs**: https://docs.docker.com
- **Hetzner Status**: https://status.hetzner.com
- **Let's Encrypt**: https://letsencrypt.org

---

Need help? Check logs first:
```bash
docker logs -f riffboard
```

Still stuck? Issues are normal during first deployment. Check:
1. Environment variables set correctly
2. Port not blocked by firewall
3. Volume persists data correctly
4. Docker has enough resources
