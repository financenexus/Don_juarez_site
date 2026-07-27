/**
 * Backend da promoção Don Juarez × Roda Rico.
 * Cole este código em Extensões > Apps Script, dentro de uma Planilha Google.
 */

// Ativa imediatamente e encerra após 16 de agosto, no horário de São Paulo.
const CAMPAIGN_END_AT_EXCLUSIVE = Date.parse("2026-08-17T00:00:00-03:00");

// Distribui aleatoriamente 4 ingressos e 50 descontos entre 500 entradas.
const TOTAL_TICKET_PRIZES = 4;
const TOTAL_DISCOUNT_PRIZES = 50;
const MAX_ENTRIES = 500;
const SECRET_PROPERTY = "REDEMPTION_SECRET";
const SHEET_NAME = "Entradas";

function doPost(e) {
  const campaignStatus = getCampaignStatus_(Date.now());

  if (!campaignStatus.active) {
    return jsonOutput_({
      closed: true,
      campaignState: campaignStatus.state,
      message: campaignStatus.message
    });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // Check again after obtaining the lock in case the campaign ended while waiting.
    const lockedCampaignStatus = getCampaignStatus_(Date.now());
    if (!lockedCampaignStatus.active) {
      return jsonOutput_({
        closed: true,
        campaignState: lockedCampaignStatus.state,
        message: lockedCampaignStatus.message
      });
    }

    const sheet = getSheet_();
    const data = JSON.parse(e.postData.contents);
    const nome = (data.nome || "").toString().slice(0, 100);
    const contato = (data.contato || "").toString().slice(0, 100);

    if (!nome || !contato) {
      return jsonOutput_({ error: "Nome e contato são obrigatórios." });
    }

    const existingEntries = sheet.getLastRow() - 1;

    if (existingEntries >= MAX_ENTRIES) {
      return jsonOutput_({
        closed: true,
        message: "As 500 entradas da promoção já foram preenchidas."
      });
    }

    const entryNumber = existingEntries + 1;
    const prizeCounts = countPrizes_(sheet, existingEntries);
    const randomDraw = Math.random();
    const selection = selectPrize_(existingEntries, prizeCounts, randomDraw);
    const prizeType = selection.prizeType;
    const code = prizeType !== "NONE"
      ? generateCode_(entryNumber, prizeType)
      : "";

    sheet.appendRow([
      new Date(),
      nome,
      contato,
      entryNumber,
      prizeType,
      code,
      prizeType !== "NONE" ? "NAO" : "",
      selection.ticketProbability,
      selection.discountProbability,
      randomDraw
    ]);

    return jsonOutput_({
      entryNumber: entryNumber,
      prizeType: prizeType,
      code: code,
      entriesRemaining: MAX_ENTRIES - entryNumber
    });
  } catch (err) {
    return jsonOutput_({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function getCampaignStatus_(now) {
  if (now >= CAMPAIGN_END_AT_EXCLUSIVE) {
    return {
      state: "after",
      active: false,
      message: "Esta promoção foi encerrada em 16 de agosto de 2026."
    };
  }

  return { state: "active", active: true, message: "" };
}

function selectPrize_(existingEntries, prizeCounts, randomDraw) {
  const remainingTickets = Math.max(0, TOTAL_TICKET_PRIZES - prizeCounts.tickets);
  const remainingDiscounts = Math.max(0, TOTAL_DISCOUNT_PRIZES - prizeCounts.discounts);
  const remainingEntries = MAX_ENTRIES - existingEntries;
  const ticketProbability = remainingTickets / remainingEntries;
  const discountProbability = remainingDiscounts / remainingEntries;
  let prizeType = "NONE";

  if (randomDraw < ticketProbability) {
    prizeType = "TICKET";
  } else if (randomDraw < ticketProbability + discountProbability) {
    prizeType = "DISCOUNT";
  }

  return {
    prizeType: prizeType,
    ticketProbability: ticketProbability,
    discountProbability: discountProbability
  };
}

function countPrizes_(sheet, existingEntries) {
  if (existingEntries <= 0) return { tickets: 0, discounts: 0 };

  return sheet
    .getRange(2, 5, existingEntries, 1)
    .getValues()
    .reduce(function(counts, row) {
      if (row[0] === "TICKET") counts.tickets++;
      if (row[0] === "DISCOUNT") counts.discounts++;
      return counts;
    }, { tickets: 0, discounts: 0 });
}

function generateCode_(entryNumber, prizeType) {
  const raw = Utilities.computeHmacSha256Signature(
    prizeType + "-entry-" + entryNumber,
    getSecret_()
  );
  const safeCode = Utilities
    .base64EncodeWebSafe(raw)
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();

  return "DJ-" + safeCode.substring(0, 4) + "-" + safeCode.substring(4, 8);
}

function getSecret_() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty(SECRET_PROPERTY);

  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty(SECRET_PROPERTY, secret);
  }

  return secret;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  const headers = [
    "Data/Hora",
    "Nome",
    "Contato",
    "Nº Entrada",
    "Prêmio",
    "Código",
    "Resgatado",
    "Prob. Ingresso",
    "Prob. Desconto",
    "Número Aleatório"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
