(() => {
  const DISMISSED_KEY = "donjuarez-promotion-dismissed-v1";
  const FORCE_PREVIEW = new URLSearchParams(window.location.search).has("promo");
  const OPEN_AFTER_MS = 30_000;
  const OPEN_AFTER_SCROLL_DISTANCE = 700;

  let opened = false;
  let cumulativeScroll = 0;
  let lastScrollY = window.scrollY;
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

  if (storage.get() && !FORCE_PREVIEW) return;

  const popup = document.createElement("div");
  popup.className = "dj-promo";
  popup.hidden = true;
  popup.innerHTML = `
    <div class="dj-promo__backdrop" data-promo-close></div>
    <section class="dj-promo__card" role="dialog" aria-modal="true" aria-labelledby="dj-promo-title" aria-describedby="dj-promo-copy">
      <button class="dj-promo__close" type="button" aria-label="Fechar promoção" data-promo-close>×</button>
      <p class="dj-promo__eyebrow">Don Juarez × Roda Rico</p>
      <h2 class="dj-promo__title" id="dj-promo-title">Você entrou <span>na roda?</span></h2>
      <p class="dj-promo__copy" id="dj-promo-copy">
        Siga <strong>@tabacodonjuarez</strong>, confirme sua participação e descubra na hora se uma experiência especial espera por você.
      </p>
      <div class="dj-promo__actions">
        <a class="dj-promo__cta" href="/promocao/" data-promo-cta>Participar da promoção</a>
        <button class="dj-promo__later" type="button" data-promo-close>Agora não</button>
      </div>
      <p class="dj-promo__legal">Participação exclusiva para maiores de 18 anos.</p>
    </section>
  `;
  document.body.appendChild(popup);

  const cta = popup.querySelector("[data-promo-cta]");
  let timer;

  function stopTriggers() {
    window.removeEventListener("scroll", handleScroll);
    window.clearTimeout(timer);
  }

  function openPopup() {
    if (opened) return;
    opened = true;
    stopTriggers();
    previousFocus = document.activeElement;
    popup.hidden = false;
    window.requestAnimationFrame(() => {
      popup.classList.add("is-open");
      cta.focus({ preventScroll: true });
    });
  }

  function closePopup() {
    if (!opened) return;
    storage.set("dismissed");
    popup.classList.remove("is-open");
    window.setTimeout(() => {
      popup.hidden = true;
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
    }, 220);
  }

  function handleScroll() {
    const currentScrollY = window.scrollY;
    cumulativeScroll += Math.abs(currentScrollY - lastScrollY);
    lastScrollY = currentScrollY;

    if (
      cumulativeScroll >= OPEN_AFTER_SCROLL_DISTANCE ||
      currentScrollY >= window.innerHeight * 0.8
    ) {
      openPopup();
    }
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
  timer = window.setTimeout(openPopup, FORCE_PREVIEW ? 50 : OPEN_AFTER_MS);
})();
