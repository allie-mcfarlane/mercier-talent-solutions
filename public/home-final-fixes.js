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
})();