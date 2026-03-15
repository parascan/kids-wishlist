import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBYM1VjlZ3P9G8ghXDdR1Z09TUNZMt1igY",
  authDomain: "kids-chores-df8e9.firebaseapp.com",
  projectId: "kids-chores-df8e9",
  storageBucket: "kids-chores-df8e9.firebasestorage.app",
  messagingSenderId: "88247425761",
  appId: "1:88247425761:web:1c1a6ceb2f6b790f9b35a0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
