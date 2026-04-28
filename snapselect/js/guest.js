// ============================================================
// SNAPSELECT — Guest Page with Face Recognition
// face-api.js runs 100% in the browser, no server needed
// ============================================================

const DRIVE_BASE = "https://drive.google.com/uc?export=view&id=";
const DRIVE_DL   = "https://drive.google.com/uc?export=download&id=";
const MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

let allPhotos = [];
let myPhotos = [];
let videoStream = null;
let cameraStarted = false;
let faceDescriptors = []; // descriptors for all gallery photos
let currentLightboxPhotos = [];
let currentLightboxIndex = 0;

// ── INIT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const cfg = SNAPSELECT_CONFIG;
  document.getElementById('guest-event-name').textContent = cfg.eventName;
  document.getElementById('guest-event-title').textContent = cfg.eventName;

  checkExpiry();
  await loadModels();
  await loadPhotos();
});

function checkExpiry() {
  const expiry = SNAPSELECT_CONFIG.guestLinkExpiry;
  if (expiry === 0) return;
  const set = localStorage.getItem('snapselect_set');
  if (!set) return;
  const days = (Date.now() - parseInt(set)) / (1000 * 60 * 60 * 24);
  if (days > expiry) {
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Georgia,serif;text-align:center;padding:2rem"><div><h2 style="font-size:2rem;margin-bottom:1rem">This link has expired</h2><p style="color:#8A7F70">Please contact the event organiser for a new link.</p></div></div>`;
  }
}

// ── LOAD FACE-API MODELS ──────────────────────────────────
async function loadModels() {
  setStatus('loading', '⏳ Loading face recognition models...');
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL)
    ]);
    setStatus('success', '✓ Face recognition ready');
    setTimeout(() => setStatus('hidden'), 2000);
  } catch (err) {
    console.error('Model load error:', err);
    setStatus('info', '⚠ Face recognition unavailable — you can still browse all photos');
  }
}

// ── LOAD PHOTOS ───────────────────────────────────────────
async function loadPhotos() {
  try {
    const folderId = SNAPSELECT_CONFIG.driveFolderId;
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id,name)',
      pageSize: 1000,
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      allPhotos = data.files.map(f => ({
        id: f.id,
        name: f.name,
        url: `${DRIVE_BASE}${f.id}`,
        downloadUrl: `${DRIVE_DL}${f.id}`,
        event: extractEvent(f.name)
      }));
    } else {
      // Fallback — use hardcoded photos from config if API fails
      allPhotos = [];
    }

    setupAllPhotosPage();
    showScreen('face-screen');

  } catch (err) {
    console.error('Photo load error:', err);
    setupAllPhotosPage();
    showScreen('face-screen');
  }
}

function extractEvent(filename) {
  const match = filename.match(/^\[([^\]]+)\]/);
  if (!match) return 'other';
  const prefix = match[1].toLowerCase();
  return Object.keys(SNAPSELECT_CONFIG.events).find(k => k === prefix) || 'other';
}

// ── SET UP ALL PHOTOS PAGE ────────────────────────────────
function setupAllPhotosPage() {
  document.getElementById('all-photos-title').textContent = SNAPSELECT_CONFIG.eventName;
  document.getElementById('all-photo-count').textContent = `${allPhotos.length} photos`;

  // Event filters
  const filterContainer = document.getElementById('all-event-filters');
  const events = SNAPSELECT_CONFIG.events;
  Object.keys(events).forEach(key => {
    const count = allPhotos.filter(p => p.event === key).length;
    if (count === 0) return;
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = key;
    btn.textContent = `${events[key]} (${count})`;
    btn.onclick = () => filterAllPhotos(key, btn);
    filterContainer.appendChild(btn);
  });

  // Render view-only grid (no right click, no download)
  renderViewOnlyGrid(allPhotos, 'all-photo-grid');
}

function renderViewOnlyGrid(photos, gridId) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';
  photos.forEach((photo, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${photo.url}" alt="" loading="lazy" 
        oncontextmenu="return false" 
        draggable="false">
      <span class="event-tag">${SNAPSELECT_CONFIG.events[photo.event] || photo.event}</span>
    `;
    // Only allow lightbox view, no download
    card.onclick = () => openLightbox(photos, index, false);
    grid.appendChild(card);
  });
}

function filterAllPhotos(eventKey, btn) {
  document.querySelectorAll('#all-event-filters .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const filtered = eventKey === 'all' ? allPhotos : allPhotos.filter(p => p.event === eventKey);
  renderViewOnlyGrid(filtered, 'all-photo-grid');
}

// ── CAMERA ────────────────────────────────────────────────
async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 640 }
    });
    const video = document.getElementById('video');
    video.srcObject = videoStream;
    cameraStarted = true;
    document.getElementById('start-camera-btn').classList.add('hidden');
    document.getElementById('capture-btn').classList.remove('hidden');
  } catch (err) {
    setStatus('error', '❌ Camera access denied. Please allow camera or use selfie upload instead.');
  }
}

async function captureAndMatch() {
  if (!cameraStarted) { await startCamera(); return; }

  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  setStatus('loading', '🔍 Detecting your face...');

  try {
    const detection = await faceapi
      .detectSingleFace(canvas)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setStatus('error', '❌ No face detected. Make sure your face is clearly visible and well-lit.');
      return;
    }

    setStatus('loading', '🔍 Searching through photos... this may take a moment');
    await matchFace(detection.descriptor);

  } catch (err) {
    console.error(err);
    setStatus('error', '❌ Face detection failed. Please try the selfie upload instead.');
  }
}

// ── UPLOAD SELFIE ─────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.face-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.face-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`${tab}-panel`).classList.add('active');
}

function handleSelfieUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('selfie-preview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    document.getElementById('match-upload-btn').classList.remove('hidden');
    document.getElementById('upload-zone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function matchFromUpload() {
  const preview = document.getElementById('selfie-preview');
  setStatus('loading', '🔍 Detecting your face...');

  try {
    const detection = await faceapi
      .detectSingleFace(preview)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setStatus('error', '❌ No face detected in your selfie. Please use a clear, front-facing photo.');
      return;
    }

    setStatus('loading', '🔍 Searching through photos... this may take a moment');
    await matchFace(detection.descriptor);

  } catch (err) {
    console.error(err);
    setStatus('error', '❌ Face detection failed. Please try a clearer photo.');
  }
}

// ── FACE MATCHING ─────────────────────────────────────────
async function matchFace(queryDescriptor) {
  myPhotos = [];
  const threshold = SNAPSELECT_CONFIG.faceMatchThreshold;
  let processed = 0;

  setStatus('loading', `🔍 Checking photos (0 / ${allPhotos.length})...`);

  for (const photo of allPhotos) {
    try {
      // Load image in memory
      const img = await loadImage(photo.url);

      // Detect all faces in this photo
      const detections = await faceapi
        .detectAllFaces(img)
        .withFaceLandmarks()
        .withFaceDescriptors();

      // Check if any face in the photo matches the query
      for (const det of detections) {
        const distance = faceapi.euclideanDistance(queryDescriptor, det.descriptor);
        if (distance < threshold) {
          myPhotos.push(photo);
          break;
        }
      }
    } catch (e) {
      // Skip photos that fail to load
    }

    processed++;
    if (processed % 5 === 0) {
      setStatus('loading', `🔍 Checking photos (${processed} / ${allPhotos.length})...`);
      await sleep(10); // let UI breathe
    }
  }

  if (myPhotos.length === 0) {
    setStatus('error', `❌ No photos found with you. Try adjusting the face match threshold in config.js or use a clearer selfie.`);
    return;
  }

  setStatus('success', `✓ Found ${myPhotos.length} photos with you!`);

  // Stop camera
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); }

  showMyPhotos();
}

// ── MY PHOTOS ─────────────────────────────────────────────
function showMyPhotos() {
  document.getElementById('my-photo-count').textContent = myPhotos.length;
  document.getElementById('my-count-btn').textContent = myPhotos.length;

  const grid = document.getElementById('my-photo-grid');
  grid.innerHTML = '';

  myPhotos.forEach((photo, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${photo.url}" alt="" loading="lazy">
      <span class="event-tag">${SNAPSELECT_CONFIG.events[photo.event] || photo.event}</span>
    `;
    card.onclick = () => openLightbox(myPhotos, index, true);
    grid.appendChild(card);
  });

  showScreen('my-photos-screen');
}

async function downloadMyPhotos() {
  const modal = document.getElementById('zip-modal');
  const progress = document.getElementById('zip-progress');
  const status = document.getElementById('zip-status');

  modal.classList.remove('hidden');
  const zip = new JSZip();

  for (let i = 0; i < myPhotos.length; i++) {
    const photo = myPhotos[i];
    status.textContent = `Adding photo ${i + 1} of ${myPhotos.length}...`;
    progress.style.width = `${((i + 1) / myPhotos.length) * 100}%`;

    try {
      const res = await fetch(photo.downloadUrl);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      zip.file(`${photo.name || `photo_${i}`}.${ext}`, blob);
    } catch (e) {
      console.warn('Skipped:', photo.name);
    }
  }

  status.textContent = 'Generating ZIP...';
  const content = await zip.generateAsync({ type: 'blob' }, meta => {
    progress.style.width = `${meta.percent.toFixed(0)}%`;
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `My_Photos_${SNAPSELECT_CONFIG.eventName.replace(/\s+/g, '_')}.zip`;
  a.click();

  modal.classList.add('hidden');
  showToast('Download started! 🎉');
}

// ── NAVIGATION ────────────────────────────────────────────
function showAllPhotos() {
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); }
  showScreen('all-photos-screen');
}

function showFaceScreen() {
  showScreen('face-screen');
}

// ── LIGHTBOX ─────────────────────────────────────────────
function openLightbox(photos, index, allowDownload) {
  currentLightboxPhotos = photos;
  currentLightboxIndex = index;
  const lb = document.getElementById('lightbox');
  lb.classList.remove('hidden');

  // Add download button only if allowed
  let dlBtn = document.getElementById('lb-dl-btn');
  if (!dlBtn && allowDownload) {
    dlBtn = document.createElement('a');
    dlBtn.id = 'lb-dl-btn';
    dlBtn.style.cssText = 'position:absolute;top:1.5rem;left:1.5rem;background:rgba(201,168,76,0.9);color:#12100E;padding:0.4rem 1rem;border-radius:2rem;font-size:0.8rem;font-weight:500;text-decoration:none;z-index:10;';
    dlBtn.textContent = '⬇ Download';
    lb.appendChild(dlBtn);
  }

  updateLightbox();
}

function updateLightbox() {
  const photo = currentLightboxPhotos[currentLightboxIndex];
  document.getElementById('lb-img').src = photo.url;
  const dlBtn = document.getElementById('lb-dl-btn');
  if (dlBtn) dlBtn.href = photo.downloadUrl;
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
}

function prevPhoto() {
  currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxPhotos.length) % currentLightboxPhotos.length;
  updateLightbox();
}

function nextPhoto() {
  currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxPhotos.length;
  updateLightbox();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') prevPhoto();
  if (e.key === 'ArrowRight') nextPhoto();
});

// ── HELPERS ───────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setStatus(type, msg) {
  const el = document.getElementById('face-status');
  if (type === 'hidden') { el.classList.add('hidden'); return; }
  el.className = `face-status ${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
