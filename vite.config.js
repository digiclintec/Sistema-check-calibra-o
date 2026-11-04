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

  function readDb() {
    try {
      if (fs.existsSync(DB_FILE)) {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      }
    } catch (e) {}
    const init = { equipments: [], activeSheetName: '', lastUpdated: Date.now(), lastUpdatedBy: 'Sistema' };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2), 'utf-8');
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
                  token: 'token_' + user.id + '_' + Date.now()
                }
              }));
            }
            res.statusCode = 401;
            return res.end(JSON.stringify({ success: false, message: 'Credenciais inválidas. Verifique seu e-mail e senha.' }));
          }

          // Users list
          if (req.url === '/api/users' && req.method === 'GET') {
            const users = readUsers();
            const sanitized = users.map(u => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role || 'operador',
              createdAt: u.createdAt
            }));
            return res.end(JSON.stringify({ success: true, users: sanitized }));
          }

          // Create user
          if (req.url === '/api/users' && req.method === 'POST') {
            const { name, email, password, role } = parsedBody;
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

          // Get spreadsheet data
          if (req.url.startsWith('/api/data') && req.method === 'GET') {
            const db = readDb();
            return res.end(JSON.stringify({ success: true, ...db }));
          }

          // Save spreadsheet data
          if (req.url === '/api/data' && req.method === 'POST') {
            const { equipments, activeSheetName, userEmail, userName } = parsedBody;
            const db = {
              equipments: Array.isArray(equipments) ? equipments : [],
              activeSheetName: activeSheetName || '',
              lastUpdated: Date.now(),
              lastUpdatedBy: userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema')
            };
            saveDb(db);
            return res.end(JSON.stringify({ success: true, message: 'Salvo', ...db }));
          }

          // Toggle check
          if (req.url === '/api/toggle-check' && req.method === 'POST') {
            const { id, userEmail, userName } = parsedBody;
            const db = readDb();
            const list = db.equipments || [];
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
            db.equipments = list;
            db.lastUpdated = Date.now();
            db.lastUpdatedBy = label;
            saveDb(db);
            return res.end(JSON.stringify({ success: true, item: list[idx], equipments: list, lastUpdated: db.lastUpdated }));
          }

          // Reset
          if (req.url === '/api/reset' && req.method === 'POST') {
            const init = { equipments: [], activeSheetName: '', lastUpdated: Date.now(), lastUpdatedBy: 'Sistema' };
            saveDb(init);
            return res.end(JSON.stringify({ success: true, ...init }));
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
