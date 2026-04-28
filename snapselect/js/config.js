// ============================================================
// SNAPSELECT CONFIG — Fill this in for each wedding/event
// ============================================================

const SNAPSELECT_CONFIG = {

  // The name shown on the page (e.g. "Sharma Wedding" or "Priya & Rahul")
  eventName: "Sharma Wedding",

  // Your Google Drive folder ID containing the AI-selected photos
  // This folder must be shared as "Anyone with the link can view"
  driveFolderId: "19rUifB7AAm2EZsZOfMKjYWeauZFZHPzH",

  // Total photos to show (set to 0 to show all)
  maxPhotos: 0,

  // Your event categories — must match the [prefix] in your photo filenames
  // The AI script names files like: [engagement] DSC_001.jpg
  events: {
    "engagement": "Engagement",
    "mehendi":    "Mehendi",
    "sangeet":    "Sangeet",
    "wedding":    "Wedding"
  },

  // How many photos the customer can download per event (0 = unlimited)
  quotaPerEvent: {
    "engagement": 0,
    "mehendi":    0,
    "sangeet":    0,
    "wedding":    0
  },

  // Guest link expiry (days from now, 0 = never expires)
  // The page just checks localStorage for a timestamp
  guestLinkExpiry: 90,

  // Minimum face match confidence (0.0 to 1.0)
  // Lower = more matches but less accurate, Higher = fewer but more precise
  faceMatchThreshold: 0.5,

};
