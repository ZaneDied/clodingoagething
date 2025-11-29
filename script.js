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

const dateInput = document.getElementById('date-input');
const killsInput = document.getElementById('kills-input');
const deathsInput = document.getElementById('deaths-input');
const assistsInput = document.getElementById('assists-input');
const addGameBtn = document.getElementById('add-game-btn');
const gameList = document.getElementById('game-list');
const overallKdaDisplay = document.getElementById('overall-kda');
const userIdDisplay = document.getElementById('user-id-display');
const messageBox = document.getElementById('message-box');

let kdaChart; // Global variable to hold the Chart.js instance

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
// 3. LOGIC: CHART INITIALIZATION
// =================================================================

function initializeChart() {
    const ctx = document.getElementById('kda-chart').getContext('2d');
    kdaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Dates will go here
            datasets: [{
                label: 'KDA Ratio',
                data: [], // KDA values will go here
                borderColor: '#79d7d7',
                backgroundColor: 'rgba(121, 215, 215, 0.2)',
                borderWidth: 2,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#f0f0f0'
                    },
                    ticks: {
                        color: '#f0f0f0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'KDA',
                        color: '#f0f0f0'
                    },
                    ticks: {
                        color: '#f0f0f0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}


// =================================================================
// 4. LOGIC: ADDING A GAME
// =================================================================

const addGame = async () => {
    const gameDate = dateInput.value;
    const kills = parseInt(killsInput.value) || 0;
    const deaths = parseInt(deathsInput.value) || 0;
    const assists = parseInt(assistsInput.value) || 0;
    
    if (!gameDate || kills < 0 || deaths < 0 || assists < 0) {
        displayMessage("Please enter a valid date and positive KDA scores.", 'error');
        return;
    }

    const path = getCollectionPath();
    const kdaRatio = calculateKda(kills, deaths, assists);
    
    try {
        await addDoc(collection(db, path), {
            date: gameDate, // Save the user-provided date
            kills: kills,
            deaths: deaths,
            assists: assists,
            kdaRatio: parseFloat(kdaRatio),
            timestamp: serverTimestamp() 
        });
        
        displayMessage(`Game logged! KDA: ${kdaRatio}`, 'success');
        
        // Clear inputs after success
        killsInput.value = '';
        deathsInput.value = '';
        assistsInput.value = '';

    } catch (error) {
        console.error("ERROR: Could not save document.", error);
        displayMessage(`ERROR: Could not log game. Check Firebase Rules!`, 'error');
    }
};

if (addGameBtn) {
    addGameBtn.addEventListener('click', addGame);
}

// =================================================================
// 5. LOGIC: REAL-TIME LISTENER & DISPLAY
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

function updateChart(allGames) {
    if (!kdaChart) return;
    
    // Sort games by date before plotting
    const sortedGames = allGames.sort((a, b) => {
        // Simple string comparison works for YYYY-MM-DD format
        return a.date.localeCompare(b.date); 
    });
    
    kdaChart.data.labels = sortedGames.map(game => game.date);
    kdaChart.data.datasets[0].data = sortedGames.map(game => game.kdaRatio);
    kdaChart.update();
}


function startRealtimeListener() {
    // Initialize chart once
    initializeChart(); 
    
    const path = getCollectionPath();
    const gamesCollectionRef = collection(db, path);
    
    // Order by timestamp to show the newest games first in the list
    const gamesQuery = query(gamesCollectionRef, orderBy("timestamp", "desc"));
    console.log(`Starting real-time listener on KDA path: ${path}`);

    onSnapshot(gamesQuery, (snapshot) => {
        if (!gameList) return; 

        const allGames = [];
        gameList.innerHTML = ''; 

        snapshot.forEach((doc) => {
            const game = doc.data();
            // Ensure the date field exists before adding to allGames
            if (game.date) {
                allGames.push(game);
            }
            
            const scoreText = `${game.kills}/${game.deaths}/${game.assists}`;
            const kdaRatioText = `KDA: ${calculateKda(game.kills, game.deaths, game.assists)}`;
            const dateText = game.date ? game.date : 'No Date';

            const li = document.createElement('li');
            li.innerHTML = `
                <span class="game-date">${dateText}</span>
                <span class="game-score">${scoreText}</span>
                <span class="game-kda-ratio">${kdaRatioText}</span>
            `; 
            gameList.appendChild(li);
        });

        // Update the overall summary and the graph
        updateOverallKDA(allGames);
        updateChart(allGames); 
        
        console.log(`SUCCESS: KDA History updated. Total games: ${snapshot.size}`);

    }, (error) => {
        console.error("FATAL ERROR: Real-time listener failed to sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}


// Start the listener immediately since no authentication is required.
startRealtimeListener();