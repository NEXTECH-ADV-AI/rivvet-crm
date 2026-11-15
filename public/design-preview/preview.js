'use strict';
// Deliberately local display state only. No authentication or data services.
const dialogs = [...document.querySelectorAll('dialog')];
const openers = new Map();
function openDialog(id, opener) {
  const dialog = document.getElementById(id);
  if (dialog.open) return;
  openers.set(dialog, opener);
  opener.setAttribute('aria-expanded', 'true');
  dialog.showModal();
  if (id === 'search-dialog') document.getElementById('sample-search').focus();
}
for (const dialog of dialogs) {
  dialog.addEventListener('close', () => {
    const opener = openers.get(dialog);
    opener?.setAttribute('aria-expanded', 'false');
    opener?.focus();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  // Keep Tab inside the native modal even in browsers that focus browser chrome at its edges.
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter((element) => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}
document.getElementById('menu-open').addEventListener('click', (event) => openDialog('menu-dialog', event.currentTarget));
document.getElementById('search-open').addEventListener('click', (event) => openDialog('search-dialog', event.currentTarget));
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => document.getElementById(button.dataset.close).close());
for (const button of document.querySelectorAll('[data-page]')) button.addEventListener('click', () => {
  const page = button.dataset.page;
  for (const section of document.querySelectorAll('[data-view]')) section.hidden = section.dataset.view !== page;
  const parentPage = document.querySelector(`[data-view="${page}"]`).dataset.parent || page;
  for (const nav of document.querySelectorAll('.nav-items [data-page], .nav-footer [data-page]')) {
    if (nav.dataset.page === parentPage) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
  }
  const menu = document.getElementById('menu-dialog');
  if (menu.open) menu.close();
  else document.getElementById('main').focus();
  window.scrollTo({ top: 0, behavior: 'instant' });
});
for (const button of document.querySelectorAll('[data-period]')) button.addEventListener('click', () => {
  const all = button.dataset.period === 'all';
  document.getElementById('created-count').textContent = all ? '8' : '5';
  document.getElementById('activity-count').textContent = all ? '32' : '18';
  document.getElementById('period-status').textContent = `Sample period: ${all ? 'all time' : 'past 30 days'}. Won/lost totals remain all time.`;
  for (const control of document.querySelectorAll('[data-period]')) control.setAttribute('aria-pressed', String(control === button));
});
for (const button of document.querySelectorAll('[data-signin]')) button.addEventListener('click', () => {
  const state = button.dataset.signin;
  const email = state === 'email';
  document.getElementById('email-state').hidden = !email;
  document.getElementById('code-state').hidden = email;
  document.getElementById('signin-error').hidden = state !== 'error';
  document.getElementById('sample-code').setAttribute('aria-invalid', String(state === 'error'));
  if (state === 'error') document.getElementById('sample-code').setAttribute('aria-describedby', 'signin-error');
  else document.getElementById('sample-code').removeAttribute('aria-describedby');
  document.getElementById('signin-title').textContent = email ? 'Sign in' : 'Check your email';
  document.getElementById('signin-description').textContent = email ? 'Use your Rivvet work email. This design sample cannot send a code.' : 'Example code screen for reviewer@example.test. No email has been sent. This code cannot sign you in.';
  for (const control of document.querySelectorAll('[data-signin]')) control.setAttribute('aria-pressed', String(control === button));
});
const sampleEntries = [
  ['Juniper Example Services', 'Sample account · Customer follow-up'],
  ['Harbor Sample Heating', 'Sample opportunity · Discovery'],
  ['Cedar Demo Electric', 'Sample opportunity · Next step missing'],
  ['Home', 'Design page · Priorities and customer follow-ups'],
  ['Analytics', 'Design page · Sample sales metrics'],
  ['Leads', 'Design page · Call queue and lead filters'],
  ['Accounts', 'Design page · Customer relationships'],
  ['Opportunities', 'Design page · Board and list'],
  ['Settings', 'Design page · Sample identity and connection'],
];
function renderSearch() {
  const query = document.getElementById('sample-search').value.trim().toLowerCase();
  const matches = sampleEntries.filter(([name, detail]) => `${name} ${detail}`.toLowerCase().includes(query));
  const list = document.getElementById('search-results');
  list.replaceChildren();
  for (const [name, detail] of matches) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = name;
    const description = document.createElement('small');
    description.textContent = `${detail} · View-only result`;
    item.append(title, description);
    list.append(item);
  }
  document.getElementById('search-status').textContent = matches.length ? `${matches.length} sample results. Search results are view-only. Use the menu to browse sample pages.` : 'No sample matches.';
}
document.getElementById('sample-search').addEventListener('input', renderSearch);
renderSearch();
const desktop = window.matchMedia('(min-width: 768px)');
desktop.addEventListener('change', () => {
  const menu = document.getElementById('menu-dialog');
  if (desktop.matches && menu.open) menu.close();
});

const priorityToggle = document.getElementById('priority-toggle');
priorityToggle.addEventListener('click', () => {
  const expanded = priorityToggle.getAttribute('aria-expanded') !== 'true';
  const rows = [...document.querySelectorAll('#sample-priority-list > li')];
  for (const row of rows.slice(3)) row.hidden = !expanded;
  priorityToggle.setAttribute('aria-expanded', String(expanded));
  priorityToggle.textContent = expanded ? 'Show fewer' : `Show all ${rows.length}`;
  document.getElementById('priority-count').textContent = `Showing ${expanded ? rows.length : 3} of ${rows.length} priorities`;
});

// Sample lists only: filters never change a record, session or persisted state.
let leadView = 'call';
let oppView = 'all';
function filterSampleList(page) {
  const root = document.querySelector(`[data-view="${page}"]`);
  const filters = Object.fromEntries([...root.querySelectorAll('[data-filter]')].map((input) => [input.dataset.filter, input.value.trim().toLowerCase()]));
  let visible = 0;
  const matches = (row) => {
    const view = page === 'leads' ? leadView : page === 'opportunities' ? oppView : 'all';
    return (view === 'all' || (row.dataset.views || '').split(' ').includes(view))
      && Object.entries(filters).every(([key, value]) => !value || key === 'sort' || (key === 'query' ? row.textContent.toLowerCase().includes(value) : (row.dataset[key] || '').toLowerCase() === value));
  };
  for (const row of root.querySelectorAll('[data-sample-row]')) {
    row.hidden = !matches(row);
    if (!row.hidden) visible++;
  }
  for (const row of root.querySelectorAll('[data-board-row]')) row.hidden = !matches(row);
  for (const column of root.querySelectorAll('.board-column')) column.querySelector('.board-empty').hidden = [...column.querySelectorAll('[data-board-row]')].some((row) => !row.hidden);
  if (page === 'leads') {
    const call = leadView === 'call';
    document.getElementById('lead-call-queue').hidden = !call;
    document.getElementById('lead-table-view').hidden = call;
    document.getElementById('lead-filters').hidden = call;
    document.getElementById('lead-result-status').textContent = call ? '1 sample contact in the call queue.' : `${visible} sample leads. Filters apply only to these fictitious records.`;
    document.getElementById('leads-empty').hidden = visible !== 0;
  } else {
    root.querySelector('[data-result-status]').textContent = `${visible} sample ${page}.${page === 'opportunities' ? ' Stage changes are disabled.' : ''}`;
    root.querySelector('[data-empty]').hidden = visible !== 0;
  }
  if (page === 'accounts') {
    const rows = [...root.querySelectorAll('[data-sample-row]')];
    rows.sort((a, b) => filters.sort === 'name' ? a.cells[1].textContent.localeCompare(b.cells[1].textContent) : filters.sort === 'score' ? Number(b.dataset.score) - Number(a.dataset.score) : Number(a.dataset.age) - Number(b.dataset.age));
    root.querySelector('tbody').append(...rows);
  }
}
for (const page of ['leads', 'accounts', 'opportunities']) {
  for (const control of document.querySelectorAll(`[data-view="${page}"] [data-filter]`)) control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', () => filterSampleList(page));
}
for (const group of ['lead', 'opp']) {
  for (const button of document.querySelectorAll(`[data-${group}-view]`)) button.addEventListener('click', () => {
    if (group === 'lead') leadView = button.dataset.leadView;
    else oppView = button.dataset.oppView;
    for (const control of document.querySelectorAll(`[data-${group}-view]`)) control.setAttribute('aria-pressed', String(control === button));
    filterSampleList(group === 'lead' ? 'leads' : 'opportunities');
  });
}
for (const button of document.querySelectorAll('[data-opp-layout]')) button.addEventListener('click', () => {
  document.getElementById('opp-board').hidden = button.dataset.oppLayout !== 'board';
  document.getElementById('opp-list').hidden = button.dataset.oppLayout !== 'list';
  for (const control of document.querySelectorAll('[data-opp-layout]')) control.setAttribute('aria-pressed', String(control === button));
});
document.getElementById('lead-totals-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = expanded ? 'Hide totals' : 'Show totals';
  document.getElementById('lead-totals').hidden = !expanded;
});
