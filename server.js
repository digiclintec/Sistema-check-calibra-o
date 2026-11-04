import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Master User seed
const DEFAULT_MASTER = {
  id: 'usr_master_1',
  email: 'digiclintec@gmail.com',
  password: '12289399@Ra',
  name: 'Digiclintec Master',
  role: 'master', // 'master' | 'admin' | 'operador'
  createdAt: new Date().toISOString()
};

// Read users
function readUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure master always exists
        const hasMaster = parsed.some(u => u.email.toLowerCase() === DEFAULT_MASTER.email.toLowerCase());
        if (!hasMaster) {
          parsed.unshift(DEFAULT_MASTER);
          saveUsers(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler users.json:', err);
  }
  const initial = [DEFAULT_MASTER];
  saveUsers(initial);
  return initial;
}

// Save users
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar users.json:', err);
  }
}

// Default initial equipment state
function getInitialData() {
  return {
    equipments: [],
    activeSheetName: '',
    lastUpdated: Date.now(),
    lastUpdatedBy: 'Sistema'
  };
}

// Read database
function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Erro ao ler db.json:', err);
  }
  const initial = getInitialData();
  saveDb(initial);
  return initial;
}

// Save database
function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar db.json:', err);
  }
}

// ---------------- AUTH & USER MANAGEMENT ROUTES ---------------- //

// Login endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Informe email e senha.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const users = readUsers();
  
  const user = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);

  if (user) {
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'operador',
        token: 'token_' + user.id + '_' + Date.now()
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Credenciais inválidas. Verifique seu e-mail e senha.'
  });
});

// List all users (For Master Panel)
app.get('/api/users', (req, res) => {
  const users = readUsers();
  // Return users without exposing plaintext passwords
  const sanitized = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || 'operador',
    createdAt: u.createdAt || new Date().toISOString()
  }));

  res.json({ success: true, users: sanitized });
});

// Create new user (From Master Panel)
app.post('/api/users', (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Preencha nome, e-mail e senha.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Já existe um usuário cadastrado com este e-mail.' });
  }

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: String(name).trim(),
    email: cleanEmail,
    password: String(password).trim(),
    role: role || 'operador',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  res.json({
    success: true,
    message: 'Usuário cadastrado com sucesso!',
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt
    }
  });
});

// Delete user (Master only)
app.post('/api/users/delete', (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ success: false, message: 'ID do usuário não informado.' });
  }

  const users = readUsers();
  const target = users.find(u => u.id === id);

  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  if (target.role === 'master' || target.email.toLowerCase() === DEFAULT_MASTER.email.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Não é permitido excluir a conta Master principal.' });
  }

  const filtered = users.filter(u => u.id !== id);
  saveUsers(filtered);

  res.json({ success: true, message: 'Usuário excluído com sucesso.' });
});

// Update password (Master or User)
app.post('/api/users/password', (req, res) => {
  const { id, newPassword } = req.body || {};
  if (!id || !newPassword) {
    return res.status(400).json({ success: false, message: 'Informe o ID e a nova senha.' });
  }

  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  users[idx].password = String(newPassword).trim();
  saveUsers(users);

  res.json({ success: true, message: 'Senha atualizada com sucesso!' });
});

// ---------------- DATA & CHECK-IN ROUTES ---------------- //

// Get current spreadsheet state
app.get('/api/data', (req, res) => {
  const db = readDb();
  res.json({
    success: true,
    equipments: db.equipments || [],
    activeSheetName: db.activeSheetName || '',
    lastUpdated: db.lastUpdated || Date.now(),
    lastUpdatedBy: db.lastUpdatedBy || ''
  });
});

// Update entire equipment list (import or batch update)
app.post('/api/data', (req, res) => {
  const { equipments, activeSheetName, userEmail, userName } = req.body || {};
  
  const db = {
    equipments: Array.isArray(equipments) ? equipments : [],
    activeSheetName: activeSheetName || '',
    lastUpdated: Date.now(),
    lastUpdatedBy: userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema')
  };

  saveDb(db);

  res.json({
    success: true,
    message: 'Planilha sincronizada no servidor com sucesso.',
    ...db
  });
});

// Check or Uncheck a specific equipment
app.post('/api/toggle-check', (req, res) => {
  const { id, userEmail, userName } = req.body || {};
  if (!id) {
    return res.status(400).json({ success: false, message: 'ID do equipamento não informado.' });
  }

  const db = readDb();
  const list = db.equipments || [];
  const idx = list.findIndex(e => e.id === id || e.codigoBarras === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Equipamento não encontrado na lista.' });
  }

  const item = list[idx];
  const nextChecked = !item.checado;
  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');

  list[idx] = {
    ...item,
    checado: nextChecked,
    dataCheck: nextChecked ? new Date().toISOString() : null,
    conferidoPor: nextChecked ? inspectorLabel : null
  };

  db.equipments = list;
  db.lastUpdated = Date.now();
  db.lastUpdatedBy = inspectorLabel;

  saveDb(db);

  res.json({
    success: true,
    item: list[idx],
    equipments: list,
    lastUpdated: db.lastUpdated,
    lastUpdatedBy: db.lastUpdatedBy
  });
});

// Reset database
app.post('/api/reset', (req, res) => {
  const initial = getInitialData();
  saveDb(initial);
  res.json({ success: true, message: 'Dados resetados com sucesso.', ...initial });
});

// Serve frontend static files from dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Single-Page Application fallback for Express 5
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor CalibraCheck rodando na porta: ${PORT}`);
});
