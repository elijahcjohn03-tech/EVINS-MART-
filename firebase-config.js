import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxGJf59idHAdYD8x8-OUfb7qDiYW6NW-E",
  authDomain: "evinsmart-62841.firebaseapp.com",
  projectId: "evinsmart-62841",
  storageBucket: "evinsmart-62841.firebasestorage.app",
  messagingSenderId: "653787355178",
  appId: "1:653787355178:web:8458b5d780594ef3590b53",
  measurementId: "G-V91H9MTSNR"
};

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { RecaptchaVerifier, signInWithPhoneNumber };
