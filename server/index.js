const express = require('express');
const cors = require('cors');
const projectsRouter = require('./routes/projects');
const { closeDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/projects', projectsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  console.log(`Isoflow server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  closeDb();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  server.close();
  process.exit(0);
});
