import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ========================================
// CONFIGURAÇÃO DE REQUISITOS
// ========================================
const REQUIRED_IMPRESSIONS = 20;
const REQUIRED_CLICKS = 2;
const MONETAG_API_URL = 'https://monetag-postback-server-production.up.railway.app';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Host', 'User-Agent']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Proxy Routes for Graninha Bot Backend
const GRANINHA_API_URL = process.env.GRANINHA_API_URL || 'https://painel.graninha.com.br/api/v1';

// ========================================
// FUNÇÃO: Verificar se usuário completou tarefas
// Consulta a API do Monetag para verificar impressões e cliques
// ========================================
async function checkUserTaskCompletion(userId) {
  try {
    if (!userId) {
      console.log('[TASK CHECK] userId não fornecido');
      return { completed: false, impressions: 0, clicks: 0, error: 'userId não fornecido' };
    }

    const statsUrl = `${MONETAG_API_URL}/api/stats/user/${userId}`;
    console.log(`[TASK CHECK] Verificando progresso do usuário ${userId}...`);

    const response = await axios.get(statsUrl, { timeout: 10000 });
    const data = response.data;

    if (data.success) {
      const impressions = data.total_impressions || 0;
      const clicks = data.total_clicks || 0;
      const completed = impressions >= REQUIRED_IMPRESSIONS && clicks >= REQUIRED_CLICKS;

      console.log(`[TASK CHECK] Usuário ${userId}: ${impressions}/${REQUIRED_IMPRESSIONS} impressões, ${clicks}/${REQUIRED_CLICKS} cliques -> ${completed ? 'COMPLETO' : 'INCOMPLETO'}`);

      return { completed, impressions, clicks, error: null };
    } else {
      console.log(`[TASK CHECK] API retornou success=false para usuário ${userId}`);
      return { completed: false, impressions: 0, clicks: 0, error: 'API retornou falha' };
    }
  } catch (error) {
    console.error(`[TASK CHECK] Erro ao verificar usuário ${userId}:`, error.message);
    return { completed: false, impressions: 0, clicks: 0, error: error.message };
  }
}

// ========================================
// FUNÇÃO: Extrair userId do body da requisição
// O body pode conter o userId em diferentes formatos
// ========================================
function extractUserId(body) {
  if (!body) return null;
  // O body pode ser um objeto JSON ou URL-encoded
  // Tentar extrair de diferentes campos possíveis
  return body.user_id || body.userId || body.ymid || body.id || null;
}

// ========================================
// ENDPOINTS ESPECÍFICOS COM VERIFICAÇÃO DE TAREFAS
// IMPORTANTE: Devem ser definidos ANTES do proxy genérico
// ========================================

// Proxy: Get Spin (Roleta) - COM VERIFICAÇÃO
app.post('/api/get_spin', async (req, res) => {
  try {
    const userId = extractUserId(req.body?.data || req.body);
    console.log(`[PROXY] Obtendo spin da roleta para usuário: ${userId}`);

    // ===== VERIFICAÇÃO DE TAREFAS =====
    if (userId) {
      const taskCheck = await checkUserTaskCompletion(userId);
      if (!taskCheck.completed) {
        console.log(`[PROXY] ❌ BLOQUEADO: Usuário ${userId} não completou tarefas (${taskCheck.impressions}/${REQUIRED_IMPRESSIONS} impressões, ${taskCheck.clicks}/${REQUIRED_CLICKS} cliques)`);
        return res.status(403).json({
          code: 403,
          error: 'Tarefas não completadas',
          message: `Você precisa completar as tarefas primeiro! Progresso: ${taskCheck.impressions}/${REQUIRED_IMPRESSIONS} impressões, ${taskCheck.clicks}/${REQUIRED_CLICKS} cliques`,
          required_impressions: REQUIRED_IMPRESSIONS,
          required_clicks: REQUIRED_CLICKS,
          current_impressions: taskCheck.impressions,
          current_clicks: taskCheck.clicks
        });
      }
      console.log(`[PROXY] ✅ Usuário ${userId} completou tarefas - liberando spin`);
    }

    const response = await axios.post(
      `${GRANINHA_API_URL}/get_spin`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'okhttp/4.11.0'
        }
      }
    );

    console.log('[PROXY] Spin obtido com sucesso');
    res.json(response.data);
  } catch (error) {
    console.error('[PROXY] Erro ao obter spin:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro ao obter spin',
      message: error.message
    });
  }
});

// Proxy: Play Roulette (Roleta) - COM VERIFICAÇÃO
app.post('/api/play_roulette', async (req, res) => {
  try {
    const userId = extractUserId(req.body?.data || req.body);
    console.log(`[PROXY] Jogando roleta para usuário: ${userId}`);

    // ===== VERIFICAÇÃO DE TAREFAS =====
    if (userId) {
      const taskCheck = await checkUserTaskCompletion(userId);
      if (!taskCheck.completed) {
        console.log(`[PROXY] ❌ BLOQUEADO: Usuário ${userId} não completou tarefas para jogar roleta`);
        return res.status(403).json({
          code: 403,
          error: 'Tarefas não completadas',
          message: `Complete as tarefas primeiro! ${taskCheck.impressions}/${REQUIRED_IMPRESSIONS} impressões, ${taskCheck.clicks}/${REQUIRED_CLICKS} cliques`,
          required_impressions: REQUIRED_IMPRESSIONS,
          required_clicks: REQUIRED_CLICKS,
          current_impressions: taskCheck.impressions,
          current_clicks: taskCheck.clicks
        });
      }
      console.log(`[PROXY] ✅ Usuário ${userId} completou tarefas - liberando roleta`);
    }

    const response = await axios.post(
      `${GRANINHA_API_URL}/play_roulette`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'okhttp/4.11.0'
        }
      }
    );

    console.log('[PROXY] Roleta jogada com sucesso');
    res.json(response.data);
  } catch (error) {
    console.error('[PROXY] Erro ao jogar roleta:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro ao jogar roleta',
      message: error.message
    });
  }
});

// Proxy: Play Scratch Card (Raspadinha) - COM VERIFICAÇÃO
app.post('/api/play_scratch', async (req, res) => {
  try {
    const userId = extractUserId(req.body?.data || req.body);
    console.log(`[PROXY] Jogando raspadinha para usuário: ${userId}`);

    // ===== VERIFICAÇÃO DE TAREFAS =====
    if (userId) {
      const taskCheck = await checkUserTaskCompletion(userId);
      if (!taskCheck.completed) {
        console.log(`[PROXY] ❌ BLOQUEADO: Usuário ${userId} não completou tarefas para raspadinha`);
        return res.status(403).json({
          code: 403,
          error: 'Tarefas não completadas',
          message: `Complete as tarefas primeiro! ${taskCheck.impressions}/${REQUIRED_IMPRESSIONS} impressões, ${taskCheck.clicks}/${REQUIRED_CLICKS} cliques`,
          required_impressions: REQUIRED_IMPRESSIONS,
          required_clicks: REQUIRED_CLICKS,
          current_impressions: taskCheck.impressions,
          current_clicks: taskCheck.clicks
        });
      }
    }

    const response = await axios.post(
      `${GRANINHA_API_URL}/play_scratch`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'okhttp/4.11.0'
        }
      }
    );

    console.log('[PROXY] Raspadinha jogada com sucesso');
    res.json(response.data);
  } catch (error) {
    console.error('[PROXY] Erro ao jogar raspadinha:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro ao jogar raspadinha',
      message: error.message
    });
  }
});

// Proxy: Play Quiz - COM VERIFICAÇÃO
app.post('/api/play_quiz', async (req, res) => {
  try {
    const userId = extractUserId(req.body?.data || req.body);
    console.log(`[PROXY] Respondendo quiz para usuário: ${userId}`);

    // ===== VERIFICAÇÃO DE TAREFAS =====
    if (userId) {
      const taskCheck = await checkUserTaskCompletion(userId);
      if (!taskCheck.completed) {
        console.log(`[PROXY] ❌ BLOQUEADO: Usuário ${userId} não completou tarefas para quiz`);
        return res.status(403).json({
          code: 403,
          error: 'Tarefas não completadas',
          message: `Complete as tarefas primeiro! ${taskCheck.impressions}/${REQUIRED_IMPRESSIONS} impressões, ${taskCheck.clicks}/${REQUIRED_CLICKS} cliques`,
          required_impressions: REQUIRED_IMPRESSIONS,
          required_clicks: REQUIRED_CLICKS,
          current_impressions: taskCheck.impressions,
          current_clicks: taskCheck.clicks
        });
      }
    }

    const response = await axios.post(
      `${GRANINHA_API_URL}/play_quiz`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'okhttp/4.11.0'
        }
      }
    );

    console.log('[PROXY] Quiz respondido com sucesso');
    res.json(response.data);
  } catch (error) {
    console.error('[PROXY] Erro ao responder quiz:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro ao responder quiz',
      message: error.message
    });
  }
});

// Proxy: Play Game - COM VERIFICAÇÃO
app.post('/api/play_game', async (req, res) => {
  try {
    const userId = extractUserId(req.body?.data || req.body);
    console.log(`[PROXY] Jogando game para usuário: ${userId}`);

    // ===== VERIFICAÇÃO DE TAREFAS =====
    if (userId) {
      const taskCheck = await checkUserTaskCompletion(userId);
      if (!taskCheck.completed) {
        console.log(`[PROXY] ❌ BLOQUEADO: Usuário ${userId} não completou tarefas para game`);
        return res.status(403).json({
          code: 403,
          error: 'Tarefas não completadas',
          message: `Complete as tarefas primeiro! ${taskCheck.impressions}/${REQUIRED_IMPRESSIONS} impressões, ${taskCheck.clicks}/${REQUIRED_CLICKS} cliques`,
          required_impressions: REQUIRED_IMPRESSIONS,
          required_clicks: REQUIRED_CLICKS,
          current_impressions: taskCheck.impressions,
          current_clicks: taskCheck.clicks
        });
      }
    }

    const response = await axios.post(
      `${GRANINHA_API_URL}/play_game`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'okhttp/4.11.0'
        }
      }
    );

    console.log('[PROXY] Game jogado com sucesso');
    res.json(response.data);
  } catch (error) {
    console.error('[PROXY] Erro ao jogar game:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro ao jogar game',
      message: error.message
    });
  }
});

// Proxy: Get User Info (mantido para compatibilidade)
app.post('/api/get_user_old', async (req, res) => {
  try {
    console.log('[PROXY] Obtendo informações do usuário');

    const response = await axios.post(
      `${GRANINHA_API_URL}/get_user`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'okhttp/4.11.0'
        }
      }
    );

    console.log('[PROXY] Usuário obtido com sucesso');
    res.json(response.data);
  } catch (error) {
    console.error('[PROXY] Erro ao obter usuário:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro ao obter usuário',
      message: error.message
    });
  }
});

// ========================================
// PROXY GENÉRICO - DEVE SER O ÚLTIMO ENDPOINT POST
// Captura qualquer endpoint não definido acima
// TAMBÉM COM VERIFICAÇÃO para endpoints de jogo
// ========================================
const GAME_ENDPOINTS = ['get_spin', 'play_roulette', 'play_scratch', 'play_quiz', 'play_game', 'datas'];

app.post('/api/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;

    console.log(`[PROXY] Requisição genérica para ${endpoint}`);

    // ===== VERIFICAÇÃO DE TAREFAS PARA ENDPOINTS DE JOGO =====
    if (GAME_ENDPOINTS.includes(endpoint)) {
      const userId = extractUserId(req.body?.data || req.body);
      if (userId) {
        const taskCheck = await checkUserTaskCompletion(userId);
        if (!taskCheck.completed) {
          console.log(`[PROXY] ❌ BLOQUEADO via proxy genérico: Usuário ${userId} não completou tarefas para ${endpoint}`);
          return res.status(403).json({
            code: 403,
            error: 'Tarefas não completadas',
            message: `Complete as tarefas primeiro! ${taskCheck.impressions}/${REQUIRED_IMPRESSIONS} impressões, ${taskCheck.clicks}/${REQUIRED_CLICKS} cliques`,
            required_impressions: REQUIRED_IMPRESSIONS,
            required_clicks: REQUIRED_CLICKS,
            current_impressions: taskCheck.impressions,
            current_clicks: taskCheck.clicks
          });
        }
        console.log(`[PROXY] ✅ Usuário ${userId} liberado para ${endpoint}`);
      }
    }

    const { bearer_token, data } = req.body;

    const response = await axios.post(
      `${GRANINHA_API_URL}/${endpoint}`,
      data,
      {
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${bearer_token}`,
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'okhttp/4.12.0'
        }
      }
    );

    console.log(`[PROXY] ${endpoint} - sucesso`);
    res.json(response.data);
  } catch (error) {
    console.error(`[PROXY] Erro em ${req.params.endpoint}:`, error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro na requisição',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    required_impressions: REQUIRED_IMPRESSIONS,
    required_clicks: REQUIRED_CLICKS
  });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Graninha Bot Server`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${NODE_ENV}`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`🤖 Backend API: ${GRANINHA_API_URL}`);
  console.log(`🔒 Verificação de tarefas: ${REQUIRED_IMPRESSIONS} impressões + ${REQUIRED_CLICKS} cliques`);
  console.log(`\n✅ Server ready to accept connections\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
