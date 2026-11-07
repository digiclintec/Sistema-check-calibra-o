import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

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

        if (Array.isArray(data.hospitals)) {
          let changed = false;
          data.hospitals.forEach(h => {
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
                if (!eq.id || eq.id === 'BOMBA DE INFUSAO VOLUMETRICA' || eq.id === eq.equipamento) {
                  eq.id = eq.serie ? `EQP-${eq.serie}` : (eq.tag ? `EQP-${eq.tag}` : `EQP-${idx + 1}`);
                  changed = true;
                }
              });
            }
          });
          if (changed) saveDb(data);
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
        req.on('end', async () => {
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

          // Plans list (com metadados enriquecidos para planos anuais e previsão)
          if (req.url.startsWith('/api/plans') && req.method === 'GET') {
            const db = readDb();
            const urlObj = new URL(req.url, 'http://localhost');
            const targetId = urlObj.searchParams.get('hospitalId') || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospital = (db.hospitals || []).find(h => h.id === targetId) || db.hospitals?.[0] || {};
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const plans = (hospital.plans || []).map(p => {
              const eqs = Array.isArray(p.equipments) ? p.equipments : [];
              const total = eqs.length;
              const checked = eqs.filter(e => e.checado).length;
              const pending = total - checked;
              const percent = total > 0 ? Math.round((checked / total) * 100) : 0;

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
            return res.end(JSON.stringify({
              success: true,
              hospitalId: hospital.id,
              hospitalName: hospital.name,
              activePlanId: hospital.activePlanId || plans[0]?.id || null,
              plans
            }));
          }

          // Switch active plan
          if (req.url === '/api/plans/switch' && req.method === 'POST') {
            const { hospitalId, planId } = parsedBody;
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);
            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
            }
            const hospital = db.hospitals[hospIdx];
            const plan = (hospital.plans || []).find(p => p.id === planId);
            if (!plan) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Planejamento não encontrado' }));
            }
            hospital.activePlanId = planId;
            hospital.equipments = plan.equipments || [];
            hospital.activeSheetName = plan.fileName || plan.title;
            hospital.lastUpdated = Date.now();
            db.lastUpdated = Date.now();
            saveDb(db);
            return res.end(JSON.stringify({
              success: true,
              message: 'Plano ativado com sucesso',
              activePlanId: planId,
              equipments: plan.equipments,
              activeSheetName: hospital.activeSheetName
            }));
          }

          // Create new monthly/annual plan
          if (req.url === '/api/plans/create' && req.method === 'POST') {
            const { hospitalId, title, mes, fileName, equipments, tipo, ano, dataInicio, dataFim, descricao } = parsedBody;
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);
            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
            }
            const hospital = db.hospitals[hospIdx];
            hospital.plans = hospital.plans || [];
            const newPlanId = 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            const detectedAno = String(ano || (mes && mes.match(/\d{4}/) ? mes.match(/\d{4}/)[0] : new Date().getFullYear())).trim();
            const newPlan = {
              id: newPlanId,
              title: String(title || fileName || `Plano Anual ${detectedAno}`).trim(),
              tipo: String(tipo || 'anual').trim(),
              ano: detectedAno,
              mes: String(mes || `Ano Todo / ${detectedAno}`).trim(),
              dataInicio: String(dataInicio || `${detectedAno}-01-01`).trim(),
              dataFim: String(dataFim || `${detectedAno}-12-31`).trim(),
              descricao: String(descricao || '').trim(),
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
            return res.end(JSON.stringify({
              success: true,
              message: `Plano "${newPlan.title}" criado e ativado com sucesso!`,
              plan: newPlan,
              activePlanId: newPlanId,
              equipments: newPlan.equipments,
              activeSheetName: hospital.activeSheetName
            }));
          }

          // Update plan metadata
          if (req.url === '/api/plans/update' && req.method === 'POST') {
            const { hospitalId, planId, title, mes, ano, tipo, dataInicio, dataFim, descricao } = parsedBody;
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);
            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
            }
            const hospital = db.hospitals[hospIdx];
            const plan = (hospital.plans || []).find(p => p.id === planId);
            if (!plan) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Planejamento não encontrado' }));
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
            return res.end(JSON.stringify({
              success: true,
              message: 'Plano atualizado com sucesso.',
              plan
            }));
          }

          // Create equipment in plan
          if (req.url === '/api/equipment/create' && req.method === 'POST') {
            const { hospitalId, planId, equipment, userEmail, userName } = parsedBody;
            if (!equipment) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Dados do equipamento não fornecidos.' }));
            }
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);
            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
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
            if (hospital.activePlanId === targetPlan.id || hospital.plans.length === 1) {
              hospital.equipments = targetPlan.equipments;
              hospital.activeSheetName = targetPlan.fileName || targetPlan.title;
            }
            const inspectorLabel = userName ? `${userName} (${userEmail})` : (userEmail || 'Sistema');
            hospital.lastUpdated = Date.now();
            hospital.lastUpdatedBy = inspectorLabel;
            db.lastUpdated = Date.now();
            saveDb(db);
            return res.end(JSON.stringify({
              success: true,
              message: `Equipamento "${finalEq.equipamento}" cadastrado com sucesso no plano "${targetPlan.title}"!`,
              equipment: finalEq,
              planId: targetPlan.id,
              planTitle: targetPlan.title,
              equipments: hospital.equipments
            }));
          }

          // Batch add equipments to plan (via Excel or Paste)
          if (req.url === '/api/equipment/batch-create' && req.method === 'POST') {
            const { hospitalId, planId, equipments, skipDuplicates = true, userEmail, userName } = parsedBody;
            if (!Array.isArray(equipments) || equipments.length === 0) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Nenhum equipamento enviado.' }));
            }
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);
            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
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
                  return;
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
            return res.end(JSON.stringify({
              success: true,
              message: `${addedEquipments.length} equipamentos adicionados ao plano "${targetPlan.title}"!`,
              addedCount: addedEquipments.length,
              totalCount: targetPlan.equipments.length,
              equipments: hospital.equipments,
              planId: targetPlan.id,
              planTitle: targetPlan.title
            }));
          }

          // Delete monthly plan
          if (req.url === '/api/plans/delete' && req.method === 'POST') {
            const { hospitalId, planId } = parsedBody;
            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);
            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado' }));
            }
            const hospital = db.hospitals[hospIdx];
            if ((hospital.plans || []).length <= 1) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Não é possível excluir o único planejamento.' }));
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
            return res.end(JSON.stringify({
              success: true,
              message: 'Excluído com sucesso',
              activePlanId: hospital.activePlanId,
              equipments: hospital.equipments,
              activeSheetName: hospital.activeSheetName
            }));
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

          // Batch Check
          if (req.url === '/api/batch-check' && req.method === 'POST') {
            const { ids, hospitalId, userEmail, userName } = parsedBody;
            if (!Array.isArray(ids) || ids.length === 0) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Nenhum equipamento informado para checagem em lote.' }));
            }

            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado.' }));
            }

            const label = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Usuário');
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
                list[i] = {
                  ...item,
                  checado: true,
                  dataCheck: nowIso,
                  conferidoPor: label
                };
                checkedCount++;
              }
            }

            db.hospitals[hospIdx].equipments = list;
            db.hospitals[hospIdx].lastUpdated = Date.now();
            db.hospitals[hospIdx].lastUpdatedBy = label;
            db.lastUpdated = Date.now();
            saveDb(db);

            return res.end(JSON.stringify({
              success: true,
              message: `${checkedCount} equipamentos conferidos com sucesso!`,
              checkedCount,
              equipments: list,
              lastUpdated: db.lastUpdated,
              lastUpdatedBy: label
            }));
          }

          // Mass Check: check_all or uncheck_all with PIN
          if (req.url === '/api/mass-check' && req.method === 'POST') {
            const { action, password, hospitalId, userEmail, userName } = parsedBody;
            const MASTER_PIN = '1234';
            const cleanPass = String(password || '').trim();
            const users = readUsers();
            const isValidPass = cleanPass === MASTER_PIN || users.some(u => u.password === cleanPass);

            if (!isValidPass) {
              res.statusCode = 401;
              return res.end(JSON.stringify({
                success: false,
                message: 'Senha de segurança incorreta. A senha padrão para ações em massa é 1234.'
              }));
            }

            if (action !== 'check_all' && action !== 'uncheck_all') {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, message: 'Ação inválida. Use check_all ou uncheck_all.' }));
            }

            const db = readDb();
            const targetId = hospitalId || db.activeHospitalId || db.hospitals?.[0]?.id;
            const hospIdx = (db.hospitals || []).findIndex(h => h.id === targetId);

            if (hospIdx === -1) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ success: false, message: 'Hospital não encontrado.' }));
            }

            const inspectorLabel = userName ? `${userName} (${userEmail || ''})` : (userEmail || 'Operador');
            const nowIso = new Date().toISOString();
            const list = db.hospitals[hospIdx].equipments || [];

            if (action === 'check_all') {
              for (let i = 0; i < list.length; i++) {
                list[i] = {
                  ...list[i],
                  checado: true,
                  dataCheck: list[i].dataCheck || nowIso,
                  conferidoPor: list[i].conferidoPor || inspectorLabel
                };
              }
            } else {
              for (let i = 0; i < list.length; i++) {
                list[i] = {
                  ...list[i],
                  checado: false,
                  dataCheck: null,
                  conferidoPor: null
                };
              }
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

            return res.end(JSON.stringify({
              success: true,
              message: action === 'check_all' ? `Todos os ${list.length} equipamentos foram marcados como checados!` : `Todos os ${list.length} equipamentos foram desmarcados.`,
              action,
              count: list.length,
              equipments: list,
              lastUpdated: db.lastUpdated
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

          // PDF text extraction route for calibration reports & equipment lists
          if (req.url === '/api/parse-pdf-calibrations' && req.method === 'POST') {
            try {
              const { pdfBase64 } = parsedBody || {};
              if (!pdfBase64) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, message: 'Arquivo PDF não fornecido.' }));
              }
              const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '');
              const buffer = Buffer.from(cleanBase64, 'base64');
              const parser = new PDFParse({ data: buffer });
              const textResult = await parser.getText();
              const fullText = typeof textResult === 'string' ? textResult : (textResult?.text || '');
              const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
              return res.end(JSON.stringify({
                success: true,
                text: fullText,
                lines,
                totalLines: lines.length
              }));
            } catch (err) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ success: false, message: 'Erro ao processar o arquivo PDF: ' + err.message }));
            }
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
          ocr: ['tesseract.js'],
        },
      },
    },
  },
});
