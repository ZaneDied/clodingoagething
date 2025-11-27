import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Global variables provided by the environment (if running in a special environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// =================================================================
// 1. FIREBASE CONFIGURATION (The Kitchen Address)
// =================================================================

// Your provided configuration (used as fallback if environment config is empty)
const userProvidedConfig = {
    apiKey: "AIzaSyCQAU1Qzqwfbpq746fiv6JSByasACCPIE0",
    authDomain: "tracker-6fae3.firebaseapp.com",
    projectId: "tracker-6fae3",
    storageBucket: "tracker-6fae3.firebasestorage.app",
    messagingSenderId: "736064228636",
    appId: "1:736064228636:web:3b5335280a133013de3ed9",
};

const activeConfig = Object.keys(firebaseConfig).length > 0 ? firebaseConfig : userProvidedConfig;

// Initialize Firebase App and Services
const app = initializeApp(activeConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null;
let isAuthReady = false;

// =================================================================
// 2. AUTHENTICATION (The Waiter getting their ID badge)
// =================================================================

async function authenticateUser() {
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth); // Use anonymous sign-in to get a unique UID
        }
        console.log("Authentication successful.");
    } catch (error) {
        console.error("Firebase Authentication failed:", error);
        displayMessage(`Authentication failed: ${error.code}`, 'error');
    }
}

// Wait for the unique User ID (UID) to be generated
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        document.getElementById('user-id-display').textContent = userId;
    } else {
        userId = 'UNAUTHENTICATED'; 
        document.getElementById('user-id-display').textContent = userId;
    }
    isAuthReady = true;
    console.log("Authentication state set. User ID:", userId);
    startRealtimeListener();
});

authenticateUser();

// =================================================================
// 3. TASK LOGIC (Placing Orders and Listening for the Bell)
// =================================================================

const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const messageBox = document.getElementById('message-box');

// Utility function to show messages in the app
function displayMessage(message, type) {
    messageBox.textContent = message;
    messageBox.className = `message-box message-${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 5000);
}


// Defines the exact collection path matching your security rules
const getCollectionPath = () => {
    // Path: /artifacts/{appId}/users/{userId}/tasks
    return `artifacts/${appId}/users/${userId}/tasks`;
};

// --- Function to ADD A TASK ---
const addTask = async () => {
    if (!isAuthReady || !userId) {
        displayMessage("Still connecting to the server. Try again in a moment.", 'error');
        return;
    }
    
    const taskText = taskInput.value.trim();
    if (taskText === "") {
        displayMessage("Please type something first!", 'error');
        return;
    }

    const path = getCollectionPath();
    console.log(`Attempting to add task to path: ${path}`);
    
    try {
        // Use addDoc to place the order in the Kitchen (Firestore)
        await addDoc(collection(db, path), {
            text: taskText,
            timestamp: serverTimestamp()
        });
        
        console.log("Task added successfully.");
        displayMessage("Task saved! Synced with the Kitchen.", 'success');
        taskInput.value = '';
    } catch (error) {
        console.error("ERROR: Could not save document.", error);
        // This is often where a "Permission Denied" error shows up!
        displayMessage(`ERROR: Could not save task. Did you publish the Security Rules?`, 'error');
    }
};

addTaskBtn.addEventListener('click', addTask);


// --- REAL-TIME LISTENER ---
function startRealtimeListener() {
    if (!isAuthReady || !userId) {
        return;
    }

    const path = getCollectionPath();
    const tasksCollectionRef = collection(db, path);
    const tasksQuery = query(tasksCollectionRef, orderBy("timestamp", "desc"));
    console.log(`Starting real-time listener on path: ${path}`);


    // onSnapshot is the "Kitchen Bell" that updates the display instantly
    onSnapshot(tasksQuery, (snapshot) => {
        taskList.innerHTML = ''; 

        snapshot.forEach((doc) => {
            const task = doc.data();
            const li = document.createElement('li');
            li.textContent = task.text; 
            taskList.appendChild(li);
        });

        console.log(`SUCCESS: Database update received. Total tasks: ${snapshot.size}`);
    }, (error) => {
        console.error("FATAL ERROR: Real-time listener failed to connect or maintain sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}