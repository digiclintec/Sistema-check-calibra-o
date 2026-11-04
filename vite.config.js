import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function apiServerPlugin() {
  const DATA_DIR = path.resolve(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'db.json');
  const USERS_FILE = path.join(DATA_DIR, 'users.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const DEFAULT_MASTER = {
    id: 'usr_master_1',
    email: 'digiclintec@gmail.com',
    password: '12289399@Ra',
    name: 'Digiclintec Master',
    role: 'master',
    hospitalId: 'all',
    createdAt: new Date().toISOString()
  };

  function readUsers() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    const initial = [DEFAULT_MASTER];
    fs.writeFileSync(USERS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  function saveUsers(users) {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } catch (e) {}
  }

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

  function readDb() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(content);
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
    } catch (e) {}
    const init = getInitialDb();
    saveDb(init);
    return init;
  }

  function saveDb(data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {}
  }

  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let parsedBody = {};
          if (body) {
            try { parsedBody = JSON.parse(body); } catch (e) {}
          }

          res.setHeader('Content-Type', 'application/json');

          // Login
          if (req.url === '/api/login' && req.method === 'POST') {
            const { email, password } = parsedBody;
            const cleanEmail = String(email || '').trim().toLowerCase();
            const users = readUsers();
            const user = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);

            if (user) {
              return res.end(JSON.stringify({
                success: true,
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role || 'operador',
                  hospitalId: user.hospitalId || 'all',
                  token: 'token_' + user.id + '_' + Date.now()
                }
              }));
            }
            res.statusCode = 401;
            return res.end(JSON.stringify({ success: false, message: 'Credenciais inválidas. Verifique seu e-mail e senha.' }));
          }

          // Hospitals list
          if (req.url === '/api/hospitals' && req.method === 'GET') {
            const db = readDb();
            const list = (db.hospitals || []).map(h => ({
              id: h.id,
              name: h.name,
              cidade: h.cidade,
              cnpj: h.cnpj,
              plano: h.plano || 'pro',
              totalEquipments: (h.equipments || []).length,
              checkedEquipments: (h.equipments || []).filter(e => e.checado).length,
              activeSheetName: h.activeSheetName || '',
              lastUpdated: h.lastUpdated
            }));
            return res.end(JSON.stringify({
              success: true,
              activeHospitalId: db.activeHospitalId || list[0]?.id,
              hospitals: list
            }));
          }

          // Create hospital
          if (req.url === '/api/hospitals' && req.method === 'POST') {
            const { name, cidade, cnpj, plano } = parsedBody;
            if (!name) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Nome do hospital é obrigatório.' }));
            }
            const db = readDb();
            const newHosp = {
              id: 'hosp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              name: String(name).trim(),
              cidade: String(cidade || '').trim(),
              cnpj: String(cnpj || '').trim(),
              plano: plano || 'pro',
              equipments: [],
              activeSheetName: '',
              lastUpdated: Date.now(),
              createdAt: new Date().toISOString()
            };
            db.hospitals = db.hospitals || [];
            db.hospitals.push(newHosp);
            db.lastUpdated = Date.now();
            saveDb(db);
            return res.end(JSON.stringify({ success: true, message: 'Hospital cadastrado!', hospital: newHosp }));
          }

          // Switch active hospital
          if (req.url === '/api/hospitals/switch' && req.method === 'POST') {
            const { id } = parsedBody;
            const db = readDb();
            const found = (db.hospitals || []).find(h => h.id === id);
            if (!found) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado.' }));
            }
            db.activeHospitalId = id;
            db.lastUpdated = Date.now();
            saveDb(db);
            return res.end(JSON.stringify({
              success: true,
              activeHospitalId: id,
              hospital: found
            }));
          }

          // Update hospital plan / details
          if (req.url === '/api/hospitals/update' && req.method === 'POST') {
            const { id, name, cidade, cnpj, plano } = parsedBody;
            const db = readDb();
            const idx = (db.hospitals || []).findIndex(h => h.id === id);
            if (idx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado.' }));
            }
            if (name !== undefined) db.hospitals[idx].name = String(name).trim();
            if (cidade !== undefined) db.hospitals[idx].cidade = String(cidade).trim();
            if (cnpj !== undefined) db.hospitals[idx].cnpj = String(cnpj).trim();
            if (plano !== undefined) db.hospitals[idx].plano = plano;
            db.hospitals[idx].lastUpdated = Date.now();
            db.lastUpdated = Date.now();
            saveDb(db);
            return res.end(JSON.stringify({ success: true, message: 'Atualizado com sucesso.', hospital: db.hospitals[idx] }));
          }

          // Delete hospital
          if (req.url === '/api/hospitals/delete' && req.method === 'POST') {
            const { id } = parsedBody;
            const db = readDb();
            if ((db.hospitals || []).length <= 1) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Não é possível excluir o único hospital cadastrado.' }));
            }
            db.hospitals = db.hospitals.filter(h => h.id !== id);
            if (db.activeHospitalId === id) {
              db.activeHospitalId = db.hospitals[0]?.id;
            }
            db.lastUpdated = Date.now();
            saveDb(db);
            return res.end(JSON.stringify({ success: true, message: 'Hospital excluído.', activeHospitalId: db.activeHospitalId }));
          }

          // Users list
          if (req.url === '/api/users' && req.method === 'GET') {
            const users = readUsers();
            const sanitized = users.map(u => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role || 'operador',
              hospitalId: u.hospitalId || 'all',
              createdAt: u.createdAt
            }));
            return res.end(JSON.stringify({ success: true, users: sanitized }));
          }

          // Create user
          if (req.url === '/api/users' && req.method === 'POST') {
            const { name, email, password, role, hospitalId } = parsedBody;
            if (!name || !email || !password) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Dados incompletos.' }));
            }
            const cleanEmail = String(email).trim().toLowerCase();
            const users = readUsers();
            if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'E-mail já cadastrado.' }));
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
            return res.end(JSON.stringify({ success: true, message: 'Criado', user: newUser }));
          }

          // Delete user
          if (req.url === '/api/users/delete' && req.method === 'POST') {
            const { id } = parsedBody;
            const users = readUsers();
            const target = users.find(u => u.id === id);
            if (!target) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Usuário não encontrado.' }));
            }
            if (target.role === 'master' || target.email.toLowerCase() === DEFAULT_MASTER.email.toLowerCase()) {
              res.statusCode = 403;
              return res.end(JSON.stringify({ success: false, message: 'Não é permitido excluir o usuário Master.' }));
            }
            const filtered = users.filter(u => u.id !== id);
            saveUsers(filtered);
            return res.end(JSON.stringify({ success: true, message: 'Excluído com sucesso.' }));
          }

          // Update password
          if (req.url === '/api/users/password' && req.method === 'POST') {
            const { id, newPassword } = parsedBody;
            const users = readUsers();
            const idx = users.findIndex(u => u.id === id);
            if (idx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Usuário não encontrado.' }));
            }
            users[idx].password = String(newPassword).trim();
            saveUsers(users);
            return res.end(JSON.stringify({ success: true, message: 'Senha atualizada.' }));
          }

          // Get spreadsheet data (scoped to hospital)
          if (req.url.startsWith('/api/data') && req.method === 'GET') {
            const db = readDb();
            const urlObj = new URL(req.url, 'http://localhost');
            const targetId = urlObj.searchParams.get('hospitalId') || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospital = (db.hospitals || []).find(h => h.id === targetId) || db.hospitals?.[0] || {};
            return res.end(JSON.stringify({
              success: true,
              hospitalId: hospital.id,
              hospitalName: hospital.name,
              hospitalPlan: hospital.plano || 'pro',
              equipments: hospital.equipments || [],
              activeSheetName: hospital.activeSheetName || '',
              lastUpdated: hospital.lastUpdated || db.lastUpdated || Date.now(),
              lastUpdatedBy: hospital.lastUpdatedBy || ''
            }));
          }

          // Save spreadsheet data
          if (req.url === '/api/data' && req.method === 'POST') {
            const { equipments, activeSheetName, userEmail, userName, hospitalId } = parsedBody;
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const idx = (db.hospitals || []).findIndex(h => h.id === targetId);

            if (idx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
            }

            const label = userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema');
            db.hospitals[idx].equipments = Array.isArray(equipments) ? equipments : [];
            db.hospitals[idx].activeSheetName = activeSheetName || '';
            db.hospitals[idx].lastUpdated = Date.now();
            db.hospitals[idx].lastUpdatedBy = label;
            db.lastUpdated = Date.now();
            saveDb(db);

            return res.end(JSON.stringify({
              success: true,
              message: 'Salvo com sucesso',
              hospitalId: db.hospitals[idx].id,
              hospitalName: db.hospitals[idx].name,
              equipments: db.hospitals[idx].equipments,
              activeSheetName: db.hospitals[idx].activeSheetName,
              lastUpdated: db.hospitals[idx].lastUpdated
            }));
          }

          // Toggle check
          if (req.url === '/api/toggle-check' && req.method === 'POST') {
            const { id, userEmail, userName, hospitalId } = parsedBody;
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
            }

            const list = db.hospitals[hospIdx].equipments || [];
            const idx = list.findIndex(e => e.id === id || e.codigoBarras === id);
            if (idx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Equipamento não encontrado' }));
            }
            const item = list[idx];
            const nextChecked = !item.checado;
            const label = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
            list[idx] = {
              ...item,
              checado: nextChecked,
              dataCheck: nextChecked ? new Date().toISOString() : null,
              conferidoPor: nextChecked ? label : null
            };
            db.hospitals[hospIdx].equipments = list;
            db.hospitals[hospIdx].lastUpdated = Date.now();
            db.hospitals[hospIdx].lastUpdatedBy = label;
            db.lastUpdated = Date.now();
            saveDb(db);

            return res.end(JSON.stringify({
              success: true,
              item: list[idx],
              equipments: list,
              lastUpdated: db.lastUpdated,
              lastUpdatedBy: label
            }));
          }

          // Reset hospital data
          if (req.url === '/api/reset' && req.method === 'POST') {
            const { hospitalId } = parsedBody;
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

            return res.end(JSON.stringify({ success: true, message: 'Planilha do hospital limpa com sucesso.' }));
          }

          next();
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiServerPlugin(),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          xlsx: ['xlsx'],
          scanner: ['html5-qrcode'],
        },
      },
    },
  },
});
