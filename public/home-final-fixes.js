(() => {
  const categoryClass = (category) => {
    if (category === "Speaking") return "pill-speaking";
    if (category === "White Paper") return "pill-whitepaper";
    return "pill-insight";
  };

  const serviceAnchor = (title) =>
    `/services/#${String(title || "")
      .trim()
      .toLowerCase()
      .replaceAll(" ", "-")}`;

  const ensureCareersPromo = () => {
    const main = document.querySelector("main#main-content");
    if (!main || main.querySelector(".home-careers-promo")) return;

    const section = document.createElement("section");
    section.className = "home-careers-promo";
    section.setAttribute("aria-labelledby", "home-careers-title");
    section.innerHTML = `
      <div class="container home-careers-promo-inner">
        <div class="home-careers-copy">
          <p class="eyebrow">Careers</p>
          <h2 id="home-careers-title">Join our <em>team</em></h2>
        </div>
        <a class="home-careers-button" href="/careers/">
          <span>View open roles</span>
          <span aria-hidden="true">→</span>
        </a>
        <div class="home-careers-mark" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>`;
    main.append(section);
  };

  document.querySelectorAll("main a.eyebrow-link").forEach((link) => {
    const label = document.createElement("p");
    label.className = "eyebrow home-static-eyebrow";
    label.textContent = link.textContent || "";
    link.replaceWith(label);
  });

  document.querySelectorAll("main .news-card .pill").forEach((pill) => {
    const category = (pill.textContent || "").trim();
    pill.classList.add(categoryClass(category));
  });

  document.querySelectorAll("main .services-preview .card").forEach((card) => {
    const link = card.querySelector(".button.text");
    const heading = card.querySelector("h3");
    if (!(link instanceof HTMLAnchorElement) || !heading) return;

    link.textContent = "Learn more";
    link.href = serviceAnchor(heading.textContent);
  });

  ensureCareersPromo();
})();