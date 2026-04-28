// ============================================================
// SNAPSELECT — Customer Results Page
// ============================================================

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_BASE = "https://drive.google.com/uc?export=view&id=";
const DRIVE_DL = "https://drive.google.com/uc?export=download&id=";

let allPhotos = [];
let filteredPhotos = [];
let currentLightboxIndex = 0;

// ── INIT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('event-name-nav').textContent = SNAPSELECT_CONFIG.eventName;

  // Check guest link expiry
  checkExpiry();

  await loadPhotos();
});

function checkExpiry() {
  const expiry = SNAPSELECT_CONFIG.guestLinkExpiry;
  if (expiry === 0) return;
  const set = localStorage.getItem('snapselect_set');
  if (!set) { localStorage.setItem('snapselect_set', Date.now()); return; }
  const days = (Date.now() - parseInt(set)) / (1000 * 60 * 60 * 24);
  if (days > expiry) {
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Georgia,serif;text-align:center;padding:2rem"><div><h2 style="font-size:2rem;margin-bottom:1rem">This link has expired</h2><p style="color:#8A7F70">Please contact the event organiser for a new link.</p></div></div>`;
  }
}

// ── LOAD PHOTOS FROM DRIVE ───────────────────────────────
async function loadPhotos() {
  try {
    const folderId = SNAPSELECT_CONFIG.driveFolderId;
    let photos = [];
    let pageToken = null;

    // Fetch all image files from the folder
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType)',
        pageSize: 1000,
        key: 'AIzaSyD9Xp9X9X9X9X9X9X9X9X9X9X9X9X9X9X' // Public key for Drive listing
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`${DRIVE_API}?${params}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      photos = photos.concat(data.files || []);
      pageToken = data.nextPageToken;
    } while (pageToken);

    if (photos.length === 0) {
      // Fallback: use folder embed approach
      await loadPhotosViaEmbed();
      return;
    }

    allPhotos = photos.map(f => ({
      id: f.id,
      name: f.name,
      url: `${DRIVE_BASE}${f.id}`,
      downloadUrl: `${DRIVE_DL}${f.id}`,
      event: extractEvent(f.name)
    }));

    renderPage();

  } catch (err) {
    console.error('Drive API error, trying embed method:', err);
    await loadPhotosViaEmbed();
  }
}

// Fallback: Load via Drive folder embed (no API key needed)
async function loadPhotosViaEmbed() {
  try {
    const folderId = SNAPSELECT_CONFIG.driveFolderId;
    // Use the Drive folder's RSS/JSON feed
    const res = await fetch(`https://drive.google.com/drive/folders/${folderId}`);
    // Parse file IDs from the HTML (Drive embeds file IDs in data attributes)
    const text = await res.text();
    const matches = [...text.matchAll(/"([a-zA-Z0-9_-]{25,})".*?"image\//g)];

    // If parsing fails, show manual instruction
    if (matches.length === 0) {
      showManualSetup();
      return;
    }

    allPhotos = matches.map((m, i) => ({
      id: m[1],
      name: `photo_${i}`,
      url: `${DRIVE_BASE}${m[1]}`,
      downloadUrl: `${DRIVE_DL}${m[1]}`,
      event: 'all'
    }));

    renderPage();
  } catch (err) {
    showManualSetup();
  }
}

function showManualSetup() {
  showScreen('results-screen');
  document.getElementById('photo-grid').innerHTML = `
    <div style="grid-column:1/-1;padding:3rem;text-align:center">
      <h3 style="font-family:Georgia,serif;font-size:1.5rem;margin-bottom:1rem">Setup needed</h3>
      <p style="color:#8A7F70;max-width:400px;margin:0 auto 1.5rem;line-height:1.6">
        To load photos, you need to add a Google Drive API key to config.js.<br><br>
        Follow the setup guide in README.md for the 2-minute setup.
      </p>
    </div>`;
}

// ── EXTRACT EVENT FROM FILENAME ──────────────────────────
function extractEvent(filename) {
  const match = filename.match(/^\[([^\]]+)\]/);
  if (!match) return 'other';
  const prefix = match[1].toLowerCase();
  const events = SNAPSELECT_CONFIG.events;
  return Object.keys(events).find(k => k === prefix) || 'other';
}

// ── RENDER PAGE ──────────────────────────────────────────
function renderPage() {
  const cfg = SNAPSELECT_CONFIG;

  document.getElementById('event-title').textContent = cfg.eventName;
  document.getElementById('photo-count').textContent = `${allPhotos.length} photos curated by AI`;

  // Event filter buttons
  const filterContainer = document.getElementById('event-filters');
  const events = cfg.events;
  Object.keys(events).forEach(key => {
    const count = allPhotos.filter(p => p.event === key).length;
    if (count === 0) return;
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = key;
    btn.textContent = `${events[key]} (${count})`;
    btn.onclick = () => filterPhotos(key, btn);
    filterContainer.appendChild(btn);
  });

  // Render all photos
  filteredPhotos = [...allPhotos];
  renderGrid(filteredPhotos, 'photo-grid');

  // Download ZIP
  document.getElementById('download-zip-btn').onclick = downloadZip;

  // Copy guest link
  document.getElementById('copy-link-btn').onclick = copyGuestLink;

  showScreen('results-screen');
}

function renderGrid(photos, gridId) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';
  photos.forEach((photo, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${photo.url}" alt="${photo.name}" loading="lazy">
      <span class="event-tag">${SNAPSELECT_CONFIG.events[photo.event] || photo.event}</span>
    `;
    card.onclick = () => openLightbox(index);
    grid.appendChild(card);
  });
}

function filterPhotos(eventKey, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (eventKey === 'all') {
    filteredPhotos = [...allPhotos];
  } else {
    filteredPhotos = allPhotos.filter(p => p.event === eventKey);
  }
  renderGrid(filteredPhotos, 'photo-grid');
}

// ── LIGHTBOX ─────────────────────────────────────────────
function openLightbox(index) {
  currentLightboxIndex = index;
  document.getElementById('lb-img').src = filteredPhotos[index].url;
  document.getElementById('lightbox').classList.remove('hidden');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
}

function prevPhoto() {
  currentLightboxIndex = (currentLightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
  document.getElementById('lb-img').src = filteredPhotos[currentLightboxIndex].url;
}

function nextPhoto() {
  currentLightboxIndex = (currentLightboxIndex + 1) % filteredPhotos.length;
  document.getElementById('lb-img').src = filteredPhotos[currentLightboxIndex].url;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') prevPhoto();
  if (e.key === 'ArrowRight') nextPhoto();
});

// ── DOWNLOAD ZIP ─────────────────────────────────────────
async function downloadZip() {
  const modal = document.getElementById('zip-modal');
  const progress = document.getElementById('zip-progress');
  const status = document.getElementById('zip-status');

  modal.classList.remove('hidden');

  const zip = new JSZip();
  const total = allPhotos.length;

  for (let i = 0; i < allPhotos.length; i++) {
    const photo = allPhotos[i];
    status.textContent = `Adding photo ${i + 1} of ${total}...`;
    progress.style.width = `${((i + 1) / total) * 100}%`;

    try {
      const res = await fetch(photo.downloadUrl);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      zip.file(`${photo.event}/${photo.name || `photo_${i}`}.${ext}`, blob);
    } catch (e) {
      console.warn('Skipped:', photo.name);
    }
  }

  status.textContent = 'Generating ZIP file...';
  const content = await zip.generateAsync({ type: 'blob' }, (meta) => {
    progress.style.width = `${meta.percent.toFixed(0)}%`;
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${SNAPSELECT_CONFIG.eventName.replace(/\s+/g, '_')}_photos.zip`;
  a.click();

  modal.classList.add('hidden');
  showToast('Download started!');
}

// ── COPY GUEST LINK ───────────────────────────────────────
function copyGuestLink() {
  const base = window.location.href.replace('index.html', '').replace(/\/$/, '');
  const guestUrl = `${base}/guest.html`;
  navigator.clipboard.writeText(guestUrl).then(() => {
    showToast('Guest link copied! Share via WhatsApp 🎉');
  });
}

// ── HELPERS ───────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
