# Faculty Work Load Management (WLM)

A comprehensive web application for managing faculty workload allocation, course assignments, and workload preferences.

## ⚡ Quick Start with Docker

**Fastest way to get running:**

```bash
# 1. Start all services
docker-compose up -d

# 2. Backend runs on http://localhost:5000
# 3. MongoDB on localhost:27017
# 4. Mongo Express (optional UI) on http://localhost:8081
```

**For detailed Docker setup, see [DOCKER_SETUP.md](DOCKER_SETUP.md) and [DOCKER_COMPLETE.md](DOCKER_COMPLETE.md)**

### Available Scripts

```bash
# Using Make (Linux/Mac)
make up                 # Start services
make logs              # Show logs
make health            # Check health
make down              # Stop services

# Using Shell Scripts (All platforms)
./start-docker.sh up   # Windows: start-docker.bat up
./start-docker.sh logs

# Or Docker Compose directly
docker-compose ps
docker-compose logs -f wlm-server
```

---

## Quick Setup Guide (Manual Setup)

### Prerequisites
- Node.js 14+ 
- MongoDB URI (from MongoDB Atlas or local instance)
- *OR* Docker Desktop (for containerized setup above)

### Installation & Running

#### 1. Install Dependencies

```bash
# Root dependencies (if needed)
npm install

# Server dependencies
cd server
npm install

# Client dependencies  
cd ../client
npm install
cd ..
```

#### 2. Configure Environment

**Server Configuration** (`server/.env`):
```
PORT=5000
NODE_ENV=development
JWT_SECRET=<random-secret>
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/wlm
CLIENT_ORIGIN=http://localhost:3000
ADMIN_ID=admin
ADMIN_PASSWORD=admin@123
```

**Client Configuration** (optional `client/.env.local`):
```
REACT_APP_API_URL=http://localhost:5000
# OR for local dev with proxy: (leave empty to use setupProxy.js)
```

#### 3. Seed Database with Users

**IMPORTANT**: Run this first to create initial users in MongoDB.

```bash
cd server
npm run seed
```

This creates:
- **Admin**: `admin` / `admin@123`
- **Faculty 1**: `faculty001` / `password123`
- **Faculty 2**: `faculty002` / `password123`

#### 4. Start Development Servers

**Terminal 1 - Start Backend**:
```bash
cd server
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Start Frontend**:
```bash
cd client
npm start
# Runs on http://localhost:3000
```

---

## Architecture

### Project Structure
```
WLM/
├── server/              # Express.js REST API
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── models/      # MongoDB schemas
│   │   ├── middleware/  # Auth, validation, error handling
│   │   ├── utils/       # JWT, logging, etc
│   │   └── index.js     # Server entry point
│   ├── .env             # Server configuration
│   └── package.json
│
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── components/  # Reusable components
│   │   ├── services/    # API calls
│   │   └── App.js       # Root component
│   ├── setupProxy.js    # Dev proxy config
│   └── package.json
│
└── package.json         # Root package.json
```

### Key Features

**For Admins**:
- Manage faculty and courses
- Allocate workloads
- View audit logs
- System integrity reports

**For Faculty**:
- Submit course preferences
- View assigned workload
- Track submissions

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Faculty Management
- `GET /api/faculty` - List all faculty
- `POST /api/faculty` - Create faculty
- `PUT /api/faculty/:id` - Update faculty
- `DELETE /api/faculty/:id` - Delete faculty

### Courses
- `GET /api/courses` - List all courses
- `POST /api/courses` - Create course
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Workload & Allocations
- `GET /api/workloads` - List workloads
- `POST /api/workloads` - Create workload
- `GET /api/allocations` - List allocations
- `POST /api/allocations` - Create allocation

### Submissions
- `GET /api/submissions` - List all submissions (admin only)
- `GET /api/submissions/by-faculty/:empId` - Faculty's submissions
- `POST /api/submissions` - Create submission

---

## Troubleshooting

### "401 Unauthorized" on Login
**Solution**: Run `npm run seed` in the `server` directory to initialize database users.

### "Cannot connect to MongoDB"
**Solution**: Check that `MONGO_URI` is correct in `server/.env`

### "CORS error"
**Solution**: Ensure `CLIENT_ORIGIN` in `server/.env` includes your client URL (e.g., `http://localhost:3000`)

### Port Already in Use
**Solution**: Change port in `.env` or kill existing process
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

---

## Development

### Available Scripts

**Server**:
```bash
npm run dev          # Development mode (with auto-reload)
npm start            # Production mode
npm run seed         # Seed database
```

**Client**:
```bash
npm start            # Development server
npm run build        # Production build
npm test             # Run tests
npm run eject        # Advanced: eject from Create React App
```

---

## Deployment

### Deploy to Render

See [render.yaml](render.yaml) for configuration.
