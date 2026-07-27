(() => {
  "use strict";

  // Active immediately; closes after 16 August in São Paulo time (UTC-03:00).
  const END_AT_EXCLUSIVE = Date.parse("2026-08-17T00:00:00-03:00");

  function getStatus(now = Date.now()) {
    if (now >= END_AT_EXCLUSIVE) {
      return {
        state: "after",
        active: false,
        message: "Esta promoção foi encerrada em 16 de agosto de 2026.",
      };
    }

    return {
      state: "active",
      active: true,
      message: "",
    };
  }

  function isLocalPreview(searchParams = new URLSearchParams(location.search)) {
    const localHost =
      location.protocol === "file:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";

    return localHost && (searchParams.has("promo") || searchParams.has("preview"));
  }

  window.DonJuarezCampaign = Object.freeze({
    endAtExclusive: END_AT_EXCLUSIVE,
    getStatus,
    isLocalPreview,
  });
})();
