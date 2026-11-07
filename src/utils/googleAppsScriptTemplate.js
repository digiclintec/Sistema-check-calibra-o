/**
 * Código do Google Apps Script para Sincronização Bidirecional com CalibraCheck.
 * Permite que a planilha do Google receba e marque IDECs conferidos em tempo real.
 * 
 * SCRIPT UNIVERSAL E PADRONIZADO:
 * - Funciona para QUALQUER planilha, hospital ou plano anual!
 * - Cores oficiais 100% padronizadas: CONFERIDO / OK em Verde (#E6F4EA / #137333) e PENDENTE em Rosa/Vermelho (#FCE8E6 / #C5221F).
 * - Suporta "Pacote Completo / Tudo de Uma Vez" (Calibração + Preventiva + TSE / Segurança Elétrica).
 * - Função embutida para padronizar e corrigir cores de planilhas antigas com 1 clique!
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * CALIBRACHECK - AGENTE DE INTEGRAÇÃO UNIVERSAL EM TEMPO REAL
 * ==============================================================================
 * 🌟 SCRIPT UNIVERSAL E PADRONIZADO:
 * - Funciona para QUALQUER planilha do Google e QUALQUER plano de calibração!
 * - Carimba Calibração, Preventiva e TSE (Segurança Elétrica) juntos ou separados.
 * - Cores padronizadas: CONFERIDO / OK em Verde Esmeralda e PENDENTE em Rosa/Vermelho.
 * - Você só precisa implantar este Webhook UMA ÚNICA VEZ na sua conta!
 *
 * Como instalar ou atualizar em 30 segundos:
 * 1. Abra uma nova aba no navegador e acesse: https://script.new
 * 2. Apague qualquer código na tela e cole todo este arquivo.
 * 3. Clique no ícone de salvar (Disquete 💾) ou Ctrl+S.
 * 4. No canto superior direito, clique em "Implantar" > "Nova implantação".
 *    (OBS: Se já tiver implantado antes, clique em "Gerenciar implantações" > "Editar (Lápis ✏️)" > "Versão: Nova versão" > "Implantar").
 * 5. Se for nova implantação, clique na engrenagem ⚙️ e escolha "App da Web".
 * 6. Preencha:
 *    - Descrição: "CalibraCheck Universal Sync"
 *    - Executar como: "Eu (seu email)" (MANTENHA COMO VOCÊ!)
 *    - Quem pode acessar: "Qualquer pessoa" (MUITO IMPORTANTE!)
 * 7. Clique em "Implantar" e copie a URL do App da Web (termina em /exec).
 * 8. Cole o link no CalibraCheck na aba "Gravação no Google Sheets"!
 * ==============================================================================
 */

// Planilha padrão de fallback
var DEFAULT_SPREADSHEET_ID = "1Wn6I7f3hdxVeVWg7lsmKkbo8BRXrnv-8sJ6-3ydUi6Q";

function getFallbackSpreadsheetId() {
  try {
    if (typeof DEFAULT_SPREADSHEET_ID !== 'undefined' && DEFAULT_SPREADSHEET_ID) {
      return DEFAULT_SPREADSHEET_ID;
    }
  } catch (e) {}
  return "1Wn6I7f3hdxVeVWg7lsmKkbo8BRXrnv-8sJ6-3ydUi6Q";
}

function extractSpreadsheetId(url) {
  if (!url || typeof url !== 'string') return null;
  var match = url.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/) ||
              url.match(/\\/file\\/d\\/([a-zA-Z0-9-_]+)/) ||
              url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getSpreadsheet(payload) {
  var fallbackId = getFallbackSpreadsheetId();
  var targetId = (payload && (payload.spreadsheetId || (payload.spreadsheetUrl ? extractSpreadsheetId(payload.spreadsheetUrl) : null))) || fallbackId;
  if (targetId) {
    try {
      return SpreadsheetApp.openById(targetId);
    } catch (err) {}
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err2) {}
  try {
    return SpreadsheetApp.openById(fallbackId);
  } catch (err3) {
    return null;
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Evita conflitos de concorrência se vários técnicos biparem ao mesmo tempo
    lock.waitLock(10000);

    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ success: false, message: "Payload vazio" });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'check';
    var ss = getSpreadsheet(payload);

    var sheetTitle = "Planilha Google";
    try {
      if (ss) sheetTitle = ss.getName();
    } catch (eTitle) {}

    // 1. AÇÃO PING / TESTE DE CONEXÃO
    if (action === 'ping') {
      return responseJson({
        success: true,
        message: "Agente conectado com sucesso!",
        spreadsheetTitle: sheetTitle,
        timestamp: new Date().toISOString()
      });
    }

    if (!ss) {
      return responseJson({ success: false, message: "Planilha não encontrada. Verifique se o ID ou URL foi informado." });
    }

    var sheet = payload.sheetName ? ss.getSheetByName(payload.sheetName) : (ss.getActiveSheet() || ss.getSheets()[0]);
    if (!sheet) sheet = ss.getSheets()[0];

    // 2. AÇÃO PADRONIZAR CORES DE TODA A PLANILHA (Corrige linhas antigas)
    if (action === 'padronizar' || action === 'format_all') {
      var count = executarPadronizacaoCores(sheet);
      return responseJson({
        success: true,
        message: "Todas as " + count + " linhas da planilha foram padronizadas com verde oficial!",
        count: count
      });
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    if (values.length < 1) {
      return responseJson({ success: false, message: "Planilha vazia" });
    }

    // Localiza a linha correta de cabeçalhos
    var headerRowIdx = -1;
    for (var r = 0; r < Math.min(10, values.length); r++) {
      var rowStr = values[r].map(function(c) { return String(c || '').toLowerCase(); }).join(' ');
      if (rowStr.indexOf('tag') !== -1 || rowStr.indexOf('idec') !== -1 || rowStr.indexOf('código') !== -1 || rowStr.indexOf('serie') !== -1) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) headerRowIdx = 0;

    var headers = values[headerRowIdx].map(function(h) { 
      return String(h || '').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); 
    });

    // Mapeamento dinâmico de colunas na planilha
    var colBarcode = -1;
    var colTag = -1;
    var colSerie = -1;
    var colSetorRetirada = -1;

    var colCalibStatus = -1;
    var colCalibData = -1;
    var colCalibResp = -1;

    var colPrevStatus = -1;
    var colPrevData = -1;
    var colPrevResp = -1;

    var colSegStatus = -1;
    var colSegData = -1;
    var colSegResp = -1;

    var colExtStatus = -1;
    var colExtData = -1;
    var colExtResp = -1;

    var colStatusGeral = -1;

    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      if (colBarcode === -1 && (h.indexOf('codigo de barras') !== -1 || h === 'codigo')) colBarcode = c;
      if (colTag === -1 && (h.indexOf('tag') !== -1 || h.indexOf('idec') !== -1)) colTag = c;
      if (colSerie === -1 && (h.indexOf('serie') !== -1 || h.indexOf('serial') !== -1 || h === 'sn')) colSerie = c;
      if (colSetorRetirada === -1 && (h.indexOf('setor retirada') !== -1 || h.indexOf('retirada') !== -1)) colSetorRetirada = c;

      // Calibração
      if (colCalibStatus === -1 && (h.indexOf('calibracao - status') !== -1 || (h.indexOf('calibracao') !== -1 && h.indexOf('status') !== -1))) colCalibStatus = c;
      if (colCalibData === -1 && (h.indexOf('calibracao - data') !== -1 || (h.indexOf('calibracao') !== -1 && h.indexOf('data') !== -1))) colCalibData = c;
      if (colCalibResp === -1 && (h.indexOf('calibracao - resp') !== -1 || (h.indexOf('calibracao') !== -1 && h.indexOf('resp') !== -1))) colCalibResp = c;

      // Preventiva
      if (colPrevStatus === -1 && (h.indexOf('preventiva - status') !== -1 || (h.indexOf('preventiva') !== -1 && h.indexOf('status') !== -1))) colPrevStatus = c;
      if (colPrevData === -1 && (h.indexOf('preventiva - data') !== -1 || (h.indexOf('preventiva') !== -1 && h.indexOf('data') !== -1))) colPrevData = c;
      if (colPrevResp === -1 && (h.indexOf('preventiva - resp') !== -1 || (h.indexOf('preventiva') !== -1 && h.indexOf('resp') !== -1))) colPrevResp = c;

      // Segurança Elétrica / TSE
      if (colSegStatus === -1 && (h.indexOf('seg. eletrica - status') !== -1 || h.indexOf('seguranca - status') !== -1 || h.indexOf('tse - status') !== -1 || (h.indexOf('seg') !== -1 && h.indexOf('status') !== -1) || h.indexOf('tse') !== -1)) colSegStatus = c;
      if (colSegData === -1 && (h.indexOf('seg. eletrica - data') !== -1 || h.indexOf('seguranca - data') !== -1 || h.indexOf('tse - data') !== -1 || (h.indexOf('seg') !== -1 && h.indexOf('data') !== -1))) colSegData = c;
      if (colSegResp === -1 && (h.indexOf('seg. eletrica - resp') !== -1 || h.indexOf('seguranca - resp') !== -1 || h.indexOf('tse - resp') !== -1 || (h.indexOf('seg') !== -1 && h.indexOf('resp') !== -1))) colSegResp = c;

      // Manutenção Externa
      if (colExtStatus === -1 && (h.indexOf('manut. externa - status') !== -1 || h.indexOf('externa - status') !== -1)) colExtStatus = c;
      if (colExtData === -1 && (h.indexOf('manut. externa - data') !== -1 || h.indexOf('externa - data') !== -1)) colExtData = c;
      if (colExtResp === -1 && (h.indexOf('manut. externa - resp') !== -1 || h.indexOf('externa - resp') !== -1)) colExtResp = c;

      // Status Geral
      if (colStatusGeral === -1 && (h.indexOf('status geral') !== -1 || h === 'status')) colStatusGeral = c;
    }

    // Garante que regras de formatação condicional existentes fiquem com Verde prioritário
    ensureConditionalFormattingRules(sheet, [colCalibStatus + 1, colPrevStatus + 1, colSegStatus + 1]);

    var items = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : [payload];
    var updatedCount = 0;
    var nowFmt = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy, HH:mm:ss");

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var searchKeys = [
        item.idec,
        item.tag,
        item.serie,
        item.codigoBarras,
        item.id
      ].filter(Boolean).map(function(k) { return String(k).trim().toLowerCase(); });

      if (searchKeys.length === 0) continue;

      for (var r = headerRowIdx + 1; r < values.length; r++) {
        var row = values[r];
        var isMatch = false;

        if (colTag !== -1 && searchKeys.indexOf(String(row[colTag]).trim().toLowerCase()) !== -1) isMatch = true;
        if (!isMatch && colBarcode !== -1 && searchKeys.indexOf(String(row[colBarcode]).trim().toLowerCase()) !== -1) isMatch = true;
        if (!isMatch && colSerie !== -1 && searchKeys.indexOf(String(row[colSerie]).trim().toLowerCase()) !== -1) isMatch = true;

        if (!isMatch) {
          for (var c = 0; c < row.length; c++) {
            if (searchKeys.indexOf(String(row[c]).trim().toLowerCase()) !== -1) {
              isMatch = true;
              break;
            }
          }
        }

        if (isMatch) {
          var isChecked = Boolean(item.checked);
          var userText = isChecked ? (item.user || item.userName || 'Técnico CalibraCheck') : '';
          var dateText = isChecked ? (item.dataCheck ? formatDateString(item.dataCheck) : nowFmt) : '';

          // Determina as modalidades a serem atualizadas (suporta Tudo de Uma Vez)
          var targetModalities = [];
          if (Array.isArray(item.modalities) && item.modalities.length > 0) {
            targetModalities = item.modalities;
          } else if (item.modality === 'all' || item.modality === 'todos' || item.modality === 'all_at_once' || item.modality === 'geral' || !item.modality) {
            targetModalities = ['calibracao', 'preventiva', 'seguranca'];
          } else {
            targetModalities = [item.modality];
          }

          // Função para aplicar formatação padronizada e imutável
          function applyStatusFormat(colIdx, checked) {
            if (colIdx === -1) return;
            sheet.getRange(r + 1, colIdx + 1)
                 .setValue(checked ? 'CONFERIDO / OK' : 'PENDENTE')
                 .setBackground(checked ? '#E6F4EA' : '#FCE8E6')
                 .setFontColor(checked ? '#137333' : '#C5221F')
                 .setFontWeight('bold')
                 .setHorizontalAlignment('center');
          }

          function applyMetaFormat(colIdx, val) {
            if (colIdx === -1) return;
            sheet.getRange(r + 1, colIdx + 1)
                 .setValue(val || '')
                 .setBackground('#FFFFFF')
                 .setFontColor('#202124')
                 .setFontWeight('normal')
                 .setHorizontalAlignment('center');
          }

          // 1. Calibração
          if (targetModalities.indexOf('calibracao') !== -1) {
            applyStatusFormat(colCalibStatus, isChecked);
            applyMetaFormat(colCalibData, dateText);
            applyMetaFormat(colCalibResp, userText);
          }

          // 2. Preventiva
          if (targetModalities.indexOf('preventiva') !== -1) {
            applyStatusFormat(colPrevStatus, isChecked);
            applyMetaFormat(colPrevData, dateText);
            applyMetaFormat(colPrevResp, userText);
          }

          // 3. Segurança Elétrica / TSE
          if (targetModalities.indexOf('seguranca') !== -1 || targetModalities.indexOf('tse') !== -1) {
            applyStatusFormat(colSegStatus, isChecked);
            applyMetaFormat(colSegData, dateText);
            applyMetaFormat(colSegResp, userText);
          }

          // 4. Manutenção Externa Terceirizada
          if (targetModalities.indexOf('externa') !== -1 || targetModalities.indexOf('manutencao_externa') !== -1) {
            if (colExtStatus !== -1) {
              sheet.getRange(r + 1, colExtStatus + 1)
                   .setValue(isChecked ? 'ENVIADA / TERCEIRIZADA' : 'NÃO ENVIADA')
                   .setBackground(isChecked ? '#FEF7E0' : '#FCE8E6')
                   .setFontColor(isChecked ? '#B06000' : '#C5221F')
                   .setFontWeight('bold')
                   .setHorizontalAlignment('center');
            }
            applyMetaFormat(colExtData, dateText);
            applyMetaFormat(colExtResp, userText);
          }

          // 5. Setor de Retirada
          if (colSetorRetirada !== -1 && item.setorRetirada) {
            applyMetaFormat(colSetorRetirada, String(item.setorRetirada));
          }

          // 6. Status Geral Consolidado
          if (colStatusGeral !== -1) {
            sheet.getRange(r + 1, colStatusGeral + 1)
                 .setValue(isChecked ? '100% CONCLUÍDO' : 'PENDENTE')
                 .setBackground(isChecked ? '#CEEAD6' : '#FCE8E6')
                 .setFontColor(isChecked ? '#0D652D' : '#C5221F')
                 .setFontWeight('bold')
                 .setHorizontalAlignment('center');
          }

          updatedCount++;
          break;
        }
      }
    }

    SpreadsheetApp.flush();

    return responseJson({
      success: true,
      updatedCount: updatedCount,
      totalRequested: items.length,
      message: updatedCount + " equipamento(s) gravado(s) com sucesso na planilha Google!"
    });

  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Função utilitária para padronizar cores de TODAS as linhas da planilha de uma só vez.
 * Pode ser executada diretamente pelo Apps Script no menu Executar > padronizarCoresDaPlanilha.
 */
function padronizarCoresDaPlanilha() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e1) {}

  if (!ss) {
    try {
      var id = getFallbackSpreadsheetId();
      ss = SpreadsheetApp.openById(id);
    } catch (e2) {}
  }

  if (!ss) {
    Logger.log("Erro: Não foi possível abrir a planilha. Verifique se o ID está correto.");
    return;
  }

  var sheet = ss.getActiveSheet() || ss.getSheets()[0];
  var count = executarPadronizacaoCores(sheet);
  Logger.log("Padronização concluída: " + count + " linhas ajustadas com verde oficial!");
}

function executarPadronizacaoCores(sheet) {
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 0;

  var range = sheet.getRange(2, 1, lastRow - 1, lastCol);
  var values = range.getValues();
  var count = 0;

  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var val = String(values[r][c] || '').trim().toUpperCase();
      if (val.indexOf('CONFERIDO') !== -1 || val === 'OK' || val === 'CALIBRADO' || val === '100% CONCLUIDO' || val === '100% CONCLUÍDO') {
        sheet.getRange(r + 2, c + 1)
             .setBackground('#E6F4EA')
             .setFontColor('#137333')
             .setFontWeight('bold')
             .setHorizontalAlignment('center');
        count++;
      } else if (val === 'PENDENTE' || val === 'NAO CONFERIDO' || val === 'NÃO CONFERIDO') {
        sheet.getRange(r + 2, c + 1)
             .setBackground('#FCE8E6')
             .setFontColor('#C5221F')
             .setFontWeight('bold')
             .setHorizontalAlignment('center');
        count++;
      }
    }
  }
  SpreadsheetApp.flush();
  return count;
}

function ensureConditionalFormattingRules(sheet, colIndices) {
  if (!sheet || !colIndices || colIndices.length === 0) return;
  try {
    var validCols = colIndices.filter(function(c) { return c > 0; });
    if (validCols.length === 0) return;

    var numRows = Math.max(50, sheet.getLastRow());
    var ranges = validCols.map(function(c) {
      return sheet.getRange(2, c, numRows - 1, 1);
    });

    var existingRules = sheet.getConditionalFormatRules() || [];
    var filteredRules = existingRules.filter(function(r) {
      var cond = r.getBooleanCondition();
      if (!cond) return true;
      var str = String(cond.getCriteriaValues()).toUpperCase();
      return str.indexOf('CONFERIDO') === -1 && str.indexOf('PENDENTE') === -1;
    });

    // Regra 1: CONFERIDO / OK -> Verde Oficial #E6F4EA / #137333
    var greenRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('CONFERIDO')
      .setBackground('#E6F4EA')
      .setFontColor('#137333')
      .setBold(true)
      .setRanges(ranges)
      .build();

    // Regra 2: PENDENTE -> Rosa/Vermelho Oficial #FCE8E6 / #C5221F
    var redRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('PENDENTE')
      .setBackground('#FCE8E6')
      .setFontColor('#C5221F')
      .setBold(true)
      .setRanges(ranges)
      .build();

    filteredRules.unshift(redRule);
    filteredRules.unshift(greenRule);
    sheet.setConditionalFormatRules(filteredRules);
  } catch (eCond) {}
}

function doGet(e) {
  try {
    var ss = getSpreadsheet(e ? e.parameter : null);
    var sheetTitle = "Planilha Google";
    var rows = 0;
    try {
      if (ss) {
        sheetTitle = ss.getName();
        rows = ss.getActiveSheet().getLastRow();
      }
    } catch (e2) {}
    return responseJson({
      status: 'online',
      service: 'CalibraCheck Google Sheets Webhook Universal',
      spreadsheetName: sheetTitle,
      rows: rows,
      time: new Date().toISOString()
    });
  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

function formatDateString(isoOrStr) {
  try {
    var d = new Date(isoOrStr);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, "GMT-3", "dd/MM/yyyy, HH:mm:ss");
    }
  } catch (e) {}
  return String(isoOrStr);
}

function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
