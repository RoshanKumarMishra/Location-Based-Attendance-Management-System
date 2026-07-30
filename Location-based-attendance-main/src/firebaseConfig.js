// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
   apiKey: "AIzaSyAUrojzg_hTpNQ5CUfSpu8LsrLAHSg9vkE",
  authDomain: "location-based-attendanc-71b42.firebaseapp.com",
  projectId: "location-based-attendanc-71b42",
  storageBucket: "location-based-attendanc-71b42.firebasestorage.app",
  messagingSenderId: "365605964851",
  appId: "1:365605964851:web:ba9af55f4adf55b524a746"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };