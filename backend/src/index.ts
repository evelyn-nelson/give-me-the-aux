import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '../.env' });
}

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    port: PORT,
    databaseConnected: !!process.env.DATABASE_URL,
    ...(process.env.NODE_ENV === 'development' && {
      googleClientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      youtubeApiKey: process.env.YOUTUBE_API_KEY ? 'Set' : 'Not set',
      jwtSecret: process.env.JWT_SECRET ? 'Set' : 'Not set'
    })
  });
});

// Routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
