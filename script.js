import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Global variables provided by the environment (if running in a special environment)
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// =================================================================
// 1. FIREBASE CONFIGURATION (Use your provided config)
// =================================================================

const userProvidedConfig = {
    apiKey: "AIzaSyCQAU1Qzqwfbpq746fiv6JSByasACCPIE0",
    authDomain: "tracker-6fae3.firebaseapp.com",
    projectId: "tracker-6fae3",
    storageBucket: "tracker-6fae3.firebasestorage.app",
    messagingSenderId: "736064228636",
    appId: "1:736064228636:web:3b5335280a133013de3ed9",
};

const activeConfig = {
    ...userProvidedConfig, 
    ...firebaseConfig 
}; 

// Initialize Firebase App and Services
const app = initializeApp(activeConfig);
const db = getFirestore(app);

// Set fixed, public ID for the universal billboard
const userId = 'PUBLIC'; // Matches the /users/PUBLIC/games/{gameId} rule

// =================================================================
// 2. UI Elements and Utilities
// =================================================================

const killsInput = document.getElementById('kills-input');
const deathsInput = document.getElementById('deaths-input');
const assistsInput = document.getElementById('assists-input');
const addGameBtn = document.getElementById('add-game-btn');
const gameList = document.getElementById('game-list');
const overallKdaDisplay = document.getElementById('overall-kda');
const userIdDisplay = document.getElementById('user-id-display');
const messageBox = document.getElementById('message-box');

if (userIdDisplay) {
    userIdDisplay.textContent = userId;
}

function displayMessage(message, type) {
    if (!messageBox) return; 
    
    messageBox.textContent = message;
    messageBox.className = `message-box message-${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 5000);
}

// Utility function to format KDA (Kills + Assists) / Deaths
function calculateKda(kills, deaths, assists) {
    // Prevent division by zero: if deaths is 0, return K+A as the ratio
    if (deaths === 0) {
        return (kills + assists).toFixed(2);
    }
    return ((kills + assists) / deaths).toFixed(2);
}

// Defines the collection path for the public KDA billboard
const getCollectionPath = () => {
    // Path: /users/PUBLIC/games
    return `users/${userId}/games`; 
};

// =================================================================
// 3. LOGIC: ADDING A GAME
// =================================================================

const addGame = async () => {
    // Ensure all inputs are valid numbers
    const kills = parseInt(killsInput.value) || 0;
    const deaths = parseInt(deathsInput.value) || 0;
    const assists = parseInt(assistsInput.value) || 0;
    
    if (kills < 0 || deaths < 0 || assists < 0) {
        displayMessage("KDA scores must be zero or positive.", 'error');
        return;
    }

    const path = getCollectionPath();
    const kdaRatio = calculateKda(kills, deaths, assists);
    
    try {
        await addDoc(collection(db, path), {
            kills: kills,
            deaths: deaths,
            assists: assists,
            kdaRatio: parseFloat(kdaRatio), // Store calculated ratio for easy retrieval/sorting
            timestamp: serverTimestamp() // Use server timestamp for reliable ordering
        });
        
        displayMessage(`Game logged! KDA: ${kdaRatio}`, 'success');
        // Clear inputs after success
        killsInput.value = '';
        deathsInput.value = '';
        assistsInput.value = '';

    } catch (error) {
        console.error("ERROR: Could not save document.", error);
        // This is where you would get the permissions error if rules aren't set!
        displayMessage(`ERROR: Could not log game. Check Firebase Rules!`, 'error');
    }
};

if (addGameBtn) {
    addGameBtn.addEventListener('click', addGame);
}

// =================================================================
// 4. LOGIC: REAL-TIME LISTENER & DISPLAY
// =================================================================

function updateOverallKDA(allGames) {
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;

    allGames.forEach(game => {
        totalKills += game.kills;
        totalDeaths += game.deaths;
        totalAssists += game.assists;
    });

    const overallKda = calculateKda(totalKills, totalDeaths, totalAssists);
    overallKdaDisplay.textContent = overallKda;
    
    return { totalKills, totalDeaths, totalAssists };
}


function startRealtimeListener() {
    const path = getCollectionPath();
    const gamesCollectionRef = collection(db, path);
    
    // Order by timestamp to show the newest games first
    const gamesQuery = query(gamesCollectionRef, orderBy("timestamp", "desc"));
    console.log(`Starting real-time listener on KDA path: ${path}`);

    onSnapshot(gamesQuery, (snapshot) => {
        if (!gameList) return; 

        const allGames = [];
        gameList.innerHTML = ''; 

        snapshot.forEach((doc) => {
            const game = doc.data();
            allGames.push(game);
            
            // Format the score string
            const scoreText = `${game.kills}/${game.deaths}/${game.assists}`;
            const kdaRatioText = `KDA: ${calculateKda(game.kills, game.deaths, game.assists)}`;

            const li = document.createElement('li');
            li.innerHTML = `
                <span class="game-score">${scoreText}</span>
                <span class="game-kda-ratio">${kdaRatioText}</span>
            `; 
            gameList.appendChild(li);
        });

        // Update the overall KDA summary
        const totals = updateOverallKDA(allGames);
        
        // OPTIONAL: Update a Chart.js graph if the element exists
        // (You would need a <canvas id="kda-chart"></canvas> element in your HTML)
        // If you want a full graph, you'll need to research Chart.js implementation.
        
        console.log(`SUCCESS: KDA History updated. Total games: ${snapshot.size}`);

    }, (error) => {
        console.error("FATAL ERROR: Real-time listener failed to sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}


// Start the listener immediately since no authentication is required.
startRealtimeListener();