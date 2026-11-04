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
  hospitalId: 'all',
  createdAt: new Date().toISOString()
};

// Plan limits definition
export const PLANS = {
  basico: {
    id: 'basico',
    name: 'Plano Básico (Clínicas)',
    price: 290,
    maxEquipments: 100,
    maxHospitals: 1,
    maxUsers: 2,
    badgeColor: 'blue',
    features: [
      'Até 100 equipamentos cadastrados',
      '1 Unidade Hospitalar ou Clínica',
      'Até 2 operadores simultâneos',
      'Leitor de código de barras e QR Code',
      'Exportação atualizada em Excel (.xlsx)',
      'Suporte via e-mail'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Plano Profissional (Hospitais)',
    price: 590,
    maxEquipments: 500,
    maxHospitals: 3,
    maxUsers: 5,
    badgeColor: 'emerald',
    features: [
      'Até 500 equipamentos cadastrados',
      'Até 3 Hospitais / Unidades clientes',
      'Até 5 operadores simultâneos',
      'Sincronização em tempo real entre celulares',
      'Instalação como App PWA no Android & iOS',
      'Alertas de calibração vencida e a vencer',
      'Suporte prioritário via WhatsApp'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Plano Enterprise (Redes Hospitalares)',
    price: 1290,
    maxEquipments: 99999,
    maxHospitals: 999,
    maxUsers: 99,
    badgeColor: 'amber',
    features: [
      'Equipamentos e instrumentos ILIMITADOS',
      'Hospitais e Redes Hospitalares ILIMITADOS',
      'Operadores e inspetores ILIMITADOS',
      'Painel Master completo de gestão de filiais',
      'Histórico de auditoria com nome do conferente',
      'SLA de suporte 24/7 com gerente de conta'
    ]
  }
};

// Read users
function readUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
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

// Default initial state for hospitals
function getInitialDb() {
  return {
    hospitals: [
      {
        id: 'hosp_central',
        name: 'Hospital Central - Digiclintec',
        cidade: 'São Paulo - SP',
        cnpj: '12.345.678/0001-90',
        plano: 'enterprise',
        equipments: [],
        activeSheetName: '',
        lastUpdated: Date.now(),
        createdAt: new Date().toISOString()
      },
      {
        id: 'hosp_marcelina',
        name: 'Hospital Santa Marcelina',
        cidade: 'Campinas - SP',
        cnpj: '98.765.432/0001-11',
        plano: 'pro',
        equipments: [],
        activeSheetName: '',
        lastUpdated: Date.now(),
        createdAt: new Date().toISOString()
      }
    ],
    activeHospitalId: 'hosp_central',
    lastUpdated: Date.now()
  };
}

// Read database with migration if needed
function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content);
      
      // Auto-migrate legacy format if it had flat equipments
      if (Array.isArray(data.equipments) && !data.hospitals) {
        const migrated = {
          hospitals: [
            {
              id: 'hosp_central',
              name: 'Hospital Central - Digiclintec',
              cidade: 'São Paulo - SP',
              cnpj: '12.345.678/0001-90',
              plano: 'enterprise',
              equipments: data.equipments,
              activeSheetName: data.activeSheetName || '',
              lastUpdated: data.lastUpdated || Date.now(),
              createdAt: new Date().toISOString()
            }
          ],
          activeHospitalId: 'hosp_central',
          lastUpdated: Date.now()
        };
        saveDb(migrated);
        return migrated;
      }
      return data;
    }
  } catch (err) {
    console.error('Erro ao ler db.json:', err);
  }
  const initial = getInitialDb();
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

// ---------------- AUTH ROUTES ---------------- //

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Informe e-mail e senha.' });
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
        hospitalId: user.hospitalId || 'all',
        token: 'token_' + user.id + '_' + Date.now()
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Credenciais inválidas. Verifique seu e-mail e senha.'
  });
});

// List users
app.get('/api/users', (req, res) => {
  const users = readUsers();
  const sanitized = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || 'operador',
    hospitalId: u.hospitalId || 'all',
    createdAt: u.createdAt || new Date().toISOString()
  }));

  res.json({ success: true, users: sanitized });
});

// Create user
app.post('/api/users', (req, res) => {
  const { name, email, password, role, hospitalId } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Preencha nome, e-mail e senha.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Já existe um usuário com este e-mail.' });
  }

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: String(name).trim(),
    email: cleanEmail,
    password: String(password).trim(),
    role: role || 'operador',
    hospitalId: hospitalId || 'all',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  res.json({
    success: true,
    message: 'Usuário cadastrado com sucesso!',
    user: newUser
  });
});

// Delete user
app.post('/api/users/delete', (req, res) => {
  const { id } = req.body || {};
  const users = readUsers();
  const target = users.find(u => u.id === id);

  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  if (target.role === 'master' || target.email.toLowerCase() === DEFAULT_MASTER.email.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Não é permitido excluir a conta Master.' });
  }

  const filtered = users.filter(u => u.id !== id);
  saveUsers(filtered);

  res.json({ success: true, message: 'Usuário excluído com sucesso.' });
});

// Update password
app.post('/api/users/password', (req, res) => {
  const { id, newPassword } = req.body || {};
  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  users[idx].password = String(newPassword).trim();
  saveUsers(users);

  res.json({ success: true, message: 'Senha atualizada com sucesso!' });
});

// ---------------- HOSPITALS & PLANS ROUTES ---------------- //

// List all hospitals & their active plan
app.get('/api/hospitals', (req, res) => {
  const db = readDb();
  const list = (db.hospitals || []).map(h => ({
    id: h.id,
    name: h.name,
    cidade: h.cidade || '',
    cnpj: h.cnpj || '',
    plano: h.plano || 'pro',
    equipmentCount: (h.equipments || []).length,
    checkedCount: (h.equipments || []).filter(e => e.checado).length,
    activeSheetName: h.activeSheetName || '',
    createdAt: h.createdAt
  }));

  res.json({
    success: true,
    hospitals: list,
    activeHospitalId: db.activeHospitalId || list[0]?.id || 'hosp_central',
    plans: PLANS
  });
});

// Create new Hospital (Client)
app.post('/api/hospitals', (req, res) => {
  const { name, cidade, cnpj, plano } = req.body || {};

  if (!name) {
    return res.status(400).json({ success: false, message: 'Nome do hospital ou clínica é obrigatório.' });
  }

  const db = readDb();
  const newHospital = {
    id: 'hosp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: String(name).trim(),
    cidade: cidade ? String(cidade).trim() : '',
    cnpj: cnpj ? String(cnpj).trim() : '',
    plano: plano || 'pro',
    equipments: [],
    activeSheetName: '',
    lastUpdated: Date.now(),
    createdAt: new Date().toISOString()
  };

  db.hospitals = db.hospitals || [];
  db.hospitals.push(newHospital);
  db.activeHospitalId = newHospital.id;
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: `Hospital "${newHospital.name}" cadastrado com sucesso!`,
    hospital: newHospital,
    hospitals: db.hospitals
  });
});

// Update Hospital (Change Plan, Name, etc.)
app.post('/api/hospitals/update', (req, res) => {
  const { id, name, cidade, cnpj, plano } = req.body || {};
  const db = readDb();
  const idx = (db.hospitals || []).findIndex(h => h.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  if (name) db.hospitals[idx].name = String(name).trim();
  if (cidade !== undefined) db.hospitals[idx].cidade = String(cidade).trim();
  if (cnpj !== undefined) db.hospitals[idx].cnpj = String(cnpj).trim();
  if (plano) db.hospitals[idx].plano = plano;

  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: 'Dados do hospital atualizados com sucesso.',
    hospital: db.hospitals[idx]
  });
});

// Delete Hospital
app.post('/api/hospitals/delete', (req, res) => {
  const { id } = req.body || {};
  const db = readDb();

  if (db.hospitals && db.hospitals.length <= 1) {
    return res.status(400).json({ success: false, message: 'Você precisa manter pelo menos 1 hospital cadastrado.' });
  }

  db.hospitals = db.hospitals.filter(h => h.id !== id);
  if (db.activeHospitalId === id) {
    db.activeHospitalId = db.hospitals[0]?.id || '';
  }
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({ success: true, message: 'Hospital excluído com sucesso.', hospitals: db.hospitals });
});

// Switch Active Hospital
app.post('/api/hospitals/switch', (req, res) => {
  const { hospitalId } = req.body || {};
  const db = readDb();
  
  if (hospitalId) {
    db.activeHospitalId = hospitalId;
    db.lastUpdated = Date.now();
    saveDb(db);
  }

  res.json({ success: true, activeHospitalId: db.activeHospitalId });
});

// ---------------- DATA & CHECK-IN ROUTES (PER HOSPITAL) ---------------- //

// Get current spreadsheet state for active hospital
app.get('/api/data', (req, res) => {
  const db = readDb();
  const targetId = req.query.hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospital = (db.hospitals || []).find(h => h.id === targetId) || db.hospitals?.[0] || {};

  res.json({
    success: true,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    hospitalPlan: hospital.plano || 'pro',
    equipments: hospital.equipments || [],
    activeSheetName: hospital.activeSheetName || '',
    lastUpdated: hospital.lastUpdated || db.lastUpdated || Date.now(),
    lastUpdatedBy: hospital.lastUpdatedBy || ''
  });
});

// Save or Update spreadsheet for active hospital
app.post('/api/data', (req, res) => {
  const { equipments, activeSheetName, userEmail, userName, hospitalId } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital ativo não encontrado.' });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema');

  db.hospitals[idx].equipments = Array.isArray(equipments) ? equipments : [];
  db.hospitals[idx].activeSheetName = activeSheetName || '';
  db.hospitals[idx].lastUpdated = Date.now();
  db.hospitals[idx].lastUpdatedBy = inspectorLabel;

  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: 'Planilha sincronizada com sucesso.',
    hospitalId: db.hospitals[idx].id,
    hospitalName: db.hospitals[idx].name,
    equipments: db.hospitals[idx].equipments,
    activeSheetName: db.hospitals[idx].activeSheetName,
    lastUpdated: db.hospitals[idx].lastUpdated
  });
});

// Check or Uncheck an equipment inside active hospital
app.post('/api/toggle-check', (req, res) => {
  const { id, userEmail, userName, hospitalId } = req.body || {};
  if (!id) {
    return res.status(400).json({ success: false, message: 'ID do equipamento não informado.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const list = db.hospitals[hospIdx].equipments || [];
  const idx = list.findIndex(e => e.id === id || e.codigoBarras === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Equipamento não encontrado na lista do hospital.' });
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

  db.hospitals[hospIdx].equipments = list;
  db.hospitals[hospIdx].lastUpdated = Date.now();
  db.hospitals[hospIdx].lastUpdatedBy = inspectorLabel;

  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    item: list[idx],
    equipments: list,
    lastUpdated: db.lastUpdated,
    lastUpdatedBy: inspectorLabel
  });
});

// Reset equipments of active hospital
app.post('/api/reset', (req, res) => {
  const { hospitalId } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx !== -1) {
    db.hospitals[idx].equipments = [];
    db.hospitals[idx].activeSheetName = '';
    db.hospitals[idx].lastUpdated = Date.now();
  }

  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({ success: true, message: 'Planilha do hospital limpa com sucesso.' });
});

// Serve frontend static files from dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor CalibraCheck Multi-Hospital rodando na porta: ${PORT}`);
});
