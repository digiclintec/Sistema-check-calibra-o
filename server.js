import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseWorkbookBuffer } from './src/utils/sheetParser.js';

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

      // Auto-fix labels if equipments have original spreadsheet fields
      if (Array.isArray(data.hospitals)) {
        let changed = false;
        data.hospitals.forEach(h => {
          // Initialize plans list if not present
          if (!Array.isArray(h.plans)) {
            h.plans = [];
            if ((Array.isArray(h.equipments) && h.equipments.length > 0) || h.activeSheetName) {
              const defaultPlan = {
                id: 'plan_' + (h.id || 'central') + '_padrao',
                title: h.activeSheetName ? h.activeSheetName.replace(/\.[^/.]+$/, "") : 'Planejamento Padrão',
                mes: 'Novembro/2026',
                fileName: h.activeSheetName || 'Planilha_Calibracao.xlsx',
                equipments: h.equipments || [],
                createdAt: new Date().toISOString(),
                lastUpdated: h.lastUpdated || Date.now()
              };
              h.plans.push(defaultPlan);
              h.activePlanId = defaultPlan.id;
            }
            changed = true;
          }

          // If activePlanId is set, sync h.equipments with active plan
          if (h.plans && h.plans.length > 0) {
            if (!h.activePlanId || !h.plans.some(p => p.id === h.activePlanId)) {
              h.activePlanId = h.plans[0].id;
              changed = true;
            }
            const activePlan = h.plans.find(p => p.id === h.activePlanId) || h.plans[0];
            if (activePlan) {
              h.equipments = activePlan.equipments || [];
              h.activeSheetName = activePlan.fileName || activePlan.title || '';
            }
          }

          if (Array.isArray(h.equipments)) {
            h.equipments.forEach((eq, idx) => {
              if (eq._originalRow) {
                if ((eq.equipamento === 'Ativo' || !eq.equipamento) && eq._originalRow['TIPO']) {
                  eq.equipamento = String(eq._originalRow['TIPO']).trim();
                  changed = true;
                }
                if ((!eq.tag || eq.tag.startsWith('TAG-')) && eq._originalRow['Identificação']) {
                  eq.tag = String(eq._originalRow['Identificação']).trim();
                  changed = true;
                }
                if (eq.codigoBarras === 'BOMBA DE INFUSAO VOLUMETRICA' && eq.serie) {
                  eq.codigoBarras = eq.serie;
                  changed = true;
                }
              }
              // Garante ID 100% exclusivo para cada bomba
              if (!eq.id || eq.id === 'BOMBA DE INFUSAO VOLUMETRICA' || eq.id === eq.equipamento) {
                eq.id = eq.serie ? `EQP-${eq.serie}` : (eq.tag ? `EQP-${eq.tag}` : `EQP-${idx + 1}`);
                changed = true;
              }

              // Normaliza modalidades para trabalho de multiequipes (Preventiva / Calibração / Seg. Elétrica)
              const isLegacyChecked = Boolean(eq.checado);
              const legacyDate = eq.dataCheck || null;
              const legacyUser = eq.conferidoPor || null;

              if (eq.check_calibracao === undefined) {
                eq.check_calibracao = isLegacyChecked;
                eq.data_calibracao = eq.data_calibracao || (isLegacyChecked ? legacyDate : null);
                eq.usuario_calibracao = eq.usuario_calibracao || (isLegacyChecked ? legacyUser : null);
                changed = true;
              }
              if (eq.check_preventiva === undefined) {
                eq.check_preventiva = false;
                eq.data_preventiva = null;
                eq.usuario_preventiva = null;
                changed = true;
              }
              if (eq.check_seguranca === undefined) {
                eq.check_seguranca = false;
                eq.data_seguranca = null;
                eq.usuario_seguranca = null;
                changed = true;
              }
            });
          }
        });
        if (changed) {
          saveDb(data);
        }
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

// ---------------- MONTHLY CALIBRATION PLANS ROUTES ---------------- //

// List all monthly plans for a hospital
app.get('/api/plans', (req, res) => {
  const db = readDb();
  const targetId = req.query.hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospital = (db.hospitals || []).find(h => h.id === targetId) || db.hospitals?.[0] || {};
  
  const plans = (hospital.plans || []).map(p => {
    const total = (p.equipments || []).length;
    const checked = (p.equipments || []).filter(e => e.checado).length;
    const pending = total - checked;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    return {
      id: p.id,
      title: p.title || p.fileName || 'Planejamento de Calibração',
      mes: p.mes || 'Novembro/2026',
      fileName: p.fileName || '',
      total,
      checked,
      pending,
      percent,
      createdAt: p.createdAt,
      lastUpdated: p.lastUpdated
    };
  });

  res.json({
    success: true,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    activePlanId: hospital.activePlanId || plans[0]?.id || null,
    plans
  });
});

// Switch active monthly plan
app.post('/api/plans/switch', (req, res) => {
  const { hospitalId, planId } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  const plan = (hospital.plans || []).find(p => p.id === planId);
  if (!plan) {
    return res.status(404).json({ success: false, message: 'Planejamento não encontrado.' });
  }

  hospital.activePlanId = planId;
  hospital.equipments = plan.equipments || [];
  hospital.activeSheetName = plan.fileName || plan.title;
  hospital.lastUpdated = Date.now();
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: `Planejamento "${plan.title}" ativado com sucesso!`,
    activePlanId: planId,
    activePlan: plan,
    equipments: plan.equipments || [],
    activeSheetName: hospital.activeSheetName
  });
});

// Create new monthly plan
app.post('/api/plans/create', (req, res) => {
  const { hospitalId, title, mes, fileName, equipments } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  hospital.plans = hospital.plans || [];

  const newPlanId = 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newPlan = {
    id: newPlanId,
    title: String(title || fileName || 'Planejamento de Calibração').trim(),
    mes: String(mes || 'Novembro/2026').trim(),
    fileName: String(fileName || '').trim(),
    equipments: Array.isArray(equipments) ? equipments : [],
    createdAt: new Date().toISOString(),
    lastUpdated: Date.now()
  };

  hospital.plans.push(newPlan);
  hospital.activePlanId = newPlanId;
  hospital.equipments = newPlan.equipments;
  hospital.activeSheetName = newPlan.fileName || newPlan.title;
  hospital.lastUpdated = Date.now();
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: 'Novo planejamento criado e ativado com sucesso!',
    plan: newPlan,
    activePlanId: newPlanId,
    equipments: newPlan.equipments,
    activeSheetName: hospital.activeSheetName
  });
});

// Delete a monthly plan
app.post('/api/plans/delete', (req, res) => {
  const { hospitalId, planId } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  if ((hospital.plans || []).length <= 1) {
    return res.status(400).json({ success: false, message: 'Não é possível excluir o único planejamento existente.' });
  }

  hospital.plans = (hospital.plans || []).filter(p => p.id !== planId);
  if (hospital.activePlanId === planId) {
    const nextPlan = hospital.plans[0];
    hospital.activePlanId = nextPlan?.id || null;
    hospital.equipments = nextPlan?.equipments || [];
    hospital.activeSheetName = nextPlan?.fileName || '';
  }

  hospital.lastUpdated = Date.now();
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: 'Planejamento excluído com sucesso.',
    activePlanId: hospital.activePlanId,
    equipments: hospital.equipments,
    activeSheetName: hospital.activeSheetName
  });
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

  // Sincroniza com o plano ativo
  if (Array.isArray(db.hospitals[idx].plans)) {
    const pIdx = db.hospitals[idx].plans.findIndex(p => p.id === db.hospitals[idx].activePlanId);
    if (pIdx !== -1) {
      db.hospitals[idx].plans[pIdx].equipments = db.hospitals[idx].equipments;
      db.hospitals[idx].plans[pIdx].fileName = activeSheetName || db.hospitals[idx].plans[pIdx].fileName;
      db.hospitals[idx].plans[pIdx].lastUpdated = Date.now();
    }
  }

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

// Fetch and parse Google Sheets / Google Drive spreadsheet URL
app.post('/api/fetch-google-sheet', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, message: 'URL da planilha não fornecida.' });
  }

  const cleanUrl = url.trim();
  const match = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
                cleanUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
                cleanUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);

  if (!match || !match[1]) {
    return res.status(400).json({ success: false, message: 'Link do Google Sheets ou Google Drive inválido.' });
  }

  const docId = match[1];
  const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
  const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';

  // URLs de download candidatas
  const candidateUrls = [
    `https://docs.google.com/spreadsheets/d/${docId}/export?format=xlsx${gidParam}`,
    `https://drive.usercontent.google.com/download?id=${docId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${docId}&confirm=t`,
    `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv${gidParam}`
  ];

  let lastError = null;
  let isRestricted = false;

  for (const candidate of candidateUrls) {
    try {
      const response = await fetch(candidate, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      });

      if (response.status === 401 || response.status === 403) {
        isRestricted = true;
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const arrayBuf = await response.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);

      // Verifica se a resposta foi uma página HTML de login / restrição
      if (contentType.includes('text/html')) {
        const textSample = new TextDecoder().decode(uint8.slice(0, 4000));
        if (
          textSample.includes('accounts.google.com') ||
          textSample.includes('Acesse a sua conta do Google') ||
          textSample.includes('Permita que o Google Drive') ||
          textSample.includes('Sign in')
        ) {
          isRestricted = true;
          continue;
        }
      }

      // Tenta decodificar como planilha com SheetJS
      try {
        const parsed = parseWorkbookBuffer(uint8, 'Google Sheets');
        if (parsed && parsed.equipments && parsed.equipments.length > 0) {
          return res.json({
            success: true,
            fileName: 'Google Sheets (' + (parsed.sheetName || 'Planilha') + ')',
            sheetName: parsed.sheetName,
            headers: parsed.headers,
            mapping: parsed.mapping,
            equipments: parsed.equipments,
            total: parsed.total
          });
        }
      } catch (parseErr) {
        lastError = parseErr;
      }
    } catch (netErr) {
      lastError = netErr;
    }
  }

  if (isRestricted) {
    return res.status(403).json({
      success: false,
      isRestricted: true,
      message: 'Esta planilha no Google Drive está com acesso "Restrito". Para permitir a importação via link: no Google Sheets/Drive, clique em "Compartilhar" (canto superior direito) e altere de "Restrito" para "Qualquer pessoa com o link" (Leitor). Ou clique em Arquivo > Fazer o download > Microsoft Excel (.xlsx) e envie o arquivo na primeira aba!'
    });
  }

  return res.status(400).json({
    success: false,
    message: lastError ? `Não foi possível ler a planilha: ${lastError.message}` : 'Não foi possível baixar ou ler os dados desta planilha do Google.'
  });
});

// Check or Uncheck an equipment inside active hospital with multi-modality support
app.post('/api/toggle-check', (req, res) => {
  const { id, modality = 'calibracao', userEmail, userName, hospitalId } = req.body || {};
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
  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
  const nowIso = new Date().toISOString();

  let nextChecked = false;
  if (modality === 'preventiva') {
    nextChecked = !Boolean(item.check_preventiva);
    item.check_preventiva = nextChecked;
    item.data_preventiva = nextChecked ? nowIso : null;
    item.usuario_preventiva = nextChecked ? inspectorLabel : null;
  } else if (modality === 'seguranca') {
    nextChecked = !Boolean(item.check_seguranca);
    item.check_seguranca = nextChecked;
    item.data_seguranca = nextChecked ? nowIso : null;
    item.usuario_seguranca = nextChecked ? inspectorLabel : null;
  } else {
    // calibracao (padrão)
    nextChecked = !Boolean(item.check_calibracao !== undefined ? item.check_calibracao : item.checado);
    item.check_calibracao = nextChecked;
    item.data_calibracao = nextChecked ? nowIso : null;
    item.usuario_calibracao = nextChecked ? inspectorLabel : null;
  }

  // Compatibilidade legada
  item.checado = Boolean(item.check_calibracao || item.check_preventiva || item.check_seguranca);
  item.dataCheck = item.data_calibracao || item.data_preventiva || item.data_seguranca || null;
  item.conferidoPor = item.usuario_calibracao || item.usuario_preventiva || item.usuario_seguranca || null;

  list[idx] = { ...item };

  db.hospitals[hospIdx].equipments = list;
  db.hospitals[hospIdx].lastUpdated = Date.now();
  db.hospitals[hospIdx].lastUpdatedBy = inspectorLabel;

  // Sincroniza com plano ativo
  if (Array.isArray(db.hospitals[hospIdx].plans)) {
    const pIdx = db.hospitals[hospIdx].plans.findIndex(p => p.id === db.hospitals[hospIdx].activePlanId);
    if (pIdx !== -1) {
      db.hospitals[hospIdx].plans[pIdx].equipments = list;
      db.hospitals[hospIdx].plans[pIdx].lastUpdated = Date.now();
    }
  }

  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    item: list[idx],
    modality,
    nextChecked,
    equipments: list,
    lastUpdated: db.lastUpdated,
    lastUpdatedBy: inspectorLabel
  });
});

// Batch Check multiple equipments at once with modality support
app.post('/api/batch-check', (req, res) => {
  const { ids, modality = 'calibracao', hospitalId, userEmail, userName } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Nenhum equipamento informado para checagem em lote.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
  const nowIso = new Date().toISOString();
  const list = db.hospitals[hospIdx].equipments || [];
  let checkedCount = 0;

  const idSet = new Set(ids.map(x => String(x).toLowerCase()));

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const itemId = String(item.id || '').toLowerCase();
    const itemBarcode = String(item.codigoBarras || '').toLowerCase();
    const itemTag = String(item.tag || '').toLowerCase();
    const itemSerie = String(item.serie || '').toLowerCase();

    if (idSet.has(itemId) || idSet.has(itemBarcode) || idSet.has(itemTag) || idSet.has(itemSerie)) {
      if (modality === 'preventiva') {
        item.check_preventiva = true;
        item.data_preventiva = nowIso;
        item.usuario_preventiva = inspectorLabel;
      } else if (modality === 'seguranca') {
        item.check_seguranca = true;
        item.data_seguranca = nowIso;
        item.usuario_seguranca = inspectorLabel;
      } else {
        item.check_calibracao = true;
        item.data_calibracao = nowIso;
        item.usuario_calibracao = inspectorLabel;
      }

      item.checado = Boolean(item.check_calibracao || item.check_preventiva || item.check_seguranca);
      item.dataCheck = item.data_calibracao || item.data_preventiva || item.data_seguranca || nowIso;
      item.conferidoPor = inspectorLabel;
      checkedCount++;
    }
  }

  db.hospitals[hospIdx].equipments = list;
  db.hospitals[hospIdx].lastUpdated = Date.now();
  db.hospitals[hospIdx].lastUpdatedBy = inspectorLabel;

  // Sincroniza com plano ativo
  if (Array.isArray(db.hospitals[hospIdx].plans)) {
    const pIdx = db.hospitals[hospIdx].plans.findIndex(p => p.id === db.hospitals[hospIdx].activePlanId);
    if (pIdx !== -1) {
      db.hospitals[hospIdx].plans[pIdx].equipments = list;
      db.hospitals[hospIdx].plans[pIdx].lastUpdated = Date.now();
    }
  }

  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: `${checkedCount} equipamentos conferidos com sucesso para [${modality.toUpperCase()}]!`,
    checkedCount,
    modality,
    equipments: list,
    lastUpdated: db.lastUpdated,
    lastUpdatedBy: inspectorLabel
  });
});

// Mass Check (Check All or Uncheck All with simple PIN password protection per modality)
app.post('/api/mass-check', (req, res) => {
  const { action, modality = 'calibracao', password, hospitalId, userEmail, userName } = req.body || {};

  // Senha simples de segurança: padrão 1234 ou senha de usuário/master
  const MASTER_PIN = '1234';
  const cleanPass = String(password || '').trim();

  const users = readUsers();
  const isValidPass = cleanPass === MASTER_PIN || users.some(u => u.password === cleanPass);

  if (!isValidPass) {
    return res.status(401).json({
      success: false,
      message: 'Senha de segurança incorreta. A senha padrão para ações em massa é 1234.'
    });
  }

  if (action !== 'check_all' && action !== 'uncheck_all') {
    return res.status(400).json({ success: false, message: 'Ação inválida. Use check_all ou uncheck_all.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Operador');
  const nowIso = new Date().toISOString();
  const list = db.hospitals[hospIdx].equipments || [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (action === 'check_all') {
      if (modality === 'preventiva' || modality === 'geral') {
        item.check_preventiva = true;
        item.data_preventiva = item.data_preventiva || nowIso;
        item.usuario_preventiva = item.usuario_preventiva || inspectorLabel;
      }
      if (modality === 'seguranca' || modality === 'geral') {
        item.check_seguranca = true;
        item.data_seguranca = item.data_seguranca || nowIso;
        item.usuario_seguranca = item.usuario_seguranca || inspectorLabel;
      }
      if (modality === 'calibracao' || modality === 'geral') {
        item.check_calibracao = true;
        item.data_calibracao = item.data_calibracao || nowIso;
        item.usuario_calibracao = item.usuario_calibracao || inspectorLabel;
      }
    } else {
      // uncheck_all
      if (modality === 'preventiva' || modality === 'geral') {
        item.check_preventiva = false;
        item.data_preventiva = null;
        item.usuario_preventiva = null;
      }
      if (modality === 'seguranca' || modality === 'geral') {
        item.check_seguranca = false;
        item.data_seguranca = null;
        item.usuario_seguranca = null;
      }
      if (modality === 'calibracao' || modality === 'geral') {
        item.check_calibracao = false;
        item.data_calibracao = null;
        item.usuario_calibracao = null;
      }
    }

    item.checado = Boolean(item.check_calibracao || item.check_preventiva || item.check_seguranca);
    item.dataCheck = item.data_calibracao || item.data_preventiva || item.data_seguranca || null;
    item.conferidoPor = item.usuario_calibracao || item.usuario_preventiva || item.usuario_seguranca || null;
  }

  db.hospitals[hospIdx].equipments = list;
  db.hospitals[hospIdx].lastUpdated = Date.now();
  db.hospitals[hospIdx].lastUpdatedBy = inspectorLabel;

  // Sincroniza com plano ativo
  if (Array.isArray(db.hospitals[hospIdx].plans)) {
    const pIdx = db.hospitals[hospIdx].plans.findIndex(p => p.id === db.hospitals[hospIdx].activePlanId);
    if (pIdx !== -1) {
      db.hospitals[hospIdx].plans[pIdx].equipments = list;
      db.hospitals[hospIdx].plans[pIdx].lastUpdated = Date.now();
    }
  }

  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: action === 'check_all' ? `Todos os ${list.length} equipamentos foram marcados como checados!` : `Todos os ${list.length} equipamentos foram desmarcados.`,
    action,
    count: list.length,
    equipments: list,
    lastUpdated: db.lastUpdated,
    lastUpdatedBy: inspectorLabel
  });
});

// OCR Scan Agent (Backend recognition fallback with tesseract.js)
app.post('/api/ocr-scan', async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }

    const { default: Tesseract } = await import('tesseract.js');
    let imgBuffer;
    if (imageBase64.includes('base64,')) {
      imgBuffer = Buffer.from(imageBase64.split('base64,')[1], 'base64');
    } else {
      imgBuffer = Buffer.from(imageBase64, 'base64');
    }

    const { data: { text } } = await Tesseract.recognize(imgBuffer, 'por+eng', {
      logger: () => {}
    });

    res.json({
      success: true,
      text: text || ''
    });
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ success: false, message: 'Falha no processamento OCR: ' + err.message });
  }
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
