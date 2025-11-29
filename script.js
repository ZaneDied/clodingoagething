import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc,       
    getDoc,     
    setDoc,    
    query, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Global variables provided by the environment (if running in a special environment)
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// =================================================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
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

const app = initializeApp(activeConfig);
const db = getFirestore(app);

// Public ID for universal access (matches your published rules)
const userId = 'PUBLIC'; 

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
    if (deaths === 0) {
        // If 0 deaths, return K+A, but limit to two decimal places for consistency
        return (kills + assists).toFixed(2);
    }
    return ((kills + assists) / deaths).toFixed(2);
}

// Defines the collection path.
const getCollectionPath = () => {
    return `users/${userId}/games`; 
};

// Set the date input to today's date
function setInitialDate() {
    const today = new Date();
    
    // Format as YYYY-MM-DD which is required by <input type="date">
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    
    if (dateInput) {
        dateInput.value = formattedDate;
    }
}


// =================================================================
// 3. LOGIC: ADDING AND AGGREGATING A GAME
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
    // Document ID is the date string (e.g., '2025-11-29')
    const docRef = doc(db, path, gameDate); 
    
    try {
        const docSnap = await getDoc(docRef);
        let existingKills = 0;
        let existingDeaths = 0;
        let existingAssists = 0;
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            existingKills = data.totalKills || 0;
            existingDeaths = data.totalDeaths || 0;
            existingAssists = data.totalAssists || 0;
        }

        const newTotalKills = existingKills + kills;
        const newTotalDeaths = existingDeaths + deaths;
        const newTotalAssists = existingAssists + assists;
        
        const newKdaRatio = parseFloat(calculateKda(newTotalKills, newTotalDeaths, newTotalAssists));

        await setDoc(docRef, {
            date: gameDate, 
            totalKills: newTotalKills,
            totalDeaths: newTotalDeaths,
            totalAssists: newTotalAssists,
            kdaRatio: newKdaRatio
        }, { merge: true }); 
        
        displayMessage(`Game Logged! Score: ${kills}/${deaths}/${assists}. Daily KDA is now ${newKdaRatio}`, 'success');
        
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
// 4. LOGIC: CHART INITIALIZATION
// =================================================================

function initializeChart() {
    const canvasElement = document.getElementById('kda-chart');
    if (!canvasElement) return;

    const ctx = canvasElement.getContext('2d');
    
    if (kdaChart) {
        kdaChart.destroy();
    }
    
    kdaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [{
                label: 'KDA Ratio',
                data: [], 
                borderColor: '#79d7d7',
                backgroundColor: 'rgba(121, 215, 215, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            scales: {
                x: {
                    title: { display: true, text: 'Date', color: '#f0f0f0' },
                    ticks: { color: '#f0f0f0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    title: { display: true, text: 'KDA', color: '#f0f0f0' },
                    ticks: { color: '#f0f0f0', beginAtZero: true },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}


// =================================================================
// 5. LOGIC: REAL-TIME LISTENER & DISPLAY
// =================================================================

function updateOverallKDA(allGames) {
    let careerKills = 0;
    let careerDeaths = 0;
    let careerAssists = 0;

    allGames.forEach(dailyData => {
        careerKills += dailyData.totalKills;
        careerDeaths += dailyData.totalDeaths;
        careerAssists += dailyData.totalAssists;
    });

    // --- FIX 1: Handle NaN (when all totals are zero) ---
    if (careerKills + careerAssists === 0 && careerDeaths === 0) {
        overallKdaDisplay.textContent = '0.00';
    } else {
        const overallKda = calculateKda(careerKills, careerDeaths, careerAssists);
        overallKdaDisplay.textContent = overallKda;
    }
}

function updateChart(allGames) {
    if (!kdaChart) return;
    
    // Sort games by date string for chronological plotting
    const sortedGames = allGames.sort((a, b) => a.date.localeCompare(b.date));
    
    kdaChart.data.labels = sortedGames.map(game => game.date);
    kdaChart.data.datasets[0].data = sortedGames.map(game => game.kdaRatio);
    kdaChart.update();
}


function startRealtimeListener() {
    initializeChart(); 
    
    const path = getCollectionPath();
    const gamesCollectionRef = collection(db, path);
    const gamesQuery = query(gamesCollectionRef); 
    console.log(`Starting real-time listener on KDA path: ${path}`);

    onSnapshot(gamesQuery, (snapshot) => {
        if (!gameList) return; 

        const allDailyData = [];
        gameList.innerHTML = ''; 

        snapshot.forEach((doc) => {
            const dailyData = doc.data();
            
            // The document ID is the date (YYYY-MM-DD), but we use the stored 'date' field for safety
            const dateString = dailyData.date || doc.id;
            
            // --- FIX 2: Filter out jumbled random Firestore IDs ---
            // A valid date (YYYY-MM-DD) is always 10 characters and contains hyphens
            if (dateString && dateString.length === 10 && dateString.includes('-')) {
                dailyData.date = dateString; 
                allDailyData.push(dailyData);
            } else {
                console.warn(`Skipping document with invalid date format: ${dateString}`);
            }
        });

        // Sort data for display (most recent first)
        const sortedDisplayData = allDailyData.sort((a, b) => b.date.localeCompare(a.date));
        
        sortedDisplayData.forEach(dailyData => {
            const scoreText = `${dailyData.totalKills}/${dailyData.totalDeaths}/${dailyData.totalAssists}`;
            const kdaRatioText = `KDA: ${calculateKda(dailyData.totalKills, dailyData.totalDeaths, dailyData.totalAssists)}`;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="daily-date">${dailyData.date}</span>
                <span class="daily-score">Total Scores: ${scoreText}</span>
                <span class="daily-kda-ratio">${kdaRatioText}</span>
            `; 
            gameList.appendChild(li);
        });


        updateOverallKDA(allDailyData);
        updateChart(allDailyData); 
        
        console.log(`SUCCESS: Daily KDA History updated. Total days: ${snapshot.size}`);

    }, (error) => {
        console.error("FATAL ERROR: Real-time listener failed to sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}


// 1. Set the date input to today's date
setInitialDate();

// 2. Start the data listener
startRealtimeListener();