export function scrollToAdminHash(): void {
  const id = window.location.hash.replace(/^#/, "");
  if (!id) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function scheduleAdminHashScroll(): void {
  scrollToAdminHash();
  for (const delay of [50, 150, 400, 1000]) {
    window.setTimeout(scrollToAdminHash, delay);
  }
}
