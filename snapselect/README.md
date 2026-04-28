# SnapSelect AI — Guest Gallery

A fully free, serverless wedding photo gallery with AI face recognition.

## Quick Setup (5 minutes)

### 1. Get a Google Drive API Key (free)
1. Go to https://console.cloud.google.com
2. Search for "Google Drive API" → Enable it
3. Go to "Credentials" → "Create Credentials" → "API Key"
4. Click "Restrict Key" → Under API restrictions → Select "Google Drive API"
5. Copy the key

### 2. Update config.js
Open `js/config.js` and fill in:
- `eventName` — e.g. "Sharma Wedding"
- `driveFolderId` — the ID from your Google Drive folder URL
- Add your Google Drive API key to `app.js` line where it says `key: 'AIza...'`

### 3. Make your Drive folder public
1. Right click the "Best Wedding Photos" folder in Drive
2. Share → "Anyone with the link" → Viewer
3. Copy the folder ID from the URL

### 4. Deploy to GitHub Pages
1. Push all files to your GitHub repo
2. Go to repo Settings → Pages
3. Source: "Deploy from a branch" → main → / (root)
4. Your site will be live at: https://YOUR_USERNAME.github.io/snapselect

### 5. Share the links
- **Customer link**: `https://YOUR_USERNAME.github.io/snapselect/index.html`
- **Guest link**: `https://YOUR_USERNAME.github.io/snapselect/guest.html`

## How Face Recognition Works
- Uses face-api.js — runs 100% in the guest's browser
- No server, no API, no cost
- Guest scans face or uploads selfie
- App checks each photo for matching faces
- Only matched photos get a download button

## File Structure
```
snapselect/
  index.html      ← Customer results page
  guest.html      ← Guest gallery with face scan
  css/
    style.css     ← Main styles
    guest.css     ← Guest page styles
  js/
    config.js     ← Your settings (edit this!)
    app.js        ← Customer page logic
    guest.js      ← Guest page + face recognition
  README.md
```

## Cost
- Google Drive: Free (uses your existing storage)
- GitHub Pages: Free
- face-api.js: Free (runs in browser)
- Total: ₹0
