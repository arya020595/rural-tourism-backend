# Auto-Refresh Development Server Setup ✅

## Quick Start

Start the development server with auto-refresh:

```bash
npm run dev
```

The server will automatically restart whenever you modify files!

---

## What's Being Watched

Nodemon watches these directories for changes:

```
✅ server.js
✅ bin/
✅ routes/
✅ controllers/
✅ models/
✅ middleware/
✅ config/
✅ utils/
```

**File types monitored**: `.js`, `.json`

---

## What's Being Ignored

These won't trigger a restart:

```
❌ node_modules/
❌ tests/
❌ coverage/
❌ uploads/
❌ *.test.js
❌ *.spec.js
```

---

## Configuration

Auto-refresh is configured in **[nodemon.json](nodemon.json)**:

```json
{
  "watch": ["server.js", "bin/", "routes/", ...],
  "ignore": ["node_modules/", "tests/", ...],
  "ext": "js,json",
  "exec": "node server.js",
  "env": {
    "NODE_ENV": "development"
  },
  "delay": 500
}
```

### Key Settings

- **delay: 500ms** - Waits 500ms after file change before restarting (prevents multiple rapid restarts)
- **env.NODE_ENV: development** - Sets development environment
- **ext: js,json** - Only watches JavaScript and JSON files

---

## Usage Examples

### Normal Development

```bash
npm run dev
```

Output:

```
[nodemon] 3.1.11
[nodemon] watching path(s): server.js bin/**/* routes/**/* ...
[nodemon] watching extensions: js,json
[nodemon] starting `node server.js`
Server is running on http://0.0.0.0:3000
```

### Manual Restart

While nodemon is running, type:

```
rs
```

This forces an immediate restart without changing files.

### Stop Server

```
Ctrl + C
```

---

## How It Works

1. **Start**: Run `npm run dev`
2. **Edit**: Make changes to any watched file
3. **Save**: Nodemon detects the change
4. **Wait**: 500ms delay (debounce)
5. **Restart**: Server automatically restarts
6. **Ready**: Server is back up with your changes!

---

## Typical Workflow

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Make API requests or run tests
curl http://localhost:3000/api/activity-master-data
```

When you edit a file:

```
[nodemon] restarting due to changes...
[nodemon] starting `node server.js`
Server is running on http://0.0.0.0:3000
```

---

## Production vs Development

| Command          | Auto-Refresh | Environment | Use Case              |
| ---------------- | ------------ | ----------- | --------------------- |
| `npm run dev`    | ✅ Yes       | development | Local development     |
| `npm start`      | ❌ No        | production  | Production deployment |
| `npm run server` | ❌ No        | -           | Manual testing        |

---

## Customizing Watched Files

Edit **nodemon.json** to add/remove watched directories:

```json
{
  "watch": [
    "server.js",
    "routes/",
    "your-new-folder/" // Add your folder here
  ]
}
```

---

## Troubleshooting

### Server not restarting on changes?

1. **Check file is being watched:**

   - Make sure the file is in a watched directory
   - Check it's a `.js` or `.json` file

2. **Check ignore list:**

   - Ensure file isn't in `ignore` array

3. **Manual restart:**
   - Type `rs` in the terminal

### Too many restarts?

If nodemon restarts too often, increase the delay:

```json
{
  "delay": 1000 // Wait 1 second instead of 500ms
}
```

### Want to watch other file types?

Add extensions to the `ext` field:

```json
{
  "ext": "js,json,ts,yaml" // Now also watches .ts and .yaml
}
```

---

## Related Commands

```bash
# Development with auto-refresh
npm run dev

# Production (no auto-refresh)
npm start

# Run without nodemon
npm run server

# Database sync
npm run db:sync

# Run tests (won't trigger restarts)
npm test
```

---

## Benefits

✅ **Faster Development** - No manual restarts  
✅ **Instant Feedback** - See changes immediately  
✅ **Better Productivity** - Focus on coding, not restarting  
✅ **Smart Watching** - Only restarts when needed  
✅ **Configurable** - Customize what triggers restarts

---

**Last Updated**: December 30, 2025  
**Nodemon Version**: 3.1.11  
**Auto-Refresh**: Enabled ✅
