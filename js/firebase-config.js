// ============================================================
//  QUINIELA GUARISMA 2026
//  firebase-config.js
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyApkuCm3Yj4QGAR1E1-Cw0r8i7LehWsQPU",
  authDomain:        "quiniela-guarisma-2026.firebaseapp.com",
  projectId:         "quiniela-guarisma-2026",
  storageBucket:     "quiniela-guarisma-2026.firebasestorage.app",
  messagingSenderId: "975980942908",
  appId:             "1:975980942908:web:baa55cf47682cba7e29539"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();
