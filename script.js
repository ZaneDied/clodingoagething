import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc,       
    getDoc,     
    setDoc,    
    deleteDoc, 
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
const resetZoomBtn = document.getElementById('reset-zoom-btn');
// NEW: Select the new KDA title button
const kdaTitleBtn = document.getElementById('kda-title-btn');

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
        return (kills + assists).toFixed(2);
    }
    return ((kills + assists) / deaths).toFixed(2);
}

// Defines the collection path.
const getCollectionPath = () => {
    // Note: The context has shifted to 'Restaurant' but the data remains 'games'. 
    return `users/${userId}/games`; 
};

// Set the date input to today's date
function setInitialDate() {
    const today = new Date();
    
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
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
    const docRef = doc(db, path, gameDate); 
    
    try {
        const docSnap = await getDoc(docRef);
        let existingKills = 0;
        let existingDeaths = 0;
        let existingAssists = 0;
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            existingKills = parseInt(data.totalKills) || 0;
            existingDeaths = parseInt(data.totalDeaths) || 0;
            existingAssists = parseInt(data.totalAssists) || 0;
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

// NEW: Add handler for the KDA button (Example)
if (kdaTitleBtn) {
    kdaTitleBtn.addEventListener('click', () => {
        displayMessage("KDA Title button clicked!", 'success');
        // You can attach a specific feature or navigation here later.
    });
}


// =================================================================
// 4. LOGIC: DELETE & EDIT FUNCTIONS
// =================================================================

const deleteKdaEntry = async (dateString) => {
    // IMPORTANT: Use custom modal instead of built-in confirm()
    // For now, keeping confirm as a fallback/simple implementation
    if (!confirm(`Are you sure you want to delete the daily total for ${dateString}?`)) {
        return;
    }
    
    const path = getCollectionPath();
    const docRef = doc(db, path, dateString);
    
    try {
        await deleteDoc(docRef);
        displayMessage(`Successfully deleted entry for ${dateString}.`, 'success');
    } catch (error) {
        console.error("ERROR: Could not delete document.", error);
        displayMessage(`ERROR: Could not delete entry: ${error.message}`, 'error');
    }
};

const editKdaEntry = (dailyData) => {
    // 1. Move the data to the input fields for easy editing
    dateInput.value = dailyData.date;
    killsInput.value = dailyData.totalKills;
    deathsInput.value = dailyData.totalDeaths;
    assistsInput.value = dailyData.totalAssists;

    // 2. Change the button to indicate we are replacing/editing the total
    addGameBtn.textContent = `UPDATE DAILY TOTAL (${dailyData.date})`;
    addGameBtn.style.backgroundColor = '#f39c12'; // Temporary orange for UX differentiation
    
    // 3. Remove the old event listener and add a temporary one for the update
    addGameBtn.removeEventListener('click', addGame);
    addGameBtn.addEventListener('click', handleUpdateClick);
    
    displayMessage(`Ready to edit/replace daily total for ${dailyData.date}. Click "UPDATE" to save.`, 'success');
};


const handleUpdateClick = async () => {
    const gameDate = dateInput.value;
    const kills = parseInt(killsInput.value) || 0;
    const deaths = parseInt(deathsInput.value) || 0;
    const assists = parseInt(assistsInput.value) || 0;
    
    if (!gameDate || kills < 0 || deaths < 0 || assists < 0) {
        displayMessage("Please enter a valid date and positive KDA scores.", 'error');
        return;
    }

    const path = getCollectionPath();
    const docRef = doc(db, path, gameDate); 
    
    try {
        const newKdaRatio = parseFloat(calculateKda(kills, deaths, assists));
        
        // Use setDoc without merge to COMPLETELY OVERWRITE the daily total
        await setDoc(docRef, {
            date: gameDate, 
            totalKills: kills,
            totalDeaths: deaths,
            totalAssists: assists,
            kdaRatio: newKdaRatio
        });
        
        displayMessage(`Successfully updated daily total for ${gameDate}.`, 'success');
        
        // Reset the input fields and button state
        killsInput.value = '';
        deathsInput.value = '';
        assistsInput.value = '';
        addGameBtn.textContent = 'Log Game (Aggregates to Daily Total)';
        addGameBtn.style.backgroundColor = '#FFC300'; // Reset to new Gold theme color
        
        // Restore the original event listener (for aggregation)
        addGameBtn.removeEventListener('click', handleUpdateClick);
        addGameBtn.addEventListener('click', addGame);


    } catch (error) {
        console.error("ERROR: Could not update document.", error);
        displayMessage(`ERROR: Could not update entry: ${error.message}`, 'error');
    }
};


// =================================================================
// 5. LISTENER & DISPLAY (Zoom Logic and Empty Data Handling)
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
                // Gold Chart Line
                borderColor: '#FFC300', 
                backgroundColor: 'rgba(255, 195, 0, 0.2)',
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
                legend: { display: false },
                zoom: {
                    pan: {
                        enabled: true, 
                        mode: 'x', 
                    },
                    zoom: {
                        wheel: {
                            enabled: true, 
                            modifierKey: 'ctrl', 
                        },
                        pinch: {
                            enabled: true 
                        },
                        mode: 'y', 
                        sensitivity: 10,
                    },
                    limits: {
                         x: { minRange: 1 }, 
                         y: { minRange: 0.1 } 
                    }
                }
            }
        }
    });
}


function updateOverallKDA(allGames) {
    let careerKills = 0;
    let careerDeaths = 0;
    let careerAssists = 0;

    allGames.forEach(dailyData => {
        careerKills += dailyData.totalKills;
        careerDeaths += dailyData.totalDeaths;
        careerAssists += dailyData.totalAssists;
    });

    if (careerKills + careerAssists === 0 && careerDeaths === 0) {
        overallKdaDisplay.textContent = '0.00';
    } else {
        const overallKda = calculateKda(careerKills, careerDeaths, careerAssists);
        overallKdaDisplay.textContent = overallKda;
    }
}

function updateChart(allGames) {
    if (!kdaChart) return;
    
    const sortedGames = allGames.sort((a, b) => a.date.localeCompare(b.date));
    
    kdaChart.data.labels = sortedGames.map(game => game.date);
    kdaChart.data.datasets[0].data = sortedGames.map(game => game.kdaRatio);
    kdaChart.update();
}


function startRealtimeListener() {
    initializeChart(); 

    // Attach event listener for the Reset Zoom button after initialization
    if (kdaChart && resetZoomBtn) {
        resetZoomBtn.style.display = 'inline-block';
        resetZoomBtn.addEventListener('click', () => {
            if (kdaChart) {
                kdaChart.resetZoom();
            }
        });
    }
    
    const path = getCollectionPath();
    const gamesCollectionRef = collection(db, path);
    const gamesQuery = query(gamesCollectionRef); 
    
    onSnapshot(gamesQuery, (snapshot) => {
        if (!gameList) return; 

        const allDailyData = [];
        gameList.innerHTML = ''; 

        snapshot.forEach((doc) => {
            const dailyData = doc.data();
            const dateString = dailyData.date || doc.id;
            
            // Filter out random Firestore IDs (only accept YYYY-MM-DD format)
            if (dateString && dateString.length === 10 && dateString.includes('-')) {
                
                // CRITICAL FIX: Explicitly convert to number for all fields to prevent crashes
                const kills = parseInt(dailyData.totalKills) || 0;
                const deaths = parseInt(dailyData.totalDeaths) || 0;
                const assists = parseInt(dailyData.totalAssists) || 0;
                
                let kdaRatio = parseFloat(dailyData.kdaRatio);
                // Re-calculate if the stored ratio is missing or invalid (NaN)
                if (isNaN(kdaRatio)) {
                    kdaRatio = parseFloat(calculateKda(kills, deaths, assists));
                }

                allDailyData.push({
                    date: dateString,
                    totalKills: kills,
                    totalDeaths: deaths,
                    totalAssists: assists,
                    kdaRatio: kdaRatio
                });
            }
        });

        // Sort data for display (most recent first)
        const sortedDisplayData = allDailyData.sort((a, b) => b.date.localeCompare(a.date));
        
        // FIX FOR EMPTY DATA DISPLAY 
        if (sortedDisplayData.length === 0) {
            const li = document.createElement('li');
            li.textContent = "No games logged yet. Add your first game to see your history and graph!";
            li.style.textAlign = 'center';
            li.style.backgroundColor = '#333';
            li.style.borderLeft = '5px solid #FFC300'; 
            gameList.appendChild(li);
        }

        sortedDisplayData.forEach(dailyData => {
            const scoreText = `${dailyData.totalKills}/${dailyData.totalDeaths}/${dailyData.totalAssists}`;
            const kdaRatioText = `KDA: ${calculateKda(dailyData.totalKills, dailyData.totalDeaths, dailyData.totalAssists)}`;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="daily-date">${dailyData.date}</span>
                <span class="daily-score">Total Scores: ${scoreText}</span>
                <span class="daily-kda-ratio">${kdaRatioText}</span>
                
                <div class="action-buttons">
                    <button class="edit-btn" data-date="${dailyData.date}">Edit</button>
                    <button class="delete-btn" data-date="${dailyData.date}">Delete</button>
                </div>
            `; 
            gameList.appendChild(li);
        });
        
        // ATTACH EVENT LISTENERS TO NEW BUTTONS
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const dateToEdit = e.target.dataset.date;
                const dataToEdit = allDailyData.find(d => d.date === dateToEdit);
                if (dataToEdit) {
                    editKdaEntry(dataToEdit);
                }
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                deleteKdaEntry(e.target.dataset.date);
            });
        });
        
        // Update the overall summary and the graph
        updateOverallKDA(allDailyData);
        updateChart(allDailyData); 

    }, (error) => {
        console.error("FATAL ERROR: Real-time listener failed to sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}


// Start the application
setInitialDate();
startRealtimeListener();