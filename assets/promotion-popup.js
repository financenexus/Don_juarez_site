(() => {
  const DISMISSED_KEY = "donjuarez-promotion-dismissed-v1";
  const searchParams = new URLSearchParams(window.location.search);
  const campaign = window.DonJuarezCampaign;
  const FORCE_PREVIEW = Boolean(campaign?.isLocalPreview(searchParams));
  const TIMER_PREVIEW = searchParams.get("promo") === "timer";
  const BOTTOM_THRESHOLD_PX = 80;
  const AUTO_OPEN_DELAY_MS = 5000;

  let opened = false;
  let previousFocus = null;

  const storage = {
    get() {
      try {
        return window.sessionStorage.getItem(DISMISSED_KEY);
      } catch {
        return null;
      }
    },
    set(value) {
      try {
        window.sessionStorage.setItem(DISMISSED_KEY, value);
      } catch {
        // The popup still works if storage is unavailable.
      }
    },
  };

  if (!campaign?.getStatus().active && !FORCE_PREVIEW && !TIMER_PREVIEW) return;
  if (storage.get() && !FORCE_PREVIEW && !TIMER_PREVIEW) return;

  const popup = document.createElement("div");
  popup.className = "dj-promo";
  popup.hidden = true;
  popup.innerHTML = `
    <div class="dj-promo__backdrop" data-promo-close></div>
    <div class="dj-promo__stage" aria-hidden="true">
      <div class="dj-promo__halo"></div>
      <span class="dj-promo__spark dj-promo__spark--1"></span>
      <span class="dj-promo__spark dj-promo__spark--2"></span>
      <span class="dj-promo__spark dj-promo__spark--3"></span>
      <span class="dj-promo__spark dj-promo__spark--4"></span>
      <span class="dj-promo__spark dj-promo__spark--5"></span>
      <span class="dj-promo__spark dj-promo__spark--6"></span>
    </div>
    <section class="dj-promo__card" role="dialog" aria-modal="true" aria-labelledby="dj-promo-title" aria-describedby="dj-promo-copy">
      <button class="dj-promo__close" type="button" aria-label="Fechar promoção" data-promo-close>×</button>
      <p class="dj-promo__eyebrow">Don Juarez × Roda Rico</p>
      <p class="dj-promo__arrival">Sua chance chegou</p>
      <h2 class="dj-promo__title" id="dj-promo-title">Entre para <span>viver essa experiência.</span></h2>
      <p class="dj-promo__copy" id="dj-promo-copy">
        Confirme sua participação e descubra na hora se a Roda Rico reservou um momento especial para você.
      </p>
      <div class="dj-promo__instant"><span></span> Resultado revelado na hora</div>
      <div class="dj-promo__actions">
        <a class="dj-promo__cta" href="/promocao/" data-promo-cta>Entrar para concorrer</a>
        <button class="dj-promo__later" type="button" data-promo-close>Agora não</button>
      </div>
      <p class="dj-promo__legal">Participação exclusiva para maiores de 18 anos.</p>
    </section>
  `;
  document.body.appendChild(popup);

  const cta = popup.querySelector("[data-promo-cta]");
  let openTimer;

  function stopTriggers() {
    window.removeEventListener("scroll", handleScroll);
    window.clearTimeout(openTimer);
  }

  function openPopup() {
    if (opened) return;
    opened = true;
    stopTriggers();
    previousFocus = document.activeElement;
    document.documentElement.classList.add("dj-promo-lock");
    popup.hidden = false;
    window.requestAnimationFrame(() => {
      popup.classList.add("is-open");
      cta.focus({ preventScroll: true });
    });
  }

  function closePopup() {
    if (!opened) return;
    storage.set("dismissed");
    document.documentElement.classList.remove("dj-promo-lock");
    popup.classList.remove("is-open");
    window.setTimeout(() => {
      popup.hidden = true;
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
    }, 220);
  }

  function handleScroll() {
    const pageBottom = window.scrollY + window.innerHeight;
    const remainingDistance = document.documentElement.scrollHeight - pageBottom;
    if (remainingDistance <= BOTTOM_THRESHOLD_PX) openPopup();
  }

  popup.addEventListener("click", (event) => {
    if (event.target.closest("[data-promo-close]")) closePopup();
  });

  cta.addEventListener("click", () => {
    storage.set("engaged");
  });

  document.addEventListener("keydown", (event) => {
    if (opened && event.key === "Escape") closePopup();
  });

  window.addEventListener("scroll", handleScroll, { passive: true });
  openTimer = window.setTimeout(openPopup, FORCE_PREVIEW ? 50 : AUTO_OPEN_DELAY_MS);
})();
