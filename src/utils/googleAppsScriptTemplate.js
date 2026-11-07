/**
 * Código do Google Apps Script para Sincronização Bidirecional com CalibraCheck.
 * Permite que a planilha do Google receba e marque IDECs conferidos em tempo real.
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * CALIBRACHECK - SCRIPT DE INTEGRAÇÃO BIDIRECIONAL GOOGLE SHEETS
 * ==============================================================================
 * Como instalar em 30 segundos:
 * 1. Na sua planilha aberta no Google Sheets, clique em: Extensões > Apps Script
 * 2. Apague qualquer código existente no editor e cole todo este arquivo.
 * 3. Clique no ícone de salvar (Disquete) ou Ctrl+S.
 * 4. No canto superior direito, clique em "Implantar" > "Nova implantação".
 * 5. Clique no ícone de engrenagem ⚙️ ao lado de "Selecione o tipo" e escolha "App da Web".
 * 6. Preencha:
 *    - Descrição: "CalibraCheck Sync"
 *    - Executar como: "Eu (seu email)"
 *    - Quem pode acessar: "Qualquer pessoa" (MUITO IMPORTANTE!)
 * 7. Clique em "Implantar" e copie o link da URL do App da Web (termina em /exec).
 * 8. Cole o link no CalibraCheck na aba "Gravação no Google Sheets"!
 * ==============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Evita conflitos se vários técnicos biparem ao mesmo tempo
    lock.waitLock(10000);

    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ success: false, message: "Payload vazio" });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'check';

    if (action === 'ping') {
      return responseJson({
        success: true,
        message: "Conexão com Google Sheets validada com sucesso!",
        spreadsheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
        timestamp: new Date().toISOString()
      });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = payload.sheetName ? ss.getSheetByName(payload.sheetName) : ss.getActiveSheet();
    if (!sheet) sheet = ss.getSheets()[0];

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    if (values.length < 1) {
      return responseJson({ success: false, message: "Planilha vazia" });
    }

    var headers = values[0].map(function(h) { 
      return String(h || '').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); 
    });

    // Mapeamento dinâmico de colunas
    var colIdec = -1;
    var colTag = -1;
    var colSerie = -1;
    var colStatus = -1;
    var colData = -1;
    var colResp = -1;
    var colSetorRetirada = -1;

    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      if (colIdec === -1 && (h === 'idec' || h.indexOf('idec') !== -1 || h === 'codigo' || h.indexOf('codigo de barras') !== -1 || h === 'id' || h.indexOf('patrimonio') !== -1)) colIdec = c;
      if (colTag === -1 && (h === 'tag' || h.indexOf('tag') !== -1 || h.indexOf('identificacao') !== -1 || h.indexOf('identifica') !== -1)) colTag = c;
      if (colSerie === -1 && (h === 'serie' || h.indexOf('serie') !== -1 || h.indexOf('serial') !== -1 || h === 'sn' || h.indexOf('n serie') !== -1)) colSerie = c;

      if (colStatus === -1 && (h.indexOf('status') !== -1 || h.indexOf('calibracao') !== -1 || h.indexOf('checado') !== -1 || h.indexOf('conferido') !== -1 || h.indexOf('situacao') !== -1)) colStatus = c;
      if (colData === -1 && h.indexOf('data') !== -1 && (h.indexOf('check') !== -1 || h.indexOf('conf') !== -1 || h.indexOf('calib') !== -1 || h.indexOf('realiz') !== -1)) colData = c;
      if (colResp === -1 && (h.indexOf('tecnico') !== -1 || h.indexOf('responsavel') !== -1 || h.indexOf('conferido por') !== -1 || h.indexOf('usuario') !== -1)) colResp = c;
      if (colSetorRetirada === -1 && (h.indexOf('retirada') !== -1 || h.indexOf('coleta') !== -1 || h.indexOf('setor retirada') !== -1)) colSetorRetirada = c;
    }

    // Se não existirem colunas específicas de status, cria automaticamente no final
    if (colStatus === -1) {
      colStatus = headers.length;
      sheet.getRange(1, colStatus + 1).setValue("STATUS CALIBRAÇÃO (CALIBRACHECK)");
      headers.push("status calibracao");
    }
    if (colData === -1) {
      colData = headers.length;
      sheet.getRange(1, colData + 1).setValue("DATA CONFERÊNCIA");
      headers.push("data conferencia");
    }
    if (colResp === -1) {
      colResp = headers.length;
      sheet.getRange(1, colResp + 1).setValue("TÉCNICO RESPONSÁVEL");
      headers.push("tecnico responsavel");
    }

    var items = [];
    if (Array.isArray(payload.items) && payload.items.length > 0) {
      items = payload.items;
    } else {
      items = [payload];
    }

    var updatedCount = 0;
    var nowFmt = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm");

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var searchKeys = [
        item.idec,
        item.codigoBarras,
        item.tag,
        item.serie,
        item.id
      ].filter(Boolean).map(function(k) {
        return String(k).trim().toLowerCase();
      });

      if (searchKeys.length === 0) continue;

      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        var isMatch = false;

        // Compara por coluna específica primeiro
        if (colIdec !== -1 && searchKeys.indexOf(String(row[colIdec]).trim().toLowerCase()) !== -1) isMatch = true;
        if (!isMatch && colTag !== -1 && searchKeys.indexOf(String(row[colTag]).trim().toLowerCase()) !== -1) isMatch = true;
        if (!isMatch && colSerie !== -1 && searchKeys.indexOf(String(row[colSerie]).trim().toLowerCase()) !== -1) isMatch = true;

        // Fallback: varre todas as células da linha
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
          var statusText = isChecked ? (item.statusText || 'CONFERIDO / CALIBRADO') : '';
          var dateText = isChecked ? (item.dataCheck ? formatDateString(item.dataCheck) : nowFmt) : '';
          var userText = isChecked ? (item.user || item.userName || 'Técnico CalibraCheck') : '';

          sheet.getRange(r + 1, colStatus + 1).setValue(statusText);
          sheet.getRange(r + 1, colData + 1).setValue(dateText);
          sheet.getRange(r + 1, colResp + 1).setValue(userText);

          if (colSetorRetirada !== -1 && item.setorRetirada) {
            sheet.getRange(r + 1, colSetorRetirada + 1).setValue(String(item.setorRetirada));
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
      message: updatedCount + " equipamento(s) atualizado(s) na planilha Google!"
    });

  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var action = (e && e.parameter && e.parameter.action) || 'ping';

    if (action === 'export_csv') {
      var data = sheet.getDataRange().getValues();
      var csv = data.map(function(row) {
        return row.map(function(cell) {
          var str = String(cell == null ? '' : cell).replace(/"/g, '""');
          return '"' + str + '"';
        }).join(',');
      }).join('\\r\\n');
      return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
    }

    return responseJson({
      status: 'online',
      service: 'CalibraCheck Google Sheets Webhook',
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      rows: sheet.getLastRow(),
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
      return Utilities.formatDate(d, "GMT-3", "dd/MM/yyyy HH:mm");
    }
  } catch (e) {}
  return String(isoOrStr);
}

function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
