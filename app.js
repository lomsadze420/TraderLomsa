/* TraderLomsa Premium — Trading Journal */

// Paste your Supabase project credentials here (Project Settings → API)
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

const STORAGE_TRADES = 'tradingJournalTrades';
const STORAGE_ACCOUNTS = 'tradingJournalAccounts';
const STORAGE_STRATEGIES = 'tradingJournalStrategies';

const LEGACY_DEFAULT_STRATEGIES = ['A+ Setup', 'Breakout', 'Order Block', '5M IFVG', 'Silver Bullet'];

const STATUSES = ['WIN', 'LOSS', 'BE', 'Partial-Loss', 'Partial-BE'];

const EMOTIONS = [
  'Confident',
  'Calm',
  'Excited',
  'Anxious',
  'Uncertain',
  'FOMO',
  'Disciplined',
  'Restless',
];

const EMOTION_MIGRATION = {
  'თავდაჯერებული': 'Confident',
  'მშვიდი': 'Calm',
  'აღტაცებული': 'Excited',
  'აღელვებული': 'Anxious',
  'არ ვიყავი დარწმუნებული': 'Uncertain',
  'დისციპლინირებული': 'Disciplined',
  'მოუსვენარი': 'Restless',
};

const DAY_MIGRATION = {
  'ორშაბათი': 'Monday',
  'სამშაბათი': 'Tuesday',
  'ოთხშაბათი': 'Wednesday',
  'ხუთშაბათი': 'Thursday',
  'პარასკევი': 'Friday',
  'კვირა': 'Sunday',
  'შაბათი': 'Saturday',
};

const TRADING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const NEWS_OPTIONS = [
  'Core PPI',
  'Unemployment Claims',
  'NFP',
  'CPI',
  'PPI',
  'FOMC',
  'Core Retail Sales',
  'ISM Manufacturing',
  'Core PCE',
  'FOMC Minutes',
  'Consumer Confidence',
  'Jolts',
  'Powell',
  'Fed Chair Testifies',
  'Advance GDP',
  'Unemployment Rate',
  'None',
];

const INSPIRATIONS = [
  'A loss is a business expense — not a personal failure.',
  'Discipline matters more than one perfect setup.',
  'Do not overtrade today — tomorrow is a new session.',
  'Define your risk before entry, not after you are in the trade.',
  'Trading without FOMO is professional trading.',
  'Patience costs more than a stop loss.',
  'Process > outcome. Your journal preserves the process.',
  'One good trade does not make you a pro — a system does.',
  'A breakeven day beats revenge trading.',
  'Your trading plan should speak louder than your emotions.',
];

const ACHIEVEMENTS = [
  { id: 'first', title: 'First Step', desc: 'Logged your first trade', check: (s) => s.total >= 1 },
  { id: 'ten', title: 'Consistency', desc: '10 trades in the journal', check: (s) => s.total >= 10 },
  { id: 'fifty', title: 'Documentarian', desc: '50 trades logged', check: (s) => s.total >= 50 },
  { id: 'winner', title: 'Win Streak', desc: 'Win Rate 60%+ (min 5 trades)', check: (s) => s.total >= 5 && s.winRate >= 60 },
  { id: 'green', title: 'Green Month', desc: 'Positive net profit', check: (s) => s.net > 0 && s.total >= 3 },
  { id: 'discipline', title: 'Discipline', desc: '5+ trades with Disciplined emotion', check: (s) => s.disciplined >= 5 },
  { id: 'rr', title: 'R:R Master', desc: 'Average R:R ≥ 1.5', check: (s) => s.avgRR >= 1.5 && s.total >= 5 },
];

const DAY_BY_JS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let trades = [];
let accounts = [];
let strategies = [];
let formPhotos = [];
let detailGalleryTradeId = null;
let detailGalleryIndex = 0;
let dashChartMode = 'equity';
let dashChartRange = 30;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedStatus = 'WIN';
let selectedEmotions = [];
let selectedNews = [];
let importMode = null;
let editingTradeId = null;

let supabase = null;
let currentUser = null;
let cloudReady = false;
let saveQueue = Promise.resolve();
let appInitialized = false;

const $ = (sel) => document.querySelector(sel);

const ICON_TRASH = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
const ICON_EYE = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
const ICON_EDIT = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`;

// ——— Storage (Supabase + local fallback) ———

function isLegacyDefaultStrategy(name) {
  return LEGACY_DEFAULT_STRATEGIES.includes(String(name || '').trim());
}

function isCloudEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && supabase && cloudReady && currentUser);
}

function initSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) return false;
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

function queueCloudSave(task) {
  saveQueue = saveQueue.then(task).catch((err) => {
    console.error(err);
    alert(`Cloud sync failed: ${err.message || err}`);
  });
  return saveQueue;
}

function loadTradesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_TRADES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadAccountsLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_ACCOUNTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadStrategiesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_STRATEGIES);
    const list = raw ? JSON.parse(raw) : [];
    return [...new Set(list.filter((s) => s && !isLegacyDefaultStrategy(s)))];
  } catch {
    return [];
  }
}

function saveTradesLocal() {
  try {
    localStorage.setItem(STORAGE_TRADES, JSON.stringify(trades));
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      alert('localStorage is full. Connect Supabase cloud sync or export JSON and delete old trades.');
    }
    throw err;
  }
}

function saveAccountsLocal() {
  localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts));
}

function saveStrategiesLocal() {
  strategies = strategies.filter((s) => s && !isLegacyDefaultStrategy(s));
  localStorage.setItem(STORAGE_STRATEGIES, JSON.stringify(strategies));
}

function tradeToRow(t) {
  return {
    id: t.id,
    user_id: currentUser.id,
    date: t.date || null,
    day_of_week: t.dayOfWeek || '',
    entry_time: t.entryTime || '',
    exit_time: t.exitTime || '',
    account: t.account || '',
    market: t.market || 'MNQ',
    session: t.session || 'NY AM',
    strategy: t.strategy || '',
    quantity: t.quantity || 1,
    direction: t.direction || 'Long',
    risked_amount: t.riskedAmount || 0,
    pnl: t.pnl || 0,
    status: t.status || 'BE',
    rr: t.rr || '',
    emotions: t.emotions || [],
    news: t.news || [],
    notes: t.notes || '',
    chart_url: t.chartUrl || '',
    photos: Array.isArray(t.photos) ? t.photos : [],
    created_at: t.createdAt || Date.now(),
    updated_at: new Date().toISOString(),
  };
}

function rowToTrade(r) {
  return normalizeTrade({
    id: r.id,
    date: r.date,
    dayOfWeek: r.day_of_week,
    entryTime: r.entry_time,
    exitTime: r.exit_time,
    account: r.account,
    market: r.market,
    session: r.session,
    strategy: r.strategy,
    quantity: r.quantity,
    direction: r.direction,
    riskedAmount: r.risked_amount,
    pnl: r.pnl,
    status: r.status,
    rr: r.rr,
    emotions: r.emotions,
    news: r.news,
    notes: r.notes,
    chartUrl: r.chart_url,
    photos: r.photos,
    createdAt: r.created_at,
  });
}

async function loadAllFromCloud() {
  if (!supabase || !currentUser) return;

  const [tradesRes, strategiesRes, accountsRes] = await Promise.all([
    supabase.from('trades').select('*').order('created_at', { ascending: false }),
    supabase.from('strategies').select('name').order('name'),
    supabase.from('accounts').select('name').order('name'),
  ]);

  if (tradesRes.error) throw tradesRes.error;
  if (strategiesRes.error) throw strategiesRes.error;
  if (accountsRes.error) throw accountsRes.error;

  trades = (tradesRes.data || []).map(rowToTrade);
  strategies = [...new Set((strategiesRes.data || []).map((r) => r.name).filter((s) => !isLegacyDefaultStrategy(s)))];
  accounts = (accountsRes.data || []).map((r) => r.name);
}

async function syncTradesToCloud() {
  if (!isCloudEnabled()) return;
  if (!trades.length) {
    const { error } = await supabase.from('trades').delete().eq('user_id', currentUser.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('trades').upsert(trades.map(tradeToRow), { onConflict: 'id' });
  if (error) throw error;
}

async function deleteTradeFromCloud(id) {
  if (!isCloudEnabled()) return;
  const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) throw error;
}

async function syncStrategiesToCloud() {
  if (!isCloudEnabled()) return;
  const { error: delErr } = await supabase.from('strategies').delete().eq('user_id', currentUser.id);
  if (delErr) throw delErr;
  if (!strategies.length) return;
  const rows = strategies.map((name) => ({ user_id: currentUser.id, name }));
  const { error } = await supabase.from('strategies').insert(rows);
  if (error) throw error;
}

async function syncAccountsToCloud() {
  if (!isCloudEnabled()) return;
  const { error: delErr } = await supabase.from('accounts').delete().eq('user_id', currentUser.id);
  if (delErr) throw delErr;
  if (!accounts.length) return;
  const rows = accounts.map((name) => ({ user_id: currentUser.id, name }));
  const { error } = await supabase.from('accounts').insert(rows);
  if (error) throw error;
}

async function migrateLocalStorageToCloud() {
  if (!isCloudEnabled()) return;

  const localTrades = loadTradesLocal().map(normalizeTrade);
  const localAccounts = loadAccountsLocal();
  const localStrategies = loadStrategiesLocal();

  const cloudEmpty = !trades.length && !accounts.length && !strategies.length;
  const localHasData = localTrades.length || localAccounts.length || localStrategies.length;
  if (!cloudEmpty || !localHasData) return;

  trades = localTrades;
  accounts = localAccounts;
  strategies = localStrategies;
  syncStrategiesFromTrades(false);

  await syncTradesToCloud();
  await syncStrategiesToCloud();
  await syncAccountsToCloud();

  localStorage.removeItem(STORAGE_TRADES);
  localStorage.removeItem(STORAGE_ACCOUNTS);
  localStorage.removeItem(STORAGE_STRATEGIES);
  updateSyncStatus('Local data migrated to cloud ✓');
}

function saveTrades() {
  saveTradesSafe();
}

function saveAccounts() {
  if (isCloudEnabled()) {
    queueCloudSave(() => syncAccountsToCloud());
  } else {
    saveAccountsLocal();
  }
}

function saveStrategies() {
  strategies = strategies.filter((s) => s && !isLegacyDefaultStrategy(s));
  if (isCloudEnabled()) {
    queueCloudSave(() => syncStrategiesToCloud());
  } else {
    saveStrategiesLocal();
  }
}

function syncStrategiesFromTrades(persist = true) {
  trades.forEach((t) => {
    const name = (t.strategy || '').trim();
    if (name && !isLegacyDefaultStrategy(name) && !strategies.includes(name)) {
      strategies.push(name);
    }
  });
  strategies = strategies.filter((s) => !isLegacyDefaultStrategy(s));
  if (persist) saveStrategies();
}

function removeSelectedStrategy() {
  const sel = $('#f-strategy');
  const name = sel?.value?.trim();
  if (!name) {
    alert('Select a strategy to remove');
    return;
  }
  if (!confirm(`Remove "${name}" from your strategy list?`)) return;
  strategies = strategies.filter((s) => s !== name);
  saveStrategies();
  populateStrategySelect('');
  if (sel) sel.value = '';
}

function saveTradesSafe() {
  if (isCloudEnabled()) {
    queueCloudSave(() => syncTradesToCloud());
    return;
  }
  saveTradesLocal();
}

function updateSyncStatus(message) {
  const el = $('#cloud-sync-status');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function showAuthModal() {
  $('#auth-modal')?.classList.remove('hidden');
}

function hideAuthModal() {
  $('#auth-modal')?.classList.add('hidden');
  $('#auth-error')?.classList.add('hidden');
}

function setAuthError(msg) {
  const el = $('#auth-error');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

async function handleSignIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function handleSignUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

async function handleSignOut() {
  await supabase.auth.signOut();
}

async function onAuthSession(user) {
  currentUser = user;
  cloudReady = Boolean(user);
  if (!user) {
    showAuthModal();
    $('#btn-sign-out')?.classList.add('hidden');
    updateSyncStatus('Sign in to enable cloud sync');
    return;
  }

  hideAuthModal();
  $('#btn-sign-out')?.classList.remove('hidden');
  await loadAllFromCloud();
  await migrateLocalStorageToCloud();
  syncStrategiesFromTrades();
  populateAccountFilter();
  populateStrategySelect();
  renderCurrentView();
  updateSyncStatus(`Synced · ${user.email}`);
}

function finishAppInit() {
  if (appInitialized) return;
  appInitialized = true;
  initFormPills();
  setTradeModalMode('add');
  populateAccountFilter();
  populateStrategySelect();
  renderFormPhotosGrid();
  renderNewsForm();
  switchView('dashboard');
}

async function bootstrapApp() {
  trades = loadTradesLocal().map(normalizeTrade);
  accounts = loadAccountsLocal();
  strategies = loadStrategiesLocal();
  syncStrategiesFromTrades(false);

  if (!initSupabaseClient()) {
    updateSyncStatus('Local mode — add Supabase keys in app.js');
    finishAppInit();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await onAuthSession(session.user);
  } else if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    showAuthModal();
    updateSyncStatus('Sign in to sync across devices');
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await onAuthSession(session.user);
      if (!appInitialized) finishAppInit();
    } else if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      currentUser = null;
      cloudReady = false;
      showAuthModal();
      $('#btn-sign-out')?.classList.add('hidden');
      updateSyncStatus('Signed out');
    }
  });

  finishAppInit();
}

// Legacy aliases
function loadTrades() {
  return loadTradesLocal();
}

function loadAccounts() {
  return loadAccountsLocal();
}

function loadStrategies() {
  return loadStrategiesLocal();
}

// ——— Trade model ———

function isLossStatus(status) {
  return status === 'LOSS' || status === 'Partial-Loss';
}

function normalizePnL(pnl, status) {
  const n = Number(pnl) || 0;
  if (isLossStatus(status)) return -Math.abs(n);
  if (status === 'WIN') return Math.abs(n);
  if (status === 'BE') return 0;
  return n;
}

function migrateEmotion(em) {
  return EMOTION_MIGRATION[em] || em;
}

function migrateDayName(day) {
  if (!day) return '';
  return DAY_MIGRATION[day] || day;
}

function getTradeDayOfWeek(t) {
  const migrated = migrateDayName(t.dayOfWeek);
  if (migrated && TRADING_DAYS.includes(migrated)) return migrated;
  if (t.date) {
    const day = DAY_BY_JS[new Date(t.date + 'T12:00:00').getDay()];
    return TRADING_DAYS.includes(day) ? day : migrated || day;
  }
  return migrated;
}

function normalizeTrade(t) {
  const riskedAmount = Number(t.riskedAmount ?? t.risk) || 0;
  let status = t.status || inferStatus(Number(t.pnl) || 0);
  if (!STATUSES.includes(status)) status = inferStatus(Number(t.pnl) || 0);
  const pnl = normalizePnL(t.pnl, status);

  const news = Array.isArray(t.news)
    ? t.news
    : typeof t.news === 'string' && t.news
      ? t.news.split(';').map((s) => s.trim()).filter(Boolean)
      : [];

  const rawEmotions = Array.isArray(t.emotions)
    ? t.emotions
    : t.emotion
      ? [t.emotion]
      : [];
  const emotions = [...new Set(rawEmotions.map(migrateEmotion))];

  let dayOfWeek = migrateDayName(t.dayOfWeek);
  if (!dayOfWeek && t.date) {
    dayOfWeek = DAY_BY_JS[new Date(t.date + 'T12:00:00').getDay()];
  }

  return {
    id: t.id || crypto.randomUUID(),
    date: t.date || '',
    dayOfWeek,
    entryTime: t.entryTime || '',
    exitTime: t.exitTime || '',
    account: t.account || '',
    market: t.market || 'MNQ',
    session: t.session || 'NY AM',
    strategy: t.strategy || '',
    quantity: Math.max(1, Number(t.quantity) || 1),
    direction: t.direction || 'Long',
    riskedAmount,
    pnl,
    status,
    rr: t.rr || calcRRDisplay(pnl, riskedAmount),
    emotions,
    news,
    notes: String(t.notes ?? t.note ?? t.analysis ?? '').trim(),
    chartUrl: t.chartUrl || '',
    photos: normalizePhotos(t),
    createdAt: t.createdAt || Date.now(),
  };
}

function normalizePhotos(t) {
  if (Array.isArray(t.photos) && t.photos.length) {
    return t.photos.filter((p) => p && typeof p === 'string');
  }
  const list = [];
  if (t.photo) list.push(t.photo);
  const url = t.chartUrl?.trim();
  if (url && !list.includes(url)) list.push(url);
  return list;
}

function getTradePhotos(t) {
  return normalizePhotos(t);
}

function getFirstPhoto(t) {
  const photos = getTradePhotos(t);
  return photos[0] || null;
}

function tradeSideLabel(t) {
  const side = t.direction === 'Short' ? 'SELL' : 'BUY';
  return `${t.market} ${side}`;
}

function tradeSideClass(t) {
  return t.direction === 'Short' ? 'tag-sell' : 'tag-buy';
}

function formatDateTimeLong(dateIso, timeStr) {
  if (!dateIso) return '—';
  if (!timeStr) return formatDate(dateIso);
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h)) return formatDate(dateIso);
  const dt = new Date(
    `${dateIso}T${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`
  );
  return dt.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function rrLabel(t) {
  if (isLossStatus(t.status)) return 'Loss';
  if (t.status === 'WIN') return t.rr;
  return t.rr;
}

function inferStatus(pnl) {
  if (pnl > 0) return 'WIN';
  if (pnl < 0) return 'LOSS';
  return 'BE';
}

function calcRRRatio(pnl, risked) {
  const risk = parseFloat(risked);
  if (!risk || risk <= 0) return null;
  const pl = parseFloat(pnl);
  if (Number.isNaN(pl)) return null;
  return Math.abs(pl) / risk;
}

function calcRRDisplay(pnl, risked) {
  const r = calcRRRatio(pnl, risked);
  return r == null ? '1 : —' : `1 : ${r.toFixed(2)}`;
}

function parseDurationMinutes(entry, exit) {
  if (!entry || !exit) return null;
  const [eh, em] = entry.split(':').map(Number);
  const [xh, xm] = exit.split(':').map(Number);
  if ([eh, em, xh, xm].some(Number.isNaN)) return null;
  let mins = xh * 60 + xm - (eh * 60 + em);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function formatDuration(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatMoney(n, showSign = true) {
  const val = Number(n) || 0;
  const abs = Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val < 0) return `-$${abs}`;
  if (showSign && val > 0) return `+$${abs}`;
  return `$${abs}`;
}

function formatTradePnL(trade) {
  return formatMoney(trade.pnl);
}

function formatDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isDisplayableImage(src) {
  if (!src) return false;
  if (src.startsWith('data:image')) return true;
  const u = src.toLowerCase();
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u) || u.includes('tradingview.com') || u.includes('s3.');
}

function getFormNotes() {
  const el = document.getElementById('f-notes');
  return el ? String(el.value).trim() : '';
}

function getFormPhotosForSave() {
  return [...formPhotos];
}

async function fileToCompressedBase64(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Image file required');
  if (file.size > 8 * 1024 * 1024) throw new Error('Image must be under 8MB');

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1280;
      let w = img.width;
      let h = img.height;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Failed to process image'));
    img.src = dataUrl;
  });
}

async function addPhotoFromFile(file) {
  const dataUrl = await fileToCompressedBase64(file);
  formPhotos.push(dataUrl);
  renderFormPhotosGrid();
}

async function addPhotosFromFiles(fileList) {
  for (const file of fileList) {
    if (file.type.startsWith('image/')) {
      await addPhotoFromFile(file);
    }
  }
}

function removeFormPhoto(index) {
  formPhotos = formPhotos.filter((_, i) => i !== index);
  renderFormPhotosGrid();
}

function renderFormPhotosGrid() {
  const grid = $('#form-photos-grid');
  const placeholder = $('#chart-drop-placeholder');
  if (!grid) return;

  if (formPhotos.length) {
    placeholder?.classList.add('hidden');
  } else {
    placeholder?.classList.remove('hidden');
  }

  grid.innerHTML = formPhotos
    .map(
      (src, i) => `
    <div class="form-photo-thumb">
      <img src="${src.startsWith('data:') ? src : escapeHtml(src)}" alt="Chart ${i + 1}" />
      <button type="button" class="form-photo-remove" data-remove-photo="${i}" title="Remove">×</button>
    </div>`
    )
    .join('');
}

function clearFormPhotos() {
  formPhotos = [];
  const fileInput = $('#f-chart-file');
  if (fileInput) fileInput.value = '';
  renderFormPhotosGrid();
}

function populateStrategySelect(selected = '') {
  const sel = $('#f-strategy');
  if (!sel) return;
  const opts = strategies.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  sel.innerHTML = `<option value="">— Select strategy —</option>${opts}`;
  if (selected && strategies.includes(selected)) sel.value = selected;
}

function isTradeModalOpen() {
  const modal = $('#trade-modal');
  return modal && !modal.classList.contains('hidden');
}

// ——— Analytics ———

function getStats(list = trades) {
  const total = list.length;
  const wins = list.filter((t) => t.status === 'WIN').length;
  const net = list.reduce((s, t) => s + t.pnl, 0);
  const winRate = total ? (wins / total) * 100 : 0;
  const durations = list.map((t) => parseDurationMinutes(t.entryTime, t.exitTime)).filter((d) => d != null);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const rrVals = list.map((t) => calcRRRatio(t.pnl, t.riskedAmount)).filter((r) => r != null);
  const avgRR = rrVals.length ? rrVals.reduce((a, b) => a + b, 0) / rrVals.length : 0;
  const disciplined = list.filter((t) => (t.emotions || []).includes('Disciplined')).length;

  return { total, wins, net, winRate, avgDuration, avgRR, disciplined };
}

function getTradesInRange(list, days) {
  if (!days || days >= 3650) return [...list];
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return list.filter((t) => t.date && new Date(t.date + 'T12:00:00') >= cutoff);
}

function getSortedTrades(list = trades) {
  return [...list].sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
}

function getAvgWinLoss(list = trades) {
  const winTrades = list.filter((t) => t.pnl > 0);
  const lossTrades = list.filter((t) => t.pnl < 0);
  const avgWin = winTrades.length ? winTrades.reduce((s, t) => s + t.pnl, 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length
    ? Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length)
    : 0;
  return { avgWin, avgLoss };
}

function getProfitFactor(list = trades) {
  const grossProfit = list.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(list.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  if (!grossLoss) return grossProfit > 0 ? 3 : 0;
  return grossProfit / grossLoss;
}

function getMaxDrawdown(values) {
  if (!values.length) return 0;
  let peak = values[0];
  let maxDD = 0;
  values.forEach((v) => {
    if (v > peak) peak = v;
    maxDD = Math.max(maxDD, peak - v);
  });
  return maxDD;
}

function getPnLRiskPercent(list = trades) {
  const risk = list.reduce((s, t) => s + (t.riskedAmount || 0), 0);
  if (!risk) return 0;
  const net = list.reduce((s, t) => s + t.pnl, 0);
  return (net / risk) * 100;
}

function getWinRateDelta(list = trades, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = list.filter((t) => t.date && new Date(t.date + 'T12:00:00') >= cutoff);
  const older = list.filter((t) => t.date && new Date(t.date + 'T12:00:00') < cutoff);
  if (!recent.length || !older.length) return 0;
  return getStats(recent).winRate - getStats(older).winRate;
}

function getDailyPnLSeries(list = trades) {
  const sorted = getSortedTrades(list);
  const byDate = {};
  sorted.forEach((t) => {
    byDate[t.date] = (byDate[t.date] || 0) + t.pnl;
  });
  return Object.entries(byDate).map(([date, pnl]) => ({ date, pnl }));
}

function getChartSeries(list, mode) {
  const sorted = getSortedTrades(list);
  if (mode === 'equity') {
    let sum = 0;
    return sorted.map((t) => {
      sum += t.pnl;
      return { label: formatDateShort(t.date), value: sum };
    });
  }
  if (mode === 'winrate') {
    return sorted.map((_, i) => {
      const slice = sorted.slice(0, i + 1);
      const wins = slice.filter((t) => t.status === 'WIN').length;
      return { label: formatDateShort(slice[i].date), value: slice.length ? (wins / slice.length) * 100 : 0 };
    });
  }
  return getDailyPnLSeries(list).map((d) => ({ label: formatDateShort(d.date), value: d.pnl }));
}

function formatDateShort(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calcPerformanceScore(list = trades) {
  const s = getStats(list);
  const { avgWin, avgLoss } = getAvgWinLoss(list);
  const pf = getProfitFactor(list);
  const cum = getCumulativePnL(list);
  const maxDD = getMaxDrawdown(cum.length ? cum : [0]);
  const totalRisk = list.reduce((sum, t) => sum + (t.riskedAmount || 0), 0) || 1;

  const radar = {
    Consistency: Math.min(100, list.length ? (s.disciplined / list.length) * 100 + 40 : 0),
    'Win %': Math.min(100, s.winRate),
    'Profit factor': Math.min(100, pf * 25),
    'Avg win/loss': avgLoss ? Math.min(100, (avgWin / avgLoss) * 40) : avgWin > 0 ? 75 : 15,
    'Recovery factor': maxDD > 0 ? Math.min(100, Math.max(0, 50 + (s.net / maxDD) * 25)) : s.net >= 0 ? 80 : 25,
    'Max drawdown': Math.max(0, Math.min(100, 100 - (maxDD / totalRisk) * 100)),
  };

  const score = Object.values(radar).reduce((a, b) => a + b, 0) / Object.keys(radar).length;
  return { score, radar };
}

function getCumulativePnL(list) {
  const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
  let sum = 0;
  return sorted.map((t) => {
    sum += t.pnl;
    return sum;
  });
}

function getStrategyStats(list = trades) {
  const map = {};
  list.forEach((t) => {
    const name = (t.strategy || '').trim();
    if (!name) return;
    if (!map[name]) map[name] = { strategy: name, total: 0, wins: 0, net: 0 };
    map[name].total += 1;
    if (t.status === 'WIN') map[name].wins += 1;
    map[name].net += t.pnl;
  });
  return Object.values(map)
    .map((s) => ({ ...s, winRate: s.total ? (s.wins / s.total) * 100 : 0 }))
    .sort((a, b) => b.winRate - a.winRate || b.net - a.net);
}

function getDayOfWeekStats(list = trades) {
  const map = {};
  TRADING_DAYS.forEach((day) => {
    map[day] = { day, total: 0, wins: 0, losses: 0, net: 0 };
  });
  list.forEach((t) => {
    const day = getTradeDayOfWeek(t);
    if (!day || !map[day]) return;
    map[day].total += 1;
    if (t.status === 'WIN') map[day].wins += 1;
    if (isLossStatus(t.status)) map[day].losses += 1;
    map[day].net += t.pnl;
  });
  return Object.values(map).map((d) => ({
    ...d,
    winRate: d.total ? (d.wins / d.total) * 100 : 0,
  }));
}

function getBestWorstDays(list = trades) {
  const days = getDayOfWeekStats(list).filter((d) => d.total > 0);
  if (!days.length) return { best: null, worst: null };

  const best = days.reduce((a, b) => {
    if (b.net !== a.net) return b.net > a.net ? b : a;
    return b.winRate > a.winRate ? b : a;
  });

  const worst = days.reduce((a, b) => {
    if (b.net !== a.net) return b.net < a.net ? b : a;
    if (b.losses !== a.losses) return b.losses > a.losses ? b : a;
    return b.winRate < a.winRate ? b : a;
  });

  return { best, worst };
}

function getRollingWinRate(list, window = 5) {
  const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
  return sorted.map((_, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    const wins = slice.filter((t) => t.status === 'WIN').length;
    return slice.length ? (wins / slice.length) * 100 : 0;
  });
}

// ——— Sparklines ———

function drawSparkline(canvasId, values, color = '#a855f7') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !values.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 4;
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();

  values.forEach((v, i) => {
    const x = pad + (i / (values.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const pts2 = values.map((v, i) => ({
    x: pad + (i / (values.length - 1 || 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }));
  ctx.beginPath();
  pts2.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.lineTo(pts2[pts2.length - 1].x, h);
  ctx.lineTo(pts2[0].x, h);
  ctx.closePath();
  ctx.fillStyle = color === '#22c55e' || color === '#ef4444'
    ? `${color}22`
    : color === '#14b8a6'
      ? 'rgba(20,184,166,0.15)'
      : color === '#f97316'
        ? 'rgba(249,115,22,0.15)'
        : 'rgba(168,85,247,0.18)';
  ctx.fill();
}

function drawMainPerformanceChart(canvasId, series, mode) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement?.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect?.width || 900));
  const h = 320;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const pad = { t: 20, r: 20, b: 36, l: 52 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
  }

  if (!series.length) {
    ctx.fillStyle = '#71717a';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No trades in this period', w / 2, h / 2);
    return;
  }

  const values = series.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const color = mode === 'equity' ? '#a855f7' : mode === 'winrate' ? '#22c55e' : '#38bdf8';

  const points = series.map((p, i) => ({
    x: pad.l + (i / (series.length - 1 || 1)) * chartW,
    y: pad.t + chartH - ((p.value - min) / range) * chartH,
    label: p.label,
    value: p.value,
  }));

  if (mode === 'equity' || mode === 'daily') {
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineTo(points[points.length - 1].x, pad.t + chartH);
    ctx.lineTo(points[0].x, pad.t + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
    grad.addColorStop(0, mode === 'equity' ? 'rgba(168,85,247,0.35)' : 'rgba(56,189,248,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  points.forEach((p) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, series.length === 1 ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  ctx.fillStyle = '#71717a';
  ctx.font = '500 10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  points.forEach((p, i) => {
    if (i % labelEvery === 0 || i === points.length - 1) {
      ctx.fillText(p.label, p.x, h - 12);
    }
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = '#a1a1aa';
  for (let i = 0; i <= 4; i++) {
    const val = max - (range / 4) * i;
    const y = pad.t + (chartH / 4) * i;
    const label = mode === 'winrate' ? `${val.toFixed(0)}%` : formatMoney(val, false);
    ctx.fillText(label, pad.l - 8, y + 4);
  }
}

function drawRadarChart(canvasId, radar) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 - 8;
  const radius = Math.min(w, h) * 0.32;
  const labels = Object.keys(radar);
  const values = Object.values(radar);
  const n = labels.length;

  for (let ring = 1; ring <= 4; ring++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (radius / 4) * ring;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();
  }

  ctx.beginPath();
  values.forEach((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (Math.min(100, Math.max(0, v)) / 100) * radius;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + Math.cos(angle) * (radius + 18);
    const y = cy + Math.sin(angle) * (radius + 18);
    ctx.fillText(label, x, y + 3);
  });
}

function setDeltaPill(el, value, suffix = '%') {
  if (!el) return;
  const sign = value > 0 ? '+' : '';
  el.textContent = `${sign}${value.toFixed(1)}${suffix}`;
  el.classList.remove('dash-delta--up', 'dash-delta--down', 'dash-delta--neutral');
  if (value > 0) el.classList.add('dash-delta--up');
  else if (value < 0) el.classList.add('dash-delta--down');
  else el.classList.add('dash-delta--neutral');
}

// ——— Status / UI helpers ———

function statusClass(status) {
  const m = {
    WIN: 'win',
    LOSS: 'loss',
    BE: 'be',
    'Partial-Loss': 'partial-loss',
    'Partial-BE': 'partial-be',
  };
  return m[status] || 'be';
}

function cardGlowClass(status) {
  if (status === 'WIN') return 'card-glow-win';
  if (status === 'LOSS' || status === 'Partial-Loss') return 'card-glow-loss';
  return 'card-glow-be';
}

function pnlNeonClass(trade) {
  const status = trade.status;
  const pnl = trade.pnl;
  if (isLossStatus(status) || pnl < 0) return 'neon-red text-red-400';
  if (status === 'WIN' || pnl > 0) return 'neon-green text-emerald-400';
  return 'text-zinc-300';
}

// ——— Navigation ———

const VIEW_META = {
  dashboard: { title: 'Dashboard', sub: 'Your trading overview' },
  journal: { title: 'Journal', sub: 'All trades' },
  calendar: { title: 'Calendar', sub: 'Monthly P&L' },
  statistics: { title: 'Statistics', sub: 'Advanced analytics' },
  achievements: { title: 'Achievements', sub: 'Milestones and progress' },
};

function switchView(name) {
  currentView = name;
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === name);
    el.classList.toggle('text-zinc-400', el.dataset.view !== name);
  });
  document.querySelectorAll('.view-panel').forEach((el) => {
    el.classList.toggle('hidden', el.id !== `view-${name}`);
  });
  $('#page-title').textContent = VIEW_META[name].title;
  $('#page-subtitle').textContent = VIEW_META[name].sub;
  renderCurrentView();
}

function renderCurrentView() {
  switch (currentView) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'journal':
      renderJournal();
      break;
    case 'calendar':
      renderCalendar();
      break;
    case 'statistics':
      renderStatistics();
      break;
    case 'achievements':
      renderAchievements();
      break;
  }
}

// ——— Dashboard ———

function renderDashboard() {
  const s = getStats();
  const rangeTrades = getTradesInRange(trades, dashChartRange);
  const cum = getCumulativePnL(trades);
  const wrSeries = getRollingWinRate(trades);
  const { avgWin, avgLoss } = getAvgWinLoss(trades);
  const { score, radar } = calcPerformanceScore(trades);
  const pnlRiskPct = getPnLRiskPercent(trades);
  const wrDelta = getWinRateDelta(trades, dashChartRange);

  const dateEl = $('#dash-welcome-date-text');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const profitEl = $('#dash-profit');
  if (profitEl) {
    profitEl.textContent = formatMoney(s.net);
    profitEl.className = `dash-stat-value ${s.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
  }

  const statCard = $('#stat-card-profit');
  if (statCard) {
    statCard.className = `dash-stat-card dash-stat-card--pnl ${s.net >= 0 ? 'dash-stat-card--positive' : 'dash-stat-card--negative'}`;
  }

  setDeltaPill($('#dash-pnl-delta'), pnlRiskPct);
  setDeltaPill($('#dash-wr-delta'), wrDelta);

  const wrEl = $('#dash-winrate');
  if (wrEl) wrEl.textContent = `${s.winRate.toFixed(1)}%`;

  const totalEl = $('#dash-total');
  if (totalEl) totalEl.textContent = s.total;

  const tradesSub = $('#dash-trades-sub');
  if (tradesSub) tradesSub.textContent = `${s.total} closed`;

  const avgEl = $('#dash-avg-winloss');
  if (avgEl) {
    avgEl.textContent = `${formatMoney(avgWin, false)} / ${formatMoney(avgLoss, false)}`;
  }

  const rrHint = $('#dash-rr-hint');
  if (rrHint) {
    rrHint.textContent = s.avgRR ? `R:R 1:${s.avgRR.toFixed(2)}` : 'Review R:R';
  }

  drawSparkline('spark-profit', cum.length ? cum : [0], s.net >= 0 ? '#22c55e' : '#ef4444');
  drawSparkline('spark-winrate', wrSeries.length ? wrSeries : [0], '#a855f7');
  drawSparkline('spark-trades', trades.length ? getSortedTrades(trades).map((_, i) => i + 1) : [0], '#14b8a6');
  drawSparkline(
    'spark-avg',
    trades.length ? getSortedTrades(trades).map((t) => (t.pnl > 0 ? t.pnl : -Math.abs(t.pnl))) : [0],
    '#f97316'
  );

  const subtitles = {
    equity: 'Your cumulative P&L over time',
    winrate: 'Rolling win rate progression',
    daily: 'Daily profit and loss',
  };
  const subEl = $('#dash-chart-subtitle');
  if (subEl) subEl.textContent = subtitles[dashChartMode] || subtitles.equity;

  document.querySelectorAll('[data-chart-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.chartMode === dashChartMode);
  });
  document.querySelectorAll('[data-chart-range]').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.chartRange) === dashChartRange);
  });

  const chartSeries = getChartSeries(rangeTrades, dashChartMode);
  drawMainPerformanceChart('dash-main-chart', chartSeries, dashChartMode);
  drawRadarChart('dash-radar-chart', radar);

  const scoreEl = $('#dash-perf-score');
  if (scoreEl) {
    scoreEl.textContent = score.toFixed(2);
    scoreEl.className = `dash-score-value ${score >= 60 ? 'dash-score-value--good' : score >= 40 ? 'dash-score-value--mid' : 'dash-score-value--low'}`;
  }

  const barFill = $('#dash-score-bar-fill');
  if (barFill) {
    barFill.style.width = `${Math.min(100, score)}%`;
    barFill.className = score >= 60 ? 'good' : score >= 40 ? 'mid' : 'low';
  }
}

// ——— Journal cards ———

function getFilteredTrades() {
  const account = $('#filter-account')?.value || '';
  const market = $('#filter-market')?.value || '';
  const status = $('#filter-status')?.value || '';
  const search = ($('#filter-search')?.value || '').toLowerCase();

  return trades
    .filter((t) => !account || t.account === account)
    .filter((t) => !market || t.market === market)
    .filter((t) => !status || t.status === status)
    .filter(
      (t) =>
        !search ||
        (t.notes || '').toLowerCase().includes(search) ||
        (t.strategy || '').toLowerCase().includes(search) ||
        (t.account || '').toLowerCase().includes(search)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
}

function renderJournal() {
  populateAccountFilter();
  const list = getFilteredTrades();
  const empty = $('#journal-empty');
  const grid = $('#journal-cards');

  if (!list.length) {
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = list.map((t) => renderTradeCard(t)).join('');
}

function renderTradeCard(t) {
  const glow = cardGlowClass(t.status);
  const pnlCls = pnlNeonClass(t);
  const firstPhoto = getFirstPhoto(t);
  const qtyLabel = t.quantity === 1 ? '1 contract' : `${t.quantity} contracts`;

  const thumbHtml = firstPhoto && isDisplayableImage(firstPhoto)
    ? `<img src="${firstPhoto.startsWith('data:') ? firstPhoto : escapeHtml(firstPhoto)}" alt="Chart" loading="lazy" />`
    : `<span class="text-xs text-zinc-600">No chart</span>`;

  return `
    <article class="journal-card glass-card rounded-xl overflow-hidden ${glow}">
      <div class="journal-card-thumb">${thumbHtml}</div>
      <div class="journal-card-body">
        <p class="journal-card-marker">${tradeSideLabel(t)}</p>
        <p class="journal-card-meta">${formatDate(t.date)}${t.strategy ? ` · ${escapeHtml(t.strategy)}` : ''}</p>
        <p class="journal-card-meta">${qtyLabel}</p>
        <p class="journal-card-pnl ${pnlCls}">${formatTradePnL(t)}</p>
      </div>
      <div class="card-actions">
        <button type="button" class="icon-btn" data-view-detail="${t.id}" title="View Detail">${ICON_EYE}</button>
        <button type="button" class="btn-edit" data-edit="${t.id}" title="Edit">${ICON_EDIT} Edit</button>
        <button type="button" class="icon-btn icon-btn-danger" data-delete="${t.id}" title="Delete">${ICON_TRASH}</button>
      </div>
    </article>`;
}

// ——— Calendar ———

function renderCalendar() {
  const label = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  $('#cal-month-label').textContent = label;

  const first = new Date(calYear, calMonth, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const pnlByDate = {};
  trades.forEach((t) => {
    if (!t.date) return;
    const [y, m] = t.date.split('-').map(Number);
    if (y === calYear && m - 1 === calMonth) {
      pnlByDate[t.date] = (pnlByDate[t.date] || 0) + t.pnl;
    }
  });

  let html = '';
  for (let i = 0; i < startPad; i++) {
    html += `<div class="cal-day other-month"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const pnl = pnlByDate[iso];
    let cls = 'cal-day';
    let pnlHtml = '';
    if (pnl != null) {
      cls += pnl >= 0 ? ' win-day' : ' loss-day';
      pnlHtml = `<div class="pnl ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">${formatMoney(pnl)}</div>`;
    }
    html += `<div class="${cls}"><span class="text-zinc-500">${d}</span>${pnlHtml}</div>`;
  }
  $('#cal-grid').innerHTML = html;
}

// ——— Statistics ———

function renderStatistics() {
  const s = getStats();
  const { best, worst } = getBestWorstDays();
  const strategyStats = getStrategyStats();

  $('#stats-best-worst-days').innerHTML = `
    <div class="glass-card rounded-2xl p-6 ${best ? 'card-glow-win border border-emerald-500/20' : ''}">
      <p class="text-xs text-zinc-500 uppercase tracking-wider">Best Day of the Week</p>
      ${
        best
          ? `<p class="text-3xl sm:text-4xl font-bold mt-3 text-emerald-400">${escapeHtml(best.day)}</p>
             <p class="font-mono text-xl mt-2 text-emerald-400/90">${formatMoney(best.net)}</p>
             <p class="text-xs text-zinc-500 mt-3">${best.winRate.toFixed(1)}% win rate · ${best.total} trade${best.total === 1 ? '' : 's'}</p>`
          : '<p class="text-sm text-zinc-600 mt-4">Log trades on weekdays to see your best day.</p>'
      }
    </div>
    <div class="glass-card rounded-2xl p-6 ${worst ? 'card-glow-loss border border-red-500/20' : ''}">
      <p class="text-xs text-zinc-500 uppercase tracking-wider">Worst Day of the Week</p>
      ${
        worst
          ? `<p class="text-3xl sm:text-4xl font-bold mt-3 text-red-400">${escapeHtml(worst.day)}</p>
             <p class="font-mono text-xl mt-2 text-red-400/90">${formatMoney(worst.net)}</p>
             <p class="text-xs text-zinc-500 mt-3">${worst.losses} loss${worst.losses === 1 ? '' : 'es'} · ${worst.winRate.toFixed(1)}% win rate · ${worst.total} trade${worst.total === 1 ? '' : 's'}</p>`
          : '<p class="text-sm text-zinc-600 mt-4">Log trades on weekdays to see your worst day.</p>'
      }
    </div>`;

  $('#stats-grid').innerHTML = `
    <div class="glass-card rounded-2xl p-5"><p class="text-xs text-zinc-500">Net Profit</p><p class="text-2xl font-mono font-bold mt-1 ${s.net >= 0 ? 'text-emerald-400' : 'text-red-400'}">${formatMoney(s.net)}</p></div>
    <div class="glass-card rounded-2xl p-5"><p class="text-xs text-zinc-500">Win Rate</p><p class="text-2xl font-mono font-bold mt-1 text-purple-300">${s.winRate.toFixed(1)}%</p></div>
    <div class="glass-card rounded-2xl p-5"><p class="text-xs text-zinc-500">Avg Duration</p><p class="text-2xl font-mono font-bold mt-1">${formatDuration(s.avgDuration)}</p></div>
    <div class="glass-card rounded-2xl p-5"><p class="text-xs text-zinc-500">Avg R:R</p><p class="text-2xl font-mono font-bold mt-1">${s.avgRR ? `1 : ${s.avgRR.toFixed(2)}` : '—'}</p></div>
    <div class="glass-card rounded-2xl p-5"><p class="text-xs text-zinc-500">Best Trade</p><p class="text-2xl font-mono font-bold mt-1 text-emerald-400">${trades.length ? formatMoney(Math.max(...trades.map((t) => t.pnl))) : '—'}</p></div>
    <div class="glass-card rounded-2xl p-5"><p class="text-xs text-zinc-500">Worst Trade</p><p class="text-2xl font-mono font-bold mt-1 text-red-400">${trades.length ? formatMoney(Math.min(...trades.map((t) => t.pnl))) : '—'}</p></div>
  `;

  $('#stats-by-strategy').innerHTML = strategyStats.length
    ? strategyStats
        .map((st) => {
          const barColor = st.winRate >= 50 ? 'from-emerald-500 to-emerald-400' : 'from-red-500 to-red-400';
          return `<div class="glass-inset rounded-xl p-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span class="tag-strategy">${escapeHtml(st.strategy)}</span>
              <span class="font-mono text-lg font-bold text-purple-300">${st.winRate.toFixed(1)}%</span>
            </div>
            <div class="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r ${barColor}" style="width:${Math.max(st.winRate, 4)}%"></div>
            </div>
            <div class="flex justify-between text-[10px] text-zinc-500 mt-2">
              <span>${st.wins}W / ${st.total - st.wins}L · ${st.total} trades</span>
              <span class="font-mono ${st.net >= 0 ? 'text-emerald-400' : 'text-red-400'}">${formatMoney(st.net)}</span>
            </div>
          </div>`;
        })
        .join('')
    : '<p class="text-sm text-zinc-600">Assign a strategy to trades to compare win rates.</p>';

  const byStatus = {};
  STATUSES.forEach((st) => {
    byStatus[st] = trades.filter((t) => t.status === st).length;
  });
  $('#stats-by-status').innerHTML = STATUSES.map(
    (st) =>
      `<div class="glass-inset rounded-xl px-4 py-3"><span class="status-3d ${statusClass(st)} text-[10px]">${st}</span><p class="text-2xl font-mono font-bold mt-2">${byStatus[st]}</p></div>`
  ).join('');

  const markets = ['MNQ', 'MES', 'MYM'];
  $('#stats-by-market').innerHTML = markets
    .map((m) => {
      const mt = trades.filter((t) => t.market === m);
      const net = mt.reduce((sum, t) => sum + t.pnl, 0);
      return `<div class="flex justify-between items-center py-2 border-b border-white/5">
        <span class="font-semibold text-purple-300">${m}</span>
        <span class="font-mono ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}">${formatMoney(net)}</span>
        <span class="text-xs text-zinc-500">${mt.length} trades</span>
      </div>`;
    })
    .join('');
}

// ——— Achievements ———

function renderAchievements() {
  const s = getStats();
  $('#achievements-grid').innerHTML = ACHIEVEMENTS.map((a) => {
    const unlocked = a.check(s);
    return `
      <div class="achievement-card glass-card rounded-2xl p-5 ${unlocked ? 'unlocked' : ''}">
        <div class="w-10 h-10 rounded-xl ${unlocked ? 'bg-purple-500/25 border border-purple-500/40' : 'bg-zinc-800 border border-zinc-700'} flex items-center justify-center mb-3">
          ${unlocked ? '✦' : '○'}
        </div>
        <h4 class="font-semibold text-sm">${a.title}</h4>
        <p class="text-xs text-zinc-500 mt-1">${a.desc}</p>
        <p class="text-[10px] mt-3 ${unlocked ? 'text-purple-400' : 'text-zinc-600'}">${unlocked ? 'Unlocked' : 'Locked'}</p>
      </div>`;
  }).join('');
}

// ——— Form modal ———

function initFormPills() {
  $('#status-pills').innerHTML = STATUSES.map(
    (st) =>
      `<button type="button" class="status-pill-btn ${st === selectedStatus ? 'active' : ''}" data-status="${st}">${st}</button>`
  ).join('');

  $('#emotion-pills').innerHTML = EMOTIONS.map(
    (e) => `<button type="button" class="pill" data-emotion="${escapeHtml(e)}">${escapeHtml(e)}</button>`
  ).join('');

  $('#news-pills').innerHTML = NEWS_OPTIONS.map(
    (n) => `<button type="button" class="pill news" data-news="${escapeHtml(n)}">${escapeHtml(n)}</button>`
  ).join('');
}

function updateFormRR() {
  $('#f-rr').textContent = calcRRDisplay($('#f-pnl').value, $('#f-risked').value);
}

function syncDayFromDate() {
  const v = $('#f-date').value;
  if (!v) return;
  const day = DAY_BY_JS[new Date(v + 'T12:00:00').getDay()];
  const sel = $('#f-day');
  if (TRADING_DAYS.includes(day)) sel.value = day;
}

function renderNewsForm() {
  const el = $('#news-selected');
  el.innerHTML = selectedNews.length
    ? selectedNews.map((n) => `<span class="pill news selected">${escapeHtml(n)}</span>`).join('')
    : '';
  document.querySelectorAll('#news-pills .pill').forEach((btn) => {
    btn.classList.toggle('selected', selectedNews.includes(btn.dataset.news));
  });
}

function renderEmotionForm() {
  document.querySelectorAll('#emotion-pills .pill').forEach((btn) => {
    btn.classList.toggle('selected', selectedEmotions.includes(btn.dataset.emotion));
  });
}

function setTradeModalMode(mode) {
  const isEdit = mode === 'edit';
  $('#trade-modal-title').textContent = isEdit ? 'Edit Trade' : 'Add Trade';
  $('#trade-submit-btn').textContent = isEdit ? 'Update Trade' : 'Save Trade';
}

function openTradeModal() {
  editingTradeId = null;
  resetTradeForm();
  setTradeModalMode('add');
  populateFormAccounts();
  populateStrategySelect();
  $('#trade-modal').classList.remove('hidden');
  $('#f-date').value = new Date().toISOString().slice(0, 10);
  syncDayFromDate();
  updateFormRR();
}

function openTradeModalForEdit(id) {
  const t = trades.find((x) => x.id === id);
  if (!t) return;
  editingTradeId = id;
  setTradeModalMode('edit');
  populateFormAccounts();
  populateFormFromTrade(t);
  $('#trade-modal').classList.remove('hidden');
}

function populateFormFromTrade(t) {
  $('#f-account').value = t.account;
  $('#f-market').value = t.market;
  const dir = document.querySelector(`input[name="direction"][value="${t.direction}"]`);
  if (dir) dir.checked = true;
  $('#f-date').value = t.date;
  if (t.dayOfWeek) $('#f-day').value = t.dayOfWeek;
  $('#f-entry').value = t.entryTime || '';
  $('#f-exit').value = t.exitTime || '';
  $('#f-session').value = t.session;
  populateStrategySelect(t.strategy || '');
  $('#f-quantity').value = t.quantity || 1;
  $('#f-risked').value = t.riskedAmount;
  $('#f-pnl').value = t.pnl;
  selectedStatus = t.status;
  selectedEmotions = [...(t.emotions || [])];
  selectedNews = [...(t.news || [])];
  formPhotos = [...getTradePhotos(t)];
  renderFormPhotosGrid();
  const notesEl = document.getElementById('f-notes');
  if (notesEl) notesEl.value = t.notes || '';
  document.querySelectorAll('.status-pill-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.status === selectedStatus)
  );
  renderNewsForm();
  renderEmotionForm();
  updateFormRR();
}

function closeTradeModal() {
  $('#trade-modal').classList.add('hidden');
  editingTradeId = null;
  resetTradeForm();
  setTradeModalMode('add');
}

function resetTradeForm() {
  $('#trade-form').reset();
  selectedStatus = 'WIN';
  selectedEmotions = [];
  selectedNews = [];
  clearFormPhotos();
  document.querySelectorAll('.status-pill-btn').forEach((b) => b.classList.toggle('active', b.dataset.status === 'WIN'));
  renderNewsForm();
  renderEmotionForm();
  populateStrategySelect();
  $('#f-quantity').value = 1;
  const notesEl = document.getElementById('f-notes');
  if (notesEl) notesEl.value = '';
  $('#strategy-add-panel')?.classList.add('hidden');
  $('#f-date').value = new Date().toISOString().slice(0, 10);
  syncDayFromDate();
}

function renderDetailGallery(t) {
  const photos = getTradePhotos(t).filter((p) => isDisplayableImage(p));
  if (!photos.length) {
    return '<p class="text-zinc-600 text-sm py-8 text-center">No chart images</p>';
  }
  const idx = Math.min(detailGalleryIndex, photos.length - 1);
  const src = photos[idx];
  const imgAttr = src.startsWith('data:') ? src : escapeHtml(src);

  const thumbs = photos
    .map(
      (p, i) => `
    <button type="button" class="gallery-thumb ${i === idx ? 'active' : ''}" data-gallery-thumb="${i}">
      <img src="${p.startsWith('data:') ? p : escapeHtml(p)}" alt="" />
    </button>`
    )
    .join('');

  const nav =
    photos.length > 1
      ? `<button type="button" class="gallery-nav prev" data-gallery-prev>‹</button>
         <button type="button" class="gallery-nav next" data-gallery-next>›</button>`
      : '';

  return `
    <div class="detail-gallery" data-gallery-trade="${t.id}">
      <div class="detail-gallery-main">
        ${nav}
        <img src="${imgAttr}" alt="Chart" class="gallery-main-img cursor-pointer" data-lightbox-src="${idx}" referrerpolicy="no-referrer" />
      </div>
      ${photos.length > 1 ? `<div class="detail-gallery-thumbs">${thumbs}</div>` : ''}
    </div>`;
}

function openDetailModal(id) {
  const t = trades.find((x) => x.id === id);
  if (!t) return;

  detailGalleryTradeId = id;
  detailGalleryIndex = 0;

  const pnlCls = pnlNeonClass(t);
  const photos = getTradePhotos(t);
  const qtyLabel = t.quantity === 1 ? '1 share' : `${t.quantity} shares`;
  const notesText = String(t.notes || '').trim();

  $('#detail-content').innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-symbol">${tradeSideLabel(t)}</p>
        <p class="detail-sub">${qtyLabel} • ${formatDate(t.date)}</p>
      </div>
      <div class="detail-pnl-block">
        <p class="detail-pnl-label">Total P&L</p>
        <p class="detail-pnl-value ${pnlCls}">${formatTradePnL(t)}</p>
      </div>
    </div>

    <div class="detail-columns">
      <div class="glass-inset rounded-xl p-4 space-y-3">
        <p class="text-[10px] uppercase tracking-wider text-purple-400/80 font-semibold">Trade Metadata</p>
        <div class="detail-field"><label>Quantity</label><p>${t.quantity}</p></div>
        <div class="detail-field"><label>Session</label><p><span class="tag-pill tag-session">${t.session}</span></p></div>
        <div class="detail-field"><label>Entry Date</label><p>${formatDateTimeLong(t.date, t.entryTime)}</p></div>
        <div class="detail-field"><label>Exit Date</label><p>${formatDateTimeLong(t.date, t.exitTime)}</p></div>
        <div class="flex flex-wrap gap-4 pt-2 border-t border-white/5 mt-2">
          <div><p class="text-[10px] text-zinc-500">Risk</p><p class="font-mono text-sm">${formatMoney(t.riskedAmount, false)}</p></div>
          <div><p class="text-[10px] text-zinc-500">Risk/Reward</p><p class="font-mono text-sm">${rrLabel(t)}</p></div>
          <div><p class="text-[10px] text-zinc-500">Realized P&L</p><p class="font-mono text-sm ${pnlCls}">${formatTradePnL(t)}</p></div>
        </div>
      </div>
      <div class="glass-inset rounded-xl p-4 space-y-3">
        <p class="text-[10px] uppercase tracking-wider text-purple-400/80 font-semibold">Trade Info</p>
        <div class="detail-field"><label>Strategy</label><p>${t.strategy ? `<span class="tag-strategy">${escapeHtml(t.strategy)}</span>` : '—'}</p></div>
        <div class="detail-field"><label>Account</label><p>${escapeHtml(t.account || '—')}</p></div>
        <div class="detail-field"><label>Trade Type</label><p><span class="tag-pill ${tradeSideClass(t)}">${t.direction === 'Short' ? 'SELL' : 'BUY'}</span></p></div>
        ${(t.emotions || []).length ? `<div class="detail-field"><label>Psychology</label><div class="flex flex-wrap gap-1 mt-1">${(t.emotions || []).map((e) => `<span class="pill selected text-[10px]">${escapeHtml(e)}</span>`).join('')}</div></div>` : ''}
        ${(t.news || []).filter((n) => n !== 'None').length ? `<div class="detail-field"><label>News</label><div class="flex flex-wrap gap-1 mt-1">${(t.news || []).map((n) => `<span class="pill news selected text-[10px]">${escapeHtml(n)}</span>`).join('')}</div></div>` : ''}
      </div>
    </div>

    ${renderDetailGallery(t)}

    <div class="glass-inset rounded-xl p-4 mt-4">
      <p class="text-[10px] uppercase tracking-wider text-purple-400/80 mb-2">Analysis & Notes</p>
      <p class="detail-notes">${notesText ? escapeHtml(notesText) : '<span class="text-zinc-500 italic">No notes</span>'}</p>
    </div>

    <div class="flex gap-2 mt-6 pt-4 border-t border-white/5">
      <button type="button" class="btn-edit" data-edit-from-detail="${t.id}">${ICON_EDIT} Edit Trade</button>
    </div>
  `;

  $('#detail-modal').classList.remove('hidden');
}

function refreshDetailGallery() {
  const t = trades.find((x) => x.id === detailGalleryTradeId);
  if (!t) return;
  const galleryEl = $('#detail-content')?.querySelector('[data-gallery-trade]');
  if (galleryEl) {
    const wrapper = galleryEl.parentElement;
    const temp = document.createElement('div');
    temp.innerHTML = renderDetailGallery(t);
    galleryEl.replaceWith(temp.firstElementChild);
  }
}

function closeDetailModal() {
  $('#detail-modal').classList.add('hidden');
}

function populateFormAccounts() {
  const sel = $('#f-account');
  const opts = accounts.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  sel.innerHTML = accounts.length
    ? `<option value="">Select account</option>${opts}`
    : '<option value="">Add account first</option>';
  if (accounts.length === 1) sel.value = accounts[0];
}

function populateAccountFilter() {
  const sel = $('#filter-account');
  if (!sel) return;
  const prev = sel.value;
  const opts = accounts.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  sel.innerHTML = `<option value="">All Accounts</option>${opts}`;
  if (accounts.includes(prev)) sel.value = prev;
}

// ——— Accounts modal ———

function renderAccountsList() {
  $('#accounts-list').innerHTML = accounts
    .map(
      (name, i) => `
    <li class="flex justify-between items-center px-3 py-2 rounded-lg glass-inset text-sm">
      <span>${escapeHtml(name)}</span>
      <button type="button" data-rm-acc="${i}" class="text-xs text-zinc-500 hover:text-red-400">Remove</button>
    </li>`
    )
    .join('');
}

// ——— Export / Import ———

const CSV_HEADERS = [
  'date', 'dayOfWeek', 'entryTime', 'exitTime', 'account', 'market', 'session',
  'strategy', 'quantity', 'direction', 'riskedAmount', 'pnl', 'status', 'rr', 'emotions', 'news', 'notes',
];

function exportPayload() {
  return { version: 5, exportedAt: new Date().toISOString(), accounts, strategies, trades };
}

function tradesToCSV(list) {
  const esc = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = list.map((t) =>
    CSV_HEADERS.map((h) => {
      if (h === 'emotions') return esc((t.emotions || []).join('; '));
      if (h === 'news') return esc((t.news || []).join('; '));
      return esc(t[h]);
    }).join(',')
  );
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = '';
    let inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { values.push(cur); cur = ''; continue; }
      cur += c;
    }
    values.push(cur);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
    });
    if (obj.emotions) obj.emotions = obj.emotions.split(';').map((s) => s.trim()).filter(Boolean);
    if (obj.news) obj.news = obj.news.split(';').map((s) => s.trim()).filter(Boolean);
    return normalizeTrade({ ...obj, riskedAmount: parseFloat(obj.riskedAmount) || 0, pnl: parseFloat(obj.pnl) || 0 });
  });
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

async function replaceAllTradesInCloud() {
  if (!isCloudEnabled()) return;
  const { error: delErr } = await supabase.from('trades').delete().eq('user_id', currentUser.id);
  if (delErr) throw delErr;
  if (!trades.length) return;
  const { error } = await supabase.from('trades').insert(trades.map(tradeToRow));
  if (error) throw error;
}

function applyImport(data, replace) {
  if (data.accounts?.length) {
    accounts = [...new Set([...accounts, ...data.accounts])];
    saveAccounts();
  }
  if (data.strategies?.length) {
    const incoming = data.strategies.filter((s) => s && !isLegacyDefaultStrategy(s));
    strategies = [...new Set([...strategies, ...incoming])];
    saveStrategies();
    populateStrategySelect();
  }
  const incoming = (data.trades || []).map(normalizeTrade);
  incoming.forEach((t) => {
    const name = (t.strategy || '').trim();
    if (name && !isLegacyDefaultStrategy(name) && !strategies.includes(name)) {
      strategies.push(name);
    }
  });
  saveStrategies();
  populateStrategySelect();
  trades = replace ? incoming : [...incoming, ...trades.filter((t) => !incoming.some((i) => i.id === t.id))];
  if (isCloudEnabled() && replace) {
    queueCloudSave(() => replaceAllTradesInCloud());
  } else {
    saveTrades();
  }
  renderCurrentView();
}

// ——— Events ———

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

$('#brand-home')?.addEventListener('click', () => switchView('dashboard'));

$('#view-dashboard')?.addEventListener('click', (e) => {
  const modeBtn = e.target.closest('[data-chart-mode]');
  if (modeBtn) {
    dashChartMode = modeBtn.dataset.chartMode;
    renderDashboard();
    return;
  }
  const rangeBtn = e.target.closest('[data-chart-range]');
  if (rangeBtn) {
    dashChartRange = Number(rangeBtn.dataset.chartRange);
    renderDashboard();
  }
});

window.addEventListener('resize', () => {
  if (currentView === 'dashboard') renderDashboard();
});

$('#btn-add-trade').addEventListener('click', openTradeModal);
$('#trade-modal-close').addEventListener('click', closeTradeModal);
$('#trade-modal').addEventListener('click', (e) => {
  if (e.target === $('#trade-modal')) closeTradeModal();
});

$('#f-date').addEventListener('change', syncDayFromDate);
$('#f-risked').addEventListener('input', updateFormRR);
$('#f-pnl').addEventListener('input', updateFormRR);

$('#status-pills').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-status]');
  if (!btn) return;
  selectedStatus = btn.dataset.status;
  document.querySelectorAll('.status-pill-btn').forEach((b) => b.classList.toggle('active', b === btn));
  const pnl = parseFloat($('#f-pnl').value);
  if (!Number.isNaN(pnl)) {
    if (selectedStatus === 'WIN' && pnl < 0) $('#f-pnl').value = Math.abs(pnl);
    if ((selectedStatus === 'LOSS' || selectedStatus === 'Partial-Loss') && pnl > 0) {
      $('#f-pnl').value = -Math.abs(pnl);
    }
    if (selectedStatus === 'BE') $('#f-pnl').value = 0;
    updateFormRR();
  }
});

$('#emotion-pills').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-emotion]');
  if (!btn) return;
  const em = btn.dataset.emotion;
  selectedEmotions = selectedEmotions.includes(em)
    ? selectedEmotions.filter((x) => x !== em)
    : [...selectedEmotions, em];
  renderEmotionForm();
});

$('#news-pills').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-news]');
  if (!btn) return;
  const n = btn.dataset.news;
  if (n === 'None') selectedNews = ['None'];
  else {
    selectedNews = selectedNews.filter((x) => x !== 'None');
    selectedNews = selectedNews.includes(n) ? selectedNews.filter((x) => x !== n) : [...selectedNews, n];
  }
  renderNewsForm();
});

$('#news-clear').addEventListener('click', () => {
  selectedNews = [];
  renderNewsForm();
});

$('#btn-toggle-strategy')?.addEventListener('click', () => {
  $('#strategy-add-panel')?.classList.toggle('hidden');
  $('#new-strategy-name')?.focus();
});

$('#btn-remove-strategy')?.addEventListener('click', removeSelectedStrategy);

$('#btn-save-strategy')?.addEventListener('click', () => {
  const name = $('#new-strategy-name')?.value.trim();
  if (!name) return;
  if (isLegacyDefaultStrategy(name)) {
    alert('That name is reserved. Choose a custom strategy name.');
    return;
  }
  if (!strategies.includes(name)) {
    strategies.push(name);
    saveStrategies();
  }
  populateStrategySelect(name);
  $('#f-strategy').value = name;
  $('#strategy-add-panel')?.classList.add('hidden');
  $('#new-strategy-name').value = '';
});

const chartDropzone = $('#chart-dropzone');
const chartFileInput = $('#f-chart-file');

chartDropzone?.addEventListener('click', (e) => {
  if (e.target.closest('[data-remove-photo]')) return;
  chartFileInput?.click();
});

chartFileInput?.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files?.length) return;
  try {
    await addPhotosFromFiles(files);
  } catch (err) {
    alert(err.message);
  }
  e.target.value = '';
});

chartDropzone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  chartDropzone.classList.add('drag-over');
});

chartDropzone?.addEventListener('dragleave', () => {
  chartDropzone.classList.remove('drag-over');
});

chartDropzone?.addEventListener('drop', async (e) => {
  e.preventDefault();
  chartDropzone.classList.remove('drag-over');
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  try {
    await addPhotosFromFiles(files);
  } catch (err) {
    alert(err.message);
  }
});

document.addEventListener('paste', async (e) => {
  if (!isTradeModalOpen()) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const blob = item.getAsFile();
      if (blob) {
        try {
          await addPhotoFromFile(blob);
        } catch (err) {
          alert(err.message);
        }
      }
      break;
    }
  }
});

$('#form-photos-grid')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-photo]');
  if (btn) removeFormPhoto(Number(btn.dataset.removePhoto));
});

$('#trade-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const account = $('#f-account').value;
  if (!account) {
    alert('Please select an account');
    return;
  }
  const riskedAmount = parseFloat($('#f-risked').value);
  const pnl = parseFloat($('#f-pnl').value);
  if (Number.isNaN(riskedAmount) || riskedAmount <= 0 || Number.isNaN(pnl)) {
    alert('Please fill in Risk and P&L');
    return;
  }

  const raw = {
    date: $('#f-date').value,
    dayOfWeek: $('#f-day').value,
    entryTime: $('#f-entry').value,
    exitTime: $('#f-exit').value,
    account,
    market: $('#f-market').value,
    session: $('#f-session').value,
    strategy: $('#f-strategy').value || '',
    quantity: parseInt($('#f-quantity').value, 10) || 1,
    direction: document.querySelector('input[name="direction"]:checked')?.value || 'Long',
    riskedAmount,
    pnl,
    status: selectedStatus,
    emotions: [...selectedEmotions],
    news: [...selectedNews],
    notes: getFormNotes(),
    chartUrl: '',
    photos: getFormPhotosForSave(),
  };

  if (editingTradeId) {
    const existing = trades.find((t) => t.id === editingTradeId);
    const trade = normalizeTrade({
      ...raw,
      id: editingTradeId,
      createdAt: existing?.createdAt || Date.now(),
    });
    trade.rr = calcRRDisplay(trade.pnl, trade.riskedAmount);
    trades = trades.map((t) => (t.id === editingTradeId ? trade : t));
  } else {
    const trade = normalizeTrade({ ...raw, id: crypto.randomUUID(), createdAt: Date.now() });
    trade.rr = calcRRDisplay(trade.pnl, trade.riskedAmount);
    trades.unshift(trade);
  }

  saveTrades();
  closeTradeModal();
  closeDetailModal();
  if (currentView !== 'journal') switchView('journal');
  else renderJournal();
  renderDashboard();
});

document.body.addEventListener('click', (e) => {
  const editFromDetail = e.target.closest('[data-edit-from-detail]');
  if (editFromDetail) {
    const id = editFromDetail.dataset.editFromDetail;
    closeDetailModal();
    openTradeModalForEdit(id);
    return;
  }

  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    openTradeModalForEdit(editBtn.dataset.edit);
    return;
  }

  const detailBtn = e.target.closest('[data-view-detail]');
  if (detailBtn) {
    openDetailModal(detailBtn.dataset.viewDetail);
    return;
  }

  if (e.target.closest('[data-delete]')) {
    const id = e.target.closest('[data-delete]').dataset.delete;
    if (confirm('Delete trade?')) {
      trades = trades.filter((t) => t.id !== id);
      if (isCloudEnabled()) queueCloudSave(() => deleteTradeFromCloud(id));
      saveTrades();
      closeDetailModal();
      renderCurrentView();
    }
    return;
  }

  const galleryThumb = e.target.closest('[data-gallery-thumb]');
  if (galleryThumb) {
    detailGalleryIndex = Number(galleryThumb.dataset.galleryThumb);
    refreshDetailGallery();
    return;
  }

  if (e.target.closest('[data-gallery-prev]')) {
    const t = trades.find((x) => x.id === detailGalleryTradeId);
    const len = t ? getTradePhotos(t).length : 0;
    if (len) detailGalleryIndex = (detailGalleryIndex - 1 + len) % len;
    refreshDetailGallery();
    return;
  }

  if (e.target.closest('[data-gallery-next]')) {
    const t = trades.find((x) => x.id === detailGalleryTradeId);
    const len = t ? getTradePhotos(t).length : 0;
    if (len) detailGalleryIndex = (detailGalleryIndex + 1) % len;
    refreshDetailGallery();
    return;
  }

  const lightboxTrigger = e.target.closest('.gallery-main-img');
  if (lightboxTrigger) {
    const t = trades.find((x) => x.id === detailGalleryTradeId);
    const photos = t ? getTradePhotos(t).filter((p) => isDisplayableImage(p)) : [];
    const src = photos[detailGalleryIndex];
    if (src) {
      $('#lightbox-img').src = src;
      $('#chart-lightbox').classList.remove('hidden');
    }
    return;
  }

  if (e.target.closest('[data-rm-acc]')) {
    const i = +e.target.closest('[data-rm-acc]').dataset.rmAcc;
    accounts = accounts.filter((_, idx) => idx !== i);
    saveAccounts();
    renderAccountsList();
    populateAccountFilter();
  }
});

$('#detail-modal-close').addEventListener('click', closeDetailModal);
$('#detail-modal').addEventListener('click', (e) => {
  if (e.target === $('#detail-modal')) closeDetailModal();
});

$('#lightbox-close').addEventListener('click', () => $('#chart-lightbox').classList.add('hidden'));
$('#chart-lightbox').addEventListener('click', (e) => {
  if (e.target === $('#chart-lightbox')) $('#chart-lightbox').classList.add('hidden');
});

$('#btn-manage-accounts').addEventListener('click', () => {
  renderAccountsList();
  $('#accounts-modal').classList.remove('hidden');
});
$('#accounts-close').addEventListener('click', () => $('#accounts-modal').classList.add('hidden'));
$('#add-account').addEventListener('click', () => {
  const name = $('#new-account').value.trim();
  if (!name || accounts.includes(name)) return;
  accounts.push(name);
  saveAccounts();
  $('#new-account').value = '';
  renderAccountsList();
  populateFormAccounts();
});

$('#cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
$('#cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

['filter-account', 'filter-market', 'filter-status', 'filter-search'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => currentView === 'journal' && renderJournal());
    el.addEventListener('change', () => currentView === 'journal' && renderJournal());
  }
});

$('#export-json').addEventListener('click', () =>
  downloadFile(`tradevault-${Date.now()}.json`, JSON.stringify(exportPayload(), null, 2), 'application/json')
);
$('#export-csv').addEventListener('click', () =>
  downloadFile(`tradevault-${Date.now()}.csv`, tradesToCSV(trades), 'text/csv')
);
$('#import-json').addEventListener('click', () => {
  importMode = 'json';
  $('#import-file').accept = '.json';
  $('#import-file').click();
});
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const payload = file.name.endsWith('.csv')
      ? { trades: parseCSV(text) }
      : Array.isArray(JSON.parse(text))
        ? { trades: JSON.parse(text) }
        : JSON.parse(text);
    const n = (payload.trades || []).length;
    if (!n && !payload.accounts?.length) return alert('Empty file');
    applyImport(payload, confirm(`Found ${n} trades. OK = Replace, Cancel = Merge`));
    alert('Import done');
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
});

$('#auth-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabase) return alert('Supabase is not configured.');
  setAuthError('');
  const email = $('#auth-email')?.value.trim();
  const password = $('#auth-password')?.value;
  try {
    await handleSignIn(email, password);
  } catch (err) {
    setAuthError(err.message);
  }
});

$('#auth-sign-up')?.addEventListener('click', async () => {
  if (!supabase) return alert('Supabase is not configured.');
  setAuthError('');
  const email = $('#auth-email')?.value.trim();
  const password = $('#auth-password')?.value;
  try {
    await handleSignUp(email, password);
    alert('Account created! Check your email to confirm (if enabled), then sign in.');
  } catch (err) {
    setAuthError(err.message);
  }
});

$('#btn-sign-out')?.addEventListener('click', async () => {
  if (!supabase) return;
  await handleSignOut();
});

bootstrapApp();
