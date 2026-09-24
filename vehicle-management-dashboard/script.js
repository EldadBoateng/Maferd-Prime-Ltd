/* Motiv dashboard interactions. Kept dependency-free for direct file:// use. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let backendReady = false;
  const recordStorageKeys = { vehicles:'motiv-vehicles', shipments:'motiv-shipments', customers:'motiv-customers', drivers:'motiv-drivers', maintenance:'motiv-maintenance', expenses:'motiv-expenses' };
  async function apiRequest(route, options = {}) {
    const response = await fetch(`api/index.php?route=${encodeURIComponent(route)}`, { credentials:'same-origin', ...options });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Database request failed');
    return result;
  }
  function saveRemoteRecords(type, records) {
    if (!backendReady) return;
    apiRequest('records', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ type, records }) })
      .catch(() => showToast('Could not save changes to MySQL; they remain in this browser for now'));
  }
  async function initializePhpBackend() {
    if (location.protocol === 'file:') return;
    try {
      const session = await apiRequest('session');
      if (!session.authenticated) return;
      const data = await apiRequest('bootstrap');
      backendReady = true;
      for (const [type, storageKey] of Object.entries(recordStorageKeys)) {
        const serverRecords = data.records?.[type] || [];
        if (serverRecords.length) localStorage.setItem(storageKey, JSON.stringify(serverRecords));
        else {
          const localRecords = JSON.parse(localStorage.getItem(storageKey) || 'null');
          if (Array.isArray(localRecords) && localRecords.length) saveRemoteRecords(type, localRecords);
        }
      }
      if (data.preferences && Object.keys(data.preferences).length) localStorage.setItem('motiv-preferences', JSON.stringify(data.preferences));
      applySavedPreferences();
      const currentPage = $('#pageTitle').textContent;
      if (currentPage === 'Vehicles') renderVehicles();
      else if (currentPage === 'Shipments') renderShipments();
      else if (currentPage === 'Customers') renderCustomers();
      else if (currentPage === 'Drivers') renderDrivers();
      else if (currentPage === 'Maintenance') renderMaintenance();
      else if (currentPage === 'Expenses') renderExpenses();
      else if (currentPage === 'Reports') renderReports();
      else if (currentPage === 'Settings') renderSettings();
    } catch (error) {
      console.warn('PHP/MySQL backend is not ready:', error.message);
      showToast('PHP backend did not respond. Check XAMPP and the database setup.');
    }
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function setupTheme() {
    const saved = localStorage.getItem('motiv-theme');
    if (saved === 'dark') document.documentElement.dataset.theme = 'dark';
    $('#themeToggle').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      if (dark) document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
      localStorage.setItem('motiv-theme', dark ? 'dark' : 'light');
      $('#themeToggle').textContent = dark ? '☾' : '☼';
      showToast(`${dark ? 'Dark' : 'Light'} mode enabled`);
    });
    if (saved === 'dark') $('#themeToggle').textContent = '☾';
  }

  function applySavedPreferences(){const prefs=getPreferences();$('.workspace-copy strong').textContent=prefs.workspace;$('.profile-copy strong').textContent=prefs.name;$('.profile-copy small').textContent=prefs.role;$('.avatar:not(.settings-avatar)').textContent=prefs.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();$('#notificationToggle i').hidden=!prefs.notifications;}

  function setupPopovers() {
    const pairs = [
      [$('#notificationToggle'), $('#notificationPopover')],
      [$('#profileToggle'), $('#profilePopover')],
    ];
    pairs.forEach(([trigger, popover]) => trigger.addEventListener('click', event => {
      event.stopPropagation();
      pairs.forEach(([, other]) => { if (other !== popover) other.classList.remove('open'); });
      popover.classList.toggle('open');
    }));
    document.addEventListener('click', event => {
      if (!event.target.closest('.popover-wrap')) $$('.popover').forEach(popover => popover.classList.remove('open'));
    });
    $('#markRead').addEventListener('click', () => {
      $('#notificationToggle i').hidden = true;
      $('#notificationPopover').classList.remove('open');
      showToast('You’re all caught up');
    });
    $$('.profile-popover button').forEach(button => button.addEventListener('click', async () => {
      if (button.textContent.trim() === 'Sign out') {
        if (location.protocol === 'file:') { showToast('Sign out is available when using the local server'); return; }
        try { await apiRequest('logout', { method:'POST' }); location.replace('login.html'); }
        catch { showToast('Could not reach the local sign-in server'); }
      } else if (button.textContent.trim() === 'My profile') {
        $('.nav-item[data-page="Settings"]').click();
        setTimeout(() => $('#account-settings')?.scrollIntoView({ behavior:'smooth', block:'center' }), 50);
      } else if (button.textContent.trim() === 'Workspace settings') {
        $('.nav-item[data-page="Settings"]').click();
        setTimeout(() => $('#workspace-settings')?.scrollIntoView({ behavior:'smooth', block:'center' }), 50);
      }
    }));
  }

  function setupSidebar() {
    const sidebar = $('#sidebar');
    const scrim = $('.mobile-scrim');
    const close = () => { sidebar.classList.remove('open'); scrim.classList.remove('open'); };
    $('#menuToggle').addEventListener('click', () => { sidebar.classList.add('open'); scrim.classList.add('open'); });
    scrim.addEventListener('click', close);
    $$('.nav-item[data-page]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      $$('.nav-item[data-page]').forEach(item => item.classList.remove('active'));
      link.classList.add('active');
      $('#pageTitle').textContent = link.dataset.page;
      close();
      if (link.dataset.page === 'Vehicles') renderVehicles();
      else if (link.dataset.page === 'Shipments') renderShipments();
      else if (link.dataset.page === 'Customers') renderCustomers();
      else if (link.dataset.page === 'Drivers') renderDrivers();
      else if (link.dataset.page === 'Maintenance') renderMaintenance();
      else if (link.dataset.page === 'Expenses') renderExpenses();
      else if (link.dataset.page === 'Reports') renderReports();
      else if (link.dataset.page === 'Settings') renderSettings();
      else if (link.dataset.page === 'Dashboard') renderDashboard();
      else showToast(`${link.dataset.page} module is coming in the next phase`);
    }));
    $$('[data-page-link]').forEach(link => link.addEventListener('click', () => {
      const page = link.dataset.pageLink;
      const navLink = $(`.nav-item[data-page="${page}"]`);
      if (navLink) navLink.click();
    }));
  }

  const defaultVehicles = [
    { id: 'NSM-2401', year: 2023, make: 'Toyota', model: 'RAV4', type: 'SUV', color: 'White', arrival: '2024-05-18', price: 285000, status: 'Available' },
    { id: 'NSM-2398', year: 2022, make: 'Honda', model: 'CR-V', type: 'SUV', color: 'Silver', arrival: '2024-05-16', price: 248500, status: 'Reserved' },
    { id: 'NSM-2395', year: 2023, make: 'Toyota', model: 'Hilux', type: 'Pickup', color: 'Graphite', arrival: '2024-05-14', price: 312000, status: 'Maintenance' },
    { id: 'NSM-2391', year: 2022, make: 'Hyundai', model: 'Tucson', type: 'SUV', color: 'Blue', arrival: '2024-05-12', price: 221000, status: 'In transit' },
    { id: 'NSM-2387', year: 2021, make: 'Mercedes-Benz', model: 'C-Class', type: 'Sedan', color: 'Black', arrival: '2024-05-09', price: 339000, status: 'Available' },
    { id: 'NSM-2382', year: 2023, make: 'Nissan', model: 'Navara', type: 'Pickup', color: 'Grey', arrival: '2024-05-06', price: 297500, status: 'Available' },
    { id: 'NSM-2379', year: 2022, make: 'Kia', model: 'Sportage', type: 'SUV', color: 'Red', arrival: '2024-05-04', price: 216000, status: 'Reserved' },
    { id: 'NSM-2371', year: 2021, make: 'Lexus', model: 'RX 350', type: 'SUV', color: 'Pearl', arrival: '2024-04-29', price: 365000, status: 'Available' },
  ];
  const money = value => `GH₵ ${Number(value).toLocaleString('en-GH')}`;
  const safe = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let dashboardMarkup = null;
  let inventory = null;

  function getInventory() {
    if (inventory) return inventory;
    try { inventory = JSON.parse(localStorage.getItem('motiv-vehicles')) || defaultVehicles; }
    catch { inventory = defaultVehicles; }
    return inventory;
  }

  function persistInventory() { localStorage.setItem('motiv-vehicles', JSON.stringify(inventory)); saveRemoteRecords('vehicles', inventory); }
  function renderDashboard() {
    if (dashboardMarkup !== null) $('.page-content').innerHTML = dashboardMarkup;
    setupActions(); setupChartHover();
    $('#vehicleSearch').addEventListener('input', event => filterVehicles(event.target.value));
  }

  function renderVehicles(query = '') {
    const page = $('.page-content');
    if (dashboardMarkup === null) dashboardMarkup = page.innerHTML;
    const all = getInventory();
    const filtered = all.filter(v => `${v.id} ${v.year} ${v.make} ${v.model} ${v.type} ${v.color} ${v.status}`.toLowerCase().includes(query.toLowerCase()));
    const rows = filtered.map((v, index) => `<tr><td><span class="car-thumb">${v.type === 'Pickup' ? '🛻' : v.type === 'Sedan' ? '🚘' : '🚙'}</span><span class="vehicle-name"><strong>${safe(v.year)} ${safe(v.make)} ${safe(v.model)}</strong><small>${safe(v.type)} · ${safe(v.color)}</small></span></td><td class="stock-id">${safe(v.id)}</td><td>${new Date(`${v.arrival}T00:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td><td class="price">${money(v.price)}</td><td><span class="status-pill ${v.status.toLowerCase().replace(' ','-')}">${safe(v.status)}</span></td><td><button class="row-menu" data-index="${index}" aria-label="Remove ${safe(v.id)}">···</button></td></tr>`).join('');
    const statusCounts = ['Available','In transit','Reserved','Maintenance'].map(status => `<option value="${status}">${status}</option>`).join('');
    page.innerHTML = `<section class="welcome-row"><div><p class="eyebrow">INVENTORY MANAGEMENT <span class="weather">${all.length} tracked vehicles</span></p><h1>Vehicles</h1><p class="welcome-subtitle">Manage your inventory from arrival through delivery.</p></div><div class="welcome-actions"><button class="button button-quiet" id="exportVehicles">⇩ Export CSV</button><button class="button button-primary" id="newVehicle">＋ Add vehicle</button></div></section>
      <section class="kpi-grid vehicle-kpis"><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Total inventory</span><span class="kpi-icon violet">▱</span></div><div class="kpi-value">${all.length}</div><div class="kpi-foot">Vehicles in your workspace</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Available</span><span class="kpi-icon green">✓</span></div><div class="kpi-value">${all.filter(v=>v.status==='Available').length}</div><div class="kpi-foot">Ready for customers</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">In transit</span><span class="kpi-icon orange">⇄</span></div><div class="kpi-value">${all.filter(v=>v.status==='In transit').length}</div><div class="kpi-foot">Currently being shipped</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Inventory value</span><span class="kpi-icon blue">＄</span></div><div class="kpi-value">₵ ${(all.reduce((sum,v)=>sum+Number(v.price),0)/1000000).toFixed(2)}M</div><div class="kpi-foot">Based on listed prices</div></article></section>
      <section class="panel inventory-panel"><div class="inventory-toolbar"><div class="inventory-tabs"><button class="inventory-tab active" data-status="All">All vehicles <span>${all.length}</span></button>${['Available','In transit','Reserved','Maintenance'].map(s=>`<button class="inventory-tab" data-status="${s}">${s}</button>`).join('')}</div><div class="table-actions"><label class="table-search"><span>⌕</span><input id="inventorySearch" type="search" value="${safe(query)}" placeholder="Search inventory" aria-label="Search inventory"></label><select class="status-filter" id="statusFilter" aria-label="Filter by status"><option value="All">All statuses</option>${statusCounts}</select></div></div><div class="table-scroll"><table><thead><tr><th>VEHICLE</th><th>STOCK ID</th><th>ARRIVAL DATE</th><th>LIST PRICE</th><th>STATUS</th><th></th></tr></thead><tbody id="inventoryRows">${rows || '<tr><td colspan="6" class="empty-row">No vehicles match your search. Try another term or add a vehicle.</td></tr>'}</tbody></table></div><div class="table-footer"><span>Showing ${filtered.length} of ${all.length} vehicles</span><span class="inventory-note">Demo inventory is saved in this browser.</span></div></section>
      <div class="modal-backdrop" id="vehicleModal" hidden><section class="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="vehicleModalTitle"><div class="modal-head"><div><h2 id="vehicleModalTitle">Add a vehicle</h2><p>Add a vehicle to your workspace inventory.</p></div><button class="modal-close" id="closeVehicleModal" aria-label="Close">×</button></div><form id="vehicleForm"><div class="form-grid"><label>Make<input name="make" required maxlength="30" placeholder="e.g. Toyota"></label><label>Model<input name="model" required maxlength="30" placeholder="e.g. Corolla"></label><label>Year<input name="year" required type="number" min="1990" max="2035" value="2023"></label><label>Type<select name="type"><option>SUV</option><option>Sedan</option><option>Pickup</option><option>Van</option><option>Coupe</option></select></label><label>Color<input name="color" required maxlength="24" placeholder="e.g. White"></label><label>Arrival date<input name="arrival" type="date" required value="${new Date().toISOString().slice(0,10)}"></label><label>List price (GH₵)<input name="price" required type="number" min="1" step="100" placeholder="250000"></label><label>Status<select name="status"><option>Available</option><option>In transit</option><option>Reserved</option><option>Maintenance</option></select></label></div><div class="modal-actions"><button class="button button-quiet" type="button" id="cancelVehicle">Cancel</button><button class="button button-primary" type="submit">Save vehicle</button></div></form></section></div><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;
    setupInventoryControls();
  }

  function setupInventoryControls() {
    const input = $('#inventorySearch'); const status = $('#statusFilter');
    const applyFilters = () => {
      const selected = $('.inventory-tab.active')?.dataset.status || 'All';
      const query = input.value.toLowerCase();
      const statusValue = status.value === 'All' ? selected : status.value;
      const rows = getInventory().filter(v => (statusValue === 'All' || v.status === statusValue) && `${v.id} ${v.year} ${v.make} ${v.model} ${v.type} ${v.color} ${v.status}`.toLowerCase().includes(query));
      $('#inventoryRows').innerHTML = rows.length ? rows.map(v => `<tr><td><span class="car-thumb">${v.type==='Pickup'?'🛻':v.type==='Sedan'?'🚘':'🚙'}</span><span class="vehicle-name"><strong>${safe(v.year)} ${safe(v.make)} ${safe(v.model)}</strong><small>${safe(v.type)} · ${safe(v.color)}</small></span></td><td class="stock-id">${safe(v.id)}</td><td>${new Date(`${v.arrival}T00:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td><td class="price">${money(v.price)}</td><td><span class="status-pill ${v.status.toLowerCase().replace(' ','-')}">${safe(v.status)}</span></td><td><button class="row-menu" data-id="${safe(v.id)}" aria-label="Remove ${safe(v.id)}">···</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-row">No vehicles match your search. Try another filter or add a vehicle.</td></tr>';
      $('.table-footer').firstElementChild.textContent = `Showing ${rows.length} of ${inventory.length} vehicles`;
      $$('.row-menu').forEach(button => button.addEventListener('click', () => {
        if (confirm(`Remove ${button.dataset.id} from this demo inventory?`)) { inventory = inventory.filter(v=>v.id!==button.dataset.id); persistInventory(); renderVehicles(input.value); }
      }));
    };
    input.addEventListener('input', applyFilters); status.addEventListener('change', applyFilters);
    $$('.inventory-tab').forEach(tab => tab.addEventListener('click', () => {
      $$('.inventory-tab').forEach(item=>item.classList.remove('active')); tab.classList.add('active'); status.value='All'; applyFilters();
    }));
    $('#newVehicle').addEventListener('click', () => { $('#vehicleModal').hidden=false; $('input[name="make"]').focus(); });
    const closeModal = () => { $('#vehicleModal').hidden=true; };
    $('#closeVehicleModal').addEventListener('click', closeModal); $('#cancelVehicle').addEventListener('click', closeModal);
    $('#vehicleModal').addEventListener('click', e => { if (e.target.id==='vehicleModal') closeModal(); });
    $('#vehicleForm').addEventListener('submit', event => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const id = `NSM-${String(Date.now()).slice(-4)}`;
      inventory.unshift({id,year:Number(form.get('year')),make:form.get('make').trim(),model:form.get('model').trim(),type:form.get('type'),color:form.get('color').trim(),arrival:form.get('arrival'),price:Number(form.get('price')),status:form.get('status')});
      persistInventory(); renderVehicles(); showToast(`Vehicle ${id} added to inventory`);
    });
    $('#exportVehicles').addEventListener('click', () => {
      const csv = ['Stock ID,Year,Make,Model,Type,Color,Arrival Date,Price (GHS),Status', ...getInventory().map(v=>[v.id,v.year,v.make,v.model,v.type,v.color,v.arrival,v.price,v.status].map(value=>`"${String(value).replaceAll('"','""')}"`).join(','))].join('\n');
      const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); link.download='motiv-vehicle-inventory.csv'; link.click(); URL.revokeObjectURL(link.href); showToast('Inventory CSV exported');
    });
    applyFilters();
  }

  const defaultShipments = [
    { ref:'MSKU 4829', mode:'Ocean freight', origin:'Yokohama, Japan', destination:'Tema, Ghana', vessel:'MV Pacific Star', departure:'2024-05-08', arrival:'2024-05-24', progress:76, status:'In transit', vehicles:4 },
    { ref:'HLCU 2901', mode:'Ocean freight', origin:'Long Beach, USA', destination:'Tema, Ghana', vessel:'Hapag-Lloyd Berlin', departure:'2024-05-02', arrival:'2024-05-29', progress:48, status:'In transit', vehicles:3 },
    { ref:'TRHU 7610', mode:'Road freight', origin:'Accra, Ghana', destination:'Kumasi, Ghana', vessel:'Northstar Transport', departure:'2024-05-19', arrival:'2024-05-21', progress:91, status:'Arriving soon', vehicles:2 },
    { ref:'CMAU 1843', mode:'Ocean freight', origin:'Nagoya, Japan', destination:'Tema, Ghana', vessel:'CMA CGM Azure', departure:'2024-05-17', arrival:'2024-06-08', progress:22, status:'In transit', vehicles:5 },
    { ref:'NSM-DEL-052', mode:'Road freight', origin:'Tema, Ghana', destination:'Takoradi, Ghana', vessel:'Northstar Transport', departure:'2024-05-19', arrival:'2024-05-20', progress:100, status:'Delivered', vehicles:1 },
    { ref:'ONEY 6774', mode:'Ocean freight', origin:'Busan, South Korea', destination:'Tema, Ghana', vessel:'One Harmony', departure:'2024-04-27', arrival:'2024-05-18', progress:100, status:'Arrived', vehicles:2 },
  ];
  let shipments = null;
  function getShipments() {
    if (shipments) return shipments;
    try { shipments = JSON.parse(localStorage.getItem('motiv-shipments')) || defaultShipments; }
    catch { shipments = defaultShipments; }
    return shipments;
  }
  function persistShipments() { localStorage.setItem('motiv-shipments', JSON.stringify(shipments)); saveRemoteRecords('shipments', shipments); }
  function renderShipments(query = '') {
    const page = $('.page-content');
    if (dashboardMarkup === null) dashboardMarkup = page.innerHTML;
    const all = getShipments();
    const filtered = all.filter(s => `${s.ref} ${s.mode} ${s.origin} ${s.destination} ${s.vessel} ${s.status}`.toLowerCase().includes(query.toLowerCase()));
    const active = all.filter(s=>s.status==='In transit'||s.status==='Arriving soon').length;
    const cards = filtered.map(s=>`<article class="shipment-card"><div class="shipment-card-head"><span class="ship-icon ${s.mode==='Road freight'?'ship-orange':'ship-purple'}">⇄</span><span class="status-pill ${s.status.toLowerCase().replace(' ','-')}">${safe(s.status)}</span><button class="row-menu shipment-menu" data-ref="${safe(s.ref)}" aria-label="Update ${safe(s.ref)}">···</button></div><div class="shipment-ref">${safe(s.ref)}</div><div class="ship-tag ${s.mode==='Road freight'?'road':'ocean'}">${safe(s.mode)}</div><div class="route-line"><div><i class="route-dot"></i><strong>${safe(s.origin)}</strong><small>Origin</small></div><span class="route-arrow">→</span><div><i class="route-dot destination-dot"></i><strong>${safe(s.destination)}</strong><small>Destination</small></div></div><div class="shipment-progress-label"><span>Progress</span><strong>${s.progress}%</strong></div><div class="progress-track"><i style="width:${s.progress}%"></i></div><div class="shipment-card-foot"><span>▱ ${s.vehicles} vehicle${s.vehicles===1?'':'s'}</span><span>Arrives ${new Date(`${s.arrival}T00:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span></div><div class="shipment-vessel">${safe(s.vessel)}</div></article>`).join('');
    page.innerHTML = `<section class="welcome-row"><div><p class="eyebrow">LOGISTICS MANAGEMENT <span class="weather">${all.length} tracked shipments</span></p><h1>Shipments</h1><p class="welcome-subtitle">Follow vehicles from origin through port arrival and final delivery.</p></div><div class="welcome-actions"><button class="button button-quiet" id="exportShipments">⇩ Export CSV</button><button class="button button-primary" id="newShipment">＋ New shipment</button></div></section>
      <section class="kpi-grid vehicle-kpis"><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Active shipments</span><span class="kpi-icon violet">⇄</span></div><div class="kpi-value">${active}</div><div class="kpi-foot">Currently moving to customers</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">In transit</span><span class="kpi-icon blue">⌁</span></div><div class="kpi-value">${all.filter(s=>s.status==='In transit').length}</div><div class="kpi-foot">Across ocean and road freight</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Arriving soon</span><span class="kpi-icon orange">⚑</span></div><div class="kpi-value">${all.filter(s=>s.status==='Arriving soon').length}</div><div class="kpi-foot">Expected within 48 hours</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Vehicles in shipment</span><span class="kpi-icon green">▱</span></div><div class="kpi-value">${all.reduce((n,s)=>n+Number(s.vehicles),0)}</div><div class="kpi-foot">Linked to active and recent loads</div></article></section>
      <section class="panel shipments-board"><div class="inventory-toolbar"><div class="inventory-tabs"><button class="inventory-tab active" data-ship-status="All">All shipments <span>${all.length}</span></button>${['In transit','Arriving soon','Arrived','Delivered'].map(s=>`<button class="inventory-tab" data-ship-status="${s}">${s}</button>`).join('')}</div><div class="table-actions"><label class="table-search"><span>⌕</span><input id="shipmentSearch" type="search" value="${safe(query)}" placeholder="Search shipments" aria-label="Search shipments"></label></div></div><div class="shipment-cards" id="shipmentCards">${cards || '<div class="empty-row">No shipments match your search.</div>'}</div><div class="table-footer"><span id="shipmentCount">Showing ${filtered.length} of ${all.length} shipments</span><span class="inventory-note">Shipment demo data is saved in this browser.</span></div></section>
      <div class="modal-backdrop" id="shipmentModal" hidden><section class="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="shipmentModalTitle"><div class="modal-head"><div><h2 id="shipmentModalTitle">Create a shipment</h2><p>Record a new vehicle movement.</p></div><button class="modal-close" id="closeShipmentModal" aria-label="Close">×</button></div><form id="shipmentForm"><div class="form-grid"><label>Container / reference<input name="ref" required maxlength="24" placeholder="e.g. MSKU 4829"></label><label>Freight mode<select name="mode"><option>Ocean freight</option><option>Road freight</option></select></label><label>Origin<input name="origin" required placeholder="Port or city"></label><label>Destination<input name="destination" required placeholder="Port or city"></label><label>Vessel / carrier<input name="vessel" required placeholder="Carrier name"></label><label>Expected arrival<input name="arrival" type="date" required></label><label>Vehicles included<input name="vehicles" type="number" required min="1" value="1"></label><label>Status<select name="status"><option>In transit</option><option>Arriving soon</option><option>Arrived</option><option>Delivered</option></select></label></div><div class="modal-actions"><button class="button button-quiet" type="button" id="cancelShipment">Cancel</button><button class="button button-primary" type="submit">Save shipment</button></div></form></section></div><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;
    setupShipmentControls();
  }
  function setupShipmentControls() {
    const input=$('#shipmentSearch'); let selected='All';
    const apply=()=>{
      const query=input.value.toLowerCase(); const rows=getShipments().filter(s=>(selected==='All'||s.status===selected)&&`${s.ref} ${s.mode} ${s.origin} ${s.destination} ${s.vessel} ${s.status}`.toLowerCase().includes(query));
      $('#shipmentCards').innerHTML=rows.length?rows.map(s=>`<article class="shipment-card"><div class="shipment-card-head"><span class="ship-icon ${s.mode==='Road freight'?'ship-orange':'ship-purple'}">⇄</span><span class="status-pill ${s.status.toLowerCase().replace(' ','-')}">${safe(s.status)}</span><button class="row-menu shipment-menu" data-ref="${safe(s.ref)}" aria-label="Update ${safe(s.ref)}">···</button></div><div class="shipment-ref">${safe(s.ref)}</div><div class="ship-tag ${s.mode==='Road freight'?'road':'ocean'}">${safe(s.mode)}</div><div class="route-line"><div><i class="route-dot"></i><strong>${safe(s.origin)}</strong><small>Origin</small></div><span class="route-arrow">→</span><div><i class="route-dot destination-dot"></i><strong>${safe(s.destination)}</strong><small>Destination</small></div></div><div class="shipment-progress-label"><span>Progress</span><strong>${s.progress}%</strong></div><div class="progress-track"><i style="width:${s.progress}%"></i></div><div class="shipment-card-foot"><span>▱ ${s.vehicles} vehicle${s.vehicles===1?'':'s'}</span><span>Arrives ${new Date(`${s.arrival}T00:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span></div><div class="shipment-vessel">${safe(s.vessel)}</div></article>`).join(''):'<div class="empty-row">No shipments match these filters.</div>';
      $('#shipmentCount').textContent=`Showing ${rows.length} of ${shipments.length} shipments`;
      $$('.shipment-menu').forEach(button=>button.addEventListener('click',()=>{
        const shipment=getShipments().find(s=>s.ref===button.dataset.ref); if(!shipment)return;
        const steps=['In transit','Arriving soon','Arrived','Delivered']; const next=steps[Math.min(steps.indexOf(shipment.status)+1,steps.length-1)];
        if(next===shipment.status){showToast(`${shipment.ref} is already marked delivered`);return;}
        shipment.status=next; shipment.progress=next==='In transit'?Math.max(shipment.progress,65):next==='Arriving soon'?90:100; persistShipments(); renderShipments(input.value); showToast(`${shipment.ref} updated to ${next}`);
      }));
    };
    input.addEventListener('input',apply);
    $$('.inventory-tab[data-ship-status]').forEach(tab=>tab.addEventListener('click',()=>{$$('.inventory-tab[data-ship-status]').forEach(t=>t.classList.remove('active'));tab.classList.add('active');selected=tab.dataset.shipStatus;apply();}));
    $('#newShipment').addEventListener('click',()=>{$('#shipmentModal').hidden=false;$('input[name="ref"]').focus();});
    const close=()=>$('#shipmentModal').hidden=true;
    $('#closeShipmentModal').addEventListener('click',close);$('#cancelShipment').addEventListener('click',close);
    $('#shipmentModal').addEventListener('click',e=>{if(e.target.id==='shipmentModal')close();});
    $('#shipmentForm').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);const ref=form.get('ref').trim().toUpperCase();if(getShipments().some(s=>s.ref.toLowerCase()===ref.toLowerCase())){showToast('That shipment reference already exists');return;}shipments.unshift({ref,mode:form.get('mode'),origin:form.get('origin').trim(),destination:form.get('destination').trim(),vessel:form.get('vessel').trim(),departure:new Date().toISOString().slice(0,10),arrival:form.get('arrival'),progress:10,status:form.get('status'),vehicles:Number(form.get('vehicles'))});persistShipments();renderShipments();showToast(`Shipment ${ref} created`);});
    $('#exportShipments').addEventListener('click',()=>{const csv=['Reference,Mode,Origin,Destination,Carrier,Departure,Arrival,Progress,Status,Vehicles',...getShipments().map(s=>[s.ref,s.mode,s.origin,s.destination,s.vessel,s.departure,s.arrival,`${s.progress}%`,s.status,s.vehicles].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='motiv-shipments.csv';link.click();URL.revokeObjectURL(link.href);showToast('Shipment CSV exported');});
    apply();
  }

  const defaultCustomers = [
    { id:'CUS-1042', name:'Ama Serwaa', email:'ama.serwaa@example.com', phone:'+233 24 555 0182', location:'Accra', joined:'2024-03-12', vehicles:2, total:533500, status:'Active' },
    { id:'CUS-1039', name:'Kwame Asante', email:'kwame.asante@example.com', phone:'+233 20 418 7721', location:'Kumasi', joined:'2024-02-26', vehicles:1, total:312000, status:'Active' },
    { id:'CUS-1035', name:'Abena Boateng', email:'abena.boateng@example.com', phone:'+233 27 881 0940', location:'Tema', joined:'2024-02-14', vehicles:1, total:248500, status:'Active' },
    { id:'CUS-1028', name:'Yaw Ofori', email:'yaw.ofori@example.com', phone:'+233 55 205 4178', location:'Accra', joined:'2024-01-30', vehicles:0, total:0, status:'Prospect' },
    { id:'CUS-1021', name:'Esi Mensah', email:'esi.mensah@example.com', phone:'+233 24 630 1187', location:'Cape Coast', joined:'2024-01-18', vehicles:1, total:221000, status:'Active' },
    { id:'CUS-1014', name:'Nana Agyeman', email:'nana.agyeman@example.com', phone:'+233 20 774 5210', location:'Accra', joined:'2023-12-08', vehicles:0, total:0, status:'Prospect' },
  ];
  let customers = null;
  function getCustomers(){ if(customers)return customers; try{customers=JSON.parse(localStorage.getItem('motiv-customers'))||defaultCustomers;}catch{customers=defaultCustomers;}return customers; }
  function persistCustomers(){localStorage.setItem('motiv-customers',JSON.stringify(customers));saveRemoteRecords('customers',customers);}
  function renderCustomers(query=''){
    const page=$('.page-content');if(dashboardMarkup===null)dashboardMarkup=page.innerHTML;
    const all=getCustomers(), filtered=all.filter(c=>`${c.id} ${c.name} ${c.email} ${c.phone} ${c.location} ${c.status}`.toLowerCase().includes(query.toLowerCase()));
    page.innerHTML=`<section class="welcome-row"><div><p class="eyebrow">CUSTOMER RELATIONSHIPS <span class="weather">${all.length} customer records</span></p><h1>Customers</h1><p class="welcome-subtitle">Keep customer details, purchase history, and follow-ups in one place.</p></div><div class="welcome-actions"><button class="button button-quiet" id="exportCustomers">⇩ Export CSV</button><button class="button button-primary" id="newCustomer">＋ Add customer</button></div></section>
    <section class="kpi-grid vehicle-kpis"><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Total customers</span><span class="kpi-icon violet">♙</span></div><div class="kpi-value">${all.length}</div><div class="kpi-foot">Customers and prospects</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Active customers</span><span class="kpi-icon green">✓</span></div><div class="kpi-value">${all.filter(c=>c.status==='Active').length}</div><div class="kpi-foot">With completed purchases</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Open prospects</span><span class="kpi-icon orange">✳</span></div><div class="kpi-value">${all.filter(c=>c.status==='Prospect').length}</div><div class="kpi-foot">Potential customers to follow up</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Customer sales</span><span class="kpi-icon blue">＄</span></div><div class="kpi-value">₵ ${(all.reduce((n,c)=>n+c.total,0)/1000000).toFixed(2)}M</div><div class="kpi-foot">Recorded vehicle purchases</div></article></section>
    <section class="panel customers-panel"><div class="inventory-toolbar"><div class="inventory-tabs"><button class="inventory-tab active" data-customer-status="All">All customers <span>${all.length}</span></button>${['Active','Prospect'].map(s=>`<button class="inventory-tab" data-customer-status="${s}">${s}</button>`).join('')}</div><div class="table-actions"><label class="table-search"><span>⌕</span><input id="customerSearch" type="search" value="${safe(query)}" placeholder="Search customers" aria-label="Search customers"></label></div></div><div class="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>LOCATION</th><th>VEHICLES</th><th>LIFETIME VALUE</th><th>STATUS</th><th></th></tr></thead><tbody id="customerRows">${filtered.map(c=>customerRow(c)).join('')||'<tr><td colspan="7" class="empty-row">No customers match your search.</td></tr>'}</tbody></table></div><div class="table-footer"><span id="customerCount">Showing ${filtered.length} of ${all.length} customers</span><span class="inventory-note">Customer demo data is saved in this browser.</span></div></section>
    <div class="modal-backdrop" id="customerModal" hidden><section class="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="customerModalTitle"><div class="modal-head"><div><h2 id="customerModalTitle">Add a customer</h2><p>Save contact details to your workspace.</p></div><button class="modal-close" id="closeCustomerModal" aria-label="Close">×</button></div><form id="customerForm"><div class="form-grid"><label>Full name<input name="name" required maxlength="60" placeholder="e.g. Ama Serwaa"></label><label>Email address<input name="email" required type="email" placeholder="name@example.com"></label><label>Phone number<input name="phone" required type="tel" placeholder="+233 24 000 0000"></label><label>Location<input name="location" required maxlength="40" placeholder="Accra"></label><label>Relationship status<select name="status"><option>Prospect</option><option>Active</option></select></label><label>Vehicles purchased<input name="vehicles" type="number" min="0" value="0"></label></div><div class="modal-actions"><button class="button button-quiet" type="button" id="cancelCustomer">Cancel</button><button class="button button-primary" type="submit">Save customer</button></div></form></section></div><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;
    setupCustomerControls();
  }
  function customerRow(c){const initials=c.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();return `<tr><td><span class="customer-avatar">${safe(initials)}</span><span class="vehicle-name"><strong>${safe(c.name)}</strong><small>${safe(c.email)}</small></span></td><td>${safe(c.phone)}</td><td>${safe(c.location)}</td><td>${Number(c.vehicles)}</td><td class="price">${money(c.total)}</td><td><span class="status-pill ${c.status==='Active'?'available':'reserved'}">${safe(c.status)}</span></td><td><button class="row-menu customer-menu" data-id="${safe(c.id)}" aria-label="Customer options">···</button></td></tr>`;}
  function setupCustomerControls(){
    const input=$('#customerSearch');let selected='All';
    const apply=()=>{const query=input.value.toLowerCase();const rows=getCustomers().filter(c=>(selected==='All'||c.status===selected)&&`${c.id} ${c.name} ${c.email} ${c.phone} ${c.location} ${c.status}`.toLowerCase().includes(query));$('#customerRows').innerHTML=rows.map(customerRow).join('')||'<tr><td colspan="7" class="empty-row">No customers match these filters.</td></tr>';$('#customerCount').textContent=`Showing ${rows.length} of ${customers.length} customers`;};
    input.addEventListener('input',apply);$$('.inventory-tab[data-customer-status]').forEach(tab=>tab.addEventListener('click',()=>{$$('.inventory-tab[data-customer-status]').forEach(t=>t.classList.remove('active'));tab.classList.add('active');selected=tab.dataset.customerStatus;apply();}));
    $('#newCustomer').addEventListener('click',()=>{$('#customerModal').hidden=false;$('input[name="name"]').focus();});const close=()=>$('#customerModal').hidden=true;$('#closeCustomerModal').addEventListener('click',close);$('#cancelCustomer').addEventListener('click',close);$('#customerModal').addEventListener('click',e=>{if(e.target.id==='customerModal')close();});
    $('#customerForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);const name=f.get('name').trim();if(getCustomers().some(c=>c.email.toLowerCase()===f.get('email').trim().toLowerCase())){showToast('A customer with that email already exists');return;}customers.unshift({id:`CUS-${String(Date.now()).slice(-4)}`,name,email:f.get('email').trim(),phone:f.get('phone').trim(),location:f.get('location').trim(),joined:new Date().toISOString().slice(0,10),vehicles:Number(f.get('vehicles')),total:0,status:f.get('status')});persistCustomers();renderCustomers();showToast(`${name} added to customers`);});
    $('#exportCustomers').addEventListener('click',()=>{const csv=['Customer ID,Name,Email,Phone,Location,Joined,Vehicles,Lifetime Value (GHS),Status',...getCustomers().map(c=>[c.id,c.name,c.email,c.phone,c.location,c.joined,c.vehicles,c.total,c.status].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='motiv-customers.csv';link.click();URL.revokeObjectURL(link.href);showToast('Customer CSV exported');});
  }

  const defaultDrivers=[
    {id:'DRV-021',name:'Nana Mensah',phone:'+233 24 779 2041',license:'GH-DL-88214',location:'Accra',vehicle:'Toyota Hilux · NSM-2284',deliveries:42,status:'Available'},
    {id:'DRV-018',name:'Abena Boateng',phone:'+233 27 881 0940',license:'GH-DL-75403',location:'Tema',vehicle:'Honda CR-V · NSM-2398',deliveries:36,status:'On delivery'},
    {id:'DRV-016',name:'Kojo Appiah',phone:'+233 20 114 5287',license:'GH-DL-63952',location:'Kumasi',vehicle:'—',deliveries:29,status:'Available'},
    {id:'DRV-013',name:'Yaw Owusu',phone:'+233 55 312 0098',license:'GH-DL-52187',location:'Accra',vehicle:'Hyundai Tucson · NSM-2311',deliveries:24,status:'On delivery'},
    {id:'DRV-009',name:'Efua Quaye',phone:'+233 24 683 4992',license:'GH-DL-41772',location:'Cape Coast',vehicle:'—',deliveries:18,status:'Off duty'},
  ];
  let drivers=null;
  function getDrivers(){if(drivers)return drivers;try{drivers=JSON.parse(localStorage.getItem('motiv-drivers'))||defaultDrivers;}catch{drivers=defaultDrivers;}return drivers;}
  function persistDrivers(){localStorage.setItem('motiv-drivers',JSON.stringify(drivers));saveRemoteRecords('drivers',drivers);}
  function renderDrivers(query=''){
    const page=$('.page-content');if(dashboardMarkup===null)dashboardMarkup=page.innerHTML;
    const all=getDrivers(),filtered=all.filter(d=>`${d.id} ${d.name} ${d.phone} ${d.license} ${d.location} ${d.vehicle} ${d.status}`.toLowerCase().includes(query.toLowerCase()));
    page.innerHTML=`<section class="welcome-row"><div><p class="eyebrow">FLEET TEAM <span class="weather">${all.length} registered drivers</span></p><h1>Drivers</h1><p class="welcome-subtitle">Manage driver profiles, availability, and vehicle assignments.</p></div><div class="welcome-actions"><button class="button button-quiet" id="exportDrivers">⇩ Export CSV</button><button class="button button-primary" id="newDriver">＋ Add driver</button></div></section>
    <section class="kpi-grid vehicle-kpis"><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Total drivers</span><span class="kpi-icon violet">♧</span></div><div class="kpi-value">${all.length}</div><div class="kpi-foot">Registered fleet team</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Available now</span><span class="kpi-icon green">✓</span></div><div class="kpi-value">${all.filter(d=>d.status==='Available').length}</div><div class="kpi-foot">Ready for an assignment</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">On delivery</span><span class="kpi-icon blue">⇄</span></div><div class="kpi-value">${all.filter(d=>d.status==='On delivery').length}</div><div class="kpi-foot">Currently completing a route</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Completed deliveries</span><span class="kpi-icon orange">✓</span></div><div class="kpi-value">${all.reduce((n,d)=>n+Number(d.deliveries),0)}</div><div class="kpi-foot">Total recorded assignments</div></article></section>
    <section class="panel drivers-panel"><div class="inventory-toolbar"><div class="inventory-tabs"><button class="inventory-tab active" data-driver-status="All">All drivers <span>${all.length}</span></button>${['Available','On delivery','Off duty'].map(s=>`<button class="inventory-tab" data-driver-status="${s}">${s}</button>`).join('')}</div><div class="table-actions"><label class="table-search"><span>⌕</span><input id="driverSearch" type="search" value="${safe(query)}" placeholder="Search drivers" aria-label="Search drivers"></label></div></div><div class="table-scroll"><table><thead><tr><th>DRIVER</th><th>PHONE</th><th>LICENSE ID</th><th>LOCATION</th><th>ASSIGNED VEHICLE</th><th>STATUS</th><th></th></tr></thead><tbody id="driverRows">${filtered.map(driverRow).join('')||'<tr><td colspan="7" class="empty-row">No drivers match your search.</td></tr>'}</tbody></table></div><div class="table-footer"><span id="driverCount">Showing ${filtered.length} of ${all.length} drivers</span><span class="inventory-note">Driver demo data is saved in this browser.</span></div></section>
    <div class="modal-backdrop" id="driverModal" hidden><section class="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="driverModalTitle"><div class="modal-head"><div><h2 id="driverModalTitle">Add a driver</h2><p>Add a driver profile to your fleet team.</p></div><button class="modal-close" id="closeDriverModal" aria-label="Close">×</button></div><form id="driverForm"><div class="form-grid"><label>Full name<input name="name" required maxlength="60" placeholder="e.g. Kwame Mensah"></label><label>Phone number<input name="phone" type="tel" required placeholder="+233 24 000 0000"></label><label>License ID<input name="license" required maxlength="24" placeholder="GH-DL-12345"></label><label>Base location<input name="location" required maxlength="40" placeholder="Accra"></label><label>Availability<select name="status"><option>Available</option><option>Off duty</option></select></label></div><div class="modal-actions"><button class="button button-quiet" type="button" id="cancelDriver">Cancel</button><button class="button button-primary" type="submit">Save driver</button></div></form></section></div><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;
    setupDriverControls();
  }
  function driverRow(d){const initials=d.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();const cls=d.status==='Available'?'available':d.status==='On delivery'?'in-transit':'maintenance';return `<tr><td><span class="customer-avatar driver-avatar">${safe(initials)}</span><span class="vehicle-name"><strong>${safe(d.name)}</strong><small>${safe(d.id)} · ${Number(d.deliveries)} deliveries</small></span></td><td>${safe(d.phone)}</td><td class="stock-id">${safe(d.license)}</td><td>${safe(d.location)}</td><td class="assigned-vehicle">${safe(d.vehicle)}</td><td><span class="status-pill ${cls}">${safe(d.status)}</span></td><td><button class="row-menu" data-driver="${safe(d.id)}" aria-label="Driver options">···</button></td></tr>`;}
  function setupDriverControls(){const input=$('#driverSearch');let selected='All';const apply=()=>{const rows=getDrivers().filter(d=>(selected==='All'||d.status===selected)&&`${d.id} ${d.name} ${d.phone} ${d.license} ${d.location} ${d.vehicle} ${d.status}`.toLowerCase().includes(input.value.toLowerCase()));$('#driverRows').innerHTML=rows.map(driverRow).join('')||'<tr><td colspan="7" class="empty-row">No drivers match these filters.</td></tr>';$('#driverCount').textContent=`Showing ${rows.length} of ${drivers.length} drivers`;};input.addEventListener('input',apply);$$('.inventory-tab[data-driver-status]').forEach(tab=>tab.addEventListener('click',()=>{$$('.inventory-tab[data-driver-status]').forEach(t=>t.classList.remove('active'));tab.classList.add('active');selected=tab.dataset.driverStatus;apply();}));
    $$('#driverRows .row-menu').forEach(button=>button.addEventListener('click',()=>showToast('Driver profile and assignment details will be available here')));
    $('#newDriver').addEventListener('click',()=>{$('#driverModal').hidden=false;$('input[name="name"]').focus();});const close=()=>$('#driverModal').hidden=true;$('#closeDriverModal').addEventListener('click',close);$('#cancelDriver').addEventListener('click',close);$('#driverModal').addEventListener('click',e=>{if(e.target.id==='driverModal')close();});
    $('#driverForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),name=f.get('name').trim();if(getDrivers().some(d=>d.license.toLowerCase()===f.get('license').trim().toLowerCase())){showToast('That license ID is already registered');return;}drivers.unshift({id:`DRV-${String(Date.now()).slice(-3)}`,name,phone:f.get('phone').trim(),license:f.get('license').trim().toUpperCase(),location:f.get('location').trim(),vehicle:'—',deliveries:0,status:f.get('status')});persistDrivers();renderDrivers();showToast(`${name} added to drivers`);});
    $('#exportDrivers').addEventListener('click',()=>{const csv=['Driver ID,Name,Phone,License ID,Location,Assigned Vehicle,Completed Deliveries,Status',...getDrivers().map(d=>[d.id,d.name,d.phone,d.license,d.location,d.vehicle,d.deliveries,d.status].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='motiv-drivers.csv';link.click();URL.revokeObjectURL(link.href);showToast('Driver CSV exported');});}

  const defaultMaintenance=[
    {id:'WO-24058',vehicle:'2023 Toyota Hilux',stock:'NSM-2395',service:'Routine service',provider:'Accra Auto Care',due:'2024-05-22',cost:2850,status:'Scheduled'},
    {id:'WO-24054',vehicle:'2022 Honda CR-V',stock:'NSM-2398',service:'Brake inspection',provider:'Tema Motor Works',due:'2024-05-20',cost:1750,status:'In progress'},
    {id:'WO-24049',vehicle:'2021 Lexus RX 350',stock:'NSM-2371',service:'Oil and filter change',provider:'Accra Auto Care',due:'2024-05-19',cost:980,status:'Completed'},
    {id:'WO-24041',vehicle:'2022 Hyundai Tucson',stock:'NSM-2391',service:'Tire replacement',provider:'Northstar Service Bay',due:'2024-05-25',cost:4200,status:'Scheduled'},
    {id:'WO-24032',vehicle:'2023 Toyota RAV4',stock:'NSM-2401',service:'Pre-delivery inspection',provider:'Northstar Service Bay',due:'2024-05-18',cost:1200,status:'Completed'},
    {id:'WO-24018',vehicle:'2021 Nissan Navara',stock:'NSM-2382',service:'Battery replacement',provider:'Tema Motor Works',due:'2024-05-16',cost:1650,status:'Completed'},
  ];
  let maintenance=null;
  function getMaintenance(){if(maintenance)return maintenance;try{maintenance=JSON.parse(localStorage.getItem('motiv-maintenance'))||defaultMaintenance;}catch{maintenance=defaultMaintenance;}return maintenance;}
  function persistMaintenance(){localStorage.setItem('motiv-maintenance',JSON.stringify(maintenance));saveRemoteRecords('maintenance',maintenance);}
  function renderMaintenance(query=''){
    const page=$('.page-content');if(dashboardMarkup===null)dashboardMarkup=page.innerHTML;
    const all=getMaintenance(),filtered=all.filter(m=>`${m.id} ${m.vehicle} ${m.stock} ${m.service} ${m.provider} ${m.status}`.toLowerCase().includes(query.toLowerCase()));
    page.innerHTML=`<section class="welcome-row"><div><p class="eyebrow">VEHICLE CARE <span class="weather">${all.length} work orders</span></p><h1>Maintenance</h1><p class="welcome-subtitle">Plan service, track repair progress, and keep vehicles road-ready.</p></div><div class="welcome-actions"><button class="button button-quiet" id="exportMaintenance">⇩ Export CSV</button><button class="button button-primary" id="newWorkOrder">＋ Schedule service</button></div></section>
    <section class="kpi-grid vehicle-kpis"><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Open work orders</span><span class="kpi-icon violet">⚙</span></div><div class="kpi-value">${all.filter(m=>m.status!=='Completed').length}</div><div class="kpi-foot">Scheduled or in progress</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">In progress</span><span class="kpi-icon orange">⌁</span></div><div class="kpi-value">${all.filter(m=>m.status==='In progress').length}</div><div class="kpi-foot">Currently at a service provider</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Completed this month</span><span class="kpi-icon green">✓</span></div><div class="kpi-value">${all.filter(m=>m.status==='Completed').length}</div><div class="kpi-foot">Service jobs closed</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Tracked service cost</span><span class="kpi-icon blue">＄</span></div><div class="kpi-value">₵ ${all.reduce((n,m)=>n+Number(m.cost),0).toLocaleString('en-GH')}</div><div class="kpi-foot">Across listed work orders</div></article></section>
    <section class="panel maintenance-panel"><div class="inventory-toolbar"><div class="inventory-tabs"><button class="inventory-tab active" data-maint-status="All">All work orders <span>${all.length}</span></button>${['Scheduled','In progress','Completed'].map(s=>`<button class="inventory-tab" data-maint-status="${s}">${s}</button>`).join('')}</div><div class="table-actions"><label class="table-search"><span>⌕</span><input id="maintenanceSearch" type="search" value="${safe(query)}" placeholder="Search work orders" aria-label="Search work orders"></label></div></div><div class="table-scroll"><table><thead><tr><th>WORK ORDER</th><th>VEHICLE</th><th>SERVICE</th><th>PROVIDER</th><th>DUE DATE</th><th>COST</th><th>STATUS</th><th></th></tr></thead><tbody id="maintenanceRows">${filtered.map(maintenanceRow).join('')||'<tr><td colspan="8" class="empty-row">No work orders match your search.</td></tr>'}</tbody></table></div><div class="table-footer"><span id="maintenanceCount">Showing ${filtered.length} of ${all.length} work orders</span><span class="inventory-note">Maintenance demo data is saved in this browser.</span></div></section>
    <div class="modal-backdrop" id="maintenanceModal" hidden><section class="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="maintenanceModalTitle"><div class="modal-head"><div><h2 id="maintenanceModalTitle">Schedule service</h2><p>Create a maintenance work order.</p></div><button class="modal-close" id="closeMaintenanceModal" aria-label="Close">×</button></div><form id="maintenanceForm"><div class="form-grid"><label>Vehicle<input name="vehicle" required placeholder="e.g. 2023 Toyota RAV4"></label><label>Stock ID<input name="stock" required placeholder="NSM-2401"></label><label>Service type<input name="service" required placeholder="e.g. Routine service"></label><label>Service provider<input name="provider" required placeholder="Workshop name"></label><label>Due date<input name="due" type="date" required></label><label>Estimated cost (GH₵)<input name="cost" type="number" min="0" required placeholder="1500"></label></div><div class="modal-actions"><button class="button button-quiet" type="button" id="cancelMaintenance">Cancel</button><button class="button button-primary" type="submit">Create work order</button></div></form></section></div><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;
    setupMaintenanceControls();
  }
  function maintenanceRow(m){const cls=m.status==='Completed'?'available':m.status==='In progress'?'in-transit':'arriving';return `<tr><td class="stock-id"><strong>${safe(m.id)}</strong></td><td><span class="vehicle-name"><strong>${safe(m.vehicle)}</strong><small>${safe(m.stock)}</small></span></td><td>${safe(m.service)}</td><td>${safe(m.provider)}</td><td>${new Date(`${m.due}T00:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td><td class="price">${money(m.cost)}</td><td><span class="status-pill ${cls}">${safe(m.status)}</span></td><td><button class="row-menu" data-order="${safe(m.id)}" aria-label="Update work order">···</button></td></tr>`;}
  function setupMaintenanceControls(){const input=$('#maintenanceSearch');let selected='All';const apply=()=>{const rows=getMaintenance().filter(m=>(selected==='All'||m.status===selected)&&`${m.id} ${m.vehicle} ${m.stock} ${m.service} ${m.provider} ${m.status}`.toLowerCase().includes(input.value.toLowerCase()));$('#maintenanceRows').innerHTML=rows.map(maintenanceRow).join('')||'<tr><td colspan="8" class="empty-row">No work orders match these filters.</td></tr>';$('#maintenanceCount').textContent=`Showing ${rows.length} of ${maintenance.length} work orders`;$$('#maintenanceRows .row-menu').forEach(button=>button.addEventListener('click',()=>{const order=getMaintenance().find(m=>m.id===button.dataset.order);if(!order)return;if(order.status==='Completed'){showToast(`${order.id} is already completed`);return;}order.status=order.status==='Scheduled'?'In progress':'Completed';persistMaintenance();renderMaintenance(input.value);showToast(`${order.id} marked ${order.status.toLowerCase()}`);}));};input.addEventListener('input',apply);$$('.inventory-tab[data-maint-status]').forEach(tab=>tab.addEventListener('click',()=>{$$('.inventory-tab[data-maint-status]').forEach(t=>t.classList.remove('active'));tab.classList.add('active');selected=tab.dataset.maintStatus;apply();}));
    $('#newWorkOrder').addEventListener('click',()=>{$('#maintenanceModal').hidden=false;$('input[name="vehicle"]').focus();});const close=()=>$('#maintenanceModal').hidden=true;$('#closeMaintenanceModal').addEventListener('click',close);$('#cancelMaintenance').addEventListener('click',close);$('#maintenanceModal').addEventListener('click',e=>{if(e.target.id==='maintenanceModal')close();});$('#maintenanceForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),id=`WO-${String(Date.now()).slice(-5)}`;maintenance.unshift({id,vehicle:f.get('vehicle').trim(),stock:f.get('stock').trim().toUpperCase(),service:f.get('service').trim(),provider:f.get('provider').trim(),due:f.get('due'),cost:Number(f.get('cost')),status:'Scheduled'});persistMaintenance();renderMaintenance();showToast(`${id} scheduled`);});$('#exportMaintenance').addEventListener('click',()=>{const csv=['Work Order,Vehicle,Stock ID,Service,Provider,Due Date,Cost (GHS),Status',...getMaintenance().map(m=>[m.id,m.vehicle,m.stock,m.service,m.provider,m.due,m.cost,m.status].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='motiv-maintenance.csv';link.click();URL.revokeObjectURL(link.href);showToast('Maintenance CSV exported');});}

  const defaultExpenses=[
    {id:'EXP-2508',date:'2024-05-19',category:'Freight & shipping',description:'Ocean freight · MSKU 4829',vendor:'Pacific Star Logistics',vehicle:'Shipment MSKU 4829',amount:28600,status:'Paid',method:'Bank transfer'},
    {id:'EXP-2503',date:'2024-05-18',category:'Maintenance',description:'Pre-delivery inspection',vendor:'Northstar Service Bay',vehicle:'Toyota RAV4 · NSM-2401',amount:1200,status:'Paid',method:'Mobile money'},
    {id:'EXP-2497',date:'2024-05-16',category:'Port & customs',description:'Tema port handling fees',vendor:'GPHA Tema Port',vehicle:'Shipment HLCU 2901',amount:8450,status:'Pending',method:'Bank transfer'},
    {id:'EXP-2491',date:'2024-05-14',category:'Transport',description:'Inland vehicle transfer',vendor:'Northstar Transport',vehicle:'Toyota Hilux · NSM-2395',amount:1750,status:'Paid',method:'Cash'},
    {id:'EXP-2488',date:'2024-05-12',category:'Insurance',description:'Transit coverage premium',vendor:'Enterprise Insurance',vehicle:'Shipment CMAU 1843',amount:3900,status:'Pending',method:'Bank transfer'},
    {id:'EXP-2480',date:'2024-05-10',category:'Operations',description:'Warehouse utilities · May',vendor:'Tema Logistics Park',vehicle:'Operations',amount:2650,status:'Paid',method:'Mobile money'},
    {id:'EXP-2472',date:'2024-05-08',category:'Maintenance',description:'Oil and filter change',vendor:'Accra Auto Care',vehicle:'Lexus RX 350 · NSM-2371',amount:980,status:'Paid',method:'Cash'},
  ];
  let expenses=null;
  function getExpenses(){if(expenses)return expenses;try{expenses=JSON.parse(localStorage.getItem('motiv-expenses'))||defaultExpenses;}catch{expenses=defaultExpenses;}return expenses;}
  function persistExpenses(){localStorage.setItem('motiv-expenses',JSON.stringify(expenses));saveRemoteRecords('expenses',expenses);}
  function renderExpenses(query=''){
    const page=$('.page-content');if(dashboardMarkup===null)dashboardMarkup=page.innerHTML;
    const all=getExpenses(),filtered=all.filter(e=>`${e.id} ${e.date} ${e.category} ${e.description} ${e.vendor} ${e.vehicle} ${e.status} ${e.method}`.toLowerCase().includes(query.toLowerCase()));
    const monthTotal=all.reduce((n,e)=>n+Number(e.amount),0),pending=all.filter(e=>e.status==='Pending').reduce((n,e)=>n+Number(e.amount),0);
    page.innerHTML=`<section class="welcome-row"><div><p class="eyebrow">COST CONTROL <span class="weather">MAY 2024 · ${all.length} records</span></p><h1>Expenses</h1><p class="welcome-subtitle">Track import, shipping, service, and day-to-day operating costs.</p></div><div class="welcome-actions"><button class="button button-quiet" id="exportExpenses">⇩ Export CSV</button><button class="button button-primary" id="newExpense">＋ Record expense</button></div></section>
    <section class="kpi-grid vehicle-kpis"><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Recorded expenses</span><span class="kpi-icon violet">＄</span></div><div class="kpi-value">${money(monthTotal)}</div><div class="kpi-foot">All expense records shown</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Pending payment</span><span class="kpi-icon orange">◷</span></div><div class="kpi-value">${money(pending)}</div><div class="kpi-foot">Awaiting payment confirmation</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Paid expenses</span><span class="kpi-icon green">✓</span></div><div class="kpi-value">${all.filter(e=>e.status==='Paid').length}</div><div class="kpi-foot">Completed transactions</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Largest category</span><span class="kpi-icon blue">▤</span></div><div class="kpi-value expense-category-value">${safe(largestExpenseCategory(all))}</div><div class="kpi-foot">By recorded expense value</div></article></section>
    <section class="panel expenses-panel"><div class="inventory-toolbar"><div class="inventory-tabs"><button class="inventory-tab active" data-expense-status="All">All expenses <span>${all.length}</span></button>${['Paid','Pending'].map(s=>`<button class="inventory-tab" data-expense-status="${s}">${s}</button>`).join('')}</div><div class="table-actions"><label class="table-search"><span>⌕</span><input id="expenseSearch" type="search" value="${safe(query)}" placeholder="Search expenses" aria-label="Search expenses"></label><select class="status-filter" id="expenseCategory"><option value="All">All categories</option>${[...new Set(all.map(e=>e.category))].map(c=>`<option>${safe(c)}</option>`).join('')}</select></div></div><div class="table-scroll"><table><thead><tr><th>EXPENSE</th><th>CATEGORY</th><th>DATE</th><th>VENDOR</th><th>LINKED TO</th><th>AMOUNT</th><th>STATUS</th><th></th></tr></thead><tbody id="expenseRows">${filtered.map(expenseRow).join('')||'<tr><td colspan="8" class="empty-row">No expenses match your search.</td></tr>'}</tbody></table></div><div class="table-footer"><span id="expenseCount">Showing ${filtered.length} of ${all.length} expenses</span><span class="inventory-note">Expense demo data is saved in this browser.</span></div></section>
    <div class="modal-backdrop" id="expenseModal" hidden><section class="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="expenseModalTitle"><div class="modal-head"><div><h2 id="expenseModalTitle">Record an expense</h2><p>Add a cost to your operations ledger.</p></div><button class="modal-close" id="closeExpenseModal" aria-label="Close">×</button></div><form id="expenseForm"><div class="form-grid"><label>Description<input name="description" required maxlength="80" placeholder="e.g. Port handling fees"></label><label>Category<select name="category"><option>Freight &amp; shipping</option><option>Port &amp; customs</option><option>Maintenance</option><option>Transport</option><option>Insurance</option><option>Operations</option><option>Other</option></select></label><label>Vendor<input name="vendor" required maxlength="60" placeholder="Company or payee"></label><label>Linked vehicle or shipment<input name="vehicle" required maxlength="60" placeholder="Stock ID, shipment, or Operations"></label><label>Date<input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></label><label>Amount (GH₵)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></label><label>Payment status<select name="status"><option>Pending</option><option>Paid</option></select></label><label>Payment method<select name="method"><option>Bank transfer</option><option>Mobile money</option><option>Cash</option><option>Card</option></select></label></div><div class="modal-actions"><button class="button button-quiet" type="button" id="cancelExpense">Cancel</button><button class="button button-primary" type="submit">Save expense</button></div></form></section></div><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;
    setupExpenseControls();
  }
  function largestExpenseCategory(rows){const sums={};rows.forEach(e=>sums[e.category]=(sums[e.category]||0)+Number(e.amount));return Object.entries(sums).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';}
  function expenseRow(e){const cls=e.status==='Paid'?'available':'arriving';return `<tr><td><span class="vehicle-name"><strong>${safe(e.description)}</strong><small>${safe(e.id)} · ${safe(e.method)}</small></span></td><td><span class="category-pill">${safe(e.category)}</span></td><td>${new Date(`${e.date}T00:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td><td>${safe(e.vendor)}</td><td class="stock-id">${safe(e.vehicle)}</td><td class="price">${money(e.amount)}</td><td><span class="status-pill ${cls}">${safe(e.status)}</span></td><td><button class="row-menu" data-expense="${safe(e.id)}" aria-label="Update expense">···</button></td></tr>`;}
  function setupExpenseControls(){const input=$('#expenseSearch'),category=$('#expenseCategory');let selected='All';const apply=()=>{const rows=getExpenses().filter(e=>(selected==='All'||e.status===selected)&&(category.value==='All'||e.category===category.value)&&`${e.id} ${e.date} ${e.category} ${e.description} ${e.vendor} ${e.vehicle} ${e.status} ${e.method}`.toLowerCase().includes(input.value.toLowerCase()));$('#expenseRows').innerHTML=rows.map(expenseRow).join('')||'<tr><td colspan="8" class="empty-row">No expenses match these filters.</td></tr>';$('#expenseCount').textContent=`Showing ${rows.length} of ${expenses.length} expenses`;$$('#expenseRows .row-menu').forEach(button=>button.addEventListener('click',()=>{const expense=getExpenses().find(e=>e.id===button.dataset.expense);if(!expense)return;expense.status=expense.status==='Paid'?'Pending':'Paid';persistExpenses();renderExpenses(input.value);showToast(`${expense.id} marked ${expense.status.toLowerCase()}`);}));};input.addEventListener('input',apply);category.addEventListener('change',apply);$$('.inventory-tab[data-expense-status]').forEach(tab=>tab.addEventListener('click',()=>{$$('.inventory-tab[data-expense-status]').forEach(t=>t.classList.remove('active'));tab.classList.add('active');selected=tab.dataset.expenseStatus;apply();}));$('#newExpense').addEventListener('click',()=>{$('#expenseModal').hidden=false;$('input[name="description"]').focus();});const close=()=>$('#expenseModal').hidden=true;$('#closeExpenseModal').addEventListener('click',close);$('#cancelExpense').addEventListener('click',close);$('#expenseModal').addEventListener('click',e=>{if(e.target.id==='expenseModal')close();});$('#expenseForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),id=`EXP-${String(Date.now()).slice(-4)}`;expenses.unshift({id,date:f.get('date'),category:f.get('category'),description:f.get('description').trim(),vendor:f.get('vendor').trim(),vehicle:f.get('vehicle').trim(),amount:Number(f.get('amount')),status:f.get('status'),method:f.get('method')});persistExpenses();renderExpenses();showToast(`${id} added to expenses`);});$('#exportExpenses').addEventListener('click',()=>{const csv=['Expense ID,Date,Category,Description,Vendor,Linked To,Amount (GHS),Status,Payment Method',...getExpenses().map(e=>[e.id,e.date,e.category,e.description,e.vendor,e.vehicle,e.amount,e.status,e.method].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='motiv-expenses.csv';link.click();URL.revokeObjectURL(link.href);showToast('Expenses CSV exported');});}

  let chosenReportPeriod='month';
  function reportPeriod(){const period=chosenReportPeriod;const now=new Date('2024-05-20T12:00:00');let start;if(period==='week')start=new Date('2024-05-13T00:00:00');else if(period==='quarter')start=new Date('2024-04-01T00:00:00');else start=new Date('2024-05-01T00:00:00');return {period,start,end:now};}
  function reportData(){const {start,end}=reportPeriod();const dateInRange=date=>{const value=new Date(`${date}T00:00:00`);return value>=start&&value<=end;};const sales=getCustomers().filter(c=>c.status==='Active');const expensesInRange=getExpenses().filter(e=>dateInRange(e.date));const maint=getMaintenance().filter(m=>dateInRange(m.due));const shipped=getShipments().filter(s=>dateInRange(s.arrival));return {sales,expensesInRange,maint,shipped,revenue:sales.reduce((n,c)=>n+Number(c.total),0),expenses:expensesInRange.reduce((n,e)=>n+Number(e.amount),0)};}
  function renderReports(){const page=$('.page-content');if(dashboardMarkup===null)dashboardMarkup=page.innerHTML;const d=reportData();page.innerHTML=`<section class="welcome-row"><div><p class="eyebrow">BUSINESS INTELLIGENCE <span class="weather">DEMO DATA · GH₵</span></p><h1>Reports</h1><p class="welcome-subtitle">A snapshot of sales, operations, shipments, and costs across your workspace.</p></div><div class="welcome-actions"><select id="reportPeriod" class="status-filter report-period"><option value="month" ${chosenReportPeriod==='month'?'selected':''}>This month</option><option value="week" ${chosenReportPeriod==='week'?'selected':''}>This week</option><option value="quarter" ${chosenReportPeriod==='quarter'?'selected':''}>This quarter</option></select><button class="button button-primary" id="exportReport">⇩ Export report</button></div></section>
    <section class="kpi-grid vehicle-kpis"><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Recorded sales</span><span class="kpi-icon violet">＄</span></div><div class="kpi-value">${money(d.revenue)}</div><div class="kpi-foot">From active customer records</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Tracked expenses</span><span class="kpi-icon orange">↘</span></div><div class="kpi-value">${money(d.expenses)}</div><div class="kpi-foot">Within selected period</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Net tracked value</span><span class="kpi-icon green">◈</span></div><div class="kpi-value">${money(d.revenue-d.expenses)}</div><div class="kpi-foot">Sales less recorded expenses</div></article><article class="kpi-card"><div class="kpi-top"><span class="kpi-label">Active shipments</span><span class="kpi-icon blue">⇄</span></div><div class="kpi-value">${getShipments().filter(s=>['In transit','Arriving soon'].includes(s.status)).length}</div><div class="kpi-foot">Across ocean and road freight</div></article></section>
    <section class="report-grid"><article class="panel report-panel"><div class="panel-header"><div><h2>Sales and expenses</h2><p>Recorded amounts in Ghana cedis</p></div><span class="report-period-label" id="periodLabel">May 2024</span></div><div class="report-bars" id="reportBars"></div><div class="report-legend"><span><i class="legend-dot revenue-dot"></i>Sales</span><span><i class="legend-dot expenses-dot"></i>Expenses</span></div></article><article class="panel report-panel"><div class="panel-header"><div><h2>Expenses by category</h2><p>Where recorded costs are going</p></div></div><div class="category-report" id="categoryReport"></div></article></section>
    <section class="report-grid secondary-report-grid"><article class="panel report-panel"><div class="panel-header"><div><h2>Operations summary</h2><p>Current totals across your workspace</p></div></div><div class="report-stat-list"><div><span>Vehicles in inventory</span><strong>${getInventory().length}</strong></div><div><span>Customers with purchases</span><strong>${d.sales.length}</strong></div><div><span>Shipments arriving in period</span><strong>${d.shipped.length}</strong></div><div><span>Maintenance due in period</span><strong>${d.maint.length}</strong></div><div><span>Completed deliveries by drivers</span><strong>${getDrivers().reduce((n,x)=>n+Number(x.deliveries),0)}</strong></div></div></article><article class="panel report-panel"><div class="panel-header"><div><h2>Recent expense records</h2><p>Latest costs from your expense ledger</p></div><button class="text-link" id="goExpenses">Open expenses <span>→</span></button></div><div class="recent-report-list">${[...getExpenses()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(e=>`<div><span class="report-expense-icon">↘</span><span class="vehicle-name"><strong>${safe(e.description)}</strong><small>${safe(e.category)} · ${new Date(`${e.date}T00:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></span><strong class="price">${money(e.amount)}</strong></div>`).join('')}</div></article></section><p class="report-disclaimer">Reports use illustrative records stored in this browser. Sales are derived from customer purchase totals; this prototype does not calculate accounting profit.</p><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;drawReports();$('#reportPeriod').addEventListener('change',event=>{chosenReportPeriod=event.target.value;renderReports();});$('#exportReport').addEventListener('click',exportReportCsv);$('#goExpenses').addEventListener('click',()=>{const link=$('.nav-item[data-page="Expenses"]');if(link)link.click();});}
  function drawReports(){const d=reportData();const max=Math.max(d.revenue,d.expenses,1);const bars=$('#reportBars');bars.innerHTML=`<div class="bar-group"><div class="bar-pair"><span class="report-bar sales-bar" style="height:${Math.max(5,d.revenue/max*100)}%" title="Sales ${money(d.revenue)}"></span><span class="report-bar cost-bar" style="height:${Math.max(5,d.expenses/max*100)}%" title="Expenses ${money(d.expenses)}"></span></div><small>${$('#reportPeriod').value==='week'?'This week':$('#reportPeriod').value==='quarter'?'This quarter':'This month'}</small></div>`;const totals={};d.expensesInRange.forEach(e=>totals[e.category]=(totals[e.category]||0)+Number(e.amount));const entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]);$('#categoryReport').innerHTML=entries.length?entries.map(([name,value],i)=>`<div class="category-report-row"><div><i class="category-swatch swatch-${i%5}"></i><span>${safe(name)}</span><strong>${money(value)}</strong></div><div class="category-track"><i class="swatch-fill-${i%5}" style="width:${value/(entries[0]?.[1]||1)*100}%"></i></div></div>`).join(''):'<div class="empty-row">No expense records in this period.</div>';$('#periodLabel').textContent=$('#reportPeriod').value==='week'?'May 13 – 20':$('#reportPeriod').value==='quarter'?'Apr – May 2024':'May 2024';}
  function exportReportCsv(){const d=reportData();const rows=[['Metric','Value'],['Sales recorded (GHS)',d.revenue],['Expenses recorded (GHS)',d.expenses],['Net tracked value (GHS)',d.revenue-d.expenses],['Inventory vehicles',getInventory().length],['Active shipments',getShipments().filter(s=>['In transit','Arriving soon'].includes(s.status)).length],['Customers with purchases',d.sales.length],['Shipments arriving in period',d.shipped.length],['Maintenance due in period',d.maint.length],[],['Expense ID','Date','Category','Description','Vendor','Amount (GHS)','Status'],...d.expensesInRange.map(e=>[e.id,e.date,e.category,e.description,e.vendor,e.amount,e.status])];const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='motiv-business-report.csv';link.click();URL.revokeObjectURL(link.href);showToast('Report CSV exported');}

  function getPreferences(){let prefs;try{prefs=JSON.parse(localStorage.getItem('motiv-preferences'));}catch{prefs=null;}prefs=prefs||{workspace:'Northstar Motors',name:'Eldad Asante Boateng',username:'Eldadboateng',email:'eldad.boateng@example.com',role:'Administrator',notifications:true};if(prefs.name==='Kofi Owusu'){prefs.name='Eldad Asante Boateng';prefs.email='eldad.boateng@example.com';}if(!prefs.username)prefs.username='Eldadboateng';return prefs;}
  function savePreferences(preferences){localStorage.setItem('motiv-preferences',JSON.stringify(preferences));if(backendReady)apiRequest('preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences})}).catch(()=>showToast('Could not save preferences to MySQL'));}
  function renderSettings(){const page=$('.page-content');if(dashboardMarkup===null)dashboardMarkup=page.innerHTML;const prefs=getPreferences();page.innerHTML=`<section class="welcome-row"><div><p class="eyebrow">WORKSPACE CONTROL</p><h1>Settings</h1><p class="welcome-subtitle">Manage your workspace profile and dashboard preferences.</p></div><div class="welcome-actions"><button class="button button-quiet" id="backupData">⇩ Download data backup</button></div></section>
    <div class="settings-layout"><nav class="panel settings-nav" aria-label="Settings sections"><a class="settings-nav-link active" href="#account-settings">♙ <span>Profile</span></a><a class="settings-nav-link" href="#workspace-settings">▦ <span>Workspace</span></a><a class="settings-nav-link" href="#preference-settings">☼ <span>Preferences</span></a><a class="settings-nav-link" href="#data-settings">▤ <span>Data & privacy</span></a></nav><div class="settings-content">
    <section class="panel settings-section" id="account-settings"><div class="settings-heading"><div><h2>Your profile</h2><p>Personal details for your Motiv account.</p></div></div><form id="profileSettingsForm"><div class="settings-profile"><span class="avatar settings-avatar">${safe(prefs.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</span><div><strong>${safe(prefs.name)}</strong><small>Profile photo is represented by your initials</small></div></div><div class="form-grid settings-form"><label>Full name<input name="name" value="${safe(prefs.name)}" required maxlength="60"></label><label>Sign-in username<input name="username" value="${safe(prefs.username)}" readonly autocomplete="username"></label><label>Email address<input name="email" value="${safe(prefs.email)}" required type="email"></label><label>Role<input value="${safe(prefs.role)}" readonly></label></div><div class="settings-save"><button class="button button-primary" type="submit">Save profile</button></div></form></section>
    <section class="panel settings-section" id="workspace-settings"><div class="settings-heading"><div><h2>Workspace</h2><p>Set the name shown in your navigation and workspace.</p></div></div><form id="workspaceSettingsForm"><div class="form-grid settings-form"><label>Workspace name<input name="workspace" value="${safe(prefs.workspace)}" required maxlength="50"></label><label>Default currency<input value="Ghana cedi (GH₵)" readonly></label></div><div class="settings-save"><button class="button button-primary" type="submit">Save workspace</button></div></form></section>
    <section class="panel settings-section" id="preference-settings"><div class="settings-heading"><div><h2>Preferences</h2><p>Choose how the dashboard looks and keeps you informed.</p></div></div><div class="preference-row"><span class="preference-icon">☼</span><div><strong>Appearance</strong><small>Choose light or dark dashboard theme</small></div><button class="button button-quiet" id="settingsTheme">${document.documentElement.dataset.theme==='dark'?'Dark mode':'Light mode'} · Change</button></div><div class="preference-row"><span class="preference-icon notification-pref">♧</span><div><strong>Notification indicator</strong><small>Show the unread dot on the notification bell</small></div><label class="switch"><input id="notificationPreference" type="checkbox" ${prefs.notifications?'checked':''}><span></span></label></div><div class="preference-row"><span class="preference-icon">◷</span><div><strong>Date format</strong><small>Dates are displayed as day, month, year</small></div><span class="readonly-value">DD MMM YYYY</span></div></section>
    <section class="panel settings-section" id="data-settings"><div class="settings-heading"><div><h2>Data & privacy</h2><p>Your demo records are stored locally in this browser.</p></div></div><div class="data-backup-row"><span class="backup-icon">▤</span><div><strong>Download a data backup</strong><small>Export vehicles, shipments, customers, drivers, maintenance, expenses, and preferences as JSON.</small></div><button class="button button-quiet" id="backupDataAlt">Export JSON</button></div><p class="settings-note">This prototype does not send your data to a server. Clearing browser site data will remove locally saved demo changes.</p></section></div></div><footer class="page-footer"><span>© 2024 Motiv Operations</span><span>Made for the road <span class="footer-star">✦</span></span><a href="#support">Support</a><a href="#privacy">Privacy</a></footer>`;
    $$('.settings-nav-link').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();$$('.settings-nav-link').forEach(item=>item.classList.remove('active'));link.classList.add('active');$(link.getAttribute('href'))?.scrollIntoView({behavior:'smooth',block:'center'});}));
    $('#profileSettingsForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);prefs.name=f.get('name').trim();prefs.username=f.get('username').trim();prefs.email=f.get('email').trim();savePreferences(prefs);$('.profile-copy strong').textContent=prefs.name;$('.profile-copy small').textContent=prefs.role;$('.avatar:not(.settings-avatar)').textContent=prefs.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();$('.settings-avatar').textContent=prefs.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();showToast('Profile settings saved');});
    $('#workspaceSettingsForm').addEventListener('submit',e=>{e.preventDefault();prefs.workspace=new FormData(e.currentTarget).get('workspace').trim();savePreferences(prefs);$('.workspace-copy strong').textContent=prefs.workspace;showToast('Workspace settings saved');});
    $('#settingsTheme').addEventListener('click',()=>{$('#themeToggle').click();renderSettings();});$('#notificationPreference').addEventListener('change',e=>{prefs.notifications=e.target.checked;savePreferences(prefs);$('#notificationToggle i').hidden=!prefs.notifications;showToast(`Notification indicator ${prefs.notifications?'enabled':'disabled'}`);});
    const backup=()=>{const data={createdAt:new Date().toISOString(),workspace:prefs.workspace,vehicles:getInventory(),shipments:getShipments(),customers:getCustomers(),drivers:getDrivers(),maintenance:getMaintenance(),expenses:getExpenses(),preferences:prefs};const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));link.download='motiv-workspace-backup.json';link.click();URL.revokeObjectURL(link.href);showToast('Workspace backup downloaded');};$('#backupData').addEventListener('click',backup);$('#backupDataAlt').addEventListener('click',backup);
  }

  function filterVehicles(query) {
    const normalized = query.trim().toLowerCase();
    const rows = $$('#vehicleRows tr');
    let visible = 0;
    rows.forEach(row => {
      const match = !normalized || row.dataset.search.includes(normalized);
      row.hidden = !match;
      if (match) visible += 1;
    });
    $('#vehicleCount').textContent = normalized
      ? `Showing ${visible} matching vehicle${visible === 1 ? '' : 's'}`
      : 'Showing 4 of 248 vehicles';
  }

  function setupSearch() {
    $('#vehicleSearch').addEventListener('input', event => filterVehicles(event.target.value));
    const global = $('#globalSearch');
    global.addEventListener('input', () => {
      const query = global.value.trim();
      if ($('#pageTitle').textContent === 'Vehicles') {
        const inventorySearch = $('#inventorySearch');
        inventorySearch.value = query;
        inventorySearch.dispatchEvent(new Event('input'));
        return;
      }
      if ($('#pageTitle').textContent === 'Shipments') {
        const shipmentSearch = $('#shipmentSearch');
        shipmentSearch.value = query;
        shipmentSearch.dispatchEvent(new Event('input'));
        return;
      }
      if ($('#pageTitle').textContent === 'Customers') {
        const customerSearch = $('#customerSearch');
        customerSearch.value = query;
        customerSearch.dispatchEvent(new Event('input'));
        return;
      }
      if ($('#pageTitle').textContent === 'Drivers') {
        const driverSearch = $('#driverSearch');
        driverSearch.value = query;
        driverSearch.dispatchEvent(new Event('input'));
        return;
      }
      if ($('#pageTitle').textContent === 'Maintenance') {
        const maintenanceSearch = $('#maintenanceSearch');
        maintenanceSearch.value = query;
        maintenanceSearch.dispatchEvent(new Event('input'));
        return;
      }
      if ($('#pageTitle').textContent === 'Expenses') {
        const expenseSearch = $('#expenseSearch');
        expenseSearch.value = query;
        expenseSearch.dispatchEvent(new Event('input'));
        return;
      }
      if (query) {
        $('#vehicleSearch').value = query;
        filterVehicles(query);
      } else {
        $('#vehicleSearch').value = '';
        filterVehicles('');
      }
    });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); global.focus();
      }
      if (event.key === 'Escape') {
        global.blur();
        $$('.popover').forEach(popover => popover.classList.remove('open'));
        $('#sidebar').classList.remove('open'); $('.mobile-scrim').classList.remove('open');
      }
    });
  }

  function setupActions() {
    $('#addVehicle').addEventListener('click', () => showToast('Vehicle form will be available in the Vehicles module'));
    $('#dateRange').addEventListener('click', () => showToast('Showing this month: May 1 – May 31, 2024'));
    $('#filterButton').addEventListener('click', () => showToast('Vehicle filters are ready to configure in the Vehicles module'));
    $$('.row-menu').forEach(button => button.addEventListener('click', () => showToast('Vehicle details will be available in the Vehicles module')));
    $$('.pagination button:not(:disabled)').forEach(button => button.addEventListener('click', () => {
      if (button.textContent === '1' || button.textContent === '‹' || button.textContent === '›') showToast('Additional vehicle pages will be available in the Vehicles module');
      else showToast(`Page ${button.textContent} will be available with the full inventory`);
    }));
    $$('.help-link,.view-all').forEach(button => button.addEventListener('click', () => showToast('This section will be available soon')));
    $$('.more-button').forEach(button => button.addEventListener('click', () => showToast('More options will be available in a future update')));
  }

  function setupChartHover() {
    const chart = $('.performance-chart');
    const tooltip = $('#chartTooltip');
    chart.addEventListener('pointermove', event => {
      const rect = chart.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const week = Math.min(6, Math.floor(fraction * 7));
      const values = ['₵ 142,800', '₵ 186,200', '₵ 174,500', '₵ 231,900', '₵ 268,300', '₵ 314,700', '₵ 362,400'];
      tooltip.innerHTML = `Revenue <strong>${values[week]}</strong>`;
      tooltip.style.display = 'block';
      const parent = chart.closest('.performance-panel').getBoundingClientRect();
      tooltip.style.left = `${Math.min(event.clientX - parent.left + 10, parent.width - 106)}px`;
      tooltip.style.top = `${Math.max(42, event.clientY - parent.top - 44)}px`;
    });
    chart.addEventListener('pointerleave', () => { tooltip.style.display = 'none'; });
  }

  setupTheme();
  applySavedPreferences();
  setupPopovers();
  setupSidebar();
  setupSearch();
  setupActions();
  setupChartHover();
  initializePhpBackend();
})();
