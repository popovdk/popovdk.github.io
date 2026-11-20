const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  courses: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  lab: '<path d="M9 3h6m-5 0v7L4.5 19a1.3 1.3 0 0 0 1.1 2h12.8a1.3 1.3 0 0 0 1.1-2L14 10V3M8 14h8"/><circle cx="10" cy="17.5" r=".5"/>',
  notebook: '<path d="M5 3h14v18H5zM3 7h4M3 12h4M3 17h4M10 8h5M10 12h5M10 16h3"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  book: '<path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1v15"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  logic: '<rect x="2" y="3" width="7" height="5" rx="1.4"/><rect x="15" y="3" width="7" height="5" rx="1.4"/><rect x="8.5" y="16" width="7" height="5" rx="1.4"/><path d="M5.5 8v4H12m6.5-4v4H12v4"/>',
  rhetoric: '<path d="M4 10v7h5l9 4V3L9 7H4v3zm5-3v10M7 17l1 5M21 8v8"/>',
  justice: '<path d="M12 3v18M7 21h10M4 7h16M5 7l-4 8h8zm14 0-4 8h8z"/>',
  markets: '<circle cx="9" cy="9" r="6"/><path d="M14 5a7 7 0 1 1-9 9M9 6v6M7.5 6H10a1.5 1.5 0 0 1 0 3H8a1.5 1.5 0 0 0 0 3h2.5"/>',
  spark: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  print: '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.5"/>',
};
export const icon = (name, className = '') => `<svg class="icon ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
export const logo = `<svg class="brand-mark" width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="14" fill="currentColor"/><path d="M12 32V16l12 9 12-9v16" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="13" r="3" fill="#e5c280"/></svg>`;
