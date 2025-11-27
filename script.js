import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Global variables provided by the environment (required for data security setup)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// =================================================================
// 1. FIREBASE INITIALIZATION AND AUTHENTICATION
// =================================================================

// 1a. Your Firebase Web App Configuration (from your input, adjusted for imports)
const yourFirebaseConfig = {
    apiKey: "AIzaSyCQAU1Qzqwfbpq746fiv6JSByasACCPIE0",
    authDomain: "tracker-6fae3.firebaseapp.com",
    projectId: "tracker-6fae3",
    storageBucket: "tracker-6fae3.firebasestorage.app",
    messagingSenderId: "736064228636",
    appId: "1:736064228636:web:3b5335280a133013de3ed9",
};

// Use the environment's config if available, otherwise use the user's provided config
const activeConfig = Object.keys(firebaseConfig).length > 0 ? firebaseConfig : yourFirebaseConfig;

// Initialize Firebase App and Services
const app = initializeApp(activeConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null;
let isAuthReady = false;

// Authenticate the user (using the provided token or anonymously)
async function authenticateUser() {
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Firebase Authentication failed:", error);
    }
}

// Wait for the authentication state to be established
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        document.getElementById('user-id-display').textContent = userId;
    } else {
        // Fallback for unauthenticated state (should not happen with anonymous sign-in)
        userId = crypto.randomUUID(); 
        document.getElementById('user-id-display').textContent = `Anon-${userId.substring(0, 8)} (Please refresh)`;
    }
    isAuthReady = true;
    console.log("Authentication state set. User ID:", userId);
    // Start listening to the database only after auth is ready
    startRealtimeListener();
});

// Immediately attempt authentication
authenticateUser();

// =================================================================
// 2. DOM ELEMENTS & TASK LOGIC
// =================================================================

const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');

// Define the path where data will be stored (Private to the user)
const getCollectionPath = () => {
    // Stores data under: /artifacts/{appId}/users/{userId}/tasks
    return `artifacts/${appId}/users/${userId}/tasks`;
};

// --- Function to ADD A TASK ---
const addTask = async () => {
    if (!isAuthReady || !userId) {
        console.warn("Authentication not ready. Cannot add task.");
        return;
    }
    
    const taskText = taskInput.value.trim();

    if (taskText === "") {
        console.warn("Input is empty.");
        return;
    }

    try {
        // Add a new document (task) to the user's private collection
        await addDoc(collection(db, getCollectionPath()), {
            text: taskText,
            timestamp: serverTimestamp() // Uses Firestore's server timestamp
        });
        taskInput.value = ''; // Clear input field after success
    } catch (error) {
        console.error("Error adding document: ", error);
        // You would use a custom modal/message box here instead of alert()
    }
};

addTaskBtn.addEventListener('click', addTask);


// --- REAL-TIME LISTENER (The Syncing Magic!) ---
function startRealtimeListener() {
    if (!isAuthReady || !userId) {
        return; // Guard clause: do not run until auth is confirmed
    }

    const tasksCollectionRef = collection(db, getCollectionPath());
    const tasksQuery = query(tasksCollectionRef, orderBy("timestamp", "desc"));

    // onSnapshot creates a persistent listener. 
    // Any change to the database (from any device) triggers this function immediately.
    onSnapshot(tasksQuery, (snapshot) => {
        taskList.innerHTML = ''; // Clear the existing list

        // Loop through all documents returned in the snapshot
        snapshot.forEach((doc) => {
            const task = doc.data();
            
            // Create the HTML element
            const li = document.createElement('li');
            li.textContent = task.text; 
            
            // Add to the displayed list
            taskList.appendChild(li);
        });

        console.log(`Database update received. ${snapshot.size} tasks displayed.`);
    }, (error) => {
        console.error("Error listening to database changes: ", error);
    });
}