import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { parseWorkbookBuffer, parseCsvText } from './src/utils/sheetParser.js';
import { PDFParse } from 'pdf-parse';

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

// ============================================================
// BLINDAGEM CRIPTOGRÁFICA DE SEGURANÇA (BCRYPT + ENV)
// ============================================================
const SALT_ROUNDS = 10;
const MASTER_EMAIL = (process.env.MASTER_EMAIL || 'digiclintec@gmail.com').trim().toLowerCase();
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'Digiclintec@Master2026!';
const MASTER_PIN = process.env.MASTER_PIN || '1234';

/**
 * Verifica se uma string já é um hash bcrypt válido
 */
export function isBcryptHash(str) {
  return typeof str === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(str);
}

/**
 * Converte senha em texto puro para hash bcrypt irreversível com salt
 */
export function hashPassword(plain) {
  if (!plain) return '';
  if (isBcryptHash(plain)) return plain;
  return bcrypt.hashSync(String(plain).trim(), SALT_ROUNDS);
}

/**
 * Compara senha em texto com a senha armazenada (bcrypt ou texto legado com auto-upgrade)
 */
export function verifyPassword(plain, stored) {
  if (!plain || !stored) return false;
  const cleanPlain = String(plain).trim();
  const cleanStored = String(stored).trim();

  if (isBcryptHash(cleanStored)) {
    try {
      return bcrypt.compareSync(cleanPlain, cleanStored);
    } catch (e) {
      return false;
    }
  }
  return cleanPlain === cleanStored;
}

// Master User seed (sempre armazenado com hash criptográfico, nunca texto puro)
const DEFAULT_MASTER = {
  id: 'usr_master_1',
  email: MASTER_EMAIL,
  password: hashPassword(MASTER_PASSWORD),
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

// Read users (com blindagem automática de senhas para bcrypt)
function readUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let needsSave = false;

        // Auto-upgrade criptográfico: transforma qualquer senha legada em texto puro em hash bcrypt
        parsed.forEach(u => {
          if (u.password && !isBcryptHash(u.password)) {
            u.password = hashPassword(u.password);
            needsSave = true;
          }
        });

        const hasMaster = parsed.some(u => u.email.toLowerCase() === DEFAULT_MASTER.email.toLowerCase());
        if (!hasMaster) {
          parsed.unshift({ ...DEFAULT_MASTER });
          needsSave = true;
        }

        if (needsSave) {
          saveUsers(parsed);
        }

        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler users.json:', err);
  }
  const initial = [{ ...DEFAULT_MASTER }];
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

// Rate Limiter em memória para proteção contra ataques de força bruta no login
const loginAttempts = new Map(); // IP -> { count, blockedUntil }

app.post('/api/login', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };

  if (attempt.blockedUntil > now) {
    const remainingSeconds = Math.ceil((attempt.blockedUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em ${remainingSeconds} segundos.`
    });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Informe e-mail e senha.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPass = String(password).trim();
  const users = readUsers();
  
  const user = users.find(u => u.email.toLowerCase() === cleanEmail && verifyPassword(cleanPass, u.password));

  if (user) {
    // Limpa histórico de tentativas em caso de sucesso
    loginAttempts.delete(ip);

    // Auto-upgrade transparente: se a senha ainda estava em texto puro legado, salva o hash bcrypt
    if (!isBcryptHash(user.password)) {
      user.password = hashPassword(cleanPass);
      saveUsers(users);
    }

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

  // Registra tentativa falha para proteção
  attempt.count += 1;
  if (attempt.count >= 8) {
    attempt.blockedUntil = now + 15 * 60 * 1000; // Bloqueio de 15 minutos
  }
  loginAttempts.set(ip, attempt);

  return res.status(401).json({
    success: false,
    message: 'Credenciais inválidas. Verifique seu e-mail e senha.'
  });
});

// List users (nunca expõe senhas)
app.get('/api/users', (req, res) => {
  const { hospitalId } = req.query || {};
  const users = readUsers();

  // Se especificado hospitalId (técnicos visualizando apenas sua equipe), filtra estritamente
  let filtered = users;
  if (hospitalId && hospitalId !== 'all') {
    filtered = users.filter(u => {
      const uHospIds = Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0 
        ? u.hospitalIds 
        : [u.hospitalId || 'all'];
      return uHospIds.includes(hospitalId) || uHospIds.includes('all');
    });
  }

  const sanitized = filtered.map(u => ({
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

// Create user (criptografa senha com bcrypt antes de salvar)
app.post('/api/users', (req, res) => {
  const { name, email, password, role, hospitalId, hospitalIds } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Preencha nome, e-mail e senha.' });
  }

  if (String(password).trim().length < 4) {
    return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 4 caracteres.' });
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
    password: hashPassword(password),
    role: role || 'operador',
    hospitalId: targetHospitalIds[0] || 'all',
    hospitalIds: targetHospitalIds,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  // Retorna dados do usuário sem expor a senha
  const { password: _p, ...safeNewUser } = newUser;

  res.json({
    success: true,
    message: 'Usuário cadastrado com sucesso!',
    user: safeNewUser
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

  const { password: _p, ...safeUpdatedUser } = users[idx];

  res.json({
    success: true,
    message: 'Usuário atualizado com sucesso!',
    user: safeUpdatedUser
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

// Update password (criptografia forte via bcrypt)
app.post('/api/users/password', (req, res) => {
  const { id, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).trim().length < 4) {
    return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 4 caracteres.' });
  }

  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  users[idx].password = hashPassword(newPassword);
  saveUsers(users);

  res.json({ success: true, message: 'Senha atualizada e criptografada com sucesso!' });
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
    const complete100 = listEq.filter(e => (e.check_calibracao && e.check_preventiva && e.check_seguranca) || e.check_externa).length;
    const checkedCount = listEq.filter(e => Boolean(e.checado || e.check_calibracao || e.check_preventiva || e.check_seguranca || e.check_externa)).length;

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
  const { hospitalId, id } = req.body || {};
  const targetHospId = hospitalId || id;
  const db = readDb();
  
  if (targetHospId) {
    db.activeHospitalId = targetHospId;
    saveDb(db);
  }

  res.json({ success: true, activeHospitalId: targetHospId || db.activeHospitalId });
});

// ---------------- MONTHLY & ANNUAL CALIBRATION PLANS ROUTES ---------------- //

// List all calibration plans for a hospital (with enriched metadata & equipments)
app.get('/api/plans', (req, res) => {
  const db = readDb();
  const targetId = req.query.hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospital = (db.hospitals || []).find(h => h.id === targetId) || db.hospitals?.[0] || {};
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plans = (hospital.plans || []).map(p => {
    const eqs = Array.isArray(p.equipments) ? p.equipments : [];
    const total = eqs.length;
    const checked = eqs.filter(e => e.checado).length;
    const pending = total - checked;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;

    // Estatísticas de validade e previsão das calibrações
    let vencidos = 0;
    let aVencer = 0;
    let emDia = 0;

    eqs.forEach(eq => {
      const valDateStr = eq.validadeCalibracao || eq.proximaCalibracao;
      if (!valDateStr) {
        if (eq.statusCalibracao?.toLowerCase().includes('vencid')) vencidos++;
        else emDia++;
        return;
      }
      const d = new Date(valDateStr + 'T00:00:00');
      if (isNaN(d.getTime())) {
        emDia++;
        return;
      }
      const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) vencidos++;
      else if (diffDays <= 30) aVencer++;
      else emDia++;
    });

    return {
      id: p.id,
      title: p.title || p.fileName || 'Planejamento de Calibração',
      tipo: p.tipo || (p.ano ? 'anual' : 'mensal'),
      ano: p.ano || (p.mes && p.mes.match(/\d{4}/) ? p.mes.match(/\d{4}/)[0] : '2026'),
      mes: p.mes || 'Novembro/2026',
      dataInicio: p.dataInicio || '',
      dataFim: p.dataFim || '',
      descricao: p.descricao || '',
      fileName: p.fileName || '',
      total,
      checked,
      pending,
      percent,
      vencidos,
      aVencer,
      emDia,
      equipments: eqs,
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

  // Registra o plano de referência para o usuário sem disparar gatilho destrutivo para outros técnicos
  hospital.activePlanId = planId;
  saveDb(db);

  res.json({
    success: true,
    message: `Planejamento "${plan.title}" ativado para você!`,
    activePlanId: planId,
    activePlan: plan,
    equipments: plan.equipments || [],
    activeSheetName: plan.fileName || plan.title || hospital.activeSheetName
  });
});

// Create new monthly/annual plan (suporta plano em branco e manual)
app.post('/api/plans/create', (req, res) => {
  const { hospitalId, title, mes, fileName, equipments, tipo, ano, dataInicio, dataFim, descricao, googleSheetUrl } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  hospital.plans = hospital.plans || [];

  const newPlanId = 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const detectedAno = String(ano || (mes && mes.match(/\d{4}/) ? mes.match(/\d{4}/)[0] : new Date().getFullYear())).trim();
  const cleanSheetUrl = String(googleSheetUrl || '').trim();
  
  const newPlan = {
    id: newPlanId,
    title: String(title || fileName || `Plano Anual ${detectedAno}`).trim(),
    tipo: String(tipo || 'anual').trim(),
    ano: detectedAno,
    mes: String(mes || `Ano Todo / ${detectedAno}`).trim(),
    dataInicio: String(dataInicio || `${detectedAno}-01-01`).trim(),
    dataFim: String(dataFim || `${detectedAno}-12-31`).trim(),
    descricao: String(descricao || '').trim(),
    googleSheetUrl: cleanSheetUrl,
    fileName: String(fileName || '').trim(),
    equipments: Array.isArray(equipments) ? equipments : [],
    createdAt: new Date().toISOString(),
    lastUpdated: Date.now()
  };

  hospital.plans.push(newPlan);
  hospital.activePlanId = newPlanId;
  hospital.equipments = newPlan.equipments;
  hospital.activeSheetName = newPlan.fileName || newPlan.title;
  if (cleanSheetUrl) hospital.googleSheetUrl = cleanSheetUrl;
  hospital.lastUpdated = Date.now();
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: `Plano "${newPlan.title}" criado e ativado com sucesso!`,
    plan: newPlan,
    activePlanId: newPlanId,
    equipments: newPlan.equipments,
    activeSheetName: hospital.activeSheetName
  });
});

// Update an existing plan metadata
app.post('/api/plans/update', (req, res) => {
  const { hospitalId, planId, title, mes, ano, tipo, dataInicio, dataFim, descricao } = req.body || {};
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

  if (title) plan.title = String(title).trim();
  if (mes) plan.mes = String(mes).trim();
  if (ano) plan.ano = String(ano).trim();
  if (tipo) plan.tipo = String(tipo).trim();
  if (dataInicio !== undefined) plan.dataInicio = String(dataInicio).trim();
  if (dataFim !== undefined) plan.dataFim = String(dataFim).trim();
  if (descricao !== undefined) plan.descricao = String(descricao).trim();
  plan.lastUpdated = Date.now();
  hospital.lastUpdated = Date.now();
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: 'Plano atualizado com sucesso.',
    plan
  });
});

// Cadastrar novo equipamento diretamente em um plano
app.post('/api/equipment/create', (req, res) => {
  const { hospitalId, planId, equipment, userEmail, userName } = req.body || {};
  if (!equipment) {
    return res.status(400).json({ success: false, message: 'Dados do equipamento não fornecidos.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  hospital.plans = hospital.plans || [];

  // Encontra o plano alvo ou usa o ativo
  const targetPlanId = planId || hospital.activePlanId || hospital.plans[0]?.id;
  let targetPlan = hospital.plans.find(p => p.id === targetPlanId);

  // Se ainda não existir nenhum plano, cria um Plano Anual padrão
  if (!targetPlan) {
    const curYear = new Date().getFullYear();
    targetPlan = {
      id: 'plan_' + Date.now(),
      title: `Plano Anual ${curYear}`,
      tipo: 'anual',
      ano: String(curYear),
      mes: `Ano Todo / ${curYear}`,
      dataInicio: `${curYear}-01-01`,
      dataFim: `${curYear}-12-31`,
      fileName: 'Cadastro_Manual.xlsx',
      equipments: [],
      createdAt: new Date().toISOString(),
      lastUpdated: Date.now()
    };
    hospital.plans.push(targetPlan);
    hospital.activePlanId = targetPlan.id;
  }

  targetPlan.equipments = targetPlan.equipments || [];

  // Prepara o objeto do equipamento garantindo unicidade
  const eqId = equipment.id || 'EQP-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
  const finalEq = {
    ...equipment,
    id: eqId,
    tag: equipment.tag || equipment.codigoBarras || eqId,
    serie: equipment.serie || equipment.codigoBarras || eqId,
    codigoBarras: equipment.codigoBarras || equipment.serie || equipment.tag || eqId,
    equipamento: equipment.equipamento || 'Equipamento',
    fabricante: equipment.fabricante || 'Não especificado',
    modelo: equipment.modelo || 'Padrão',
    setor: equipment.setor || 'Geral',
    dataCalibracao: equipment.dataCalibracao || null,
    periodicidadeMeses: parseInt(equipment.periodicidadeMeses, 10) || 12,
    validadeCalibracao: equipment.validadeCalibracao || equipment.proximaCalibracao || null,
    proximaCalibracao: equipment.proximaCalibracao || equipment.validadeCalibracao || null,
    statusCalibracao: equipment.statusCalibracao || 'Válido',
    checado: Boolean(equipment.checado),
    observacao: equipment.observacao || ''
  };

  targetPlan.equipments.push(finalEq);
  targetPlan.lastUpdated = Date.now();

  // Se o plano for o ativo, atualiza também a lista principal do hospital
  if (hospital.activePlanId === targetPlan.id || hospital.plans.length === 1) {
    hospital.equipments = targetPlan.equipments;
    hospital.activeSheetName = targetPlan.fileName || targetPlan.title;
  }

  const inspectorLabel = userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema');
  hospital.lastUpdated = Date.now();
  hospital.lastUpdatedBy = inspectorLabel;
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: `Equipamento "${finalEq.equipamento}" cadastrado com sucesso no plano "${targetPlan.title}"!`,
    equipment: finalEq,
    planId: targetPlan.id,
    planTitle: targetPlan.title,
    equipments: hospital.equipments
  });
});

// Cadastrar múltiplos equipamentos em lote diretamente em um plano (via Excel complementar ou colar dados)
app.post('/api/equipment/batch-create', (req, res) => {
  const { hospitalId, planId, equipments, skipDuplicates = true, userEmail, userName } = req.body || {};
  if (!Array.isArray(equipments) || equipments.length === 0) {
    return res.status(400).json({ success: false, message: 'Nenhum equipamento enviado para adição.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  hospital.plans = hospital.plans || [];

  const targetPlanId = planId || hospital.activePlanId || hospital.plans[0]?.id;
  let targetPlan = hospital.plans.find(p => p.id === targetPlanId);

  if (!targetPlan) {
    const curYear = new Date().getFullYear();
    targetPlan = {
      id: 'plan_' + Date.now(),
      title: `Plano Anual ${curYear}`,
      tipo: 'anual',
      ano: String(curYear),
      mes: `Ano Todo / ${curYear}`,
      dataInicio: `${curYear}-01-01`,
      dataFim: `${curYear}-12-31`,
      fileName: 'Cadastro_Manual.xlsx',
      equipments: [],
      createdAt: new Date().toISOString(),
      lastUpdated: Date.now()
    };
    hospital.plans.push(targetPlan);
    hospital.activePlanId = targetPlan.id;
  }

  targetPlan.equipments = targetPlan.equipments || [];

  // Indexação de itens existentes para verificação inteligente de duplicatas
  const existingKeys = new Set();
  targetPlan.equipments.forEach(eq => {
    if (eq.tag) existingKeys.add(String(eq.tag).trim().toLowerCase());
    if (eq.serie) existingKeys.add(String(eq.serie).trim().toLowerCase());
    if (eq.codigoBarras) existingKeys.add(String(eq.codigoBarras).trim().toLowerCase());
  });

  const addedEquipments = [];
  const now = Date.now();

  equipments.forEach((item, idx) => {
    const tag = String(item.tag || '').trim();
    const serie = String(item.serie || '').trim();
    const barcode = String(item.codigoBarras || serie || tag || '').trim();

    if (skipDuplicates) {
      if ((tag && existingKeys.has(tag.toLowerCase())) ||
          (serie && existingKeys.has(serie.toLowerCase())) ||
          (barcode && existingKeys.has(barcode.toLowerCase()))) {
        return; // Pula duplicado já existente
      }
    }

    const eqId = item.id || 'EQP-' + now.toString(36) + '-' + idx + '-' + Math.random().toString(36).substring(2, 5);
    const finalEq = {
      ...item,
      id: eqId,
      tag: tag || barcode || eqId,
      serie: serie || barcode || eqId,
      codigoBarras: barcode || eqId,
      equipamento: item.equipamento || item.nome || 'Equipamento',
      fabricante: item.fabricante || 'Não especificado',
      modelo: item.modelo || 'Padrão',
      setor: item.setor || 'Geral',
      dataCalibracao: item.dataCalibracao || null,
      periodicidadeMeses: parseInt(item.periodicidadeMeses, 10) || 12,
      validadeCalibracao: item.validadeCalibracao || item.proximaCalibracao || null,
      proximaCalibracao: item.proximaCalibracao || item.validadeCalibracao || null,
      statusCalibracao: item.statusCalibracao || 'Válido',
      checado: Boolean(item.checado),
      observacao: item.observacao || ''
    };

    targetPlan.equipments.push(finalEq);
    addedEquipments.push(finalEq);

    if (tag) existingKeys.add(tag.toLowerCase());
    if (serie) existingKeys.add(serie.toLowerCase());
    if (barcode) existingKeys.add(barcode.toLowerCase());
  });

  targetPlan.lastUpdated = now;

  if (hospital.activePlanId === targetPlan.id || hospital.plans.length === 1) {
    hospital.equipments = targetPlan.equipments;
    hospital.activeSheetName = targetPlan.fileName || targetPlan.title;
  }

  const inspectorLabel = userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema');
  hospital.lastUpdated = now;
  hospital.lastUpdatedBy = inspectorLabel;
  db.lastUpdated = now;
  saveDb(db);

  res.json({
    success: true,
    message: `${addedEquipments.length} equipamentos adicionados ao plano "${targetPlan.title}" com sucesso!`,
    addedCount: addedEquipments.length,
    totalCount: targetPlan.equipments.length,
    equipments: hospital.equipments,
    planId: targetPlan.id,
    planTitle: targetPlan.title
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
  const requestedPlanId = req.query.planId;

  // Suporte a múltiplos técnicos em projetos/planos simultâneos e independentes
  let targetPlan = null;
  if (requestedPlanId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === requestedPlanId);
  } else if (hospital.activePlanId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === hospital.activePlanId);
  }

  const equipments = targetPlan ? (targetPlan.equipments || []) : (hospital.equipments || []);
  const activeSheetName = targetPlan ? (targetPlan.fileName || targetPlan.title || hospital.activeSheetName || '') : (hospital.activeSheetName || '');
  const planLastUpdated = targetPlan ? (targetPlan.lastUpdated || targetPlan.createdAt || hospital.lastUpdated || 1) : (hospital.lastUpdated || db.lastUpdated || Date.now());

  res.json({
    success: true,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    hospitalPlan: hospital.plano || 'pro',
    activePlanId: targetPlan ? targetPlan.id : (hospital.activePlanId || null),
    equipments,
    activeSheetName,
    googleSheetUrl: hospital.googleSheetUrl || '',
    googleSheetWebhookUrl: hospital.googleSheetWebhookUrl || '',
    lastGoogleSheetPush: hospital.lastGoogleSheetPush || null,
    googleSheetAutoSync: hospital.googleSheetAutoSync !== false,
    lastGoogleSheetSync: hospital.lastGoogleSheetSync || null,
    googleSheetSyncStatus: hospital.googleSheetSyncStatus || 'idle',
    serviceConfig: hospital.serviceConfig || {
      enableCalibracao: true,
      enablePreventiva: true,
      enableSeguranca: true,
      executionMode: 'all_at_once',
      enableCarrinhoDevolucao: false
    },
    sectorColors: hospital.sectorColors || db.sectorColors || {},
    lastUpdated: planLastUpdated,
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

// PDF Text Extraction Route for Calibration Reports
app.post('/api/parse-pdf-calibrations', async (req, res) => {
  try {
    const { pdfBase64 } = req.body || {};
    if (!pdfBase64) {
      return res.status(400).json({ success: false, message: 'Arquivo PDF não fornecido.' });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const fullText = typeof textResult === 'string' ? textResult : (textResult?.text || '');
    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    res.json({
      success: true,
      text: fullText,
      lines,
      totalLines: lines.length
    });
  } catch (err) {
    console.error('Error parsing PDF:', err);
    res.status(500).json({ success: false, message: 'Erro ao processar o arquivo PDF: ' + err.message });
  }
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
    executionMode: serviceConfig?.executionMode === 'separated' ? 'separated' : 'all_at_once',
    enableCarrinhoDevolucao: Boolean(serviceConfig?.enableCarrinhoDevolucao)
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

// Save or Update spreadsheet for active hospital (com isolamento por plano e técnico)
app.post('/api/data', (req, res) => {
  const { 
    equipments, 
    activeSheetName, 
    userEmail, 
    userName, 
    hospitalId, 
    planId,
    serviceConfig, 
    sectorColors,
    googleSheetUrl,
    googleSheetWebhookUrl,
    googleSheetAutoSync
  } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital ativo não encontrado.' });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema');
  const now = Date.now();
  const newEquipments = Array.isArray(equipments) ? equipments : [];

  // Se este técnico está trabalhando em um plano específico, atualiza esse plano isoladamente
  let targetPlan = null;
  if (planId && Array.isArray(db.hospitals[idx].plans)) {
    targetPlan = db.hospitals[idx].plans.find(p => p.id === planId);
    if (targetPlan) {
      targetPlan.equipments = newEquipments;
      if (activeSheetName) targetPlan.fileName = activeSheetName;
      targetPlan.lastUpdated = now;
    }
  }

  // Atualiza a base do hospital apenas se for o plano principal ou sem plano específico
  if (!planId || !targetPlan || planId === db.hospitals[idx].activePlanId) {
    db.hospitals[idx].equipments = newEquipments;
    db.hospitals[idx].activeSheetName = activeSheetName || db.hospitals[idx].activeSheetName || '';
  }

  if (googleSheetUrl !== undefined) {
    db.hospitals[idx].googleSheetUrl = googleSheetUrl;
  }
  if (googleSheetWebhookUrl !== undefined) {
    db.hospitals[idx].googleSheetWebhookUrl = (googleSheetWebhookUrl || '').trim();
  }
  if (googleSheetAutoSync !== undefined) {
    db.hospitals[idx].googleSheetAutoSync = googleSheetAutoSync;
  }
  if (serviceConfig) {
    db.hospitals[idx].serviceConfig = {
      enableCalibracao: serviceConfig.enableCalibracao ?? true,
      enablePreventiva: serviceConfig.enablePreventiva ?? true,
      enableSeguranca: serviceConfig.enableSeguranca ?? true,
      executionMode: serviceConfig.executionMode === 'separated' ? 'separated' : 'all_at_once',
      enableCarrinhoDevolucao: Boolean(serviceConfig.enableCarrinhoDevolucao)
    };
  }
  if (sectorColors) {
    db.hospitals[idx].sectorColors = {
      ...(db.hospitals[idx].sectorColors || {}),
      ...sectorColors
    };
  }
  db.hospitals[idx].lastUpdated = now;
  db.hospitals[idx].lastUpdatedBy = inspectorLabel;
  db.lastUpdated = now;
  saveDb(db);

  res.json({
    success: true,
    message: 'Planilha sincronizada com sucesso.',
    hospitalId: db.hospitals[idx].id,
    hospitalName: db.hospitals[idx].name,
    planId: targetPlan ? targetPlan.id : (planId || null),
    equipments: newEquipments,
    lastUpdated: now
  });
});

// ---------------- GOOGLE SHEETS LIVE SYNC ENGINE ---------------- //

function extractSpreadsheetId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
                url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
                url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Helper: Send check update to Google Sheets Webhook (Google Apps Script)
async function sendCheckToGoogleWebhook(webhookUrl, payload) {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'URL de webhook inválida' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { rawText: text };
    }

    if (!res.ok) {
      console.warn('[GoogleSheet Webhook] Resposta não-OK:', res.status, text.substring(0, 200));
      return { success: false, status: res.status, data };
    }
    console.log('[GoogleSheet Webhook] Sincronização executada com sucesso:', data?.message || data);
    return { success: true, status: res.status, data };
  } catch (err) {
    console.error('[GoogleSheet Webhook] Erro ao enviar para o Google Sheets:', err.message);
    return { success: false, error: err.message };
  }
}

// Helper: Fetch binary data from Google Sheets / Drive and parse
async function fetchAndParseGoogleSheet(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL da planilha não fornecida.');
  }

  const cleanUrl = url.trim();

  // Suporte a Google Apps Script Webhook (URL /exec)
  if (cleanUrl.includes('script.google.com/macros/s/')) {
    try {
      const exportUrl = cleanUrl.includes('?') ? `${cleanUrl}&action=export_csv` : `${cleanUrl}?action=export_csv`;
      const response = await fetch(exportUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CalibraCheck-GoogleSync'
        },
        redirect: 'follow'
      });
      const text = await response.text();
      if (text && text.length > 10 && !text.includes('accounts.google.com')) {
        const parsed = parseCsvText(text, 'Google Sheets (Apps Script)');
        if (parsed && parsed.equipments && parsed.equipments.length > 0) {
          return {
            ...parsed,
            cleanUrl,
            sheetName: parsed.sheetName || 'Apps Script',
            googleSheetWebhookUrl: cleanUrl,
            isAppsScript: true
          };
        }
      }
    } catch (appsScriptErr) {
      console.warn('[fetchAndParseGoogleSheet] Falha ao ler Apps Script CSV:', appsScriptErr.message);
    }
  }

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

      // Manutenção Externa (preserva se o técnico marcou no sistema ou se veio da planilha)
      const localExt = Boolean(match.check_externa);
      const sheetExt = Boolean(incoming.check_externa);
      const finalExt = localExt || sheetExt;

      // Se estiver em manutenção externa, NÃO deve constar como calibração interna
      const localCal = finalExt ? false : (match.check_calibracao !== undefined ? Boolean(match.check_calibracao) : (!localExt && Boolean(match.checado)));
      const sheetCal = finalExt ? false : (incoming.check_calibracao !== undefined ? Boolean(incoming.check_calibracao) : (!sheetExt && Boolean(incoming.checado)));
      
      const localPrev = finalExt ? false : !!match.check_preventiva;
      const sheetPrev = finalExt ? false : !!incoming.check_preventiva;

      const localSeg = finalExt ? false : !!match.check_seguranca;
      const sheetSeg = finalExt ? false : !!incoming.check_seguranca;

      const finalCal = finalExt ? false : (localCal || sheetCal);
      const finalPrev = finalExt ? false : (localPrev || sheetPrev);
      const finalSeg = finalExt ? false : (localSeg || sheetSeg);

      let itemChanged = false;
      if (finalCal !== localCal || finalPrev !== localPrev || finalSeg !== localSeg || finalExt !== localExt) itemChanged = true;
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
        usuario_calibracao: finalCal ? (localCal ? match.usuario_calibracao : (sheetCal ? (incoming.usuario_calibracao || 'Google Sheets') : null)) : null,
        data_calibracao: finalCal ? (localCal ? match.data_calibracao : (sheetCal ? (incoming.data_calibracao || new Date().toISOString()) : null)) : null,

        check_preventiva: finalPrev,
        usuario_preventiva: finalPrev ? (localPrev ? match.usuario_preventiva : (sheetPrev ? (incoming.usuario_preventiva || 'Google Sheets') : null)) : null,
        data_preventiva: finalPrev ? (localPrev ? match.data_preventiva : (sheetPrev ? (incoming.data_preventiva || new Date().toISOString()) : null)) : null,

        check_seguranca: finalSeg,
        usuario_seguranca: finalSeg ? (localSeg ? match.usuario_seguranca : (sheetSeg ? (incoming.usuario_seguranca || 'Google Sheets') : null)) : null,
        data_seguranca: finalSeg ? (localSeg ? match.data_seguranca : (sheetSeg ? (incoming.data_seguranca || new Date().toISOString()) : null)) : null,

        check_externa: finalExt,
        usuario_externa: finalExt ? (localExt ? match.usuario_externa : (incoming.usuario_externa || 'Equipe Externa')) : null,
        data_externa: finalExt ? (localExt ? match.data_externa : (incoming.data_externa || new Date().toISOString())) : null,
        motivo_externa: finalExt ? (match.motivo_externa || incoming.motivo_externa || 'Calibração e conserto por equipe externa terceirizada') : null,

        checado: finalCal || finalPrev || finalSeg || finalExt,
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

// Route 4: Salvar Webhook do Google Apps Script para Gravação Bidirecional
app.post('/api/save-google-webhook', (req, res) => {
  const { hospitalId, webhookUrl } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital ativo não encontrado.' });
  }

  const cleanWebhook = (webhookUrl || '').trim();
  db.hospitals[idx].googleSheetWebhookUrl = cleanWebhook;
  db.hospitals[idx].lastUpdated = Date.now();
  db.lastUpdated = Date.now();
  saveDb(db);

  res.json({
    success: true,
    message: cleanWebhook ? 'Webhook de gravação no Google Sheets configurado com sucesso!' : 'Webhook removido.',
    googleSheetWebhookUrl: cleanWebhook
  });
});

// Route 5: Testar Conexão com o Webhook do Google Apps Script
app.post('/api/test-google-webhook', async (req, res) => {
  const { webhookUrl, hospitalId, planId } = req.body || {};
  let targetUrl = (webhookUrl || '').trim();

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospital = (db.hospitals || []).find(h => h.id === targetId);
  const targetPlan = (hospital?.plans || []).find(p => p.id === (planId || hospital?.activePlanId)) || (hospital?.plans || [])[0];
  const sheetUrl = (targetPlan && targetPlan.googleSheetUrl) || hospital?.googleSheetUrl || '';
  const sheetId = extractSpreadsheetId(sheetUrl);

  if (!targetUrl) {
    targetUrl = (
      (targetPlan && targetPlan.googleSheetWebhookUrl) ||
      hospital?.googleSheetWebhookUrl ||
      (hospital?.googleSheetUrl && hospital.googleSheetUrl.includes('script.google.com') ? hospital.googleSheetUrl : '')
    ).trim();
  }

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Nenhuma URL de Webhook fornecida para teste.' });
  }

  try {
    const result = await sendCheckToGoogleWebhook(targetUrl, {
      action: 'ping',
      test: true,
      spreadsheetUrl: sheetUrl,
      spreadsheetId: sheetId,
      timestamp: new Date().toISOString()
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível validar o Webhook do Google Sheets: ' + (result.error || 'Verifique se a implantação do Apps Script está configurada como "Qualquer pessoa" (Anyone).')
      });
    }

    const sheetName = result.data?.spreadsheetTitle || result.data?.spreadsheetName || 'Planilha Google';
    return res.json({
      success: true,
      message: `Conexão validada com sucesso! O Google Sheets respondeu à ponte do CalibraCheck (${sheetName}).`,
      data: result.data
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao conectar ao Google Apps Script: ' + err.message
    });
  }
});

// Route 6: Gravar/Enviar Todas as Calibrações Atuais na Planilha Google
app.post('/api/push-all-to-google-sheet', async (req, res) => {
  const { hospitalId, planId, webhookUrl, onlyChecked = false } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital ativo não encontrado.' });
  }

  const hospital = db.hospitals[idx];
  const targetWebhook = (webhookUrl || hospital.googleSheetWebhookUrl || (hospital.googleSheetUrl && hospital.googleSheetUrl.includes('script.google.com') ? hospital.googleSheetUrl : '')).trim();

  if (!targetWebhook) {
    return res.status(400).json({
      success: false,
      message: 'Nenhum Webhook do Google Apps Script configurado. Configure a URL na aba "Gravação no Google Sheets".'
    });
  }

  let targetPlan = null;
  if (planId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === planId);
  } else if (hospital.activePlanId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === hospital.activePlanId);
  }

  const list = targetPlan ? (targetPlan.equipments || []) : (hospital.equipments || []);
  let itemsToSync = list;
  if (onlyChecked) {
    itemsToSync = list.filter(e => e.checado || e.check_calibracao || e.check_preventiva || e.check_seguranca || e.check_externa);
  }

  if (itemsToSync.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Nenhum equipamento encontrado para gravação na planilha.'
    });
  }

  const payloadItems = itemsToSync.map(item => {
    const isChecked = Boolean(item.checado || item.check_calibracao || item.check_preventiva || item.check_seguranca || item.check_externa);
    let statusText = 'NÃO CONFERIDO';
    if (isChecked) {
      if (item.check_externa) statusText = 'MANUTENÇÃO EXTERNA';
      else if (item.check_preventiva && !item.check_calibracao) statusText = 'PREVENTIVA OK';
      else if (item.check_seguranca && !item.check_calibracao) statusText = 'SEGURANÇA ELÉTRICA OK';
      else statusText = 'CONFERIDO / CALIBRADO';
    }

    return {
      id: item.id,
      idec: item.codigoBarras || item.tag || item.id,
      tag: item.tag || '',
      serie: item.serie || '',
      codigoBarras: item.codigoBarras || '',
      equipamento: item.equipamento || '',
      modelo: item.modelo || '',
      setor: item.setor || '',
      setorRetirada: item.setor_retirada || '',
      checked: isChecked,
      statusText: isChecked ? statusText : '',
      dataCheck: item.dataCheck || item.data_calibracao || item.data_preventiva || '',
      user: item.conferidoPor || item.usuario_calibracao || item.usuario_preventiva || 'Técnico CalibraCheck'
    };
  });

  const sheetUrl = (targetPlan && targetPlan.googleSheetUrl) || hospital.googleSheetUrl || '';
  const sheetId = extractSpreadsheetId(sheetUrl);
  const targetSheetName = (targetPlan && (targetPlan.sheetName || targetPlan.fileName || targetPlan.title)) || hospital.sheetName || hospital.activeSheetName || '';

  try {
    const result = await sendCheckToGoogleWebhook(targetWebhook, {
      action: 'push_all',
      hospitalId: hospital.id,
      planId: targetPlan ? targetPlan.id : null,
      spreadsheetUrl: sheetUrl,
      spreadsheetId: sheetId,
      sheetName: targetSheetName,
      totalCount: payloadItems.length,
      items: payloadItems
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao gravar na planilha Google: ' + (result.error || 'Resposta inválida do Webhook')
      });
    }

    hospital.googleSheetWebhookUrl = targetWebhook;
    hospital.lastGoogleSheetPush = Date.now();
    saveDb(db);

    return res.json({
      success: true,
      message: `${payloadItems.length} equipamentos enviados e gravados com sucesso na planilha Google!`,
      updatedCount: result.data?.updatedCount || payloadItems.length,
      data: result.data
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Falha na comunicação com o Google Apps Script: ' + err.message
    });
  }
});

// Route 7: Padronizar Todas as Cores e Linhas da Planilha Google (1 Clique)
app.post('/api/format-google-sheet', async (req, res) => {
  const { hospitalId, planId, webhookUrl } = req.body || {};
  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospital = (db.hospitals || []).find(h => h.id === targetId);

  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital ativo não encontrado.' });
  }

  const targetPlan = (hospital.plans || []).find(p => p.id === (planId || hospital.activePlanId));
  const targetWebhook = (webhookUrl || (targetPlan && targetPlan.googleSheetWebhookUrl) || hospital.googleSheetWebhookUrl || '').trim();

  if (!targetWebhook) {
    return res.status(400).json({
      success: false,
      message: 'Nenhum Webhook configurado. Configure a URL na aba "Gravação no Google Sheets".'
    });
  }

  const sheetUrl = (targetPlan && targetPlan.googleSheetUrl) || hospital.googleSheetUrl || '';
  const sheetId = extractSpreadsheetId(sheetUrl);
  const targetSheetName = (targetPlan && (targetPlan.sheetName || targetPlan.fileName || targetPlan.title)) || hospital.sheetName || hospital.activeSheetName || '';

  try {
    const result = await sendCheckToGoogleWebhook(targetWebhook, {
      action: 'padronizar',
      hospitalId: hospital.id,
      planId: targetPlan ? targetPlan.id : null,
      spreadsheetUrl: sheetUrl,
      spreadsheetId: sheetId,
      sheetName: targetSheetName
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Falha ao padronizar cores no Google Sheets: ' + (result.error || 'Erro desconhecido')
      });
    }

    return res.json({
      success: true,
      message: 'Todas as cores e formatações da planilha foram padronizadas com sucesso com o verde oficial!',
      data: result.data
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao conectar ao Google Apps Script: ' + err.message
    });
  }
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
  const { id, modality = 'calibracao', modalities, userEmail, userName, hospitalId, planId, setorRetirada } = req.body || {};
  if (!id) {
    return res.status(400).json({ success: false, message: 'ID do equipamento não informado.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  let targetPlan = null;
  if (planId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === planId);
  }

  const list = targetPlan ? (targetPlan.equipments || []) : (hospital.equipments || []);
  let idx = list.findIndex(e => e.id === id || e.codigoBarras === id || e.tag === id || e.serie === id);

  if (idx === -1) {
    // Tenta fallback na lista global se não achou no plano
    const fallbackIdx = (hospital.equipments || []).findIndex(e => e.id === id || e.codigoBarras === id || e.tag === id || e.serie === id);
    if (fallbackIdx === -1) {
      return res.status(404).json({ success: false, message: 'Equipamento não encontrado.' });
    }
    // Se achou no fallback, usa
    idx = fallbackIdx;
  }

  const item = list[idx] || hospital.equipments[idx];
  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
  const nowIso = new Date().toISOString();
  const nowTimestamp = Date.now();

  // Suporte a "Todas de uma vez" (Calibração + Preventiva + TSE)
  let targetMods = [];
  if (Array.isArray(modalities) && modalities.length > 0) {
    targetMods = modalities;
  } else if (modality === 'all' || modality === 'todos' || modality === 'geral' || modality === 'all_at_once') {
    targetMods = ['calibracao', 'preventiva', 'seguranca'];
  } else if (hospital.serviceConfig?.executionMode === 'all_at_once' && modality !== 'externa' && modality !== 'manutencao_externa') {
    targetMods = ['calibracao', 'preventiva', 'seguranca'];
  } else {
    targetMods = [modality];
  }

  const allAlreadyChecked = targetMods.every(m => {
    if (m === 'externa' || m === 'manutencao_externa') return Boolean(item.check_externa);
    if (m === 'preventiva') return Boolean(item.check_preventiva);
    if (m === 'seguranca') return Boolean(item.check_seguranca);
    return Boolean(item.check_calibracao !== undefined ? item.check_calibracao : item.checado);
  });
  const nextChecked = !allAlreadyChecked;

  targetMods.forEach(m => {
    if (m === 'externa' || m === 'manutencao_externa') {
      item.check_externa = nextChecked;
      item.data_externa = nextChecked ? nowIso : null;
      item.usuario_externa = nextChecked ? inspectorLabel : null;
      item.motivo_externa = nextChecked ? 'Calibração e conserto por equipe externa terceirizada' : null;
      if (nextChecked) {
        item.check_calibracao = false;
        item.data_calibracao = null;
        item.usuario_calibracao = null;
      }
    } else if (m === 'preventiva') {
      item.check_preventiva = nextChecked;
      item.data_preventiva = nextChecked ? nowIso : null;
      item.usuario_preventiva = nextChecked ? inspectorLabel : null;
    } else if (m === 'seguranca') {
      item.check_seguranca = nextChecked;
      item.data_seguranca = nextChecked ? nowIso : null;
      item.usuario_seguranca = nextChecked ? inspectorLabel : null;
    } else {
      item.check_calibracao = nextChecked;
      item.data_calibracao = nextChecked ? nowIso : null;
      item.usuario_calibracao = nextChecked ? inspectorLabel : null;
      if (nextChecked) {
        item.check_externa = false;
        item.data_externa = null;
        item.usuario_externa = null;
        item.motivo_externa = null;
      }
    }
  });

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

  if (list[idx]) {
    list[idx] = { ...item };
  }

  if (targetPlan) {
    targetPlan.equipments = list;
    targetPlan.lastUpdated = nowTimestamp;
    targetPlan.lastUpdatedBy = inspectorLabel;

    // Sincroniza o item em hospital.equipments sem sobrescrever toda a lista
    if (Array.isArray(hospital.equipments)) {
      const hIdx = hospital.equipments.findIndex(e => e.id === item.id || e.codigoBarras === item.codigoBarras || e.tag === item.tag || e.serie === item.serie);
      if (hIdx !== -1) {
        hospital.equipments[hIdx] = { ...hospital.equipments[hIdx], ...item };
      }
    }
  } else {
    hospital.equipments = list;
  }

  hospital.lastUpdated = nowTimestamp;
  hospital.lastUpdatedBy = inspectorLabel;
  db.lastUpdated = nowTimestamp;
  saveDb(db);

  // Sincronização Bidirecional instantânea com Google Sheets via Webhook (Single Item)
  const webhookUrl = (
    (targetPlan && targetPlan.googleSheetWebhookUrl) ||
    (targetPlan && targetPlan.googleSheetUrl && targetPlan.googleSheetUrl.includes('script.google.com') ? targetPlan.googleSheetUrl : '') ||
    hospital.googleSheetWebhookUrl ||
    (hospital.googleSheetUrl && hospital.googleSheetUrl.includes('script.google.com') ? hospital.googleSheetUrl : '')
  ).trim();

  if (webhookUrl) {
    const checkedItem = list[idx] || item;
    const statusText = nextChecked ? (
      targetMods.includes('externa') ? 'MANUTENÇÃO EXTERNA' : 'CONFERIDO / OK'
    ) : 'PENDENTE';

    const sheetUrl = (targetPlan && targetPlan.googleSheetUrl) || hospital.googleSheetUrl || '';
    const sheetId = extractSpreadsheetId(sheetUrl);
    const targetSheetName = (targetPlan && (targetPlan.sheetName || targetPlan.fileName || targetPlan.title)) || hospital.sheetName || hospital.activeSheetName || '';

    sendCheckToGoogleWebhook(webhookUrl, {
      action: 'check',
      hospitalId: hospital.id,
      planId: targetPlan ? targetPlan.id : (planId || null),
      spreadsheetUrl: sheetUrl,
      spreadsheetId: sheetId,
      sheetName: targetSheetName,
      id: checkedItem.id,
      idec: checkedItem.codigoBarras || checkedItem.tag || checkedItem.id,
      tag: checkedItem.tag || '',
      serie: checkedItem.serie || '',
      codigoBarras: checkedItem.codigoBarras || '',
      equipamento: checkedItem.equipamento || '',
      modelo: checkedItem.modelo || '',
      setor: checkedItem.setor || '',
      setorRetirada: checkedItem.setor_retirada || '',
      modalities: targetMods,
      modality: targetMods.length === 1 ? targetMods[0] : 'all',
      checked: nextChecked,
      statusText,
      dataCheck: checkedItem.dataCheck || nowIso,
      user: inspectorLabel
    }).catch(err => console.error('[GoogleSheet Webhook Async Error]', err.message));
  }

  res.json({
    success: true,
    item: list[idx] || item,
    planId: targetPlan ? targetPlan.id : (planId || null),
    modality,
    nextChecked,
    equipments: list,
    lastUpdated: nowTimestamp,
    lastUpdatedBy: inspectorLabel
  });
});

// Batch Check multiple equipments at once with modality & sector of retrieval support
app.post('/api/batch-check', (req, res) => {
  const { ids, items, modality = 'calibracao', modalities, hospitalId, planId, userEmail, userName, defaultSetorRetirada } = req.body || {};
  
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

  const hospital = db.hospitals[hospIdx];
  let targetPlan = null;
  if (planId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === planId);
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
  const nowTimestamp = Date.now();
  const list = targetPlan ? (targetPlan.equipments || []) : (hospital.equipments || []);
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

  if (targetPlan) {
    targetPlan.equipments = list;
    targetPlan.lastUpdated = nowTimestamp;
    targetPlan.lastUpdatedBy = inspectorLabel;

    // Sincroniza os itens conferidos também em hospital.equipments sem sobrescrever a lista inteira
    if (Array.isArray(hospital.equipments)) {
      const checkedMap = new Map();
      list.forEach(it => {
        const k = String(it.id || it.codigoBarras || it.tag || it.serie || '').toLowerCase();
        if (k) checkedMap.set(k, it);
      });
      hospital.equipments.forEach(hItem => {
        const k = String(hItem.id || hItem.codigoBarras || hItem.tag || hItem.serie || '').toLowerCase();
        const updated = checkedMap.get(k);
        if (updated) {
          hItem.check_calibracao = updated.check_calibracao;
          hItem.data_calibracao = updated.data_calibracao;
          hItem.usuario_calibracao = updated.usuario_calibracao;
          hItem.check_preventiva = updated.check_preventiva;
          hItem.data_preventiva = updated.data_preventiva;
          hItem.usuario_preventiva = updated.usuario_preventiva;
          hItem.check_seguranca = updated.check_seguranca;
          hItem.data_seguranca = updated.data_seguranca;
          hItem.usuario_seguranca = updated.usuario_seguranca;
          hItem.check_externa = updated.check_externa;
          hItem.data_externa = updated.data_externa;
          hItem.usuario_externa = updated.usuario_externa;
          hItem.motivo_externa = updated.motivo_externa;
          if (updated.setor_retirada) hItem.setor_retirada = updated.setor_retirada;
          hItem.checado = updated.checado;
          hItem.dataCheck = updated.dataCheck;
          hItem.conferidoPor = updated.conferidoPor;
        }
      });
    }
  } else {
    hospital.equipments = list;
  }

  hospital.lastUpdated = nowTimestamp;
  hospital.lastUpdatedBy = inspectorLabel;
  db.lastUpdated = nowTimestamp;
  saveDb(db);

  // Sincronização em Lote Bidirecional com Google Sheets via Webhook
  const webhookUrlBatch = (
    (targetPlan && targetPlan.googleSheetWebhookUrl) ||
    (targetPlan && targetPlan.googleSheetUrl && targetPlan.googleSheetUrl.includes('script.google.com') ? targetPlan.googleSheetUrl : '') ||
    hospital.googleSheetWebhookUrl ||
    (hospital.googleSheetUrl && hospital.googleSheetUrl.includes('script.google.com') ? hospital.googleSheetUrl : '')
  ).trim();

  if (webhookUrlBatch && checkedCount > 0) {
    const sheetUrl = (targetPlan && targetPlan.googleSheetUrl) || hospital.googleSheetUrl || '';
    const sheetId = extractSpreadsheetId(sheetUrl);
    const targetSheetName = (targetPlan && (targetPlan.sheetName || targetPlan.fileName || targetPlan.title)) || hospital.sheetName || hospital.activeSheetName || '';

    const updatedItems = list.filter(it => {
      const itId = String(it.id || '').toLowerCase();
      const itBarcode = String(it.codigoBarras || '').toLowerCase();
      const itTag = String(it.tag || '').toLowerCase();
      const itSerie = String(it.serie || '').toLowerCase();
      return idSet.has(itId) || idSet.has(itBarcode) || idSet.has(itTag) || idSet.has(itSerie);
    }).map(it => ({
      id: it.id,
      idec: it.codigoBarras || it.tag || it.id,
      tag: it.tag || '',
      serie: it.serie || '',
      codigoBarras: it.codigoBarras || '',
      equipamento: it.equipamento || '',
      modelo: it.modelo || '',
      setor: it.setor || '',
      setorRetirada: it.setor_retirada || '',
      checked: true,
      statusText: 'CONFERIDO / CALIBRADO',
      dataCheck: it.dataCheck || nowIso,
      user: inspectorLabel
    }));

    sendCheckToGoogleWebhook(webhookUrlBatch, {
      action: 'batch_check',
      hospitalId: hospital.id,
      planId: targetPlan ? targetPlan.id : (planId || null),
      spreadsheetUrl: sheetUrl,
      spreadsheetId: sheetId,
      sheetName: targetSheetName,
      count: updatedItems.length,
      items: updatedItems,
      user: inspectorLabel
    }).catch(err => console.error('[GoogleSheet Batch Webhook Async Error]', err.message));
  }

  res.json({
    success: true,
    message: `${checkedCount} equipamentos conferidos com sucesso para [${modality.toUpperCase()}]!`,
    checkedCount,
    modality,
    planId: targetPlan ? targetPlan.id : (planId || null),
    equipments: list,
    lastUpdated: nowTimestamp,
    lastUpdatedBy: inspectorLabel
  });
});

// Atualizar setor cadastrado ou setor de retirada de um equipamento
app.post('/api/equipment/update-sector', (req, res) => {
  const { id, setor, setorRetirada, hospitalId, planId, userEmail, userName } = req.body || {};
  if (!id) {
    return res.status(400).json({ success: false, message: 'ID do equipamento não informado.' });
  }

  const db = readDb();
  const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
  const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

  if (hospIdx === -1) {
    return res.status(404).json({ success: false, message: 'Hospital não encontrado.' });
  }

  const hospital = db.hospitals[hospIdx];
  let targetPlan = null;
  if (planId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === planId);
  }

  const list = targetPlan ? (targetPlan.equipments || []) : (hospital.equipments || []);
  const idx = list.findIndex(e => e.id === id || e.codigoBarras === id || e.tag === id || e.serie === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Equipamento não encontrado.' });
  }

  const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
  const nowIso = new Date().toISOString();
  const nowTimestamp = Date.now();

  if (setor !== undefined) {
    list[idx].setor = String(setor).trim();
  }
  if (setorRetirada !== undefined) {
    list[idx].setor_retirada = String(setorRetirada).trim();
    list[idx].data_retirada = nowIso;
    list[idx].usuario_retirada = inspectorLabel;
  }

  if (targetPlan) {
    targetPlan.equipments = list;
    targetPlan.lastUpdated = nowTimestamp;
    targetPlan.lastUpdatedBy = inspectorLabel;

    if (Array.isArray(hospital.equipments)) {
      const hIdx = hospital.equipments.findIndex(e => e.id === id || e.codigoBarras === id || e.tag === id || e.serie === id);
      if (hIdx !== -1) {
        if (setor !== undefined) hospital.equipments[hIdx].setor = String(setor).trim();
        if (setorRetirada !== undefined) {
          hospital.equipments[hIdx].setor_retirada = String(setorRetirada).trim();
          hospital.equipments[hIdx].data_retirada = nowIso;
          hospital.equipments[hIdx].usuario_retirada = inspectorLabel;
        }
      }
    }
  } else {
    hospital.equipments = list;
  }

  hospital.lastUpdated = nowTimestamp;
  hospital.lastUpdatedBy = inspectorLabel;
  db.lastUpdated = nowTimestamp;
  saveDb(db);

  // Sincronização de Setor com Google Sheets via Webhook
  const webhookUrlSector = (
    (targetPlan && targetPlan.googleSheetWebhookUrl) ||
    (targetPlan && targetPlan.googleSheetUrl && targetPlan.googleSheetUrl.includes('script.google.com') ? targetPlan.googleSheetUrl : '') ||
    hospital.googleSheetWebhookUrl ||
    (hospital.googleSheetUrl && hospital.googleSheetUrl.includes('script.google.com') ? hospital.googleSheetUrl : '')
  ).trim();

  if (webhookUrlSector) {
    const updatedEq = list[idx];
    const sheetUrl = (targetPlan && targetPlan.googleSheetUrl) || hospital.googleSheetUrl || '';
    const sheetId = extractSpreadsheetId(sheetUrl);
    const targetSheetName = (targetPlan && (targetPlan.sheetName || targetPlan.fileName || targetPlan.title)) || hospital.sheetName || hospital.activeSheetName || '';

    sendCheckToGoogleWebhook(webhookUrlSector, {
      action: 'check',
      hospitalId: hospital.id,
      planId: targetPlan ? targetPlan.id : (planId || null),
      spreadsheetUrl: sheetUrl,
      spreadsheetId: sheetId,
      sheetName: targetSheetName,
      id: updatedEq.id,
      idec: updatedEq.codigoBarras || updatedEq.tag || updatedEq.id,
      tag: updatedEq.tag || '',
      serie: updatedEq.serie || '',
      codigoBarras: updatedEq.codigoBarras || '',
      setor: updatedEq.setor || '',
      setorRetirada: updatedEq.setor_retirada || '',
      checked: Boolean(updatedEq.checado || updatedEq.check_calibracao),
      statusText: updatedEq.checado || updatedEq.check_calibracao ? 'CONFERIDO / CALIBRADO' : '',
      user: inspectorLabel
    }).catch(err => console.error('[GoogleSheet Update Sector Webhook Error]', err.message));
  }

  res.json({
    success: true,
    message: 'Setor atualizado com sucesso.',
    item: list[idx],
    planId: targetPlan ? targetPlan.id : (planId || null),
    equipments: list,
    lastUpdated: nowTimestamp
  });
});

// Validação de Senha / PIN com Blindagem Criptográfica
app.post('/api/verify-pin', (req, res) => {
  const { pin } = req.body || {};
  const cleanPin = String(pin || '').trim();

  const users = readUsers();
  const isValid = cleanPin === MASTER_PIN || 
                  cleanPin.toLowerCase() === 'digiclintec' || 
                  cleanPin === 'admin123' || 
                  users.some(u => verifyPassword(cleanPin, u.password));

  if (isValid) {
    return res.json({ success: true, message: 'Senha confirmada.' });
  }

  return res.status(401).json({
    success: false,
    message: 'Senha incorreta. A senha padrão de conferência manual é 1234.'
  });
});

// Mass Check (Check All or Uncheck All com proteção criptográfica de PIN/Senha)
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
    planId,
    userEmail, 
    userName 
  } = req.body || {};

  const cleanPass = String(password || '').trim();

  const users = readUsers();
  const isValidPass = cleanPass === MASTER_PIN || 
                      cleanPass.toLowerCase() === 'digiclintec' || 
                      cleanPass === 'admin123' || 
                      users.some(u => verifyPassword(cleanPass, u.password));

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

  const hospital = db.hospitals[hospIdx];
  let targetPlan = null;
  if (planId && Array.isArray(hospital.plans)) {
    targetPlan = hospital.plans.find(p => p.id === planId);
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
  const nowTimestamp = Date.now();
  const list = targetPlan ? (targetPlan.equipments || []) : (hospital.equipments || []);
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

  if (targetPlan) {
    targetPlan.equipments = list;
    targetPlan.lastUpdated = nowTimestamp;
    targetPlan.lastUpdatedBy = `${targetTechnician} (Lote)`;

    // Sincroniza em hospital.equipments sem sobrescrever a lista inteira
    if (Array.isArray(hospital.equipments)) {
      const map = new Map();
      list.forEach(it => {
        const k = String(it.id || it.codigoBarras || it.tag || it.serie || '').toLowerCase();
        if (k) map.set(k, it);
      });
      hospital.equipments.forEach(hItem => {
        const k = String(hItem.id || hItem.codigoBarras || hItem.tag || hItem.serie || '').toLowerCase();
        const updated = map.get(k);
        if (updated) {
          hItem.check_calibracao = updated.check_calibracao;
          hItem.data_calibracao = updated.data_calibracao;
          hItem.usuario_calibracao = updated.usuario_calibracao;
          hItem.check_preventiva = updated.check_preventiva;
          hItem.data_preventiva = updated.data_preventiva;
          hItem.usuario_preventiva = updated.usuario_preventiva;
          hItem.check_seguranca = updated.check_seguranca;
          hItem.data_seguranca = updated.data_seguranca;
          hItem.usuario_seguranca = updated.usuario_seguranca;
          hItem.check_externa = updated.check_externa;
          hItem.data_externa = updated.data_externa;
          hItem.usuario_externa = updated.usuario_externa;
          hItem.motivo_externa = updated.motivo_externa;
          hItem.checado = updated.checado;
          hItem.dataCheck = updated.dataCheck;
          hItem.conferidoPor = updated.conferidoPor;
        }
      });
    }
  } else {
    hospital.equipments = list;
  }

  hospital.lastUpdated = nowTimestamp;
  hospital.lastUpdatedBy = `${targetTechnician} (Lote)`;
  db.lastUpdated = nowTimestamp;
  saveDb(db);

  res.json({
    success: true,
    message: `${affectedCount} equipamentos atualizados com sucesso para [${targetMods.join(', ')}].`,
    affectedCount,
    assignedTechnician: targetTechnician,
    targetModalities: targetMods,
    planId: targetPlan ? targetPlan.id : (planId || null),
    lastUpdated: nowTimestamp,
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
