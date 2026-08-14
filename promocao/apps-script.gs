/**
 * Backend da promoção Don Juarez × Roda Rico.
 * Cole este código em Extensões > Apps Script, dentro de uma Planilha Google.
 */

// Ativa apenas nos dias 15 e 16 de agosto, no horário de São Paulo.
const CAMPAIGN_START_AT = Date.parse("2026-08-15T00:00:00-03:00");
const CAMPAIGN_DAY_TWO_AT = Date.parse("2026-08-16T00:00:00-03:00");
const CAMPAIGN_END_AT_EXCLUSIVE = Date.parse("2026-08-17T00:00:00-03:00");

// Distribui aleatoriamente 4 ingressos e 50 descontos entre 500 entradas.
const TOTAL_TICKET_PRIZES = 4;
const TOTAL_DISCOUNT_PRIZES = 50;
const MAX_ENTRIES = 500;
const MAX_ENTRIES_PER_DAY = 250;
const SECRET_PROPERTY = "REDEMPTION_SECRET";
const SPREADSHEET_ID = "15oTfl_BVBPn5B-XYF4HH-Y7kUwCs6FrdQ3qlijWf95k";
const SHEET_NAME = "Entradas";

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ error: "Requisição inválida." });
  }

  const action = cleanText_(data.action, 30);
  if (action === "verifyPrize" || action === "redeemPrize") {
    return handlePrizeValidation_(data, action === "redeemPrize");
  }

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
    const nome = cleanText_(data.nome, 100);
    const telefone = normalizePhone_(data.telefone);
    const email = normalizeEmail_(data.email);
    const instagram = normalizeInstagram_(data.instagram);
    const marketingConsent = data.marketingConsent === true;

    if (!nome || !telefone || !email || !instagram) {
      return jsonOutput_({ error: "Nome, telefone, e-mail e Instagram são obrigatórios." });
    }
    if (!isValidPhone_(telefone)) {
      return jsonOutput_({ error: "Informe um telefone brasileiro válido com DDD." });
    }
    if (!isValidEmail_(email)) {
      return jsonOutput_({ error: "Informe um e-mail válido." });
    }
    if (!isValidInstagram_(instagram)) {
      return jsonOutput_({ error: "Informe um usuário válido do Instagram." });
    }

    const existingRows = sheet.getLastRow() - 1;

    if (findDuplicate_(sheet, existingRows, telefone, email, instagram)) {
      return jsonOutput_({
        error: "Este telefone, e-mail ou Instagram já participou da promoção."
      });
    }

    const campaignRows = getCampaignRows_(sheet, existingRows);
    const existingEntries = campaignRows.length;
    const todayEntries = countEntriesForDay_(campaignRows, Date.now());

    if (todayEntries >= MAX_ENTRIES_PER_DAY) {
      return jsonOutput_({
        closed: true,
        campaignState: "day-full",
        message: "As 250 participações de hoje já foram preenchidas."
      });
    }

    if (existingEntries >= MAX_ENTRIES) {
      return jsonOutput_({
        closed: true,
        message: "As 500 entradas da promoção já foram preenchidas."
      });
    }

    const entryNumber = existingEntries + 1;
    const prizeCounts = countPrizesFromRows_(campaignRows);
    const randomDraw = Math.random();
    const selection = selectPrize_(existingEntries, prizeCounts, randomDraw);
    const prizeType = selection.prizeType;
    const code = prizeType !== "NONE"
      ? generateCode_(entryNumber, prizeType)
      : "";

    sheet.appendRow([
      new Date(),
      nome,
      telefone,
      email,
      instagram,
      marketingConsent ? "SIM" : "NAO",
      marketingConsent ? new Date() : "",
      entryNumber,
      prizeType,
      code,
      prizeType !== "NONE" ? "NAO" : "",
      selection.ticketProbability,
      selection.discountProbability,
      randomDraw,
      ""
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

function handlePrizeValidation_(data, redeem) {
  const code = normalizeWinnerCode_(data.code);
  const telefone = normalizePhone_(data.telefone);

  if (!/^DJ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) || !isValidPhone_(telefone)) {
    return jsonOutput_({ valid: false, error: "Código ou telefone inválido." });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_();
    const existingEntries = sheet.getLastRow() - 1;
    if (existingEntries <= 0) {
      return jsonOutput_({ valid: false, error: "Prêmio não encontrado." });
    }

    const rows = sheet.getRange(2, 1, existingEntries, 15).getValues();
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const storedPhone = normalizePhone_(row[2]);
      const prizeType = cleanText_(row[8], 20);
      const storedCode = normalizeWinnerCode_(row[9]);
      const redeemed = cleanText_(row[10], 10).toUpperCase() === "SIM";

      if (storedCode !== code || storedPhone !== telefone || prizeType === "NONE") continue;

      if (redeemed) {
        return jsonOutput_({
          valid: false,
          alreadyRedeemed: true,
          error: "Este prêmio já foi resgatado."
        });
      }

      if (redeem) {
        const sheetRow = index + 2;
        sheet.getRange(sheetRow, 11).setValue("SIM");
        sheet.getRange(sheetRow, 15).setValue(new Date());
      }

      return jsonOutput_({
        valid: true,
        redeemed: redeem,
        winnerName: cleanText_(row[1], 100),
        entryNumber: row[7],
        prizeType: prizeType,
        code: storedCode
      });
    }

    return jsonOutput_({ valid: false, error: "Código ou telefone não confere." });
  } catch (err) {
    return jsonOutput_({ valid: false, error: "Não foi possível validar agora." });
  } finally {
    lock.releaseLock();
  }
}

function getCampaignStatus_(now) {
  if (now < CAMPAIGN_START_AT) {
    return {
      state: "before",
      active: false,
      message: "A promoção começa em 15 de agosto de 2026."
    };
  }

  if (now >= CAMPAIGN_END_AT_EXCLUSIVE) {
    return {
      state: "after",
      active: false,
      message: "Esta promoção foi encerrada em 16 de agosto de 2026."
    };
  }

  return { state: "active", active: true, message: "" };
}

function getCampaignRows_(sheet, existingRows) {
  if (existingRows <= 0) return [];

  return sheet
    .getRange(2, 1, existingRows, 15)
    .getValues()
    .filter(function(row) {
      const timestamp = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime();
      return timestamp >= CAMPAIGN_START_AT && timestamp < CAMPAIGN_END_AT_EXCLUSIVE;
    });
}

function getCampaignDayIndex_(timestamp) {
  if (timestamp >= CAMPAIGN_START_AT && timestamp < CAMPAIGN_DAY_TWO_AT) return 1;
  if (timestamp >= CAMPAIGN_DAY_TWO_AT && timestamp < CAMPAIGN_END_AT_EXCLUSIVE) return 2;
  return 0;
}

function countEntriesForDay_(campaignRows, now) {
  const dayIndex = getCampaignDayIndex_(now);
  if (!dayIndex) return 0;

  return campaignRows.filter(function(row) {
    const timestamp = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime();
    return getCampaignDayIndex_(timestamp) === dayIndex;
  }).length;
}

function cleanText_(value, maxLength) {
  return (value || "").toString().trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizePhone_(value) {
  let digits = (value || "").toString().replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.indexOf("55") === 0) {
    digits = digits.slice(2);
  }
  return digits;
}

function normalizeEmail_(value) {
  return cleanText_(value, 120).toLowerCase();
}

function normalizeInstagram_(value) {
  return cleanText_(value, 31).replace(/^@/, "").toLowerCase();
}

function normalizeWinnerCode_(value) {
  return cleanText_(value, 20).toUpperCase();
}

function isValidPhone_(phone) {
  return /^\d{10,11}$/.test(phone);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidInstagram_(instagram) {
  return /^(?!.*\.\.)[a-z0-9._]{1,30}$/.test(instagram) &&
    instagram.charAt(instagram.length - 1) !== ".";
}

function findDuplicate_(sheet, existingEntries, telefone, email, instagram) {
  if (existingEntries <= 0) return false;

  return sheet
    .getRange(2, 3, existingEntries, 3)
    .getValues()
    .some(function(row) {
      return normalizePhone_(row[0]) === telefone ||
        normalizeEmail_(row[1]) === email ||
        normalizeInstagram_(row[2]) === instagram;
    });
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
    .getRange(2, 9, existingEntries, 1)
    .getValues()
    .reduce(function(counts, row) {
      if (row[0] === "TICKET") counts.tickets++;
      if (row[0] === "DISCOUNT") counts.discounts++;
      return counts;
    }, { tickets: 0, discounts: 0 });
}

function countPrizesFromRows_(rows) {
  return rows.reduce(function(counts, row) {
    if (row[8] === "TICKET") counts.tickets++;
    if (row[8] === "DISCOUNT") counts.discounts++;
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  const headers = [
    "Data/Hora",
    "Nome",
    "Telefone",
    "E-mail",
    "Instagram",
    "Consentimento Marketing",
    "Data Consentimento",
    "Nº Entrada",
    "Prêmio",
    "Código",
    "Resgatado",
    "Chance de ingresso neste sorteio",
    "Chance de desconto neste sorteio",
    "Sorteio interno (0 a 1)",
    "Data/Hora Resgate"
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
