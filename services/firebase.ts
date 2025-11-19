
import firebase from 'firebase/compat/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDurJghURgX3w0JFBD8vFzHk60IUd8pW0I",
  authDomain: "money-manager-aa811.firebaseapp.com",
  projectId: "money-manager-aa811",
  storageBucket: "money-manager-aa811.firebasestorage.app",
  messagingSenderId: "1094697587165",
  appId: "1:1094697587165:web:b24176d423060338dae634",
  measurementId: "G-JHLMM59Y36"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
