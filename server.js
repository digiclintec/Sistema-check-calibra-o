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
    const userHospitalIds = Array.isArray(user.hospitalIds) && user.hospitalIds.length > 0
      ? user.hospitalIds
      : [user.hospitalId || 'all'];

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'operador',
        hospitalId: userHospitalIds[0] || 'all',
        hospitalIds: userHospitalIds,
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
    hospitalIds: Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0 
      ? u.hospitalIds 
      : [u.hospitalId || 'all'],
    createdAt: u.createdAt || new Date().toISOString()
  }));

  res.json({ success: true, users: sanitized });
});

// Create user
app.post('/api/users', (req, res) => {
  const { name, email, password, role, hospitalId, hospitalIds } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Preencha nome, e-mail e senha.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Já existe um usuário com este e-mail.' });
  }

  let targetHospitalIds = [];
  if (Array.isArray(hospitalIds) && hospitalIds.length > 0) {
    targetHospitalIds = hospitalIds;
  } else if (hospitalId) {
    targetHospitalIds = [hospitalId];
  } else {
    targetHospitalIds = ['all'];
  }

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: String(name).trim(),
    email: cleanEmail,
    password: String(password).trim(),
    role: role || 'operador',
    hospitalId: targetHospitalIds[0] || 'all',
    hospitalIds: targetHospitalIds,
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

// Update user details and hospital permissions
app.post('/api/users/update', (req, res) => {
  const { id, name, role, hospitalIds, hospitalId } = req.body || {};
  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  if (name) users[idx].name = String(name).trim();
  if (role) users[idx].role = role;
  
  if (Array.isArray(hospitalIds)) {
    users[idx].hospitalIds = hospitalIds.length > 0 ? hospitalIds : ['all'];
    users[idx].hospitalId = users[idx].hospitalIds[0] || 'all';
  } else if (hospitalId) {
    users[idx].hospitalIds = [hospitalId];
    users[idx].hospitalId = hospitalId;
  }

  saveUsers(users);

  res.json({
    success: true,
    message: 'Usuário atualizado com sucesso!',
    user: users[idx]
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

// List all hospitals & their detailed progress
app.get('/api/hospitals', (req, res) => {
  const db = readDb();
  const users = readUsers();

  const list = (db.hospitals || []).map(h => {
    const listEq = h.equipments || [];
    const total = listEq.length;
    const calOk = listEq.filter(e => e.check_calibracao).length;
    const prevOk = listEq.filter(e => e.check_preventiva).length;
    const segOk = listEq.filter(e => e.check_seguranca).length;
    const externaOk = listEq.filter(e => e.check_externa).length;
    const complete100 = listEq.filter(e => e.check_calibracao && e.check_preventiva && e.check_seguranca).length;
    const checkedCount = listEq.filter(e => e.checado).length;

    // Usuários com acesso a este hospital
    const assignedUsers = users.filter(u => {
      const uHospIds = Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0 
        ? u.hospitalIds 
        : [u.hospitalId || 'all'];
      return uHospIds.includes('all') || uHospIds.includes(h.id);
    }).map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email }));

    return {
      id: h.id,
      name: h.name,
      cidade: h.cidade || '',
      cnpj: h.cnpj || '',
      plano: h.plano || 'pro',
      equipmentCount: total,
      checkedCount,
      calOk,
      calPercent: total > 0 ? Math.round((calOk / total) * 100) : 0,
      prevOk,
      prevPercent: total > 0 ? Math.round((prevOk / total) * 100) : 0,
      segOk,
      segPercent: total > 0 ? Math.round((segOk / total) * 100) : 0,
      externaOk,
      externaPercent: total > 0 ? Math.round((externaOk / total) * 100) : 0,
      complete100,
      completePercent: total > 0 ? Math.round((complete100 / total) * 100) : 0,
      activeSheetName: h.activeSheetName || '',
      assignedUsers,
      lastUpdated: h.lastUpdated || null,
      lastUpdatedBy: h.lastUpdatedBy || '',
      createdAt: h.createdAt
    };
  });

  res.json({
    success: true,
    hospitals: list,
    activeHospitalId: db.activeHospitalId || list[0]?.id || 'hosp_central',
    plans: PLANS
  });
});

// Create new Hospital (Client)
app.post('/api/hospitals', (req, res) => {
  const { name, cidade, cnpj, plano, assignedUserIds } = req.body || {};

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

  // Se foram enviados usuários para vincular a este novo hospital
  if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
    const users = readUsers();
    let modified = false;
    users.forEach(u => {
      if (assignedUserIds.includes(u.id)) {
        let uHospIds = Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0 ? [...u.hospitalIds] : [u.hospitalId || 'all'];
        if (!uHospIds.includes('all') && !uHospIds.includes(newHospital.id)) {
          uHospIds.push(newHospital.id);
          u.hospitalIds = uHospIds;
          u.hospitalId = uHospIds[0];
          modified = true;
        }
      }
    });
    if (modified) saveUsers(users);
  }

  res.json({
    success: true,
    message: `Hospital "${newHospital.name}" cadastrado com sucesso!`,
    hospital: newHospital,
    hospitals: db.hospitals
  });
});

// Assign multiple users to a hospital
app.post('/api/hospitals/assign-users', (req, res) => {
  const { hospitalId, userIds } = req.body || {};

  if (!hospitalId || !Array.isArray(userIds)) {
    return res.status(400).json({ success: false, message: 'ID do hospital e lista de usuários são obrigatórios.' });
  }

  const users = readUsers();
  users.forEach(u => {
    // Master sempre tem acesso total
    if (u.role === 'master' || u.email.toLowerCase() === 'digiclintec@gmail.com') return;

    let uHospIds = Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0 ? [...u.hospitalIds] : [u.hospitalId || 'all'];

    if (userIds.includes(u.id)) {
      // Adicionar acesso se ainda não tiver e não for global
      if (!uHospIds.includes('all') && !uHospIds.includes(hospitalId)) {
        uHospIds.push(hospitalId);
      }
    } else {
      // Remover acesso a este hospital específico
      if (!uHospIds.includes('all')) {
        uHospIds = uHospIds.filter(id => id !== hospitalId);
        if (uHospIds.length === 0) uHospIds = ['hosp_central'];
      }
    }

    u.hospitalIds = uHospIds;
    u.hospitalId = uHospIds[0] || 'hosp_central';
  });

  saveUsers(users);

  res.json({
    success: true,
    message: 'Equipe atualizada para o hospital com sucesso!'
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
    hospital: db.hospitals[idx],
    hospitals: db.hospitals
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
    googleSheetUrl: hospital.googleSheetUrl || '',
    googleSheetAutoSync: hospital.googleSheetAutoSync !== false,
    lastGoogleSheetSync: hospital.lastGoogleSheetSync || null,
    googleSheetSyncStatus: hospital.googleSheetSyncStatus || 'idle',
    serviceConfig: hospital.serviceConfig || {
      enableCalibracao: true,
      enablePreventiva: true,
      enableSeguranca: true,
      executionMode: 'all_at_once'
    },
    sectorColors: hospital.sectorColors || db.sectorColors || {},
    lastUpdated: hospital.lastUpdated || db.lastUpdated || Date.now(),
    lastUpdatedBy: hospital.lastUpdatedBy || ''
  });
});

// Sector Colors routes
app.get('/api/sector-colors', (req, res) => {
  const db = readDb();
  const targetId = req.query.hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospital = (db.hospitals || []).find(h => h.id === targetId) || db.hospitals?.[0] || {};
  res.json({
    success: true,
    hospitalId: hospital.id,
    sectorColors: hospital.sectorColors || db.sectorColors || {}
  });
});

app.post('/api/sector-colors', (req, res) => {
  const { hospitalId, sectorColors } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx !== -1) {
    db.hospitals[idx].sectorColors = {
      ...(db.hospitals[idx].sectorColors || {}),
      ...(sectorColors || {})
    };
    db.hospitals[idx].lastUpdated = Date.now();
  }
  db.sectorColors = {
    ...(db.sectorColors || {}),
    ...(sectorColors || {})
  };
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: 'Cores dos setores salvas com sucesso.',
    sectorColors: idx !== -1 ? db.hospitals[idx].sectorColors : db.sectorColors
  });
});

// Update service configuration for hospital
app.post('/api/service-config', (req, res) => {
  const { hospitalId, serviceConfig } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  db.hospitals[idx].serviceConfig = {
    enableCalibracao: serviceConfig?.enableCalibracao ?? true,
    enablePreventiva: serviceConfig?.enablePreventiva ?? true,
    enableSeguranca: serviceConfig?.enableSeguranca ?? true,
    executionMode: serviceConfig?.executionMode === 'separated' ? 'separated' : 'all_at_once'
  };

  db.hospitals[idx].lastUpdated = Date.now();
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: 'Configurações de serviço salvas com sucesso.',
    serviceConfig: db.hospitals[idx].serviceConfig
  });
});

// Save or Update spreadsheet for active hospital
app.post('/api/data', (req, res) => {
  const { 
    equipments, 
    activeSheetName, 
    userEmail, 
    userName, 
    hospitalId, 
    serviceConfig, 
    sectorColors,
    googleSheetUrl,
    googleSheetAutoSync
  } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital ativo não encontrado.' });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema');

  db.hospitals[idx].equipments = Array.isArray(equipments) ? equipments : [];
  db.hospitals[idx].activeSheetName = activeSheetName || '';
  if (googleSheetUrl !== undefined) {
    db.hospitals[idx].googleSheetUrl = googleSheetUrl;
  }
  if (googleSheetAutoSync !== undefined) {
    db.hospitals[idx].googleSheetAutoSync = googleSheetAutoSync;
  }
  if (serviceConfig) {
    db.hospitals[idx].serviceConfig = {
      enableCalibracao: serviceConfig.enableCalibracao ?? true,
      enablePreventiva: serviceConfig.enablePreventiva ?? true,
      enableSeguranca: serviceConfig.enableSeguranca ?? true,
      executionMode: serviceConfig.executionMode === 'separated' ? 'separated' : 'all_at_once'
    };
  }
  if (sectorColors) {
    db.hospitals[idx].sectorColors = {
      ...(db.hospitals[idx].sectorColors || {}),
      ...sectorColors
    };
  }
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
    sectorColors: db.hospitals[idx].sectorColors || db.sectorColors || {},
    lastUpdated: db.hospitals[idx].lastUpdated
  });
});

// ---------------- GOOGLE SHEETS LIVE SYNC ENGINE ---------------- //

// Helper: Fetch binary data from Google Sheets / Drive and parse
async function fetchAndParseGoogleSheet(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL da planilha não fornecida.');
  }

  const cleanUrl = url.trim();
  const match = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
                cleanUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
                cleanUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);

  if (!match || !match[1]) {
    throw new Error('Link do Google Sheets ou Google Drive inválido.');
  }

  const docId = match[1];
  const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
  const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';

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

      const parsed = parseWorkbookBuffer(uint8, 'Google Sheets');
      if (parsed && parsed.equipments && parsed.equipments.length > 0) {
        return {
          ...parsed,
          docId,
          cleanUrl
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (isRestricted) {
    const restrictedErr = new Error('Esta planilha no Google Drive está com acesso "Restrito". No Google Sheets, clique em "Compartilhar" e mude para "Qualquer pessoa com o link" (Leitor).');
    restrictedErr.isRestricted = true;
    throw restrictedErr;
  }

  throw lastError || new Error('Não foi possível baixar ou ler os dados desta planilha do Google.');
}

// Helper: Smart merge incoming Google Sheets equipments with current equipments
// Preserves technician checks done in CalibraCheck while pulling new rows or updated metadata from Google Sheets
function smartMergeGoogleSheet(currentEquipments = [], incomingEquipments = []) {
  let addedCount = 0;
  let updatedCount = 0;

  const currentMap = new Map();
  for (const item of currentEquipments) {
    if (item.codigoBarras) currentMap.set(`cb:${String(item.codigoBarras).trim().toLowerCase()}`, item);
    if (item.serie) currentMap.set(`sn:${String(item.serie).trim().toLowerCase()}`, item);
    if (item.tag) currentMap.set(`tag:${String(item.tag).trim().toLowerCase()}`, item);
    if (item.id) currentMap.set(`id:${String(item.id).trim().toLowerCase()}`, item);
  }

  const merged = [];
  const processedCurrentIds = new Set();

  for (const incoming of incomingEquipments) {
    let match = null;
    if (incoming.codigoBarras && currentMap.has(`cb:${String(incoming.codigoBarras).trim().toLowerCase()}`)) {
      match = currentMap.get(`cb:${String(incoming.codigoBarras).trim().toLowerCase()}`);
    } else if (incoming.serie && currentMap.has(`sn:${String(incoming.serie).trim().toLowerCase()}`)) {
      match = currentMap.get(`sn:${String(incoming.serie).trim().toLowerCase()}`);
    } else if (incoming.tag && currentMap.has(`tag:${String(incoming.tag).trim().toLowerCase()}`)) {
      match = currentMap.get(`tag:${String(incoming.tag).trim().toLowerCase()}`);
    } else if (incoming.id && currentMap.has(`id:${String(incoming.id).trim().toLowerCase()}`)) {
      match = currentMap.get(`id:${String(incoming.id).trim().toLowerCase()}`);
    }

    if (match) {
      processedCurrentIds.add(match.id);

      const localCal = match.check_calibracao !== undefined ? match.check_calibracao : match.checado;
      const sheetCal = incoming.check_calibracao !== undefined ? incoming.check_calibracao : incoming.checado;
      
      const localPrev = !!match.check_preventiva;
      const sheetPrev = !!incoming.check_preventiva;

      const localSeg = !!match.check_seguranca;
      const sheetSeg = !!incoming.check_seguranca;

      const finalCal = localCal || sheetCal;
      const finalPrev = localPrev || sheetPrev;
      const finalSeg = localSeg || sheetSeg;

      let itemChanged = false;
      if (finalCal !== localCal || finalPrev !== localPrev || finalSeg !== localSeg) itemChanged = true;
      if (incoming.setor && incoming.setor !== match.setor) itemChanged = true;
      if (incoming.setor_retirada && incoming.setor_retirada !== match.setor_retirada) itemChanged = true;
      if (incoming.modelo && incoming.modelo !== match.modelo) itemChanged = true;
      if (incoming.fabricante && incoming.fabricante !== match.fabricante) itemChanged = true;
      if (incoming.observacao && incoming.observacao !== match.observacao) itemChanged = true;
      if (incoming.tag && incoming.tag !== match.tag) itemChanged = true;

      if (itemChanged) {
        updatedCount++;
      }

      merged.push({
        ...match,
        equipamento: incoming.equipamento || match.equipamento,
        modelo: incoming.modelo || match.modelo,
        fabricante: incoming.fabricante || match.fabricante,
        setor: incoming.setor || match.setor,
        setor_retirada: incoming.setor_retirada !== undefined ? incoming.setor_retirada : match.setor_retirada,
        data_retirada: incoming.data_retirada || match.data_retirada,
        observacao: incoming.observacao !== undefined ? incoming.observacao : match.observacao,
        tag: incoming.tag || match.tag,
        
        check_calibracao: finalCal,
        usuario_calibracao: localCal ? match.usuario_calibracao : (sheetCal ? (incoming.usuario_calibracao || 'Google Sheets') : null),
        data_calibracao: localCal ? match.data_calibracao : (sheetCal ? (incoming.data_calibracao || new Date().toISOString()) : null),

        check_preventiva: finalPrev,
        usuario_preventiva: localPrev ? match.usuario_preventiva : (sheetPrev ? (incoming.usuario_preventiva || 'Google Sheets') : null),
        data_preventiva: localPrev ? match.data_preventiva : (sheetPrev ? (incoming.data_preventiva || new Date().toISOString()) : null),

        check_seguranca: finalSeg,
        usuario_seguranca: localSeg ? match.usuario_seguranca : (sheetSeg ? (incoming.usuario_seguranca || 'Google Sheets') : null),
        data_seguranca: localSeg ? match.data_seguranca : (sheetSeg ? (incoming.data_seguranca || new Date().toISOString()) : null),

        checado: finalCal,
        _originalRow: incoming._originalRow || match._originalRow
      });
    } else {
      addedCount++;
      merged.push(incoming);
    }
  }

  for (const existing of currentEquipments) {
    if (!processedCurrentIds.has(existing.id)) {
      merged.push(existing);
    }
  }

  return {
    merged,
    addedCount,
    updatedCount,
    totalChanges: addedCount + updatedCount
  };
}

// Route 1: Fetch and parse Google Sheets URL (Primeira Importação)
app.post('/api/fetch-google-sheet', async (req, res) => {
  const { url } = req.body || {};
  try {
    const parsed = await fetchAndParseGoogleSheet(url);
    res.json({
      success: true,
      googleSheetUrl: parsed.cleanUrl,
      fileName: 'Google Sheets (' + (parsed.sheetName || 'Planilha') + ')',
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      mapping: parsed.mapping,
      equipments: parsed.equipments,
      total: parsed.total
    });
  } catch (err) {
    if (err.isRestricted) {
      return res.status(403).json({ success: false, isRestricted: true, message: err.message });
    }
    return res.status(400).json({ success: false, message: err.message || 'Erro ao carregar planilha do Google.' });
  }
});

// Route 2: Sync Active Google Sheet in Real-Time (Merge inteligente preservando checks)
app.post('/api/sync-google-sheet', async (req, res) => {
  const { hospitalId, url } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital ativo não encontrado.' });
  }

  const hospital = db.hospitals[idx];
  const targetUrl = (url || hospital.googleSheetUrl || '').trim();

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Nenhuma URL de Google Sheets associada a este hospital.' });
  }

  try {
    const parsed = await fetchAndParseGoogleSheet(targetUrl);
    if (!parsed || !parsed.equipments || parsed.equipments.length === 0) {
      throw new Error('A planilha retornou vazia ou sem linhas de equipamentos válidas.');
    }

    const currentEquipments = hospital.equipments || [];
    const { merged, addedCount, updatedCount, totalChanges } = smartMergeGoogleSheet(currentEquipments, parsed.equipments);

    hospital.googleSheetUrl = targetUrl;
    hospital.lastGoogleSheetSync = Date.now();
    hospital.googleSheetSyncStatus = 'synced';

    if (totalChanges > 0 || currentEquipments.length === 0) {
      hospital.equipments = merged;
      if (!hospital.activeSheetName || hospital.activeSheetName.includes('Google Sheets')) {
        hospital.activeSheetName = 'Google Sheets (' + (parsed.sheetName || 'Planilha') + ')';
      }
      hospital.lastUpdated = Date.now();
      hospital.lastUpdatedBy = `Google Sheets Sync (+${addedCount} novos, ${updatedCount} atualizados)`;
      db.lastUpdated = Date.now();
      saveDb(db);
    } else {
      saveDb(db);
    }

    res.json({
      success: true,
      hasChanges: totalChanges > 0,
      addedCount,
      updatedCount,
      totalChanges,
      equipments: hospital.equipments,
      total: hospital.equipments.length,
      activeSheetName: hospital.activeSheetName,
      lastGoogleSheetSync: hospital.lastGoogleSheetSync,
      sheetName: parsed.sheetName
    });

  } catch (err) {
    console.error('Erro ao sincronizar com Google Sheets:', err.message);
    hospital.googleSheetSyncStatus = 'error';
    hospital.lastGoogleSheetSyncError = err.message;
    saveDb(db);
    res.status(500).json({
      success: false,
      message: err.message || 'Erro ao sincronizar com Google Sheets.'
    });
  }
});

// Route 3: Desvincular Link do Google Sheets (mantendo dados locais intactos)
app.post('/api/unlink-google-sheet', (req, res) => {
  const { hospitalId } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx !== -1) {
    db.hospitals[idx].googleSheetUrl = '';
    db.hospitals[idx].googleSheetAutoSync = false;
    db.hospitals[idx].googleSheetSyncStatus = 'idle';
    db.lastUpdated = Date.now();
    saveDb(db);
  }

  res.json({ success: true, message: 'Link do Google Sheets desvinculado com sucesso.' });
});

// Background Auto-Sync Worker for all hospitals connected to Google Sheets (Executa a cada 25s)
setInterval(async () => {
  try {
    const db = readDb();
    if (!Array.isArray(db.hospitals)) return;

    let dbModified = false;

    for (const hospital of db.hospitals) {
      if (hospital.googleSheetUrl && hospital.googleSheetAutoSync !== false) {
        try {
          const parsed = await fetchAndParseGoogleSheet(hospital.googleSheetUrl);
          if (parsed && Array.isArray(parsed.equipments) && parsed.equipments.length > 0) {
            const currentEquipments = hospital.equipments || [];
            const { merged, addedCount, updatedCount, totalChanges } = smartMergeGoogleSheet(currentEquipments, parsed.equipments);

            hospital.lastGoogleSheetSync = Date.now();
            hospital.googleSheetSyncStatus = 'synced';

            if (totalChanges > 0 || currentEquipments.length === 0) {
              hospital.equipments = merged;
              hospital.lastUpdated = Date.now();
              hospital.lastUpdatedBy = `Google Sheets Auto-Sync (+${addedCount} novos, ${updatedCount} atualizados)`;
              db.lastUpdated = Date.now();
              dbModified = true;
              console.log(`[GoogleSheets Auto-Sync] Sincronizado hospital "${hospital.name}": +${addedCount} novos, ${updatedCount} atualizados.`);
            }
          }
        } catch (err) {
          hospital.googleSheetSyncStatus = 'error';
          hospital.lastGoogleSheetSyncError = err.message;
        }
      }
    }

    if (dbModified) {
      saveDb(db);
    }
  } catch (globalErr) {
    // Silent
  }
}, 25000);

// Check or Uncheck an equipment inside active hospital with multi-modality support
app.post('/api/toggle-check', (req, res) => {
  const { id, modality = 'calibracao', userEmail, userName, hospitalId, setorRetirada } = req.body || {};
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
  if (modality === 'externa' || modality === 'manutencao_externa') {
    nextChecked = !Boolean(item.check_externa);
    item.check_externa = nextChecked;
    item.data_externa = nextChecked ? nowIso : null;
    item.usuario_externa = nextChecked ? inspectorLabel : null;
    item.motivo_externa = nextChecked ? 'Calibração e conserto por equipe externa terceirizada' : null;
    if (nextChecked) {
      // Conforme solicitado: Manutenção externa não é calibração interna
      item.check_calibracao = false;
      item.data_calibracao = null;
      item.usuario_calibracao = null;
    }
  } else if (modality === 'preventiva') {
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
    if (nextChecked) {
      // Se marcou calibração interna, desmarca externa
      item.check_externa = false;
      item.data_externa = null;
      item.usuario_externa = null;
      item.motivo_externa = null;
    }
  }

  // Se foi informado setor de retirada (coleta) da bomba
  if (setorRetirada) {
    item.setor_retirada = String(setorRetirada).trim();
    item.data_retirada = nowIso;
    item.usuario_retirada = inspectorLabel;
  }

  // Compatibilidade legada
  item.checado = Boolean(item.check_calibracao || item.check_preventiva || item.check_seguranca || item.check_externa);
  item.dataCheck = item.data_calibracao || item.data_preventiva || item.data_seguranca || item.data_externa || null;
  item.conferidoPor = item.usuario_calibracao || item.usuario_preventiva || item.usuario_seguranca || item.usuario_externa || null;

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

// Batch Check multiple equipments at once with modality & sector of retrieval support
app.post('/api/batch-check', (req, res) => {
  const { ids, items, modality = 'calibracao', modalities, hospitalId, userEmail, userName, defaultSetorRetirada } = req.body || {};
  
  // Normaliza lista de modalidades a serem checadas
  let targetModalities = [];
  if (Array.isArray(modalities) && modalities.length > 0) {
    targetModalities = modalities;
  } else if (typeof modalities === 'string' && modalities.trim()) {
    targetModalities = modalities.split(',').map(m => m.trim());
  } else if (modality === 'all' || modality === 'todos' || modality === 'geral') {
    targetModalities = ['calibracao', 'preventiva', 'seguranca'];
  } else if (modality === 'calibracao+preventiva') {
    targetModalities = ['calibracao', 'preventiva'];
  } else {
    targetModalities = [modality || 'calibracao'];
  }

  // Suporta tanto lista de IDs simples quanto lista de objetos { id, setorRetirada }
  const targetIds = Array.isArray(items) && items.length > 0 
    ? items.map(it => it.id || it.equipment?.id).filter(Boolean)
    : (Array.isArray(ids) ? ids : []);

  if (targetIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Nenhum equipamento informado para checagem em lote.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  // Mapa de setor de retirada individual para cada equipamento bipado no lote
  const itemSectorMap = new Map();
  if (Array.isArray(items)) {
    items.forEach(it => {
      const itId = it.id || it.equipment?.id;
      if (itId && it.setorRetirada) {
        itemSectorMap.set(String(itId).toLowerCase(), String(it.setorRetirada).trim());
      }
    });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
  const nowIso = new Date().toISOString();
  const list = db.hospitals[hospIdx].equipments || [];
  let checkedCount = 0;

  const idSet = new Set(targetIds.map(x => String(x).toLowerCase()));

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const itemId = String(item.id || '').toLowerCase();
    const itemBarcode = String(item.codigoBarras || '').toLowerCase();
    const itemTag = String(item.tag || '').toLowerCase();
    const itemSerie = String(item.serie || '').toLowerCase();

    if (idSet.has(itemId) || idSet.has(itemBarcode) || idSet.has(itemTag) || idSet.has(itemSerie)) {
      if (targetModalities.includes('externa') || targetModalities.includes('manutencao_externa')) {
        item.check_externa = true;
        item.data_externa = nowIso;
        item.usuario_externa = inspectorLabel;
        item.motivo_externa = 'Calibração e conserto por equipe externa terceirizada';
        // Conforme solicitado: Manutenção Externa não é calibração interna
        item.check_calibracao = false;
        item.data_calibracao = null;
        item.usuario_calibracao = null;
      }
      if (targetModalities.includes('preventiva')) {
        item.check_preventiva = true;
        item.data_preventiva = nowIso;
        item.usuario_preventiva = inspectorLabel;
      }
      if (targetModalities.includes('seguranca')) {
        item.check_seguranca = true;
        item.data_seguranca = nowIso;
        item.usuario_seguranca = inspectorLabel;
      }
      if (targetModalities.includes('calibracao')) {
        item.check_calibracao = true;
        item.data_calibracao = nowIso;
        item.usuario_calibracao = inspectorLabel;
        // Se marcou calibração interna, remove externa
        item.check_externa = false;
        item.data_externa = null;
        item.usuario_externa = null;
        item.motivo_externa = null;
      }

      // Atribui o setor de retirada (coleta) específico deste item ou o padrão do lote
      const assignedSector = itemSectorMap.get(itemId) || 
                             itemSectorMap.get(itemBarcode) || 
                             itemSectorMap.get(itemTag) || 
                             itemSectorMap.get(itemSerie) || 
                             defaultSetorRetirada;

      if (assignedSector) {
        item.setor_retirada = assignedSector;
        item.data_retirada = nowIso;
        item.usuario_retirada = inspectorLabel;
      }

      item.checado = Boolean(item.check_calibracao || item.check_preventiva || item.check_seguranca || item.check_externa);
      item.dataCheck = item.data_calibracao || item.data_preventiva || item.data_seguranca || item.data_externa || nowIso;
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

// Atualizar setor cadastrado ou setor de retirada de um equipamento
app.post('/api/equipment/update-sector', (req, res) => {
  const { id, setor, setorRetirada, hospitalId, userEmail, userName } = req.body || {};
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
  const idx = list.findIndex(e => e.id === id || e.codigoBarras === id || e.tag === id || e.serie === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Equipamento não encontrado.' });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
  const nowIso = new Date().toISOString();

  if (setor !== undefined) {
    list[idx].setor = String(setor).trim();
  }
  if (setorRetirada !== undefined) {
    list[idx].setor_retirada = String(setorRetirada).trim();
    list[idx].data_retirada = nowIso;
    list[idx].usuario_retirada = inspectorLabel;
  }

  db.hospitals[hospIdx].equipments = list;
  db.hospitals[hospIdx].lastUpdated = Date.now();
  db.hospitals[hospIdx].lastUpdatedBy = inspectorLabel;

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
    message: 'Setor atualizado com sucesso.',
    item: list[idx],
    lastUpdated: db.lastUpdated
  });
});

// Validação de Senha / PIN Simples para Conferência Manual
app.post('/api/verify-pin', (req, res) => {
  const { pin } = req.body || {};
  const cleanPin = String(pin || '').trim();
  const MASTER_PIN = '1234';

  const users = readUsers();
  const isValid = cleanPin === MASTER_PIN || 
                  cleanPin.toLowerCase() === 'digiclintec' || 
                  cleanPin === 'admin123' || 
                  users.some(u => u.password === cleanPin);

  if (isValid) {
    return res.json({ success: true, message: 'Senha confirmada.' });
  }

  return res.status(401).json({
    success: false,
    message: 'Senha incorreta. A senha padrão de conferência manual é 1234.'
  });
});

// Mass Check (Check All or Uncheck All with intelligent multi-modality, technician assignment, sector filtering, and PIN protection)
app.post('/api/mass-check', (req, res) => {
  const { 
    action, 
    modality = 'calibracao', 
    modalities,
    assignedTechnician,
    assignedDate,
    sectorFilter = 'ALL',
    onlyPending = false,
    password, 
    hospitalId, 
    userEmail, 
    userName 
  } = req.body || {};

  // Senha simples de segurança: padrão 1234 ou senha de usuário/master
  const MASTER_PIN = '1234';
  const cleanPass = String(password || '').trim();

  const users = readUsers();
  const isValidPass = cleanPass === MASTER_PIN || 
                      cleanPass.toLowerCase() === 'digiclintec' || 
                      cleanPass === 'admin123' || 
                      users.some(u => u.password === cleanPass);

  if (!isValidPass) {
    return res.status(401).json({
      success: false,
      message: 'Senha de segurança incorreta. A senha padrão de confirmação é 1234.'
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

  // Define as modalidades-alvo
  let targetMods = [];
  if (Array.isArray(modalities) && modalities.length > 0) {
    targetMods = modalities;
  } else if (modality === 'geral') {
    targetMods = ['calibracao', 'preventiva', 'seguranca'];
  } else {
    targetMods = [modality];
  }

  // Rótulo do técnico responsável (ou o selecionado pelo master, ou quem executou)
  const defaultLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Operador');
  const targetTechnician = assignedTechnician && String(assignedTechnician).trim() 
    ? String(assignedTechnician).trim() 
    : defaultLabel;

  const targetDate = assignedDate ? new Date(assignedDate).toISOString() : new Date().toISOString();
  const list = db.hospitals[hospIdx].equipments || [];
  let affectedCount = 0;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];

    // Filtro por setor se especificado
    if (sectorFilter && sectorFilter !== 'ALL') {
      const itemSector = String(item.setor || '').trim().toLowerCase();
      const itemRetirada = String(item.setor_retirada || '').trim().toLowerCase();
      const targetSec = String(sectorFilter).trim().toLowerCase();
      if (itemSector !== targetSec && itemRetirada !== targetSec) {
        continue;
      }
    }

    let modified = false;

    if (action === 'check_all') {
      targetMods.forEach(m => {
        if (m === 'calibracao') {
          if (!onlyPending || !item.check_calibracao) {
            item.check_calibracao = true;
            item.data_calibracao = targetDate;
            item.usuario_calibracao = targetTechnician;
            modified = true;
          }
        } else if (m === 'preventiva') {
          if (!onlyPending || !item.check_preventiva) {
            item.check_preventiva = true;
            item.data_preventiva = targetDate;
            item.usuario_preventiva = targetTechnician;
            modified = true;
          }
        } else if (m === 'seguranca') {
          if (!onlyPending || !item.check_seguranca) {
            item.check_seguranca = true;
            item.data_seguranca = targetDate;
            item.usuario_seguranca = targetTechnician;
            modified = true;
          }
        } else if (m === 'externa' || m === 'manutencao_externa') {
          if (!onlyPending || !item.check_externa) {
            item.check_externa = true;
            item.data_externa = targetDate;
            item.usuario_externa = targetTechnician;
            item.motivo_externa = 'Calibração e conserto por equipe externa terceirizada';
            // Conforme solicitado: Não colocar como calibração
            item.check_calibracao = false;
            item.data_calibracao = null;
            item.usuario_calibracao = null;
            modified = true;
          }
        }
      });
    } else {
      // uncheck_all
      targetMods.forEach(m => {
        if (m === 'calibracao') {
          item.check_calibracao = false;
          item.data_calibracao = null;
          item.usuario_calibracao = null;
          modified = true;
        } else if (m === 'preventiva') {
          item.check_preventiva = false;
          item.data_preventiva = null;
          item.usuario_preventiva = null;
          modified = true;
        } else if (m === 'seguranca') {
          item.check_seguranca = false;
          item.data_seguranca = null;
          item.usuario_seguranca = null;
          modified = true;
        } else if (m === 'externa' || m === 'manutencao_externa') {
          item.check_externa = false;
          item.data_externa = null;
          item.usuario_externa = null;
          item.motivo_externa = null;
          modified = true;
        }
      });
    }

    if (modified) {
      affectedCount++;
    }

    // Compatibilidade legada
    item.checado = Boolean(item.check_calibracao || item.check_preventiva || item.check_seguranca || item.check_externa);
    item.dataCheck = item.data_calibracao || item.data_preventiva || item.data_seguranca || item.data_externa || null;
    item.conferidoPor = item.usuario_calibracao || item.usuario_preventiva || item.usuario_seguranca || item.usuario_externa || null;
  }

  db.hospitals[hospIdx].equipments = list;
  db.hospitals[hospIdx].lastUpdated = Date.now();
  db.hospitals[hospIdx].lastUpdatedBy = `${targetTechnician} (Lote)`;

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
    message: `${affectedCount} equipamentos atualizados com sucesso para [${targetMods.join(', ')}].`,
    affectedCount,
    assignedTechnician: targetTechnician,
    targetModalities: targetMods,
    lastUpdated: db.lastUpdated,
    equipments: list
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

// ---------------- DOWNLOAD APK & PWA ASSETLINKS ROUTES ---------------- //

// Download do Instalador APK Direto para Android
app.get(['/download/apk', '/download/calibracheck.apk', '/download/CalibraCheck.apk', '/downloads/CalibraCheck.apk'], (req, res) => {
  const publicApk = path.join(__dirname, 'public', 'downloads', 'CalibraCheck.apk');
  const distApk = path.join(__dirname, 'dist', 'downloads', 'CalibraCheck.apk');
  const targetApk = fs.existsSync(publicApk) ? publicApk : (fs.existsSync(distApk) ? distApk : null);

  if (targetApk) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="CalibraCheck.apk"');
    return res.sendFile(targetApk);
  }
  res.status(404).send('Arquivo APK não encontrado.');
});

// Google Trusted Web Activity (TWA) Digital Asset Links
app.get('/.well-known/assetlinks.json', (req, res) => {
  const publicAssetlinks = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
  const distAssetlinks = path.join(__dirname, 'dist', '.well-known', 'assetlinks.json');
  const target = fs.existsSync(publicAssetlinks) ? publicAssetlinks : (fs.existsSync(distAssetlinks) ? distAssetlinks : null);

  if (target) {
    try {
      const content = JSON.parse(fs.readFileSync(target, 'utf8'));
      res.setHeader('Content-Type', 'application/json');
      return res.json(content);
    } catch (e) {
      return res.status(500).send('Erro ao ler assetlinks.');
    }
  }
  res.status(404).send('Assetlinks não encontrado.');
});

// Serve frontend static files from dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { dotfiles: 'allow' }));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor CalibraCheck Multi-Hospital rodando na porta: ${PORT}`);
});
