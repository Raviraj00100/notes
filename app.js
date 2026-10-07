/**
 * MyNotes — app.js
 * Main application logic
 */

/* =====================================================
   STATE
   ===================================================== */
const state = {
  notes: [],       // active notes
  files: [],       // uploaded file notes
  categories: [],  // user categories
  recycle: [],     // recycle bin
  currentPage: 'home',
  editingNoteId: null,
  pendingDeleteId: null,
  pendingPermDeleteId: null,
  viewingNoteId: null,
  viewingBackPage: 'notes',
  searchQuery: '',
  searchFilter: 'all',
  notesView: 'grid',    // 'grid' | 'list'
  notesSort: 'updatedAt',
  notesCategoryFilter: 'all',
  uploadedFileData: null, // { name, size, type, dataUrl }
  selectedEmoji: '📂',
  userName: 'Student',
  darkMode: false,
  reminderCheckInterval: null,
};

/* =====================================================
   INIT
   ===================================================== */
async function init() {
  // Load settings
  state.darkMode = Settings.get('darkMode', false);
  state.userName = Settings.get('userName', 'Student');
  applyTheme();
  updateUserDisplay();

  // Load data
  await loadAllData();
  await ensureDefaultCategories();

  // Splash → App
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.remove();
      document.getElementById('main-app').classList.remove('hidden');
      renderPage('home');
      updateStorage();
    }, 500);
  }, 2000);

  // Bind all events
  bindNavigation();
  bindHomePage();
  bindCreatePage();
  bindUploadPage();
  bindSearchPage();
  bindSettingsPage();
  bindViewerPage();
  bindModals();
  bindLightbox();
  bindTopbar();
  bindRemindersPage();
  bindCategoriesPage();
  bindRecyclePage();

  // Start reminder checker
  startReminderChecker();
}

/* =====================================================
   DATA LOADERS
   ===================================================== */
async function loadAllData() {
  const [notes, files, cats, recycle] = await Promise.all([
    NotesDB.getAllNotes(),
    NotesDB.getAllFiles(),
    NotesDB.getAllCategories(),
    NotesDB.getAllRecycle(),
  ]);
  state.notes = notes;
  state.files = files;
  state.categories = cats;
  state.recycle = recycle;

  // Auto-purge recycle items older than 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const toRemove = state.recycle.filter(n => n.deletedAt < thirtyDaysAgo);
  for (const n of toRemove) {
    await NotesDB.deleteRecycle(n.id);
  }
  state.recycle = state.recycle.filter(n => n.deletedAt >= thirtyDaysAgo);
}

async function ensureDefaultCategories() {
  if (state.categories.length === 0) {
    const defaults = [
      { id: genId(), name: 'Java', icon: '📘', createdAt: Date.now() },
      { id: genId(), name: 'Python', icon: '🐍', createdAt: Date.now() },
      { id: genId(), name: 'C Programming', icon: '💻', createdAt: Date.now() },
      { id: genId(), name: 'Data Structures', icon: '🌳', createdAt: Date.now() },
      { id: genId(), name: 'Mathematics', icon: '📐', createdAt: Date.now() },
      { id: genId(), name: 'Other', icon: '📂', createdAt: Date.now() },
    ];
    for (const c of defaults) await NotesDB.saveCategory(c);
    state.categories = defaults;
  }
}

/* =====================================================
   NAVIGATION
   ===================================================== */
function bindNavigation() {
  // Sidebar links
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = el.dataset.page;
      navigateTo(page);
    });
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);

  // Sidebar overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.addEventListener('click', closeSidebar);
  document.getElementById('app').appendChild(overlay);
}

function navigateTo(page) {
  state.currentPage = page;
  // Deactivate all
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(n => n.classList.remove('active'));

  // Activate page
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  // Activate nav links
  document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

  // Topbar title
  const titles = {
    home: 'Home', notes: 'My Notes', create: 'Create Note',
    upload: 'Upload', search: 'Search', favorites: 'Favorites',
    pinned: 'Pinned Notes', reminders: 'Reminders', categories: 'Categories',
    recycle: 'Recycle Bin', settings: 'Settings', viewer: 'Note Viewer',
    storage: 'Storage',
  };
  document.getElementById('topbar-title').textContent = titles[page] || 'MyNotes';

  // Render the page
  renderPage(page);
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

/* =====================================================
   PAGE RENDERER
   ===================================================== */
function renderPage(page) {
  switch (page) {
    case 'home': renderHome(); break;
    case 'notes': renderNotesList(); break;
    case 'create': renderCreateForm(); break;
    case 'upload': renderUploadPage(); break;
    case 'search': renderSearch(); break;
    case 'favorites': renderFavorites(); break;
    case 'pinned': renderPinned(); break;
    case 'reminders': renderReminders(); break;
    case 'categories': renderCategories(); break;
    case 'recycle': renderRecycle(); break;
    case 'settings': renderSettings(); break;
    case 'storage': renderStoragePage(); break;
  }
}

/* =====================================================
   HOME PAGE
   ===================================================== */
function bindHomePage() {
  document.getElementById('home-search').addEventListener('input', e => {
    const q = e.target.value.trim();
    if (q) {
      state.searchQuery = q;
      document.getElementById('search-input').value = q;
      navigateTo('search');
    }
  });
}

function renderHome() {
  // Greeting
  const hr = new Date().getHours();
  let greet = hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  const name = state.userName.split(' ')[0];
  document.getElementById('home-greeting').textContent = `${greet}, ${name}! 👋`;

  // Pinned
  const pinned = getAllActiveNotes().filter(n => n.isPinned);
  const pinnedSection = document.getElementById('home-pinned-section');
  const pinnedList = document.getElementById('home-pinned-list');
  if (pinned.length) {
    pinnedSection.classList.remove('hidden');
    pinnedList.innerHTML = '';
    pinnedList.className = 'note-grid';
    pinned.slice(0, 4).forEach(n => pinnedList.appendChild(createNoteCard(n)));
  } else {
    pinnedSection.classList.add('hidden');
  }

  // Recent
  const recent = getAllActiveNotes().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const recentList = document.getElementById('home-recent-list');
  recentList.className = 'note-grid';
  if (recent.length) {
    recentList.innerHTML = '';
    recent.forEach(n => recentList.appendChild(createNoteCard(n)));
  } else {
    recentList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>No notes yet. Create your first note!</p>
        <button class="btn btn-primary" data-page="create">Create Note</button>
      </div>`;
    recentList.querySelector('[data-page]')?.addEventListener('click', e => {
      e.preventDefault(); navigateTo('create');
    });
  }

  // Categories
  renderHomeCategories();

  // Reminders
  renderHomeReminders();
}

function renderHomeCategories() {
  const container = document.getElementById('home-categories');
  container.innerHTML = '';
  state.categories.forEach(cat => {
    const count = getAllActiveNotes().filter(n => n.category === cat.name).length;
    const chip = document.createElement('button');
    chip.className = 'category-chip';
    chip.innerHTML = `<span>${cat.icon}</span><span>${cat.name}</span><span class="chip-count">${count}</span>`;
    chip.addEventListener('click', () => {
      state.notesCategoryFilter = cat.name;
      navigateTo('notes');
    });
    container.appendChild(chip);
  });
}

function renderHomeReminders() {
  const now = Date.now();
  const upcoming = getAllActiveNotes().filter(n => n.reminderDate && n.reminderDate > now - 60000)
    .sort((a, b) => a.reminderDate - b.reminderDate).slice(0, 3);
  const section = document.getElementById('home-reminders-section');
  const list = document.getElementById('home-reminders-list');
  if (upcoming.length) {
    section.classList.remove('hidden');
    list.innerHTML = '';
    upcoming.forEach(n => {
      const isOverdue = n.reminderDate < now;
      const div = document.createElement('div');
      div.className = 'reminder-item';
      div.innerHTML = `
        <div class="reminder-dot ${isOverdue ? 'overdue' : ''}"></div>
        <div class="reminder-info">
          <div class="reminder-title">${escHtml(n.title)}</div>
          <div class="reminder-time">${isOverdue ? '⚠️ ' : ''}${formatDateTime(n.reminderDate)}</div>
        </div>
        <button class="reminder-dismiss" title="Dismiss" data-id="${n.id}">✕</button>`;
      div.querySelector('.reminder-dismiss').addEventListener('click', e => {
        e.stopPropagation();
        dismissReminder(n.id);
      });
      div.addEventListener('click', () => openViewer(n.id, 'home'));
      list.appendChild(div);
    });
  } else {
    section.classList.add('hidden');
  }
}

/* =====================================================
   NOTES LIST PAGE
   ===================================================== */
function bindCreatePage() {
  // Editor toolbar
  document.getElementById('note-content').addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;'); }
  });
  document.querySelectorAll('.editor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'h2' || cmd === 'h3') {
        document.execCommand('formatBlock', false, cmd);
      } else {
        document.execCommand(cmd, false, null);
      }
      document.getElementById('note-content').focus();
    });
  });

  document.getElementById('save-note').addEventListener('click', saveNote);
  document.getElementById('cancel-note').addEventListener('click', () => {
    const back = state.editingNoteId ? state.viewingBackPage || 'notes' : 'home';
    state.editingNoteId = null;
    navigateTo(back);
  });
}

function renderCreateForm(noteToEdit = null) {
  document.getElementById('note-form-title').textContent = noteToEdit ? '✏️ Edit Note' : '✏️ Create Note';
  document.getElementById('note-id').value = noteToEdit ? noteToEdit.id : '';
  document.getElementById('note-title').value = noteToEdit ? noteToEdit.title : '';
  document.getElementById('note-subject').value = noteToEdit ? noteToEdit.subject : '';
  document.getElementById('note-content').innerHTML = noteToEdit ? noteToEdit.content : '';
  document.getElementById('note-favorite').checked = noteToEdit ? noteToEdit.isFavorite : false;
  document.getElementById('note-pin').checked = noteToEdit ? noteToEdit.isPinned : false;
  document.getElementById('note-reminder').value = noteToEdit && noteToEdit.reminderDate
    ? new Date(noteToEdit.reminderDate).toISOString().slice(0, 16) : '';

  // Populate category select
  const catSel = document.getElementById('note-category');
  catSel.innerHTML = `<option value="">— No Category —</option>`;
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = c.icon + ' ' + c.name;
    if (noteToEdit && noteToEdit.category === c.name) opt.selected = true;
    catSel.appendChild(opt);
  });
}

async function saveNote() {
  const title = document.getElementById('note-title').value.trim();
  if (!title) { showToast('Please enter a title.', 'error'); return; }

  const existingId = document.getElementById('note-id').value;
  const now = Date.now();
  const reminderVal = document.getElementById('note-reminder').value;

  const note = {
    id: existingId || genId(),
    title,
    subject: document.getElementById('note-subject').value.trim(),
    category: document.getElementById('note-category').value,
    content: document.getElementById('note-content').innerHTML,
    isFavorite: document.getElementById('note-favorite').checked,
    isPinned: document.getElementById('note-pin').checked,
    reminderDate: reminderVal ? new Date(reminderVal).getTime() : null,
    fileUrl: null, fileType: 'note',
    createdAt: existingId ? (state.notes.find(n => n.id === existingId)?.createdAt || now) : now,
    updatedAt: now,
  };

  await NotesDB.saveNote(note);
  // Update state
  const idx = state.notes.findIndex(n => n.id === note.id);
  if (idx >= 0) state.notes[idx] = note; else state.notes.push(note);

  showToast(existingId ? 'Note updated!' : 'Note saved! 🎉', 'success');
  updateStorage();
  state.editingNoteId = null;
  navigateTo('notes');
}

/* =====================================================
   NOTES LIST
   ===================================================== */
function renderNotesList() {
  populateCategoryFilter();
  const container = document.getElementById('notes-list');
  const notes = getSortedFilteredNotes();
  container.className = 'note-grid' + (state.notesView === 'list' ? ' list-view' : '');
  container.innerHTML = '';
  if (!notes.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No notes found. Try changing filters or creating a new note.</p></div>`;
    return;
  }
  notes.forEach(n => container.appendChild(createNoteCard(n, true)));

  // Bind toolbar
  document.getElementById('grid-view-btn').addEventListener('click', () => {
    state.notesView = 'grid';
    document.getElementById('grid-view-btn').classList.add('active');
    document.getElementById('list-view-btn').classList.remove('active');
    renderNotesList();
  });
  document.getElementById('list-view-btn').addEventListener('click', () => {
    state.notesView = 'list';
    document.getElementById('list-view-btn').classList.add('active');
    document.getElementById('grid-view-btn').classList.remove('active');
    renderNotesList();
  });
  document.getElementById('notes-sort').value = state.notesSort;
  document.getElementById('notes-sort').addEventListener('change', e => {
    state.notesSort = e.target.value; renderNotesList();
  });
  document.getElementById('notes-category-filter').value = state.notesCategoryFilter;
  document.getElementById('notes-category-filter').addEventListener('change', e => {
    state.notesCategoryFilter = e.target.value; renderNotesList();
  });
}

function populateCategoryFilter() {
  const sel = document.getElementById('notes-category-filter');
  const cur = sel.value || 'all';
  sel.innerHTML = `<option value="all">All Categories</option>`;
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = c.icon + ' ' + c.name;
    sel.appendChild(opt);
  });
  sel.value = cur;
}

function getSortedFilteredNotes() {
  let notes = getAllActiveNotes();
  if (state.notesCategoryFilter && state.notesCategoryFilter !== 'all') {
    notes = notes.filter(n => n.category === state.notesCategoryFilter);
  }
  switch (state.notesSort) {
    case 'createdAt': notes.sort((a, b) => b.createdAt - a.createdAt); break;
    case 'title': notes.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'favorites': notes.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)); break;
    case 'pinned': notes.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)); break;
    default: notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return notes;
}

/* =====================================================
   NOTE CARD BUILDER
   ===================================================== */
function createNoteCard(note, showActions = true) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.dataset.id = note.id;

  const typeIcon = getNoteTypeIcon(note.fileType);
  const preview = getTextPreview(note.content);
  const dateStr = formatRelativeDate(note.updatedAt);

  const listBodyWrap = state.notesView === 'list' ? '<div class="note-card-body">' : '';
  const listBodyClose = state.notesView === 'list' ? '</div>' : '';

  card.innerHTML = `
    ${listBodyWrap}
    <div class="note-card-header">
      <span class="note-type-badge">${typeIcon}</span>
      <span class="note-card-title">${escHtml(note.title)}</span>
    </div>
    ${note.subject ? `<div class="note-card-subject">${escHtml(note.subject)}</div>` : ''}
    ${preview ? `<div class="note-card-preview">${escHtml(preview)}</div>` : ''}
    ${listBodyClose}
    <div class="note-card-footer">
      <span class="note-card-date">🕐 ${dateStr}</span>
      <div class="note-card-actions">
        <button class="note-action-btn ${note.isFavorite ? 'active' : ''}" data-action="favorite" title="Favorite">⭐</button>
        <button class="note-action-btn ${note.isPinned ? 'active' : ''}" data-action="pin" title="Pin">📌</button>
        <button class="note-action-btn" data-action="edit" title="Edit">✏️</button>
        <button class="note-action-btn" data-action="delete" title="Delete">🗑️</button>
      </div>
    </div>`;

  // Card click → viewer
  card.addEventListener('click', (e) => {
    if (e.target.closest('.note-card-actions')) return;
    openViewer(note.id, state.currentPage);
  });

  // Action buttons
  card.querySelector('[data-action="favorite"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleFavorite(note.id);
    e.currentTarget.classList.toggle('active');
    renderPage(state.currentPage);
  });
  card.querySelector('[data-action="pin"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await togglePin(note.id);
    renderPage(state.currentPage);
  });
  card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditNote(note.id);
  });
  card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(note.id);
  });

  return card;
}

/* =====================================================
   UPLOAD PAGE
   ===================================================== */
function bindUploadPage() {}

function renderUploadPage() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const progressWrap = document.getElementById('upload-progress-wrap');
  const metaForm = document.getElementById('upload-meta-form');

  // Reset
  progressWrap.classList.add('hidden');
  metaForm.classList.add('hidden');
  state.uploadedFileData = null;
  dropZone.classList.remove('hidden');

  // Populate category selects
  const catSel = document.getElementById('upload-category');
  catSel.innerHTML = `<option value="">— No Category —</option>`;
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = c.icon + ' ' + c.name;
    catSel.appendChild(opt);
  });

  // Drop Zone Events (re-bind to avoid duplicates)
  const dz = dropZone.cloneNode(true);
  dropZone.parentNode.replaceChild(dz, dropZone);
  const newInput = document.getElementById('file-input');

  dz.addEventListener('click', () => newInput.click());
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') newInput.click(); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });
  newInput.addEventListener('change', () => {
    if (newInput.files[0]) handleFileSelect(newInput.files[0]);
  });

  document.getElementById('upload-cancel-btn').addEventListener('click', () => renderUploadPage());
  document.getElementById('upload-cancel-form').addEventListener('click', () => renderUploadPage());
  document.getElementById('upload-save').addEventListener('click', saveUploadedFile);
}

function handleFileSelect(file) {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|doc|docx)$/i)) {
    showToast('Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX', 'error');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('File too large. Maximum size is 50MB.', 'error');
    return;
  }

  document.getElementById('drop-zone').classList.add('hidden');
  const progressWrap = document.getElementById('upload-progress-wrap');
  progressWrap.classList.remove('hidden');
  document.getElementById('upload-file-name').textContent = file.name;
  document.getElementById('upload-file-size').textContent = formatFileSize(file.size);
  document.getElementById('upload-file-icon').textContent = getFileIcon(file.type, file.name);

  // Simulate upload progress
  const fill = document.getElementById('upload-progress-fill');
  const label = document.getElementById('upload-progress-label');
  let pct = 0;
  const reader = new FileReader();
  const interval = setInterval(() => {
    pct = Math.min(pct + Math.random() * 12 + 5, 90);
    fill.style.width = pct + '%';
    label.textContent = `Uploading... ${Math.round(pct)}%`;
  }, 80);

  reader.onload = (e) => {
    clearInterval(interval);
    fill.style.width = '100%';
    label.textContent = 'Upload complete! ✓';
    state.uploadedFileData = {
      name: file.name, size: file.size, type: file.type, dataUrl: e.target.result
    };
    // Pre-fill title
    document.getElementById('upload-title').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    setTimeout(() => {
      progressWrap.classList.add('hidden');
      document.getElementById('upload-meta-form').classList.remove('hidden');
    }, 600);
  };
  reader.onerror = () => {
    clearInterval(interval);
    showToast('Failed to read file.', 'error');
    renderUploadPage();
  };
  reader.readAsDataURL(file);
}

async function saveUploadedFile() {
  const title = document.getElementById('upload-title').value.trim();
  if (!title) { showToast('Please enter a title.', 'error'); return; }
  if (!state.uploadedFileData) { showToast('No file selected.', 'error'); return; }

  const now = Date.now();
  const fileType = getSimpleFileType(state.uploadedFileData.type, state.uploadedFileData.name);

  const note = {
    id: genId(),
    title,
    subject: document.getElementById('upload-subject').value.trim(),
    category: document.getElementById('upload-category').value,
    content: '',
    isFavorite: document.getElementById('upload-favorite').checked,
    isPinned: document.getElementById('upload-pin').checked,
    reminderDate: null,
    fileUrl: state.uploadedFileData.dataUrl,
    fileType,
    fileName: state.uploadedFileData.name,
    fileSize: state.uploadedFileData.size,
    createdAt: now, updatedAt: now,
  };

  await NotesDB.saveNote(note);
  state.notes.push(note);
  state.uploadedFileData = null;
  showToast('File saved successfully! 🎉', 'success');
  updateStorage();
  navigateTo('notes');
}

/* =====================================================
   SEARCH PAGE
   ===================================================== */
function bindSearchPage() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');

  input.addEventListener('input', () => { state.searchQuery = input.value; doSearch(); });
  clearBtn.addEventListener('click', () => { input.value = ''; state.searchQuery = ''; doSearch(); });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.searchFilter = btn.dataset.filter;
      doSearch();
    });
  });
}

function renderSearch() {
  document.getElementById('search-input').value = state.searchQuery;
  if (state.searchQuery) doSearch();
}

function doSearch() {
  const q = state.searchQuery.toLowerCase();
  const container = document.getElementById('search-results');
  container.className = 'note-grid';
  if (!q) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔎</div><p>Start typing to search your notes</p></div>`;
    return;
  }
  let notes = getAllActiveNotes().filter(n => {
    const matches = n.title.toLowerCase().includes(q) ||
      (n.subject || '').toLowerCase().includes(q) ||
      (n.category || '').toLowerCase().includes(q) ||
      getTextPreview(n.content).toLowerCase().includes(q) ||
      (n.fileName || '').toLowerCase().includes(q);
    if (!matches) return false;
    if (state.searchFilter === 'all') return true;
    if (state.searchFilter === 'note') return !n.fileUrl;
    if (state.searchFilter === 'pdf') return n.fileType === 'pdf';
    if (state.searchFilter === 'image') return n.fileType === 'image';
    return true;
  });
  if (!notes.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No results for "<strong>${escHtml(q)}</strong>"</p></div>`;
    return;
  }
  container.innerHTML = '';
  notes.forEach(n => container.appendChild(createNoteCard(n)));
}

/* =====================================================
   FAVORITES
   ===================================================== */
function renderFavorites() {
  const faves = getAllActiveNotes().filter(n => n.isFavorite).sort((a, b) => b.updatedAt - a.updatedAt);
  const container = document.getElementById('favorites-list');
  container.className = 'note-grid';
  container.innerHTML = '';
  if (!faves.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⭐</div><p>No favorites yet. Star a note to add it here.</p></div>`;
    return;
  }
  faves.forEach(n => container.appendChild(createNoteCard(n)));
}

/* =====================================================
   PINNED
   ===================================================== */
function renderPinned() {
  const pinned = getAllActiveNotes().filter(n => n.isPinned).sort((a, b) => b.updatedAt - a.updatedAt);
  const container = document.getElementById('pinned-list');
  container.className = 'note-grid';
  container.innerHTML = '';
  if (!pinned.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📌</div><p>No pinned notes. Pin important notes for quick access.</p></div>`;
    return;
  }
  pinned.forEach(n => container.appendChild(createNoteCard(n)));
}

/* =====================================================
   REMINDERS
   ===================================================== */
function bindRemindersPage() {
  document.getElementById('add-reminder-btn').addEventListener('click', () => openReminderModal());
}

function renderReminders() {
  const notes = getAllActiveNotes().filter(n => n.reminderDate).sort((a, b) => a.reminderDate - b.reminderDate);
  const container = document.getElementById('reminders-list');
  container.innerHTML = '';
  if (!notes.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><p>No reminders set. Add a reminder to a note to get notified.</p></div>`;
    return;
  }
  const now = Date.now();
  notes.forEach(n => {
    const isOverdue = n.reminderDate < now;
    const card = document.createElement('div');
    card.className = 'reminder-card' + (isOverdue ? ' overdue' : '');
    card.innerHTML = `
      <div class="reminder-card-icon">🔔</div>
      <div class="reminder-card-body">
        <div class="reminder-card-title">${escHtml(n.title)}</div>
        <div class="reminder-card-time">${isOverdue ? '⚠️ Overdue — ' : ''}${formatDateTime(n.reminderDate)}</div>
        ${n.subject ? `<div style="font-size:0.78rem;color:var(--brand-primary);margin-top:4px">${escHtml(n.subject)}</div>` : ''}
        <div class="reminder-card-actions">
          <button class="btn btn-ghost btn-sm" data-action="view">View Note</button>
          <button class="btn btn-secondary btn-sm" data-action="dismiss">Dismiss</button>
        </div>
      </div>`;
    card.querySelector('[data-action="view"]').addEventListener('click', () => openViewer(n.id, 'reminders'));
    card.querySelector('[data-action="dismiss"]').addEventListener('click', () => dismissReminder(n.id));
    container.appendChild(card);
  });
}

function openReminderModal(noteId = null) {
  const sel = document.getElementById('reminder-note-select');
  sel.innerHTML = '';
  getAllActiveNotes().forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.id; opt.textContent = n.title;
    if (noteId && n.id === noteId) opt.selected = true;
    sel.appendChild(opt);
  });
  document.getElementById('reminder-datetime').value = '';
  openModal('reminder-modal');
}

async function dismissReminder(noteId) {
  const note = findNote(noteId);
  if (!note) return;
  note.reminderDate = null;
  note.updatedAt = Date.now();
  await NotesDB.saveNote(note);
  showToast('Reminder dismissed.', 'info');
  renderPage(state.currentPage);
}

/* =====================================================
   CATEGORIES
   ===================================================== */
function bindCategoriesPage() {
  document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());
}

function renderCategories() {
  const grid = document.getElementById('categories-grid');
  grid.innerHTML = '';
  if (!state.categories.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>No categories yet.</p></div>`;
    return;
  }
  state.categories.forEach(cat => {
    const count = getAllActiveNotes().filter(n => n.category === cat.name).length;
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-card-actions">
        <button class="cat-action-btn" data-action="edit" title="Edit">✏️</button>
        <button class="cat-action-btn" data-action="delete" title="Delete">🗑️</button>
      </div>
      <div class="category-card-icon">${cat.icon}</div>
      <div class="category-card-name">${escHtml(cat.name)}</div>
      <div class="category-card-count">${count} note${count !== 1 ? 's' : ''}</div>`;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.category-card-actions')) return;
      state.notesCategoryFilter = cat.name;
      navigateTo('notes');
    });
    card.querySelector('[data-action="edit"]').addEventListener('click', e => {
      e.stopPropagation(); openCategoryModal(cat);
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', e => {
      e.stopPropagation(); deleteCategory(cat.id);
    });
    grid.appendChild(card);
  });
}

function openCategoryModal(cat = null) {
  document.getElementById('cat-modal-title').textContent = cat ? '✏️ Edit Category' : '📂 Create Category';
  document.getElementById('cat-name').value = cat ? cat.name : '';
  document.getElementById('cat-edit-id').value = cat ? cat.id : '';
  state.selectedEmoji = cat ? cat.icon : '📂';
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.emoji === state.selectedEmoji);
  });
  openModal('category-modal');
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? Notes in it will keep the category name.')) return;
  await NotesDB.deleteCategory(id);
  state.categories = state.categories.filter(c => c.id !== id);
  showToast('Category deleted.', 'info');
  renderCategories();
}

/* =====================================================
   RECYCLE BIN
   ===================================================== */
function bindRecyclePage() {
  document.getElementById('empty-recycle-btn').addEventListener('click', async () => {
    if (!state.recycle.length) { showToast('Recycle bin is already empty.', 'info'); return; }
    if (!confirm('Permanently delete all items in the recycle bin?')) return;
    await NotesDB.clearRecycle();
    state.recycle = [];
    showToast('Recycle bin emptied.', 'success');
    renderRecycle();
    updateStorage();
  });
}

function renderRecycle() {
  const container = document.getElementById('recycle-list');
  container.className = 'note-grid';
  container.innerHTML = '';
  if (!state.recycle.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🗑️</div><p>Recycle bin is empty.</p></div>`;
    return;
  }
  state.recycle.sort((a, b) => b.deletedAt - a.deletedAt).forEach(n => {
    const card = document.createElement('div');
    card.className = 'note-card recycle-card';
    const daysLeft = Math.ceil((n.deletedAt + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
    card.innerHTML = `
      <div class="note-card-header">
        <span class="note-type-badge">${getNoteTypeIcon(n.fileType)}</span>
        <span class="note-card-title">${escHtml(n.title)}</span>
      </div>
      ${n.subject ? `<div class="note-card-subject">${escHtml(n.subject)}</div>` : ''}
      <div class="note-card-preview" style="color:var(--color-danger);font-size:0.75rem">Deletes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</div>
      <div class="recycle-actions">
        <button class="btn btn-secondary btn-sm" data-action="restore">♻️ Restore</button>
        <button class="btn btn-danger btn-sm" data-action="perm-delete">🗑️ Delete Forever</button>
      </div>`;
    card.querySelector('[data-action="restore"]').addEventListener('click', () => restoreNote(n.id));
    card.querySelector('[data-action="perm-delete"]').addEventListener('click', () => openPermDeleteModal(n.id));
    container.appendChild(card);
  });
}

async function restoreNote(id) {
  const note = state.recycle.find(n => n.id === id);
  if (!note) return;
  const restored = { ...note };
  delete restored.deletedAt;
  restored.updatedAt = Date.now();
  await NotesDB.saveNote(restored);
  await NotesDB.deleteRecycle(id);
  state.notes.push(restored);
  state.recycle = state.recycle.filter(n => n.id !== id);
  showToast('Note restored! ✅', 'success');
  renderRecycle();
  updateStorage();
}

/* =====================================================
   SETTINGS
   ===================================================== */
function bindSettingsPage() {
  document.getElementById('settings-dark-mode').addEventListener('change', e => {
    state.darkMode = e.target.checked;
    Settings.set('darkMode', state.darkMode);
    applyTheme();
    updateThemeToggleIcon();
  });

  document.getElementById('settings-profile').addEventListener('click', openProfileModal);
  document.getElementById('settings-backup').addEventListener('click', backupNotes);
  document.getElementById('settings-restore').addEventListener('click', () => document.getElementById('restore-file-input').click());
  document.getElementById('restore-file-input').addEventListener('change', restoreNotes);
  document.getElementById('settings-storage-item').addEventListener('click', () => navigateTo('storage'));
  document.getElementById('settings-recycle-item').addEventListener('click', () => navigateTo('recycle'));
}

function renderSettings() {
  document.getElementById('settings-dark-mode').checked = state.darkMode;
  document.getElementById('settings-username-display').textContent = state.userName;
  document.getElementById('settings-storage-info').textContent = getStorageSummary();
  document.getElementById('settings-recycle-info').textContent = `${state.recycle.length} item${state.recycle.length !== 1 ? 's' : ''}`;
}

/* =====================================================
   NOTE VIEWER
   ===================================================== */
function bindViewerPage() {
  document.getElementById('viewer-back').addEventListener('click', () => navigateTo(state.viewingBackPage || 'notes'));
  document.getElementById('viewer-edit').addEventListener('click', () => {
    if (state.viewingNoteId) openEditNote(state.viewingNoteId);
  });
  document.getElementById('viewer-favorite').addEventListener('click', async () => {
    if (state.viewingNoteId) { await toggleFavorite(state.viewingNoteId); openViewer(state.viewingNoteId, state.viewingBackPage); }
  });
  document.getElementById('viewer-pin').addEventListener('click', async () => {
    if (state.viewingNoteId) { await togglePin(state.viewingNoteId); openViewer(state.viewingNoteId, state.viewingBackPage); }
  });
  document.getElementById('viewer-delete').addEventListener('click', () => {
    if (state.viewingNoteId) openDeleteModal(state.viewingNoteId);
  });
  document.getElementById('viewer-download').addEventListener('click', () => {
    if (state.viewingNoteId) downloadNote(state.viewingNoteId);
  });
}

function openViewer(noteId, fromPage = 'notes') {
  state.viewingNoteId = noteId;
  state.viewingBackPage = fromPage;

  const note = findNote(noteId);
  if (!note) return;

  const body = document.getElementById('viewer-body');
  const favBtn = document.getElementById('viewer-favorite');
  const pinBtn = document.getElementById('viewer-pin');

  favBtn.textContent = note.isFavorite ? '⭐ Unfavorite' : '⭐ Favorite';
  pinBtn.textContent = note.isPinned ? '📌 Unpin' : '📌 Pin';

  let attachHtml = '';
  if (note.fileUrl) {
    if (note.fileType === 'image') {
      attachHtml = `
        <div class="viewer-attachment">
          <div class="viewer-attachment-title">📎 Attachment</div>
          <div class="attachment-preview">
            <img src="${note.fileUrl}" alt="${escHtml(note.title)}" id="viewer-img" />
          </div>
        </div>`;
    } else if (note.fileType === 'pdf') {
      attachHtml = `
        <div class="viewer-attachment">
          <div class="viewer-attachment-title">📎 PDF Attachment</div>
          <div class="attachment-preview">
            <iframe class="pdf-embed" src="${note.fileUrl}" title="PDF Preview"></iframe>
          </div>
          <a class="file-download-link" href="${note.fileUrl}" download="${escHtml(note.fileName || note.title)}">
            📥 Download PDF
          </a>
        </div>`;
    } else {
      attachHtml = `
        <div class="viewer-attachment">
          <div class="viewer-attachment-title">📎 Attachment</div>
          <a class="file-download-link" href="${note.fileUrl}" download="${escHtml(note.fileName || note.title)}">
            ${getNoteTypeIcon(note.fileType)} Download ${escHtml(note.fileName || note.title)}
          </a>
        </div>`;
    }
  }

  body.innerHTML = `
    <h1 class="viewer-title">${escHtml(note.title)}</h1>
    <div class="viewer-meta">
      ${note.subject ? `<span class="viewer-badge subject">📚 ${escHtml(note.subject)}</span>` : ''}
      ${note.category ? `<span class="viewer-badge">📂 ${escHtml(note.category)}</span>` : ''}
      <span class="viewer-badge">${getNoteTypeIcon(note.fileType)} ${capitalize(note.fileType || 'Note')}</span>
      <span class="viewer-badge">🕐 Updated ${formatRelativeDate(note.updatedAt)}</span>
      <span class="viewer-badge">📅 Created ${formatDate(note.createdAt)}</span>
      ${note.isFavorite ? '<span class="viewer-badge" style="background:rgba(251,191,36,0.15);color:#D97706">⭐ Favorite</span>' : ''}
      ${note.isPinned ? '<span class="viewer-badge" style="background:rgba(239,68,68,0.1);color:#DC2626">📌 Pinned</span>' : ''}
      ${note.reminderDate ? `<span class="viewer-badge" style="background:rgba(16,185,129,0.1);color:#059669">🔔 ${formatDateTime(note.reminderDate)}</span>` : ''}
    </div>
    ${note.content ? `<div class="viewer-content">${note.content}</div>` : ''}
    ${attachHtml}`;

  // Lightbox for images
  if (note.fileType === 'image') {
    const img = body.querySelector('#viewer-img');
    img?.addEventListener('click', () => openLightbox(note.fileUrl));
  }

  navigateTo('viewer');
}

/* =====================================================
   TOPBAR
   ===================================================== */
function bindTopbar() {
  document.getElementById('theme-toggle').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    Settings.set('darkMode', state.darkMode);
    applyTheme();
    updateThemeToggleIcon();
    document.getElementById('settings-dark-mode').checked = state.darkMode;
  });
  document.getElementById('topbar-avatar').addEventListener('click', openProfileModal);
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  updateThemeToggleIcon();
}
function updateThemeToggleIcon() {
  document.getElementById('theme-toggle').textContent = state.darkMode ? '☀️' : '🌙';
}

/* =====================================================
   MODALS
   ===================================================== */
function bindModals() {
  // Close buttons
  document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
      if (modalId) closeModal(modalId);
    });
  });

  // Overlay click to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });

  // Profile save
  document.getElementById('save-profile').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value.trim() || 'Student';
    state.userName = name;
    Settings.set('userName', name);
    updateUserDisplay();
    closeModal('profile-modal');
    showToast('Profile updated!', 'success');
    if (state.currentPage === 'home') renderHome();
  });

  // Category modal
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedEmoji = btn.dataset.emoji;
    });
  });
  document.getElementById('save-category').addEventListener('click', saveCategoryFromModal);

  // Delete confirm
  document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
  document.getElementById('confirm-perm-delete').addEventListener('click', confirmPermDelete);

  // Reminder save
  document.getElementById('save-reminder-btn').addEventListener('click', saveReminderFromModal);
}

function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

function openProfileModal() {
  document.getElementById('profile-name').value = state.userName;
  document.getElementById('profile-avatar-display').textContent = state.userName.charAt(0).toUpperCase();
  openModal('profile-modal');
}

function openDeleteModal(noteId) {
  state.pendingDeleteId = noteId;
  openModal('delete-modal');
}

async function confirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;
  const note = findNote(id);
  if (!note) { closeModal('delete-modal'); return; }

  const recycled = { ...note, deletedAt: Date.now() };
  await NotesDB.saveRecycle(recycled);
  await NotesDB.deleteNote(id);
  state.notes = state.notes.filter(n => n.id !== id);
  state.recycle.push(recycled);

  closeModal('delete-modal');
  showToast('Moved to Recycle Bin.', 'info');
  updateStorage();

  if (state.currentPage === 'viewer') navigateTo(state.viewingBackPage || 'notes');
  else renderPage(state.currentPage);
}

function openPermDeleteModal(noteId) {
  state.pendingPermDeleteId = noteId;
  openModal('perm-delete-modal');
}

async function confirmPermDelete() {
  const id = state.pendingPermDeleteId;
  if (!id) return;
  await NotesDB.deleteRecycle(id);
  state.recycle = state.recycle.filter(n => n.id !== id);
  closeModal('perm-delete-modal');
  showToast('Note permanently deleted.', 'info');
  renderRecycle();
  updateStorage();
}

async function saveCategoryFromModal() {
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { showToast('Please enter a category name.', 'error'); return; }
  const editId = document.getElementById('cat-edit-id').value;

  if (editId) {
    const cat = state.categories.find(c => c.id === editId);
    if (cat) { cat.name = name; cat.icon = state.selectedEmoji; await NotesDB.saveCategory(cat); }
  } else {
    const cat = { id: genId(), name, icon: state.selectedEmoji, createdAt: Date.now() };
    await NotesDB.saveCategory(cat);
    state.categories.push(cat);
  }

  closeModal('category-modal');
  showToast(editId ? 'Category updated!' : 'Category created!', 'success');
  renderCategories();
  refreshCategorySelects();
}

async function saveReminderFromModal() {
  const noteId = document.getElementById('reminder-note-select').value;
  const dt = document.getElementById('reminder-datetime').value;
  if (!noteId || !dt) { showToast('Please select a note and date/time.', 'error'); return; }
  const note = findNote(noteId);
  if (!note) return;
  note.reminderDate = new Date(dt).getTime();
  note.updatedAt = Date.now();
  await NotesDB.saveNote(note);
  closeModal('reminder-modal');
  showToast('Reminder saved! 🔔', 'success');
  renderPage(state.currentPage);
}

/* =====================================================
   LIGHTBOX
   ===================================================== */
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.remove('hidden');
}
function bindLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', () => {
    document.getElementById('lightbox').classList.add('hidden');
  });
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === document.getElementById('lightbox')) document.getElementById('lightbox').classList.add('hidden');
  });
}

/* =====================================================
   HELPERS
   ===================================================== */
function getAllActiveNotes() {
  return [...state.notes];
}

function findNote(id) {
  return state.notes.find(n => n.id === id) || null;
}

async function toggleFavorite(id) {
  const note = findNote(id);
  if (!note) return;
  note.isFavorite = !note.isFavorite;
  note.updatedAt = Date.now();
  await NotesDB.saveNote(note);
  showToast(note.isFavorite ? '⭐ Added to Favorites' : 'Removed from Favorites', 'info');
}

async function togglePin(id) {
  const note = findNote(id);
  if (!note) return;
  note.isPinned = !note.isPinned;
  note.updatedAt = Date.now();
  await NotesDB.saveNote(note);
  showToast(note.isPinned ? '📌 Note Pinned' : 'Note Unpinned', 'info');
}

function openEditNote(id) {
  const note = findNote(id);
  if (!note) return;
  state.editingNoteId = id;
  navigateTo('create');
  renderCreateForm(note);
}

function downloadNote(id) {
  const note = findNote(id);
  if (!note) return;
  if (note.fileUrl) {
    const a = document.createElement('a');
    a.href = note.fileUrl;
    a.download = note.fileName || note.title;
    a.click();
  } else {
    // Export as HTML
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escHtml(note.title)}</title></head><body>
      <h1>${escHtml(note.title)}</h1>
      <p><strong>Subject:</strong> ${escHtml(note.subject || '')} | <strong>Category:</strong> ${escHtml(note.category || '')}</p>
      <hr/>${note.content}
      <hr/><p style="color:#999;font-size:12px">Exported from MyNotes — ${formatDate(Date.now())}</p>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = note.title + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

function refreshCategorySelects() {
  // Refresh category selects in create and upload forms
  const catSel = document.getElementById('note-category');
  const upSel = document.getElementById('upload-category');
  const notesFilter = document.getElementById('notes-category-filter');

  [catSel, upSel].forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = `<option value="">— No Category —</option>`;
    state.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name; opt.textContent = c.icon + ' ' + c.name;
      sel.appendChild(opt);
    });
    sel.value = cur;
  });

  if (notesFilter) {
    const cur = notesFilter.value;
    notesFilter.innerHTML = `<option value="all">All Categories</option>`;
    state.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name; opt.textContent = c.icon + ' ' + c.name;
      notesFilter.appendChild(opt);
    });
    notesFilter.value = cur;
  }
}

function updateUserDisplay() {
  const initial = (state.userName || 'S').charAt(0).toUpperCase();
  document.getElementById('topbar-avatar').textContent = initial;
}

/* =====================================================
   STORAGE
   ===================================================== */
async function updateStorage() {
  const allNotes = await NotesDB.getAllNotes();
  const allRecycle = await NotesDB.getAllRecycle();
  const allItems = [...allNotes, ...allRecycle];

  let totalBytes = 0;
  allItems.forEach(n => {
    totalBytes += (n.title?.length || 0) + (n.content?.length || 0) + (n.subject?.length || 0);
    if (n.fileUrl) totalBytes += n.fileSize || 0;
  });

  const quota = 50 * 1024 * 1024; // 50MB estimate
  const pct = Math.min(Math.round((totalBytes / quota) * 100), 100);
  const formatted = formatFileSize(totalBytes);

  document.getElementById('sidebar-storage-pct').textContent = pct + '%';
  document.getElementById('sidebar-storage-fill').style.width = pct + '%';
  document.getElementById('sidebar-storage-detail').textContent = formatted + ' used';
}

function getStorageSummary() {
  const notes = getAllActiveNotes();
  const files = notes.filter(n => n.fileUrl);
  return `${notes.length} notes · ${files.length} files`;
}

function renderStoragePage() {
  const notes = getAllActiveNotes();
  const files = notes.filter(n => n.fileUrl);
  let totalBytes = 0;
  notes.forEach(n => {
    totalBytes += (n.title?.length || 0) + (n.content?.length || 0);
    if (n.fileSize) totalBytes += n.fileSize;
  });
  const quota = 50 * 1024 * 1024;
  const pct = Math.min(Math.round((totalBytes / quota) * 100), 100);

  document.getElementById('storage-used-label').textContent = formatFileSize(totalBytes) + ' used';
  document.getElementById('storage-main-fill').style.width = pct + '%';
  document.getElementById('storage-main-pct').textContent = pct + '% of 50 MB estimated quota';
  document.getElementById('storage-files-count').textContent = files.length;
  document.getElementById('storage-notes-count').textContent = notes.length - files.length;
  document.getElementById('storage-categories-count').textContent = state.categories.length;
}

/* =====================================================
   BACKUP & RESTORE
   ===================================================== */
async function backupNotes() {
  const allNotes = await NotesDB.getAllNotes();
  const allCats = await NotesDB.getAllCategories();
  const backup = {
    version: 1, exportedAt: new Date().toISOString(),
    userName: state.userName, notes: allNotes, categories: allCats,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MyNotes_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Backup downloaded! 💾', 'success');
}

async function restoreNotes(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.notes) throw new Error('Invalid backup file.');
      if (!confirm(`Restore ${data.notes.length} notes from backup? This will add to existing notes.`)) return;
      for (const note of data.notes) await NotesDB.saveNote(note);
      if (data.categories) for (const cat of data.categories) await NotesDB.saveCategory(cat);
      await loadAllData();
      showToast(`Restored ${data.notes.length} notes! ✅`, 'success');
      renderPage(state.currentPage);
    } catch (err) {
      showToast('Restore failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* =====================================================
   REMINDER CHECKER
   ===================================================== */
function startReminderChecker() {
  checkReminders();
  state.reminderCheckInterval = setInterval(checkReminders, 60000);
}

function checkReminders() {
  const now = Date.now();
  const fired = getAllActiveNotes().filter(n =>
    n.reminderDate && n.reminderDate <= now && n.reminderDate > now - 65000
  );
  fired.forEach(n => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('📚 MyNotes Reminder', { body: n.title, icon: 'logo.jpg' });
    }
    showToast(`🔔 Reminder: ${n.title}`, 'info');
  });
}

// Request notification permission on first load
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

/* =====================================================
   FORMAT HELPERS
   ===================================================== */
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatRelativeDate(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return formatDate(ts);
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
function getTextPreview(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent.trim().slice(0, 120);
}
function getNoteTypeIcon(type) {
  switch (type) {
    case 'pdf': return '📄';
    case 'image': return '🖼️';
    case 'doc': return '📝';
    default: return '📓';
  }
}
function getFileIcon(mimeType, name) {
  if (mimeType === 'application/pdf' || name?.endsWith('.pdf')) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('word') || name?.match(/\.docx?$/i)) return '📝';
  return '📁';
}
function getSimpleFileType(mimeType, name) {
  if (mimeType === 'application/pdf' || name?.endsWith('.pdf')) return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('word') || name?.match(/\.docx?$/i)) return 'doc';
  return 'file';
}

/* =====================================================
   TOAST
   ===================================================== */
let toastTimeout = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* =====================================================
   BOOT
   ===================================================== */
document.addEventListener('DOMContentLoaded', init);
