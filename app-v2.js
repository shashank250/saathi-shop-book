(() => {
  'use strict';

  const VERSION = 1;
  const ITERATIONS = 600000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const gate = $('#unlockScreen');
  const gateContent = $('#gateContent');
  const app = $('#app');
  const dialog = $('#dialog');
  const dialogBody = $('#dialogBody');
  const dialogActions = $('#dialogActions');
  const storeKey = edition => `saathi.vault.v${VERSION}.${edition}`;
  const themeKey = edition => `saathi.theme.${edition}`;
  const routeParams = new URLSearchParams(location.search);
  const editionFromUrl = routeParams.get('edition') === 'satyam' ? 'satyam' : 'community';
  const seededShop = editionFromUrl === 'satyam' && routeParams.get('starter') === '1';
  let edition = seededShop ? 'satyam-starter' : editionFromUrl;
  const isSatyamEdition = value => value === 'satyam' || value === 'satyam-starter';
  let vault = null;
  let cryptoKey = null;
  let state = null;
  let saveQueue = Promise.resolve();
  let deferredInstall = null;
  let lockTimer = null;
  let toastTimer = null;
  let language = 'en';

  const words = {
    en: { home: 'Home', credit: 'Credit', stock: 'Stock', reports: 'Reports', more: 'More', today: 'TODAY', welcome: 'A clear view of your shop, at a glance.', sales: 'Sales today', profit: 'Gross profit', due: 'Money customers owe', quick: 'QUICK ACTIONS', what: 'What do you need?', recordSale: 'Record a sale', cashCredit: 'Cash or customer credit', recordPayment: 'Record a payment', paidBack: 'Customer paid back', checkStock: 'Check stock', monthly: 'Monthly report', privacy: 'Your shop book is private.', details: 'Details', saved: 'Saved in this browser', noSales: 'No sales yet', noBalances: 'No open balances', addCredit: 'Add credit', setUp: 'Set up', language: 'हिन्दी', install: 'Install', light: 'Dark mode', title: 'Credit book', who: 'Know who owes you and what has been paid.', items: 'Your stock', list: 'Keep prices and quantities up to date.', reportTitle: 'Reports', reportIntro: 'A simple summary to help you plan your month.', moreTitle: 'More', moreIntro: 'Settings, privacy and plans.' },
    hi: { home: 'होम', credit: 'उधार', stock: 'सामान', reports: 'रिपोर्ट', more: 'और', today: 'आज', welcome: 'दुकान का साफ़ हिसाब, एक नज़र में।', sales: 'आज की बिक्री', profit: 'आज का मुनाफ़ा', due: 'ग्राहकों से लेना है', quick: 'जल्दी काम', what: 'क्या करना है?', recordSale: 'बिक्री लिखें', cashCredit: 'नकद या उधार', recordPayment: 'भुगतान लिखें', paidBack: 'ग्राहक ने पैसे दिए', checkStock: 'सामान देखें', monthly: 'महीने की रिपोर्ट', privacy: 'आपकी दुकान की बही निजी है।', details: 'जानकारी', saved: 'इस फ़ोन पर सेव', noSales: 'अभी बिक्री नहीं', noBalances: 'कोई खुला उधार नहीं', addCredit: 'उधार जोड़ें', setUp: 'शुरू करें', language: 'English', install: 'ऐप लगाएं', light: 'डार्क मोड', title: 'उधार बही', who: 'किसका उधार बाकी है और किसने पैसे दिए।', items: 'आपका सामान', list: 'कीमत और मात्रा अपडेट रखें।', reportTitle: 'रिपोर्ट', reportIntro: 'महीने की योजना के लिए आसान हिसाब।', moreTitle: 'और', moreIntro: 'सेटिंग, सुरक्षा और प्लान।' }
  };
  const tr = key => words[language][key] || words.en[key] || key;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function money(value) {
    try { return new Intl.NumberFormat(language === 'hi' ? 'hi-IN' : (navigator.language || 'en-US'), { style: 'currency', currency: state?.currency || 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0); }
    catch { return '₹' + Math.round(Number(value) || 0).toLocaleString('en-IN'); }
  }
  function localDay(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function id() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function dateLabel(value, includeTime = true) {
    const date = new Date(value);
    return date.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN', includeTime
      ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
      : { day: 'numeric', month: 'short' });
  }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function setTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    $('#themeSwitch').setAttribute('aria-checked', theme === 'dark');
    $('#themeButton').setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    $('#themeButton').title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#17251d' : '#f6f2e7';
  }
  function applyLanguage() {
    document.documentElement.lang = language === 'hi' ? 'hi' : 'en';
    const nav = ['home', 'ledger', 'stock', 'reports', 'more'];
    $$('.nav-item').forEach((button, i) => { const label = $('small', button); if (label) label.textContent = tr(nav[i]); });
    $('#todayLabel').textContent = tr('today');
    $('#shopGreeting').textContent = tr('welcome');
    const metricLabels = $$('.metric-label');
    [tr('sales'), tr('profit'), tr('due')].forEach((label, i) => { if (metricLabels[i]) metricLabels[i].textContent = label; });
    const section = $('.section-title .eyebrow'); if (section) section.textContent = tr('quick');
    const sectionHead = $('.section-title h2'); if (sectionHead) sectionHead.textContent = tr('what');
    const actionTitles = $$('.action-tile b');
    [tr('recordSale'), tr('recordPayment'), tr('checkStock'), tr('monthly')].forEach((label, i) => { if (actionTitles[i]) actionTitles[i].textContent = label; });
    const actionSubs = $$('.action-tile small');
    [tr('cashCredit'), tr('paidBack')].forEach((label, i) => { if (actionSubs[i]) actionSubs[i].textContent = label; });
    if (actionSubs[2]) actionSubs[2].textContent = tr('checkStock');
    if (actionSubs[3]) actionSubs[3].textContent = tr('monthly');
    const navText = $$('.nav-item small'); navText.forEach((n, i) => n.textContent = tr(nav[i]));
    $('#languageButton').textContent = tr('language');
    $('#languageTopButton').textContent = tr('language');
    $('#installButton').textContent = tr('install');
    $('#themeSwitch').setAttribute('aria-label', tr('light'));
  }

  async function deriveKey(pin, salt, iterations = ITERATIONS) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  function asBytes(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
  function asBase64(bytes) {
    const view = new Uint8Array(bytes); let binary = '';
    for (let offset = 0; offset < view.length; offset += 0x8000) binary += String.fromCharCode(...view.subarray(offset, Math.min(offset + 0x8000, view.length)));
    return btoa(binary);
  }
  async function seal(data, key, saltB64) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return { v: VERSION, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: saltB64, iv: asBase64(iv), data: asBase64(cipher) };
  }
  async function openVault(encrypted, key) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asBytes(encrypted.iv) }, key, asBytes(encrypted.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function validateBackupEnvelope(backup) {
    if (backup?.format !== 'saathi-encrypted-backup' || !['satyam', 'satyam-starter', 'community'].includes(backup.edition) || backup.vault?.v !== VERSION || backup.vault?.kdf !== 'PBKDF2-SHA256') throw new Error('invalid backup');
    const rounds = Number(backup.vault.iterations);
    if (!Number.isInteger(rounds) || rounds < 100000 || rounds > 1000000) throw new Error('invalid backup');
    const salt = asBytes(backup.vault.salt), iv = asBytes(backup.vault.iv), data = asBytes(backup.vault.data);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16 || data.length > 5 * 1024 * 1024) throw new Error('invalid backup');
  }
  function createEmptyState(ownerName, shopName, currency = 'INR') {
    return { ownerName: isSatyamEdition(edition) ? 'Satyam Bhaiya' : ownerName, shopName, currency, items: [], entries: [], language: 'en', theme: 'light', createdAt: new Date().toISOString() };
  }
  function createSatyamStarterState() {
    const items = [
      { id: 'demo-chai', name: 'Masala chai', price: 12, cost: 8, stock: 45, reorderAt: 15, unit: 'cups', active: true, icon: '☕' },
      { id: 'demo-samosa', name: 'Samosa', price: 15, cost: 9, stock: 22, reorderAt: 10, unit: 'pieces', active: true, icon: '◈' },
      { id: 'demo-juice', name: 'Mango juice', price: 30, cost: 18, stock: 8, reorderAt: 10, unit: 'bottles', active: true, icon: '◉' },
      { id: 'demo-biscuit', name: 'Biscuit packet', price: 10, cost: 6, stock: 38, reorderAt: 12, unit: 'packets', active: true, icon: '▤' },
      { id: 'demo-cold-drink', name: 'Cold drink', price: 40, cost: 28, stock: 14, reorderAt: 8, unit: 'bottles', active: true, icon: '◍' },
      { id: 'demo-pakora', name: 'Bread pakora', price: 20, cost: 12, stock: 6, reorderAt: 8, unit: 'pieces', active: true, icon: '✦' },
      { id: 'demo-soda', name: 'Lemon soda', price: 20, cost: 10, stock: 19, reorderAt: 8, unit: 'glasses', active: true, icon: '◌' },
      { id: 'demo-maggi', name: 'Veg Maggi', price: 35, cost: 20, stock: 8, reorderAt: 5, unit: 'plates', active: true, icon: '≋' }
    ];
    const entries = [];
    const dateAt = (daysAgo, hour, minute = 0) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(hour, minute, 0, 0);
      return date.toISOString();
    };
    const addSale = (item, quantity, daysAgo, hour, payment = 'cash', customer = '') => {
      const amount = quantity * item.price, cost = quantity * item.cost;
      entries.push({ id: 'demo-entry-' + (entries.length + 1), type: 'sale', itemId: item.id, itemName: item.name, quantity, amount, cost, profit: amount - cost, customer, payment, time: dateAt(daysAgo, hour) });
    };
    const addBalance = (type, customer, amount, daysAgo, hour) => entries.push({ id: 'demo-entry-' + (entries.length + 1), type, customer, amount, time: dateAt(daysAgo, hour) });
    for (let ago = Math.min(14, new Date().getDate() - 1); ago >= 1; ago--) {
      for (let slot = 0; slot < 4; slot++) {
        const item = items[(ago * 2 + slot * 3) % items.length];
        const quantity = 1 + ((ago + slot) % 4);
        addSale(item, quantity, ago, [9, 11, 14, 17][slot], 'cash');
      }
    }
    addBalance('credit', 'Rahul Yadav', 450, 5, 12);
    addBalance('payment', 'Rahul Yadav', 200, 3, 16);
    addBalance('credit', 'Neha Singh', 300, 4, 13);
    addBalance('credit', 'Aman Verma', 500, 7, 11);
    addBalance('payment', 'Aman Verma', 250, 2, 15);
    addBalance('credit', 'Priya Sharma', 600, 10, 12);
    addBalance('payment', 'Priya Sharma', 100, 4, 17);
    addBalance('credit', 'Vikas Kumar', 350, 8, 14);
    addSale(items[0], 15, 0, 9, 'cash');
    addSale(items[1], 10, 0, 10, 'credit', 'Rahul Yadav');
    addSale(items[2], 5, 0, 11, 'cash');
    addSale(items[3], 8, 0, 12, 'cash');
    addSale(items[4], 6, 0, 13, 'cash');
    addSale(items[5], 5, 0, 14, 'cash');
    addSale(items[6], 8, 0, 15, 'cash');
    addSale(items[7], 5, 0, 16, 'credit', 'Neha Singh');
    addSale(items[0], 5, 0, 17, 'cash');
    entries.sort((a, b) => a.time.localeCompare(b.time));
    return { ownerName: 'Satyam Bhaiya', shopName: "Satyam Bhaiya's shop", currency: 'INR', items, entries, language: 'en', theme: 'light', createdAt: new Date().toISOString() };
  }
  function gateHeader(title, copy) {
    return `<h1>${escapeHtml(title)}</h1><p class="gate-copy">${escapeHtml(copy)}</p>`;
  }
  function renderGate(message = '') {
    gate.classList.remove('hidden'); app.classList.add('hidden');
    const isSatyam = isSatyamEdition(edition);
    document.title = isSatyam ? 'Saathi for Satyam Bhaiya' : 'Saathi — My Shop';
    $('link[rel="manifest"]').href = edition === 'satyam-starter' ? './manifest-satyam-book.json' : isSatyam ? './manifest-satyam.json' : './manifest.json';
    setTheme(localStorage.getItem(themeKey(edition)) || 'light');
    const saved = localStorage.getItem(storeKey(edition));
    if (saved) {
      gateContent.innerHTML = gateHeader(isSatyam ? 'Welcome back, Satyam Bhaiya' : 'Welcome back to My Shop', 'Unlock this private shop book with your PIN.') +
        `<form id="unlockForm" class="form-stack"><div class="field"><label for="unlockPin">Your shop PIN</label><input id="unlockPin" type="password" inputmode="numeric" autocomplete="current-password" minlength="8" maxlength="12" required placeholder="8 or more digits"></div>${message ? `<p class="form-error">${escapeHtml(message)}</p>` : ''}<button class="button primary full" type="submit">Unlock ${isSatyam ? "Satyam Bhaiya's shop" : 'My Shop'}</button></form><div class="gate-switch"><span>Forgot your PIN? Restore an encrypted backup for this shop link.</span></div>`;
      $('#unlockForm').onsubmit = async e => { e.preventDefault(); await unlock($('#unlockPin').value); };
    } else {
      const owner = isSatyam ? 'Satyam Bhaiya' : '';
      const shop = isSatyam ? "Satyam Bhaiya's shop" : '';
      gateContent.innerHTML = gateHeader(isSatyam ? "Satyam Bhaiya's shop" : 'My shop', isSatyam ? 'A private, simple shop book made for Satyam Bhaiya.' : 'A private, simple shop book for your sales, stock and customer credit.') +
        `<form id="setupForm" class="form-stack"><div class="field"><label for="ownerName">Your name</label><input id="ownerName" ${isSatyam ? 'readonly aria-readonly="true"' : ''} required maxlength="40" value="${owner}" placeholder="Your name" autocomplete="name"></div><div class="field"><label for="shopName">Shop name</label><input id="shopName" required maxlength="50" value="${shop}" placeholder="Your shop name" autocomplete="organization"></div><div class="field"><label for="shopCurrency">Shop currency</label><select id="shopCurrency"><option value="INR">Indian rupee · INR ₹</option><option value="USD">US dollar · USD $</option><option value="EUR">Euro · EUR €</option><option value="GBP">British pound · GBP £</option><option value="AED">UAE dirham · AED</option><option value="AUD">Australian dollar · AUD $</option><option value="CAD">Canadian dollar · CAD $</option><option value="JPY">Japanese yen · JPY ¥</option><option value="MXN">Mexican peso · MXN $</option><option value="BRL">Brazilian real · BRL R$</option><option value="ZAR">South African rand · ZAR R</option></select></div><div class="field"><label for="newPin">Create an 8-digit shop PIN</label><input id="newPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" required placeholder="8 or more digits"><small class="field-help">Saathi cannot reset a forgotten PIN. Save an encrypted backup.</small></div><div class="field"><label for="confirmPin">Confirm your PIN</label><input id="confirmPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" required placeholder="Type it once more"></div>${message ? `<p class="form-error">${escapeHtml(message)}</p>` : ''}<button class="button primary full" type="submit">Create ${isSatyam ? "Satyam Bhaiya's shop book" : 'My Shop book'}</button></form><div class="gate-switch"><span>Already have an encrypted backup for ${isSatyam ? "Satyam Bhaiya's shop" : 'My Shop'}?</span><button class="text-button" id="gateRestore">Restore backup</button></div>`;
      $('#setupForm').onsubmit = async e => {
        e.preventDefault(); const pin = $('#newPin').value, confirm = $('#confirmPin').value;
        if (!/^\d{8,12}$/.test(pin)) return renderGate('Choose a PIN with 8 to 12 digits.');
        if (pin !== confirm) return renderGate('Those PINs do not match. Please enter them again.');
        const owner = isSatyam ? 'Satyam Bhaiya' : $('#ownerName').value.trim(), shop = $('#shopName').value.trim();
        if (!owner || !shop) return renderGate('Enter your name and shop name to continue.');
        await createShopBook(owner, shop, pin, $('#shopCurrency').value);
      };
      $('#gateRestore').onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json'; input.onchange = () => restoreBackupFile(input.files[0], true); input.click(); };
    }
  }
  async function createShopBook(owner, shop, pin, currency = 'INR') {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = asBase64(salt); cryptoKey = await deriveKey(pin, salt);
      state = edition === 'satyam-starter' ? createSatyamStarterState() : createEmptyState(owner, shop, currency);
      if (edition === 'satyam-starter') { state.shopName = shop; state.currency = currency; }
      vault = await seal(state, cryptoKey, saltB64);
      localStorage.setItem(storeKey(edition), JSON.stringify(vault));
      startApp();
      showView('home');
      toast('Your private shop book is ready. Add your first item.');
    } catch (error) { renderGate('This phone could not create a secure shop book. Please use a current browser.'); }
  }
  async function unlock(pin) {
    if (!/^\d{8,12}$/.test(pin)) return renderGate('Enter the 8 to 12 digit PIN you created.');
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey(edition)) || 'null');
      if (!saved || saved.v !== VERSION) throw new Error('unavailable');
      vault = saved; cryptoKey = await deriveKey(pin, asBytes(vault.salt), vault.iterations || ITERATIONS);
      state = await openVault(vault, cryptoKey);
      if (!state || !Array.isArray(state.items) || !Array.isArray(state.entries)) throw new Error('bad vault');
      if (isSatyamEdition(edition) && state.ownerName !== 'Satyam Bhaiya') { state.ownerName = 'Satyam Bhaiya'; await persist(); }
      startApp(); showView('home');
    } catch (error) { cryptoKey = null; state = null; renderGate('That PIN did not unlock the shop book. Try again.'); }
  }
  async function persist() {
    if (!state || !cryptoKey || !vault) return;
    saveQueue = saveQueue.then(async () => {
      const sealed = await seal(state, cryptoKey, vault.salt);
      localStorage.setItem(storeKey(edition), JSON.stringify(sealed));
      vault = sealed;
    }).catch(() => toast('Could not save in this browser. Download a backup and free some space.'));
    return saveQueue;
  }
  function startApp() {
    gate.classList.add('hidden'); app.classList.remove('hidden');
    document.title = isSatyamEdition(edition) ? 'Saathi for Satyam Bhaiya' : 'Saathi — My Shop';
    $('link[rel="manifest"]').href = edition === 'satyam-starter' ? './manifest-satyam-book.json' : isSatyamEdition(edition) ? './manifest-satyam.json' : './manifest.json';
    $('#recordsPanel').classList.remove('hidden');
    $('#sampleNote').classList.toggle('hidden', edition !== 'satyam-starter');
    $('#todayStatus').textContent = tr('saved');
    ['#lockButton', '#dictateButton', '#profileButton', '#editProfile', '#saleAction', '#paymentAction', '#newCreditButton', '#addItemButton', '#addFirstItem', '#privacyStrip'].forEach(selector => $(selector).classList.remove('hidden'));
    $('#currencySelect').disabled = false;
    language = state.language || 'en';
    setTheme(state.theme || 'light');
    applyLanguage();
    $('#shopLabel').textContent = state.shopName;
    $('#greeting').textContent = `Namaste, ${state.ownerName}`;
    $('#profileTitle').textContent = state.shopName;
    $('#editionLabel').textContent = isSatyamEdition(edition) ? "Personal edition for Satyam Bhaiya's shop" : 'Community edition for small shops and stalls';
    $('#currencySelect').value = state.currency || 'INR';
    $('#profileButton').textContent = state.ownerName.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    $('#reportMonth').value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    $('#todayLabel').textContent = `${tr('today')} · ${now.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`.toUpperCase();
    renderAll(); resetLockTimer();
  }
  function lockApp() {
    clearTimeout(lockTimer); cryptoKey = null; state = null; vault = null;
    renderGate();
  }
  function resetLockTimer() {
    clearTimeout(lockTimer);
    if (!state) return;
    lockTimer = setTimeout(lockApp, 5 * 60 * 1000);
  }
  function showView(name) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'reports') renderReports();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function totalDueFor(name) {
    const target = name.trim().toLocaleLowerCase();
    return state.entries.reduce((sum, entry) => {
      if (!entry.customer || entry.customer.trim().toLocaleLowerCase() !== target) return sum;
      if (entry.type === 'sale' && entry.payment === 'credit') return sum + entry.amount;
      if (entry.type === 'credit') return sum + entry.amount;
      if (entry.type === 'payment') return sum - entry.amount;
      return sum;
    }, 0);
  }
  function customerBalances() {
    const names = [...new Set(state.entries.filter(e => e.customer && ((e.type === 'sale' && e.payment === 'credit') || e.type === 'credit')).map(e => e.customer.trim()))];
    return names.map(name => ({ name, due: Math.max(0, totalDueFor(name)) })).filter(c => c.due > 0.01).sort((a, b) => b.due - a.due);
  }
  function sumEntries(entries, selector) { return entries.reduce((total, e) => total + (Number(selector(e)) || 0), 0); }
  function selectedMonth() { const d = new Date(); return $('#reportMonth').value || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  function monthEntries(month) { return state.entries.filter(e => { const d = new Date(e.time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === month; }); }
  function kindLabel(entry) {
    if (entry.type === 'payment') return 'Payment received';
    if (entry.type === 'credit') return 'Credit added';
    return entry.payment === 'credit' ? 'Sale · customer credit' : 'Cash sale';
  }
  function iconFor(entry) { return entry.type === 'payment' ? '₹' : entry.type === 'credit' ? '↗' : '＋'; }
  function signedAmount(entry) {
    if (entry.type === 'payment') return `+${money(entry.amount)}`;
    if (entry.type === 'credit') return money(entry.amount);
    return `+${money(entry.amount)}`;
  }
  function renderActivity(container, entries, empty) {
    container.innerHTML = entries.map(entry => `<div class="activity-row"><div class="row-main"><span class="row-icon">${iconFor(entry)}</span><span><b class="row-title">${escapeHtml(entry.itemName || entry.customer || 'Shop entry')}</b><small class="row-sub">${escapeHtml(kindLabel(entry))} · ${dateLabel(entry.time)}</small></span></div><span class="row-value ${entry.type === 'payment' ? 'in' : ''}">${signedAmount(entry)}<small>${entry.customer ? escapeHtml(entry.customer) : (entry.quantity ? `${entry.quantity} ${entry.quantity === 1 ? 'item' : 'items'}` : '')}</small></span></div>`).join('');
    empty.classList.toggle('show', entries.length === 0);
  }
  function renderAll() {
    if (!state) return;
    const today = localDay();
    const todayEntries = state.entries.filter(e => localDay(new Date(e.time)) === today);
    const sales = todayEntries.filter(e => e.type === 'sale');
    const due = customerBalances();
    const low = state.items.filter(item => item.active !== false && item.stock <= item.reorderAt).length;
    $('#todaySales').textContent = money(sumEntries(sales, e => e.amount));
    $('#salesCount').textContent = sales.length ? `${sales.length} ${sales.length === 1 ? 'sale' : 'sales'} today` : tr('noSales');
    $('#todayProfit').textContent = money(sumEntries(sales, e => e.profit));
    $('#totalDue').textContent = money(sumEntries(due, c => c.due));
    $('#dueCount').textContent = due.length ? `${due.length} ${due.length === 1 ? 'customer' : 'customers'} with a balance` : tr('noBalances');
    $('#ledgerDue').textContent = money(sumEntries(due, c => c.due));
    $('#ledgerPeople').textContent = due.length ? `${due.length} ${due.length === 1 ? 'customer' : 'customers'} to follow up` : tr('noBalances');
    $('#lowStockNote').textContent = low ? `${low} ${low === 1 ? 'item' : 'items'} running low` : 'See what is running low';
    $('#setupNudge').classList.toggle('hidden', state.items.length > 0);
    renderActivity($('#homeActivity'), todayEntries.slice().reverse().slice(0, 5), $('#emptyActivity'));
    renderCustomers(due);
    renderActivity($('#ledgerActivity'), ledgerEntries(), $('#emptyLedger'));
    renderItems();
    renderReports();
  }
  function ledgerEntries() {
    const filter = $('#ledgerFilter').value;
    return state.entries.filter(e => filter === 'all' || e.type === filter || (filter === 'credit' && e.type === 'sale' && e.payment === 'credit')).slice().reverse().slice(0, 40);
  }
  function renderCustomers(balances = customerBalances()) {
    $('#customerList').innerHTML = balances.map(c => `<div class="customer-row"><div class="row-main"><span class="row-icon">${escapeHtml(c.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase())}</span><span><b class="row-title">${escapeHtml(c.name)}</b><small class="row-sub">${state.entries.filter(e => e.customer?.toLowerCase() === c.name.toLowerCase()).length} shop entries</small></span></div><div class="customer-actions"><span class="balance">${money(c.due)}</span><button data-payment="${escapeHtml(c.name)}">Paid</button></div></div>`).join('');
    $('#emptyCustomers').classList.toggle('show', balances.length === 0);
    $$('[data-payment]').forEach(button => button.onclick = () => openPayment(button.dataset.payment));
  }
  function renderItems() {
    const items = state.items.filter(item => item.active !== false);
    $('#itemCount').textContent = String(items.length);
    $('#stockSummary').textContent = items.length ? `${items.filter(x => x.stock <= x.reorderAt).length} items need a stock check.` : 'Start with the items you sell most.';
    $('#itemList').innerHTML = items.map(item => {
      const low = item.stock <= item.reorderAt;
      return `<div class="item-row"><div class="row-main"><span class="row-icon">${escapeHtml(item.icon || '▦')}</span><span><b class="row-title">${escapeHtml(item.name)}</b><small class="row-sub">${low ? 'Running low · ' : ''}${item.stock} ${escapeHtml(item.unit || 'units')} · cost ${money(item.cost)}</small></span></div><span class="item-price"><b>${money(item.price)}</b><small>selling price</small></span><span class="item-actions"><button data-restock="${escapeHtml(item.id)}">+ stock</button><button data-edit-item="${escapeHtml(item.id)}">Edit</button></span></div>`;
    }).join('');
    $('#emptyItems').classList.toggle('show', items.length === 0);
    $$('[data-restock]').forEach(button => button.onclick = () => openRestock(button.dataset.restock));
    $$('[data-edit-item]').forEach(button => button.onclick = () => openItemEditor(button.dataset.editItem));
  }
  function renderReports() {
    if (!state || !$('#reportMonth')) return;
    const entries = monthEntries(selectedMonth());
    const sales = entries.filter(e => e.type === 'sale');
    $('#reportSales').textContent = money(sumEntries(sales, e => e.amount));
    $('#reportCost').textContent = money(sumEntries(sales, e => e.cost));
    $('#reportProfit').textContent = money(sumEntries(sales, e => e.profit));
    $('#reportDue').textContent = money(sumEntries(customerBalances(), c => c.due));
    const perItem = {};
    sales.forEach(e => { const name = e.itemName || 'Other'; perItem[name] = (perItem[name] || 0) + e.amount; });
    const items = Object.entries(perItem).sort((a, b) => b[1] - a[1]).slice(0, 6), max = items[0]?.[1] || 1;
    $('#popularItems').innerHTML = items.map(([name, amount]) => `<div class="bar-row"><div class="bar-meta"><span>${escapeHtml(name)}</span><span>${money(amount)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, amount / max * 100)}%"></div></div></div>`).join('');
    $('#emptyPopular').classList.toggle('show', items.length === 0);
  }
  function openDialog(title, copy, fields, onSave, confirmText = 'Save') {
    dialogBody.innerHTML = `<h2>${escapeHtml(title)}</h2><p class="dialog-copy">${escapeHtml(copy)}</p><div class="dialog-fields">${fields}</div>`;
    dialogActions.innerHTML = `<button class="button secondary" type="button" id="cancelDialog">Cancel</button><button class="button primary" type="button" id="confirmDialog">${escapeHtml(confirmText)}</button>`;
    dialog.showModal();
    $('#closeDialog').onclick = () => dialog.close();
    $('#cancelDialog').onclick = () => dialog.close();
    $('#confirmDialog').onclick = async () => { const result = await onSave(); if (result !== false) dialog.close(); };
    const focus = $('input,select,button', dialogBody); if (focus) setTimeout(() => focus.focus(), 50);
  }
  function field(label, idName, opts = {}) {
    const type = opts.type || 'text';
    if (opts.options) return `<div class="field"><label for="${idName}">${escapeHtml(label)}</label><select id="${idName}" ${opts.required === false ? '' : 'required'}>${opts.options}</select></div>`;
    return `<div class="field"><label for="${idName}">${escapeHtml(label)}</label><input id="${idName}" type="${type}" ${opts.min !== undefined ? `min="${opts.min}"` : ''} ${opts.step ? `step="${opts.step}"` : ''} ${opts.maxlength ? `maxlength="${opts.maxlength}"` : ''} ${opts.inputmode ? `inputmode="${opts.inputmode}"` : ''} ${opts.required === false ? '' : 'required'} placeholder="${escapeHtml(opts.placeholder || '')}" autocomplete="${opts.autocomplete || 'off'}">${opts.help ? `<small class="field-help">${escapeHtml(opts.help)}</small>` : ''}</div>`;
  }
  function requireNumber(selector, label, min = 0) {
    const n = Number($(selector).value);
    if (!Number.isFinite(n) || n < min) { toast(`${label} must be ${min ? `at least ${min}` : 'a valid amount'}.`); $(selector).focus(); return null; }
    return n;
  }
  function openSale(prefill = {}) {
    const items = state.items.filter(x => x.active !== false);
    if (!items.length) { showView('stock'); openItemEditor(); toast('Add an item before recording a sale.'); return; }
    openDialog('Record a sale', 'Choose what was sold. Saathi will update stock and estimate your profit.',
      `<div class="field"><label for="saleItem">Item</label><select id="saleItem" required>${items.map(x => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)} · ${money(x.price)} · ${x.stock} in stock</option>`).join('')}</select></div>${field('Quantity', 'saleQty', { type: 'number', min: 1, step: 1, inputmode: 'numeric', placeholder: '1' })}<div class="field"><label for="salePayment">Payment</label><select id="salePayment"><option value="cash">Paid now</option><option value="credit">Add to customer credit</option></select></div>${field('Customer name (for credit)', 'saleCustomer', { maxlength: 40, placeholder: 'e.g. Aman', required: false })}<div class="field"><label>Sale total</label><div id="salePreview" class="summary-band"><span>Based on item and quantity</span><b>${money(items[0].price)}</b><small>Stock left after sale: ${Math.max(0, items[0].stock - 1)}</small></div></div>`, async () => {
        const item = state.items.find(x => x.id === $('#saleItem').value), qty = requireNumber('#saleQty', 'Quantity', 1), payment = $('#salePayment').value, customer = $('#saleCustomer').value.trim();
        if (!item || qty === null) return false;
        if (!Number.isInteger(qty) || qty > 999) { toast('Enter a whole number from 1 to 999.'); return false; }
        if (payment === 'credit' && customer.length < 2) { toast('Add the customer name before saving credit.'); return false; }
        if (qty > item.stock) { toast(`Only ${item.stock} ${item.unit || 'units'} are in stock. Restock first.`); return false; }
        const amount = qty * item.price, cost = qty * item.cost;
        if (amount > 10000 && !confirm(`This sale is ${money(amount)}. Check the quantity and amount before saving. Continue?`)) return false;
        if (!confirm(`${qty} × ${item.name} · ${money(amount)} · ${payment === 'credit' ? `credit for ${customer}` : 'paid now'}. Save this sale?`)) return false;
        item.stock -= qty;
        state.entries.push({ id: id(), type: 'sale', itemId: item.id, itemName: item.name, quantity: qty, amount, cost, profit: amount - cost, customer: payment === 'credit' ? customer : '', payment, time: new Date().toISOString() });
        await persist(); renderAll(); toast('Sale saved; stock updated.'); return true;
      });
    if (prefill.itemId && items.some(x => x.id === prefill.itemId)) $('#saleItem').value = prefill.itemId;
    if (prefill.quantity) $('#saleQty').value = prefill.quantity;
    if (prefill.customer) { $('#salePayment').value = 'credit'; $('#saleCustomer').value = prefill.customer; }
    const updatePreview = () => { const item = state.items.find(x => x.id === $('#saleItem').value), qty = Math.max(1, Number($('#saleQty').value) || 1); $('#salePreview').innerHTML = `<span>Based on item and quantity</span><b>${money((item?.price || 0) * qty)}</b><small>Stock after sale: ${Math.max(0, (item?.stock || 0) - qty)}</small>`; };
    $('#saleItem').onchange = updatePreview; $('#saleQty').oninput = updatePreview;
    $('#salePayment').onchange = () => { $('#saleCustomer').closest('.field').style.display = $('#salePayment').value === 'credit' ? 'grid' : 'none'; };
    $('#salePayment').dispatchEvent(new Event('change'));
  }
  function openManualCredit(prefill = {}) {
    openDialog('Add customer credit', 'Use this for an older balance you are entering for the first time.',
      `${field('Customer name', 'creditName', { maxlength: 40, placeholder: 'e.g. Aman' })}${field('Amount still to collect', 'creditAmount', { type: 'number', min: 0.01, step: 0.01, inputmode: 'decimal', placeholder: '100' })}`,
      async () => {
        const name = $('#creditName').value.trim(), amount = requireNumber('#creditAmount', 'Amount', 0.01);
        if (name.length < 2 || amount === null) { if (name.length < 2) toast('Enter the customer name.'); return false; }
        if (!confirm(`Add ${money(amount)} as credit for ${name}?`)) return false;
        state.entries.push({ id: id(), type: 'credit', customer: name, amount, time: new Date().toISOString() });
        await persist(); renderAll(); toast('Customer credit saved.'); return true;
      });
    if (prefill.customer) $('#creditName').value = prefill.customer;
    if (prefill.amount) $('#creditAmount').value = prefill.amount;
  }
  function openPayment(customerName = '', amount = '') {
    const balances = customerBalances();
    if (!balances.length) { toast('There are no open customer balances yet.'); return; }
    const options = balances.map(c => `<option value="${escapeHtml(c.name)}" ${customerName === c.name ? 'selected' : ''}>${escapeHtml(c.name)} · ${money(c.due)} due</option>`).join('');
    openDialog('Record a payment', 'Record the amount the customer gave you. This reduces their open balance.',
      `<div class="field"><label for="paymentCustomer">Customer</label><select id="paymentCustomer">${options}</select></div>${field('Amount received', 'paymentAmount', { type: 'number', min: 0.01, step: 0.01, inputmode: 'decimal', placeholder: '100' })}<p id="paymentBalance" class="field-help"></p>`,
      async () => {
        const name = $('#paymentCustomer').value, amount = requireNumber('#paymentAmount', 'Amount', 0.01), due = totalDueFor(name);
        if (amount === null) return false;
        if (amount > due) { toast(`This customer owes ${money(due)}. The amount cannot be more than the balance.`); return false; }
        if (!confirm(`Record ${money(amount)} received from ${name}?`)) return false;
        state.entries.push({ id: id(), type: 'payment', customer: name, amount, time: new Date().toISOString() });
        await persist(); renderAll(); toast('Payment saved.'); return true;
      });
    if (amount) $('#paymentAmount').value = amount;
    const updateDue = () => { const name = $('#paymentCustomer').value; $('#paymentBalance').textContent = `Open balance: ${money(totalDueFor(name))}`; $('#paymentAmount').max = String(totalDueFor(name)); };
    $('#paymentCustomer').onchange = updateDue; updateDue();
  }
  function openItemEditor(itemId = '') {
    const old = state.items.find(item => item.id === itemId);
    openDialog(old ? 'Edit shop item' : 'Add an item', 'Use the price you pay and the price you charge. Your past sales will keep their original amounts.',
      `${field('Item name', 'itemName', { maxlength: 50, placeholder: 'e.g. Mango juice' })}${field('Selling price', 'itemPrice', { type: 'number', min: 0, step: 0.01, inputmode: 'decimal', placeholder: '30' })}${field('What you pay for one', 'itemCost', { type: 'number', min: 0, step: 0.01, inputmode: 'decimal', placeholder: '22' })}${field('Quantity in stock', 'itemStock', { type: 'number', min: 0, step: 1, inputmode: 'numeric', placeholder: '12' })}${field('Remind me when stock reaches', 'itemReorder', { type: 'number', min: 0, step: 1, inputmode: 'numeric', placeholder: '3' })}<p class="field-help">No private shop data leaves your phone.</p>`, async () => {
        const name = $('#itemName').value.trim(), price = requireNumber('#itemPrice', 'Selling price'), cost = requireNumber('#itemCost', 'Cost price'), stock = requireNumber('#itemStock', 'Stock quantity'), reorder = requireNumber('#itemReorder', 'Restock reminder');
        if (name.length < 2) { toast('Enter an item name.'); return false; }
        if ([price, cost, stock, reorder].some(n => n === null)) return false;
        if (price <= 0) { toast('Selling price must be more than zero.'); return false; }
        if ([stock, reorder].some(n => !Number.isInteger(n))) { toast('Stock amounts must be whole numbers.'); return false; }
        if (cost > price && !confirm(`Your cost is ${money(cost)} and the selling price is ${money(price)}. This shows a loss of ${money(cost - price)} per item. Save these prices?`)) return false;
        const item = old || { id: id(), active: true, unit: 'units', icon: '▦' };
        Object.assign(item, { name, price, cost, stock, reorderAt: reorder, active: true });
        if (!old) state.items.push(item);
        await persist(); renderAll(); toast(old ? 'Item updated.' : 'Item added.'); return true;
      }, old ? 'Save changes' : 'Add item');
    if (old) { $('#itemName').value = old.name; $('#itemPrice').value = old.price; $('#itemCost').value = old.cost; $('#itemStock').value = old.stock; $('#itemReorder').value = old.reorderAt; }
  }
  function openRestock(itemId) {
    const item = state.items.find(x => x.id === itemId); if (!item) return;
    openDialog(`Add ${item.name} to stock`, 'Enter the number of items that arrived at the shop.', `${field('Quantity received', 'restockQty', { type: 'number', min: 1, step: 1, inputmode: 'numeric', placeholder: '10' })}<p class="field-help">Current stock: ${item.stock} ${escapeHtml(item.unit)}</p>`, async () => {
      const qty = requireNumber('#restockQty', 'Quantity', 1); if (qty === null) return false;
      if (!Number.isInteger(qty) || qty > 9999) { toast('Enter a whole number up to 9,999.'); return false; }
      if (!confirm(`Add ${qty} to ${item.name}? New stock will be ${item.stock + qty}.`)) return false;
      item.stock += qty; await persist(); renderAll(); toast('Stock updated.'); return true;
    }, 'Update stock');
  }
  function openProfileEditor() {
    const ownerField = isSatyamEdition(edition)
      ? `<div class="field"><label>Satyam Bhaiya</label><input value="Satyam Bhaiya" disabled></div>`
      : field('Your name', 'profileOwner', { maxlength: 40, placeholder: 'Your name' });
    openDialog('Shop profile', 'Keep the shop name clear so your shop book feels like yours.', `${ownerField}${field('Shop name', 'profileShop', { maxlength: 50, placeholder: 'Shop name' })}`, async () => {
      const owner = isSatyamEdition(edition) ? 'Satyam Bhaiya' : $('#profileOwner').value.trim(), shop = $('#profileShop').value.trim();
      if (owner.length < 2 || shop.length < 2) { toast('Enter both names to continue.'); return false; }
      state.ownerName = owner; state.shopName = shop; await persist(); startApp(); toast('Shop profile updated.'); return true;
    });
    if (!isSatyamEdition(edition)) $('#profileOwner').value = state.ownerName;
    $('#profileShop').value = state.shopName;
  }
  function downloadBlob(name, type, content) {
    const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
  function downloadCSV() {
    const month = selectedMonth();
    const currency = state.currency || 'INR';
    const rows = [['Date', 'Entry', 'Item / customer', 'Quantity', `Sales / payment (${currency})`, `Estimated cost (${currency})`, `Estimated gross profit (${currency})`, 'Payment type'], ...monthEntries(month).map(e => [new Date(e.time).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN'), kindLabel(e), e.itemName || e.customer || '', e.quantity || '', e.type === 'payment' ? -e.amount : e.amount, e.cost || '', e.profit ?? '', e.payment || ''])];
    const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    if (!confirm(`Download ${month} shop records as a spreadsheet? The CSV includes customer names and financial details. Save it somewhere private.`)) return;
    downloadBlob(`saathi-${month}-shop-records.csv`, 'text/csv;charset=utf-8', csv); toast('Monthly CSV downloaded.');
  }
  async function downloadBackup() {
    await saveQueue;
    const data = localStorage.getItem(storeKey(edition));
    if (!data) { toast('No saved shop book found.'); return; }
    if (!confirm('Download an encrypted backup file? It contains your shop records but cannot be opened without your PIN. Keep the PIN safe.')) return;
    downloadBlob(`saathi-${edition}-encrypted-backup.json`, 'application/json', JSON.stringify({ format: 'saathi-encrypted-backup', edition, vault: JSON.parse(data) }, null, 2));
    toast('Encrypted backup downloaded.');
  }
  async function restoreBackupFile(file, newSetup = false) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      validateBackupEnvelope(backup);
      if (backup.edition !== edition) { toast(`This backup belongs to ${isSatyamEdition(backup.edition) ? "Satyam Bhaiya's shop" : 'My Shop'}. Open that separate shop link to restore it.`); return; }
      if (!newSetup) { toast('Use Restore backup from More to replace this shop book.'); return; }
      const pin = prompt('Enter the 8 to 12 digit PIN used when you made this backup.');
      if (!pin || !/^\d{8,12}$/.test(pin)) { if (pin) toast('Enter the 8 to 12 digit backup PIN.'); return; }
      const key = await deriveKey(pin, asBytes(backup.vault.salt), backup.vault.iterations);
      const restored = await openVault(backup.vault, key);
      if (!restored || !Array.isArray(restored.entries) || !Array.isArray(restored.items)) throw new Error('invalid backup');
      if (localStorage.getItem(storeKey(backup.edition)) && !confirm('Replace this shop book with the selected backup? This cannot be undone.')) return;
      state = restored; cryptoKey = key; vault = backup.vault;
      localStorage.setItem(storeKey(edition), JSON.stringify(vault)); startApp(); showView('home'); toast('Backup restored.');
    } catch (error) { if (error.name === 'OperationError') toast('That PIN did not open this backup. Nothing was changed.'); else toast('This backup could not be opened. Nothing was changed.'); }
  }
  async function changePin() {
    const next = prompt('Choose a new PIN (8 to 12 digits). Your current shop book will be re-encrypted with it.');
    if (!next) return;
    if (!/^\d{8,12}$/.test(next)) { toast('Choose a PIN with 8 to 12 digits.'); return; }
    const confirmPin = prompt('Type your new PIN one more time.');
    if (next !== confirmPin) { toast('Those PINs did not match. No changes made.'); return; }
    if (!confirm('Change the PIN for this encrypted shop book? Make a new backup afterwards.')) return;
    const salt = crypto.getRandomValues(new Uint8Array(16)), saltB64 = asBase64(salt);
    cryptoKey = await deriveKey(next, salt); vault = await seal(state, cryptoKey, saltB64);
    localStorage.setItem(storeKey(edition), JSON.stringify(vault)); toast('PIN changed. Save a new backup.');
  }
  function installApp() {
    if (deferredInstall) {
      deferredInstall.prompt(); deferredInstall.userChoice.then(choice => { if (choice.outcome === 'accepted') toast('Saathi is being installed.'); deferredInstall = null; });
    } else {
      openDialog('Add Saathi to your phone', 'Use your browser menu to keep Saathi on your home screen.', '<p class="dialog-copy">On Android: tap the browser menu, then “Install app” or “Add to Home screen”.<br><br>On iPhone: tap Share, then “Add to Home Screen”.</p>', async () => true, 'Got it');
    }
  }

  function openDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    openDialog('Speak a shop entry', 'For reliable phone dictation, use the microphone on your phone keyboard. Saathi receives only the text your keyboard inserts, not its audio. Voice typing privacy depends on your phone and keyboard provider. Review every word and amount before saving.',
      `<button class="button primary full" type="button" id="keyboardDictate">🎙 Use phone keyboard to dictate</button><div class="field"><label for="dictationText">Dictate or type your entry here</label><textarea id="dictationText" rows="4" maxlength="300" placeholder="Example: sold two mango juice for Aman on credit" autocapitalize="sentences" spellcheck="true"></textarea></div><button class="button secondary full" type="button" id="startDictation">Try Saathi microphone</button><div class="field"><label for="dictationKind">What are you recording?</label><select id="dictationKind"><option value="sale">Sale</option><option value="credit">Customer credit</option><option value="payment">Customer payment</option><option value="restock">Stock received</option></select></div><p class="field-help" id="dictationStatus" aria-live="polite">Tap “Use phone keyboard to dictate”, then tap its microphone. Switch your keyboard to Hindi first if needed.</p>`, async () => {
        const text = $('#dictationText').value.trim();
        if (!text) { toast('Record or type an entry first.'); return false; }
        const kind = $('#dictationKind').value, amount = Number((text.match(/\d+(?:\.\d{1,2})?/) || [])[0]) || 0;
        const item = state.items.find(x => text.toLocaleLowerCase().includes(x.name.toLocaleLowerCase()));
        const qty = Math.max(1, Number((text.match(/\b\d+\b/) || [])[0]) || 1);
        const nameMatch = text.match(/(?:for|from|customer)\s+([\p{L}][\p{L} .'-]{1,38})/iu);
        const customer = nameMatch?.[1]?.trim().replace(/\s+(?:on credit|paid|owes).*$/i, '') || '';
        dialog.close();
        if (kind === 'sale') openSale({ itemId: item?.id, quantity: qty, customer: /credit|udhaar|उधार/i.test(text) ? customer : '' });
        else if (kind === 'credit') openManualCredit({ customer, amount });
        else if (kind === 'payment') openPayment(customer, amount);
        else if (kind === 'restock' && item) { openRestock(item.id); $('#restockQty').value = qty; }
        else if (kind === 'restock') { showView('stock'); toast('Add the stock item first, then record its quantity.'); }
        else toast('Check the details in the form, then confirm to save.');
        return false;
      }, 'Review entry');
    $('#keyboardDictate').onclick = () => {
      $('#dictationStatus').textContent = 'Your phone keyboard should open. Tap its microphone and dictate. If it has no microphone, enable voice typing in your phone keyboard settings.';
      $('#dictationText').focus();
    };
    const start = $('#startDictation');
    if (!SpeechRecognition) {
      start.disabled = true;
      start.disabled = true;
      start.textContent = 'In-app microphone unavailable';
      $('#dictationStatus').textContent = 'This browser does not support Saathi microphone recording. Use the microphone on your phone keyboard instead.';
      return;
    }
    let localSpeechReady = false;
    const startRecognition = () => {
      let failed = false;
      try {
        recognition = new SpeechRecognition();
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        if (localSpeechReady && 'processLocally' in recognition) recognition.processLocally = true;
        const status = $('#dictationStatus');
        recognition.onresult = event => { $('#dictationText').value = [...event.results].map(result => result[0].transcript).join(' '); };
        recognition.onerror = event => {
          failed = true;
          const reasons = {
            'not-allowed': 'The browser denied microphone access. Open site settings beside the address bar, set Microphone to Allow, reload, and try again.',
            'service-not-allowed': 'This browser blocked its speech service. Try another browser or type the entry.',
            'network': 'The speech service could not connect. Check internet, or type the entry.',
            'no-speech': 'No speech was detected. Check the microphone, move closer, and speak after tapping Record.',
            'audio-capture': 'The browser could not use the microphone. Check site permission and close other apps using it.',
            'language-not-supported': `This browser cannot transcribe ${language === 'hi' ? 'Hindi' : 'English'} here. Change language or type the entry.`,
            'aborted': 'Recording stopped.'
          };
          status.textContent = reasons[event.error] || `Speech recognition failed (${event.error}). Check microphone access or type the entry.`;
          start.textContent = '🎙 Try again';
          start.onclick = ['not-allowed', 'audio-capture'].includes(event.error) ? prepareMicrophone : startRecognition;
        };
        recognition.onend = () => {
          if (failed) return;
          start.textContent = $('#dictationText').value ? '🎙 Record again' : '🎙 Try again';
          status.textContent = $('#dictationText').value ? 'Transcript ready. Edit it, choose the entry type, then review.' : 'No transcript received. Try again or type the entry.';
          start.onclick = startRecognition;
        };
        start.textContent = '🎙 Listening… tap to stop';
        status.textContent = localSpeechReady ? 'Listening on this device. Speak clearly, then check the transcript.' : 'Listening. Speak clearly, then check the transcript.';
        recognition.start();
        start.onclick = () => recognition?.stop();
      } catch (error) {
        $('#dictationStatus').textContent = `Could not start speech recognition (${error.name || 'browser error'}). Try again or type the entry.`;
        start.textContent = '🎙 Try again';
        start.onclick = startRecognition;
      }
    };
    const prepareMicrophone = async () => {
      try {
        if (!window.isSecureContext) throw Object.assign(new Error('Saathi needs HTTPS or localhost to access the microphone.'), { name: 'InsecureContextError' });
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('This browser cannot request microphone access here.'), { name: 'MicrophoneUnavailableError' });
        const status = $('#dictationStatus');
        status.textContent = 'Requesting microphone permission. Choose Allow in your browser prompt.';
        const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone.getTracks().forEach(track => track.stop());
        localSpeechReady = false;
        if (typeof SpeechRecognition.available === 'function') {
          try {
            const recognitionLanguage = language === 'hi' ? 'hi-IN' : 'en-IN';
            let availability = await SpeechRecognition.available({ langs: [recognitionLanguage], processLocally: true, quality: 'dictation' });
            if (['downloadable', 'downloading'].includes(availability) && typeof SpeechRecognition.install === 'function') {
              status.textContent = 'Microphone allowed. Preparing the on-device speech pack…';
              const installed = await SpeechRecognition.install({ langs: [recognitionLanguage], quality: 'dictation' });
              availability = installed ? 'available' : 'unavailable';
            }
            localSpeechReady = availability === 'available';
          } catch { localSpeechReady = false; }
        }
        start.textContent = '🎙 Start recording';
        start.onclick = startRecognition;
        status.textContent = localSpeechReady ? 'Microphone is ready. Tap Start recording; speech will stay on this device.' : 'Microphone is ready. Tap Start recording. This browser may use an online speech service.';
      } catch (error) {
        const reasons = {
          'NotAllowedError': 'Microphone access is blocked. In your browser, open the site controls beside the address, set Microphone to Allow, then reload Saathi.',
          'PermissionDeniedError': 'Microphone access is blocked. Open this site’s browser settings, set Microphone to Allow, then reload Saathi.',
          'NotFoundError': 'No microphone was found. Connect or enable a microphone, then try again.',
          'NotReadableError': 'The microphone is busy or unavailable. Close other apps using it, then try again.',
          'SecurityError': 'The browser blocked microphone access. Open Saathi using its HTTPS link or localhost.',
          'InsecureContextError': error.message,
          'MicrophoneUnavailableError': error.message
        };
        $('#dictationStatus').textContent = reasons[error.name] || `Could not access the microphone (${error.name || 'browser error'}). Check site permissions and try again.`;
        start.textContent = '🎙 Try again';
        start.onclick = prepareMicrophone;
      }
    };
    start.onclick = prepareMicrophone;
  }

  // Pointer-responsive shop colors add a little life without moving the content.
  window.addEventListener('pointermove', event => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.style.setProperty('--glow-x', `${Math.round(event.clientX / innerWidth * 100)}%`);
    document.documentElement.style.setProperty('--glow-y', `${Math.round(event.clientY / innerHeight * 100)}%`);
  }, { passive: true });
  document.addEventListener('pointerdown', resetLockTimer, { passive: true });
  document.addEventListener('keydown', resetLockTimer);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state) persist().then(lockApp); });
  $$('.nav-item').forEach(button => button.onclick = () => showView(button.dataset.view));
  $$('[data-go]').forEach(button => button.onclick = () => showView(button.dataset.go));
  $('#saleAction').onclick = openSale;
  $('#paymentAction').onclick = () => openPayment();
  $('#newCreditButton').onclick = openManualCredit;
  $('#addItemButton').onclick = () => openItemEditor();
  $('#addFirstItem').onclick = () => openItemEditor();
  $('#editProfile').onclick = openProfileEditor;
  $('#profileButton').onclick = openProfileEditor;
  $('#lockButton').onclick = () => { if (confirm('Lock Saathi now? Your latest changes are saved first.')) persist().then(lockApp); };
  $('#themeButton').onclick = $('#themeSwitch').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(themeKey(edition), state.theme); setTheme(state.theme); persist(); };
  $('#languageButton').onclick = $('#languageTopButton').onclick = () => { language = language === 'en' ? 'hi' : 'en'; state.language = language; applyLanguage(); persist(); };
  $('#dictateButton').onclick = openDictation;
  $('#reportMonth').onchange = renderReports;
  $('#currencySelect').onchange = async event => {
    const nextCurrency = event.target.value;
    if (nextCurrency === state.currency) return;
    if (state.entries.length && !confirm(`Change the shop currency symbol to ${nextCurrency}? Existing amounts will not be converted.`)) { event.target.value = state.currency || 'INR'; return; }
    state.currency = nextCurrency; await persist(); renderAll(); toast(`Shop currency set to ${nextCurrency}.`);
  };
  $('#ledgerFilter').onchange = () => renderActivity($('#ledgerActivity'), ledgerEntries(), $('#emptyLedger'));
  $('#csvButton').onclick = $('#settingsCsv').onclick = downloadCSV;
  $('#backupButton').onclick = $('#settingsBackup').onclick = downloadBackup;
  $('#restoreButton').onclick = () => $('#restoreFile').click();
  $('#restoreFile').onchange = event => {
    const file = event.target.files[0]; if (!file) return;
    openDialog('Open encrypted backup', 'Enter the PIN used to create that backup. It will replace the shop book in this browser.', `${field('Backup PIN', 'unlockPinForRestore', { type: 'password', inputmode: 'numeric', maxlength: 12, placeholder: '8 or more digits' })}`, async () => {
      const pin = $('#unlockPinForRestore').value;
      try {
        const backup = JSON.parse(await file.text()); validateBackupEnvelope(backup);
        if (backup.edition !== edition) { toast(`This backup belongs to ${isSatyamEdition(backup.edition) ? "Satyam Bhaiya's shop" : 'My Shop'}. Open that separate shop link to restore it.`); return false; }
        if (!/^\d{8,12}$/.test(pin)) { toast('Enter the 8 to 12 digit backup PIN.'); return false; }
        const key = await deriveKey(pin, asBytes(backup.vault.salt), backup.vault.iterations);
        const restored = await openVault(backup.vault, key);
        if (!restored || !Array.isArray(restored.entries) || !Array.isArray(restored.items)) throw new Error('invalid');
        if (!confirm('Replace this browser’s current shop book with this backup? This cannot be undone.')) return false;
        state = restored; cryptoKey = key; vault = backup.vault; edition = backup.edition;
        localStorage.setItem(storeKey(edition), JSON.stringify(vault)); dialog.close(); startApp(); showView('home'); toast('Backup restored.');
        return true;
      } catch (error) { toast(error.name === 'OperationError' ? 'That PIN did not open this backup.' : 'This file is not a valid Saathi backup.'); return false; }
    }, 'Restore');
    event.target.value = '';
  };
  $('#changePinButton').onclick = changePin;
  $('#installButton').onclick = installApp;
  $('#closeDialog').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { const bounds = dialog.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) dialog.close(); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; $('#installButton').textContent = 'Install'; });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  if (!window.crypto?.subtle || !window.isSecureContext) {
    gateContent.innerHTML = gateHeader('Secure connection needed', 'Open Saathi from its secure hosted link or from localhost. Private records need your browser’s built-in encryption.');
  } else {
    try { renderGate(); }
    catch (error) {
      console.error('Saathi could not open its private setup.', error);
      gateContent.innerHTML = gateHeader('Could not open Saathi', 'The private shop book could not be opened in this browser. Try reloading this page.');
    }
  }
})();

