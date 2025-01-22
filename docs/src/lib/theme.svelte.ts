interface Theme {
  dark: boolean;
}

let isDark = $state(true);

function toggle() {
  isDark = isDark ? !isDark : isDark;
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', isDark);
}

function initialize() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const stored = localStorage.getItem('theme');
  isDark = stored ? stored === 'dark' : prefersDark;
  document.documentElement.classList.toggle('dark', isDark);
}

export const theme = {
  toggle,
  initialize,
  get dark() { return isDark }
};
