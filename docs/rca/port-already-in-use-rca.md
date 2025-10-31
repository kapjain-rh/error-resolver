# RCA: Port Already in Use (EADDRINUSE)

**Error Type:** runtime
**Severity:** Medium
**Date:** 2025-01-15
**Reported By:** Backend Team

## Error Description

Application fails to start because the port it's trying to bind to is already in use by another process.

### Common Error Messages
- `Error: listen EADDRINUSE: address already in use :::3000`
- `EADDRINUSE: Address already in use`
- `Port 3000 is already in use`
- `bind EADDRINUSE 0.0.0.0:8080`

## Root Cause

This error occurs when:
1. **Previous instance still running** - App wasn't properly stopped
2. **Another service using port** - Different application bound to same port
3. **Zombie process** - Process didn't terminate cleanly
4. **Development server restarted** - Hot reload kept old process alive
5. **Hardcoded port conflicts** - Multiple services configured with same port

## Solution

### Step 1: Find Process Using Port

#### On macOS/Linux:

```bash
# Find process on port 3000
lsof -i :3000

# Or use netstat
netstat -vanp tcp | grep 3000

# Or use ss (faster)
ss -lptn 'sport = :3000'
```

#### On Windows:

```powershell
# Find process on port 3000
netstat -ano | findstr :3000

# Get process details
tasklist | findstr <PID>
```

### Step 2: Kill the Process

#### On macOS/Linux:

```bash
# Kill by port (one command)
kill $(lsof -t -i:3000)

# Or kill by PID
kill -9 <PID>

# For stubborn processes
sudo kill -9 <PID>

# Kill all node processes (use with caution!)
pkill -9 node
```

#### On Windows:

```powershell
# Kill by PID
taskkill /PID <PID> /F

# Kill all node processes (use with caution!)
taskkill /IM node.exe /F
```

### Step 3: Use Different Port

Change port in your configuration:

```javascript
// Node.js/Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Use environment variable
// .env
PORT=3001
```

```bash
# Start with different port
PORT=3001 npm start

# Or
node server.js --port 3001
```

### Step 4: Automatic Port Selection

Let the OS assign an available port:

```javascript
// Node.js - use port 0 for automatic assignment
const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(`Server running on port ${port}`);
});

// Or find available port programmatically
const getPort = require('get-port');

(async () => {
  const port = await getPort({ port: 3000 });
  app.listen(port);
})();
```

## Prevention

### 1. Use Environment Variables

```javascript
// config.js
module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost'
};

// Start script
// package.json
{
  "scripts": {
    "dev": "PORT=3000 nodemon server.js",
    "prod": "PORT=8080 node server.js"
  }
}
```

### 2. Graceful Shutdown

```javascript
// Node.js - handle shutdown signals
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### 3. Check Port Before Starting

```javascript
const net = require('net');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

// Usage
const PORT = 3000;
isPortAvailable(PORT).then(available => {
  if (!available) {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  app.listen(PORT);
});
```

### 4. Development Script

```bash
#!/bin/bash
# start-dev.sh

PORT=3000

# Kill any process using the port
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "Killing process on port $PORT"
    kill $(lsof -t -i:$PORT)
    sleep 1
fi

# Start application
npm run dev
```

### 5. Docker Port Mapping

```yaml
# docker-compose.yml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"  # HOST:CONTAINER
    environment:
      - PORT=3000
```

```dockerfile
# Dockerfile
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

## Quick Fix Script

Save as `kill-port.sh`:

```bash
#!/bin/bash
# Usage: ./kill-port.sh 3000

PORT=$1

if [ -z "$PORT" ]; then
  echo "Usage: ./kill-port.sh <port>"
  exit 1
fi

echo "Finding processes on port $PORT..."
PIDS=$(lsof -ti:$PORT)

if [ -z "$PIDS" ]; then
  echo "No processes found on port $PORT"
else
  echo "Killing processes: $PIDS"
  kill -9 $PIDS
  echo "Done!"
fi
```

Make executable: `chmod +x kill-port.sh`

## Testing

Verify port is free:

```bash
# Check if port is available
lsof -i :3000

# Should return nothing if port is free

# Test your application
npm start

# Verify it's listening
curl http://localhost:3000
```

## Common Scenarios

### Development Mode
```json
{
  "scripts": {
    "predev": "pkill -9 node || true",
    "dev": "nodemon server.js"
  }
}
```

### Multiple Services
```bash
# Assign different ports
SERVICE_A_PORT=3000 npm start
SERVICE_B_PORT=3001 npm start
SERVICE_C_PORT=3002 npm start
```

### CI/CD
```yaml
# .github/workflows/test.yml
- name: Start server
  run: |
    PORT=$((3000 + $RANDOM % 1000))
    PORT=$PORT npm start &
    sleep 5
```

## Related Issues

- [RCA: Process Management](./process-management-rca.md)
- [RCA: Docker Networking](./docker-networking-rca.md)

## Additional Resources

- [Node.js Net Module](https://nodejs.org/api/net.html)
- [Managing Processes on Unix](https://www.baeldung.com/linux/process-management)
- [get-port npm package](https://www.npmjs.com/package/get-port)
