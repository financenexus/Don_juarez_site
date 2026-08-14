const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const frontendSource = fs.readFileSync("assets/promotion-campaign.js", "utf8");
const popupSource = fs.readFileSync("assets/promotion-popup.js", "utf8");
const frontendWindow = {};
const frontendContext = vm.createContext({
  window: frontendWindow,
  location: { protocol: "https:", hostname: "tabacodonjuarez.com.br", search: "" },
  URLSearchParams,
  Date,
  Object,
});

vm.runInContext(frontendSource, frontendContext);

const campaign = frontendWindow.DonJuarezCampaign;
assert.match(popupSource, /AUTO_OPEN_DELAY_MS\s*=\s*30000/);
assert.match(popupSource, /TIMER_PREVIEW\s*=\s*searchParams\.get\("promo"\) === "timer"/);
assert.match(popupSource, /setTimeout\(openPopup, FORCE_PREVIEW \? 50 : AUTO_OPEN_DELAY_MS\)/);
const nowDuringPreparation = Date.parse("2026-07-27T12:00:00-03:00");
const opening = Date.parse("2026-08-15T00:00:00-03:00");
const finalSecond = Date.parse("2026-08-16T23:59:59.999-03:00");
const closing = Date.parse("2026-08-17T00:00:00-03:00");

assert.equal(campaign.getStatus(nowDuringPreparation).state, "before");
assert.equal(campaign.getStatus(opening).state, "active");
assert.equal(campaign.getStatus(finalSecond).state, "active");
assert.equal(campaign.getStatus(closing).state, "after");

const backendSource = fs.readFileSync("promocao/apps-script.gs", "utf8");
const backendContext = vm.createContext({ Date, Math });
vm.runInContext(
  backendSource +
    "\nglobalThis.getCampaignStatusForTest = getCampaignStatus_;" +
    "\nglobalThis.getCampaignDayIndexForTest = getCampaignDayIndex_;" +
    "\nglobalThis.countEntriesForDayForTest = countEntriesForDay_;" +
    "\nglobalThis.selectPrizeForTest = selectPrize_;" +
    "\nglobalThis.normalizePhoneForTest = normalizePhone_;" +
    "\nglobalThis.normalizeEmailForTest = normalizeEmail_;" +
    "\nglobalThis.normalizeInstagramForTest = normalizeInstagram_;" +
    "\nglobalThis.normalizeWinnerCodeForTest = normalizeWinnerCode_;" +
    "\nglobalThis.isValidPhoneForTest = isValidPhone_;" +
    "\nglobalThis.isValidEmailForTest = isValidEmail_;" +
    "\nglobalThis.isValidInstagramForTest = isValidInstagram_;",
  backendContext
);

assert.equal(backendContext.getCampaignStatusForTest(nowDuringPreparation).state, "before");
assert.equal(backendContext.getCampaignStatusForTest(opening).state, "active");
assert.equal(backendContext.getCampaignStatusForTest(finalSecond).state, "active");
assert.equal(backendContext.getCampaignStatusForTest(closing).state, "after");
assert.equal(backendContext.getCampaignDayIndexForTest(opening), 1);
assert.equal(backendContext.getCampaignDayIndexForTest(Date.parse("2026-08-16T12:00:00-03:00")), 2);
assert.equal(backendContext.getCampaignDayIndexForTest(closing), 0);
const dailyRows = [];
for (let index = 0; index < 250; index++) dailyRows.push([new Date(opening + index * 1000)]);
for (let index = 0; index < 249; index++) dailyRows.push([new Date(Date.parse("2026-08-16T00:00:00-03:00") + index * 1000)]);
assert.equal(backendContext.countEntriesForDayForTest(dailyRows, opening), 250);
assert.equal(backendContext.countEntriesForDayForTest(dailyRows, Date.parse("2026-08-16T12:00:00-03:00")), 249);
assert.equal(backendContext.normalizePhoneForTest("+55 (11) 98765-4321"), "11987654321");
assert.equal(backendContext.normalizeEmailForTest(" VISITOR@Example.COM "), "visitor@example.com");
assert.equal(backendContext.normalizeInstagramForTest("@Don.Juarez_01"), "don.juarez_01");
assert.equal(backendContext.normalizeWinnerCodeForTest(" dj-ab12-cd34 "), "DJ-AB12-CD34");
assert.equal(backendContext.isValidPhoneForTest("11987654321"), true);
assert.equal(backendContext.isValidPhoneForTest("123"), false);
assert.equal(backendContext.isValidEmailForTest("visitor@example.com"), true);
assert.equal(backendContext.isValidEmailForTest("not-an-email"), false);
assert.equal(backendContext.isValidInstagramForTest("don.juarez_01"), true);
assert.equal(backendContext.isValidInstagramForTest("bad..name"), false);

for (let campaignRun = 0; campaignRun < 1000; campaignRun++) {
  const counts = { tickets: 0, discounts: 0 };

  for (let existingEntries = 0; existingEntries < 500; existingEntries++) {
    const result = backendContext.selectPrizeForTest(
      existingEntries,
      counts,
      Math.random()
    );

    if (result.prizeType === "TICKET") counts.tickets++;
    if (result.prizeType === "DISCOUNT") counts.discounts++;
    assert.ok(counts.tickets <= 4);
    assert.ok(counts.discounts <= 50);
  }

  assert.equal(counts.tickets, 4);
  assert.equal(counts.discounts, 50);
}

console.log("PASS: campaign dates and 1,000 complete prize distributions.");
