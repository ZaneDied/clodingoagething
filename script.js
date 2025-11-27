import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
// AUTHENTICATION IMPORTS REMOVED: getAuth, signInAnonymously, onAuthStateChanged, etc.

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

// **FIXED LOGIC:** Use the environment config if it's fully populated.
const activeConfig = {
    ...userProvidedConfig, 
    ...firebaseConfig 
}; 

// Initialize Firebase App and Services
const app = initializeApp(activeConfig);
const db = getFirestore(app);
// const auth = getAuth(app); // AUTH SERVICE REMOVED

// Set fixed, public IDs that match the simplified security rules
const userId = 'PUBLIC'; // All users share this ID
const appId = 'GLOBAL';


// =================================================================
// 2. AUTHENTICATION (REMOVED FOR PUBLIC BILLBOARD)
// =================================================================

// REMOVE: authenticateUser()
// REMOVE: onAuthStateChanged(auth, (user) => { ... })
// REMOVE: authenticateUser();

// Update the user display immediately since the ID is known
const userIdDisplay = document.getElementById('user-id-display');
if (userIdDisplay) {
    userIdDisplay.textContent = userId;
}


// =================================================================
// 3. TASK LOGIC (Placing Orders and Listening for the Bell)
// =================================================================

const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const messageBox = document.getElementById('message-box');

// Utility function to show messages in the app
function displayMessage(message, type) {
    if (!messageBox) return; 
    
    messageBox.textContent = message;
    messageBox.className = `message-box message-${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 5000);
}


// Defines the collection path for the public billboard
const getCollectionPath = () => {
    // Path is now fixed: /users/PUBLIC/tasks
    return `users/${userId}/tasks`;
};

// --- Function to ADD A TASK ---
const addTask = async () => {
    // NO AUTH GUARDS NEEDED: The app is always ready.
    
    if (!taskInput) return;
    
    const taskText = taskInput.value.trim();
    if (taskText === "") {
        displayMessage("Please type something first!", 'error');
        return;
    }

    const path = getCollectionPath();
    console.log(`Attempting to add task to public path: ${path}`);
    
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
        // User MUST have published the rule 'allow read, write: if true;'
        displayMessage(`ERROR: Could not save task. Did you publish the Security Rules?`, 'error');
    }
};

if (addTaskBtn) {
    addTaskBtn.addEventListener('click', addTask);
}


// --- REAL-TIME LISTENER (The corrected function) ---
let listenerStarted = false;

function startRealtimeListener() {
    if (listenerStarted) {
        // Prevent accidental double-call
        return;
    }
    
    const path = getCollectionPath();
    const tasksCollectionRef = collection(db, path);
    // NO AUTH GUARDS NEEDED HERE EITHER

    const tasksQuery = query(tasksCollectionRef, orderBy("timestamp", "desc"));
    console.log(`Starting real-time listener on path: ${path}`);


    // onSnapshot is the "Kitchen Bell" that updates the display instantly
    onSnapshot(tasksQuery, (snapshot) => {
        if (!taskList) return; // Guard against missing element
        taskList.innerHTML = ''; 

        snapshot.forEach((doc) => {
            const task = doc.data();
            const li = document.createElement('li');
            li.textContent = task.text; 
            taskList.appendChild(li);
        });

        console.log(`SUCCESS: Database update received. Total tasks: ${snapshot.size}`);
        listenerStarted = true;
    }, (error) => {
        console.error("FATAL ERROR: Real-time listener failed to connect or maintain sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}


// Crucial change: Start the listener immediately since no authentication is required.
startRealtimeListener();