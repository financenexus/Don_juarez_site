const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const frontendSource = fs.readFileSync("assets/promotion-campaign.js", "utf8");
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
const nowDuringPreparation = Date.parse("2026-07-27T12:00:00-03:00");
const opening = Date.parse("2026-08-15T00:00:00-03:00");
const finalSecond = Date.parse("2026-08-16T23:59:59.999-03:00");
const closing = Date.parse("2026-08-17T00:00:00-03:00");

assert.equal(campaign.getStatus(nowDuringPreparation).state, "active");
assert.equal(campaign.getStatus(opening).state, "active");
assert.equal(campaign.getStatus(finalSecond).state, "active");
assert.equal(campaign.getStatus(closing).state, "after");

const backendSource = fs.readFileSync("promocao/apps-script.gs", "utf8");
const backendContext = vm.createContext({ Date, Math });
vm.runInContext(
  backendSource +
    "\nglobalThis.getCampaignStatusForTest = getCampaignStatus_;" +
    "\nglobalThis.selectPrizeForTest = selectPrize_;",
  backendContext
);

assert.equal(backendContext.getCampaignStatusForTest(nowDuringPreparation).state, "active");
assert.equal(backendContext.getCampaignStatusForTest(opening).state, "active");
assert.equal(backendContext.getCampaignStatusForTest(finalSecond).state, "active");
assert.equal(backendContext.getCampaignStatusForTest(closing).state, "after");

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
