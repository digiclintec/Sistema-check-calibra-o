/**
 * Código do Google Apps Script para Sincronização Bidirecional com CalibraCheck.
 * Permite que a planilha do Google receba e marque IDECs conferidos em tempo real.
 * 
 * SCRIPT UNIVERSAL: Funciona para qualquer planilha, hospital ou plano anual!
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * CALIBRACHECK - AGENTE DE INTEGRAÇÃO UNIVERSAL EM TEMPO REAL
 * ==============================================================================
 * 🌟 ESTE SCRIPT É UNIVERSAL:
 * - Funciona para QUALQUER planilha do Google e QUALQUER plano de calibração!
 * - Você só precisa criar este Webhook UMA ÚNICA VEZ e pode usar a mesma URL
 *   em todos os seus planos e hospitais no CalibraCheck!
 *
 * Como instalar em 30 segundos (SEM PRECISAR ABRIR PELO MENU DA PLANILHA):
 * 1. Abra uma nova aba no navegador e acesse: https://script.new
 * 2. Apague qualquer código na tela e cole todo este arquivo.
 * 3. Clique no ícone de salvar (Disquete 💾) ou Ctrl+S.
 * 4. No canto superior direito, clique em "Implantar" > "Nova implantação".
 *    (OBS: Se já tiver implantado antes, clique em "Gerenciar implantações" > "Editar (Lápis)" > "Versão: Nova versão" > "Implantar").
 * 5. Clique no ícone de engrenagem ⚙️ (ao lado de Selecione o tipo) e escolha "App da Web".
 * 6. Preencha:
 *    - Descrição: "CalibraCheck Universal Sync"
 *    - Executar como: "Eu (seu email)"
 *    - Quem pode acessar: "Qualquer pessoa" (MUITO IMPORTANTE!)
 * 7. Clique em "Implantar" e copie o link da URL do App da Web (termina em /exec).
 * 8. Cole o link no CalibraCheck na aba "Gravação no Google Sheets"!
 * ==============================================================================
 */

// Planilha padrão de fallback (caso o sistema não envie o ID no payload)
var DEFAULT_SPREADSHEET_ID = "1Wn6I7f3hdxVeVWg7lsmKkbo8BRXrnv-8sJ6-3ydUi6Q";

function extractSpreadsheetId(url) {
  if (!url || typeof url !== 'string') return null;
  var match = url.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/) ||
              url.match(/\\/file\\/d\\/([a-zA-Z0-9-_]+)/) ||
              url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getSpreadsheet(payload) {
  var targetId = (payload && (payload.spreadsheetId || (payload.spreadsheetUrl ? extractSpreadsheetId(payload.spreadsheetUrl) : null))) || DEFAULT_SPREADSHEET_ID;
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
    return SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
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

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    if (values.length < 1) {
      return responseJson({ success: false, message: "Planilha vazia" });
    }

    // Localiza a linha correta de cabeçalhos (busca linha com 'Tag' ou 'IDEC' ou 'Código' ou 'Série')
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

      if (colCalibStatus === -1 && (h.indexOf('calibracao - status') !== -1 || (h.indexOf('calibracao') !== -1 && h.indexOf('status') !== -1))) colCalibStatus = c;
      if (colCalibData === -1 && (h.indexOf('calibracao - data') !== -1 || (h.indexOf('calibracao') !== -1 && h.indexOf('data') !== -1))) colCalibData = c;
      if (colCalibResp === -1 && (h.indexOf('calibracao - resp') !== -1 || (h.indexOf('calibracao') !== -1 && h.indexOf('resp') !== -1))) colCalibResp = c;

      if (colPrevStatus === -1 && h.indexOf('preventiva - status') !== -1) colPrevStatus = c;
      if (colPrevData === -1 && h.indexOf('preventiva - data') !== -1) colPrevData = c;
      if (colPrevResp === -1 && h.indexOf('preventiva - resp') !== -1) colPrevResp = c;

      if (colSegStatus === -1 && (h.indexOf('seg. eletrica - status') !== -1 || h.indexOf('seguranca - status') !== -1)) colSegStatus = c;
      if (colSegData === -1 && (h.indexOf('seg. eletrica - data') !== -1 || h.indexOf('seguranca - data') !== -1)) colSegData = c;
      if (colSegResp === -1 && (h.indexOf('seg. eletrica - resp') !== -1 || h.indexOf('seguranca - resp') !== -1)) colSegResp = c;

      if (colExtStatus === -1 && (h.indexOf('manut. externa - status') !== -1 || h.indexOf('externa - status') !== -1)) colExtStatus = c;
      if (colExtData === -1 && (h.indexOf('manut. externa - data') !== -1 || h.indexOf('externa - data') !== -1)) colExtData = c;
      if (colExtResp === -1 && (h.indexOf('manut. externa - resp') !== -1 || h.indexOf('externa - resp') !== -1)) colExtResp = c;

      if (colStatusGeral === -1 && (h.indexOf('status geral') !== -1 || h === 'status')) colStatusGeral = c;
    }

    // Garante que regras de formatação condicional existentes não sobrescrevam o verde de CONFERIDO
    if (colCalibStatus !== -1) ensureConditionalFormattingGreen(sheet, colCalibStatus + 1);
    if (colPrevStatus !== -1) ensureConditionalFormattingGreen(sheet, colPrevStatus + 1);
    if (colSegStatus !== -1) ensureConditionalFormattingGreen(sheet, colSegStatus + 1);

    // Se a planilha não possuir colunas de calibração, cria automaticamente
    if (colCalibStatus === -1) {
      colCalibStatus = headers.length;
      sheet.getRange(headerRowIdx + 1, colCalibStatus + 1).setValue("CALIBRAÇÃO - Status");
      headers.push("calibracao - status");
    }
    if (colCalibData === -1) {
      colCalibData = headers.length;
      sheet.getRange(headerRowIdx + 1, colCalibData + 1).setValue("CALIBRAÇÃO - Data/Hora");
      headers.push("calibracao - data/hora");
    }
    if (colCalibResp === -1) {
      colCalibResp = headers.length;
      sheet.getRange(headerRowIdx + 1, colCalibResp + 1).setValue("CALIBRAÇÃO - Responsável");
      headers.push("calibracao - responsavel");
    }

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
          var modality = item.modality || 'calibracao';
          var userText = isChecked ? (item.user || item.userName || 'Técnico CalibraCheck') : '';
          var dateText = isChecked ? (item.dataCheck ? formatDateString(item.dataCheck) : nowFmt) : '';

          if (modality === 'calibracao' || !modality) {
            if (colCalibStatus !== -1) {
              sheet.getRange(r + 1, colCalibStatus + 1)
                   .setValue(isChecked ? 'CONFERIDO / OK' : 'PENDENTE')
                   .setBackground(isChecked ? '#E6F4EA' : '#FCE8E6')
                   .setFontColor(isChecked ? '#137333' : '#C5221F')
                   .setFontWeight(isChecked ? 'bold' : 'normal');
            }
            if (colCalibData !== -1) {
              sheet.getRange(r + 1, colCalibData + 1).setValue(dateText).setBackground('#FFFFFF').setFontColor('#202124');
            }
            if (colCalibResp !== -1) {
              sheet.getRange(r + 1, colCalibResp + 1).setValue(userText).setBackground('#FFFFFF').setFontColor('#202124');
            }
          } else if (modality === 'preventiva') {
            if (colPrevStatus !== -1) {
              sheet.getRange(r + 1, colPrevStatus + 1)
                   .setValue(isChecked ? 'CONFERIDO / OK' : 'PENDENTE')
                   .setBackground(isChecked ? '#E6F4EA' : '#FCE8E6')
                   .setFontColor(isChecked ? '#137333' : '#C5221F')
                   .setFontWeight(isChecked ? 'bold' : 'normal');
            }
            if (colPrevData !== -1) sheet.getRange(r + 1, colPrevData + 1).setValue(dateText).setBackground('#FFFFFF').setFontColor('#202124');
            if (colPrevResp !== -1) sheet.getRange(r + 1, colPrevResp + 1).setValue(userText).setBackground('#FFFFFF').setFontColor('#202124');
          } else if (modality === 'seguranca') {
            if (colSegStatus !== -1) {
              sheet.getRange(r + 1, colSegStatus + 1)
                   .setValue(isChecked ? 'CONFERIDO / OK' : 'PENDENTE')
                   .setBackground(isChecked ? '#E6F4EA' : '#FCE8E6')
                   .setFontColor(isChecked ? '#137333' : '#C5221F')
                   .setFontWeight(isChecked ? 'bold' : 'normal');
            }
            if (colSegData !== -1) sheet.getRange(r + 1, colSegData + 1).setValue(dateText).setBackground('#FFFFFF').setFontColor('#202124');
            if (colSegResp !== -1) sheet.getRange(r + 1, colSegResp + 1).setValue(userText).setBackground('#FFFFFF').setFontColor('#202124');
          } else if (modality === 'externa' || modality === 'manutencao_externa') {
            if (colExtStatus !== -1) {
              sheet.getRange(r + 1, colExtStatus + 1)
                   .setValue(isChecked ? 'ENVIADA / TERCEIRIZADA' : 'NÃO ENVIADA')
                   .setBackground(isChecked ? '#FEF7E0' : '#FCE8E6')
                   .setFontColor(isChecked ? '#B06000' : '#C5221F')
                   .setFontWeight(isChecked ? 'bold' : 'normal');
            }
            if (colExtData !== -1) sheet.getRange(r + 1, colExtData + 1).setValue(dateText).setBackground('#FFFFFF').setFontColor('#202124');
            if (colExtResp !== -1) sheet.getRange(r + 1, colExtResp + 1).setValue(userText).setBackground('#FFFFFF').setFontColor('#202124');
          }

          if (colSetorRetirada !== -1 && item.setorRetirada) {
            sheet.getRange(r + 1, colSetorRetirada + 1).setValue(String(item.setorRetirada)).setBackground('#FFFFFF');
          }

          if (colStatusGeral !== -1) {
            sheet.getRange(r + 1, colStatusGeral + 1)
                 .setValue(isChecked ? '100% CONCLUÍDO' : 'PENDENTE')
                 .setBackground(isChecked ? '#CEEAD6' : '#FCE8E6')
                 .setFontColor(isChecked ? '#0D652D' : '#C5221F')
                 .setFontWeight(isChecked ? 'bold' : 'normal');
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

function ensureConditionalFormattingGreen(sheet, colIndex) {
  if (!sheet || colIndex <= 0) return;
  try {
    var rules = sheet.getConditionalFormatRules() || [];
    var alreadyHasGreen = false;
    for (var i = 0; i < rules.length; i++) {
      var cond = rules[i].getBooleanCondition();
      if (cond && String(cond.getCriteriaValues()).toUpperCase().indexOf('CONFERIDO') !== -1) {
        alreadyHasGreen = true;
        break;
      }
    }
    if (!alreadyHasGreen) {
      var numRows = Math.max(20, sheet.getLastRow());
      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('CONFERIDO')
        .setBackground('#E6F4EA')
        .setFontColor('#137333')
        .setBold(true)
        .setRanges([sheet.getRange(2, colIndex, numRows, 1)])
        .build();
      rules.push(rule);
      sheet.setConditionalFormatRules(rules);
    }
  } catch (eCond) {}
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
