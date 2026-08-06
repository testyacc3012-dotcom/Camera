// MRF — Medwood Research Facility
// Minor progressive-enhancement behavior only. The site works fully without this file.

document.addEventListener('DOMContentLoaded', () => {
  // Add a subtle "pressed" state on clearance buttons before the Roblox tab opens,
  // so the click feels acknowledged rather than instant.
  document.querySelectorAll('.level-card .btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.style.transform = 'scale(0.97)';
      setTimeout(() => { btn.style.transform = ''; }, 150);
    });
  });
});
