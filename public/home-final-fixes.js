(() => {
  const categoryClass = (category) => {
    if (category === "Speaking") return "pill-speaking";
    if (category === "White Paper") return "pill-whitepaper";
    return "pill-insight";
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

  document.querySelectorAll("main .services-preview .card .button.text").forEach((link) => {
    link.textContent = "Learn more";
  });
})();
