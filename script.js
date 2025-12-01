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

// Database Collection Constants
const KDA_COLLECTION_NAME = 'games';
const HSR_COLLECTION_NAME = 'headshots';

// =================================================================
// 2. UI Elements and Utilities
// =================================================================

// --- KDA Elements ---
const kdaContent = document.getElementById('kda-tracker-content');
const dateInputKda = document.getElementById('date-input-kda');
const killsInput = document.getElementById('kills-input');
const deathsInput = document.getElementById('deaths-input');
const assistsInput = document.getElementById('assists-input');
const addGameBtn = document.getElementById('add-game-btn');
const kdaList = document.getElementById('kda-list');
const overallKdaDisplay = document.getElementById('overall-kda');
const resetZoomBtnKda = document.getElementById('reset-zoom-btn-kda');

// --- HSR Elements ---
const hsrContent = document.getElementById('hsr-tracker-content');
const dateInputHsr = document.getElementById('date-input-hsr');
const hsrRateInput = document.getElementById('hsr-rate-input');
const addHsrBtn = document.getElementById('add-hsr-btn');
const hsrList = document.getElementById('hsr-list');
const overallHsrDisplay = document.getElementById('overall-hsr');
const resetZoomBtnHsr = document.getElementById('reset-zoom-btn-hsr');

// --- Shared Elements ---
const userIdDisplay = document.getElementById('user-id-display');
const messageBox = document.getElementById('message-box');
const kdaTitleBtn = document.getElementById('kda-title-btn');
const hsrTitleBtn = document.getElementById('hsr-title-btn');

let kdaChart; // Global variable to hold the KDA Chart.js instance
let hsrChart; // Global variable to hold the HSR Chart.js instance

let currentListenerUnsubscribe; // To manage the current active real-time listener

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

// Defines the collection path based on the mode.
const getCollectionPath = (mode) => {
    const collection = mode === 'KDA' ? KDA_COLLECTION_NAME : HSR_COLLECTION_NAME;
    return `users/${userId}/${collection}`;
};

// Set the date input to today's date
function setInitialDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;

    if (dateInputKda) dateInputKda.value = formattedDate;
    if (dateInputHsr) dateInputHsr.value = formattedDate;
}

// =================================================================
// 3. KDA LOGIC (Modified to use new IDs/logic)
// =================================================================

const addGame = async () => {
    const gameDate = dateInputKda.value;
    const kills = parseInt(killsInput.value) || 0;
    const deaths = parseInt(deathsInput.value) || 0;
    const assists = parseInt(assistsInput.value) || 0;

    if (!gameDate || kills < 0 || deaths < 0 || assists < 0) {
        displayMessage("Please enter a valid date and positive KDA scores.", 'error');
        return;
    }

    const path = getCollectionPath('KDA');
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
        console.error("ERROR: Could not save KDA document.", error);
        displayMessage(`ERROR: Could not log KDA game.`, 'error');
    }
};

const deleteKdaEntry = async (dateString) => {
    if (!confirm(`Are you sure you want to delete the daily KDA total for ${dateString}?`)) {
        return;
    }

    const path = getCollectionPath('KDA');
    const docRef = doc(db, path, dateString);

    try {
        await deleteDoc(docRef);
        displayMessage(`Successfully deleted KDA entry for ${dateString}.`, 'success');
    } catch (error) {
        console.error("ERROR: Could not delete KDA document.", error);
        displayMessage(`ERROR: Could not delete KDA entry: ${error.message}`, 'error');
    }
};

const editKdaEntry = (dailyData) => {
    dateInputKda.value = dailyData.date;
    killsInput.value = dailyData.totalKills;
    deathsInput.value = dailyData.totalDeaths;
    assistsInput.value = dailyData.totalAssists;

    addGameBtn.textContent = `UPDATE DAILY KDA TOTAL (${dailyData.date})`;
    addGameBtn.style.backgroundColor = '#f39c12';

    addGameBtn.removeEventListener('click', addGame);
    addGameBtn.addEventListener('click', handleUpdateKdaClick);

    displayMessage(`Ready to edit/replace daily KDA total for ${dailyData.date}. Click "UPDATE" to save.`, 'success');
};


const handleUpdateKdaClick = async () => {
    const gameDate = dateInputKda.value;
    const kills = parseInt(killsInput.value) || 0;
    const deaths = parseInt(deathsInput.value) || 0;
    const assists = parseInt(assistsInput.value) || 0;

    if (!gameDate || kills < 0 || deaths < 0 || assists < 0) {
        displayMessage("Please enter a valid date and positive KDA scores.", 'error');
        return;
    }

    const path = getCollectionPath('KDA');
    const docRef = doc(db, path, gameDate);

    try {
        const newKdaRatio = parseFloat(calculateKda(kills, deaths, assists));

        await setDoc(docRef, {
            date: gameDate,
            totalKills: kills,
            totalDeaths: deaths,
            totalAssists: assists,
            kdaRatio: newKdaRatio
        });

        displayMessage(`Successfully updated daily KDA total for ${gameDate}.`, 'success');

        killsInput.value = '';
        deathsInput.value = '';
        assistsInput.value = '';
        addGameBtn.textContent = 'Log Game (Aggregates to Daily Total)';
        addGameBtn.style.backgroundColor = '#FFC300';

        addGameBtn.removeEventListener('click', handleUpdateKdaClick);
        addGameBtn.addEventListener('click', addGame);


    } catch (error) {
        console.error("ERROR: Could not update KDA document.", error);
        displayMessage(`ERROR: Could not update KDA entry: ${error.message}`, 'error');
    }
};

// =================================================================
// 4. HSR LOGIC (NEW)
// =================================================================

const addHSR = async () => {
    const gameDate = dateInputHsr.value;
    const hsrRate = parseFloat(hsrRateInput.value);

    if (!gameDate || isNaN(hsrRate) || hsrRate < 0 || hsrRate > 100) {
        displayMessage("Please enter a valid date and Headshot Rate (0-100%).", 'error');
        return;
    }

    const path = getCollectionPath('HSR');
    const docRef = doc(db, path, gameDate);

    try {
        // HSR tracking does NOT aggregate, it just replaces the daily rate
        await setDoc(docRef, {
            date: gameDate,
            hsrRate: hsrRate
        }, { merge: true });

        displayMessage(`Headshot Rate Logged! Rate for ${gameDate}: ${hsrRate.toFixed(2)}%`, 'success');

        hsrRateInput.value = '';

    } catch (error) {
        console.error("ERROR: Could not save HSR document.", error);
        displayMessage(`ERROR: Could not log HSR rate.`, 'error');
    }
};

const deleteHsrEntry = async (dateString) => {
    if (!confirm(`Are you sure you want to delete the daily HSR rate for ${dateString}?`)) {
        return;
    }

    const path = getCollectionPath('HSR');
    const docRef = doc(db, path, dateString);

    try {
        await deleteDoc(docRef);
        displayMessage(`Successfully deleted HSR entry for ${dateString}.`, 'success');
    } catch (error) {
        console.error("ERROR: Could not delete HSR document.", error);
        displayMessage(`ERROR: Could not delete HSR entry: ${error.message}`, 'error');
    }
};

const editHsrEntry = (dailyData) => {
    dateInputHsr.value = dailyData.date;
    hsrRateInput.value = dailyData.hsrRate;

    addHsrBtn.textContent = `UPDATE DAILY HSR RATE (${dailyData.date})`;
    addHsrBtn.style.backgroundColor = '#f39c12';

    addHsrBtn.removeEventListener('click', addHSR);
    addHsrBtn.addEventListener('click', handleUpdateHsrClick);

    displayMessage(`Ready to edit/replace daily HSR rate for ${dailyData.date}. Click "UPDATE" to save.`, 'success');
};


const handleUpdateHsrClick = async () => {
    const gameDate = dateInputHsr.value;
    const hsrRate = parseFloat(hsrRateInput.value);

    if (!gameDate || isNaN(hsrRate) || hsrRate < 0 || hsrRate > 100) {
        displayMessage("Please enter a valid date and Headshot Rate (0-100%).", 'error');
        return;
    }

    const path = getCollectionPath('HSR');
    const docRef = doc(db, path, gameDate);

    try {

        await setDoc(docRef, {
            date: gameDate,
            hsrRate: hsrRate
        });

        displayMessage(`Successfully updated daily HSR rate for ${gameDate}.`, 'success');

        hsrRateInput.value = '';
        addHsrBtn.textContent = 'Log Headshot Rate (Daily Total)';
        addHsrBtn.style.backgroundColor = '#FFC300';

        addHsrBtn.removeEventListener('click', handleUpdateHsrClick);
        addHsrBtn.addEventListener('click', addHSR);


    } catch (error) {
        console.error("ERROR: Could not update HSR document.", error);
        displayMessage(`ERROR: Could not update HSR entry: ${error.message}`, 'error');
    }
};


// =================================================================
// 5. CHARTS AND DATA UPDATE FUNCTIONS
// =================================================================

function initializeChart(chartId) {
    const canvasElement = document.getElementById(chartId);
    if (!canvasElement) return;

    const ctx = canvasElement.getContext('2d');
    let chartInstance = chartId === 'kda-chart' ? kdaChart : hsrChart;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const isKda = chartId === 'kda-chart';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: isKda ? 'KDA Ratio' : 'HSR %',
                data: [],
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
                    title: { display: true, text: isKda ? 'KDA' : 'HSR (%)', color: '#f0f0f0' },
                    ticks: { color: '#f0f0f0', beginAtZero: isKda ? true : false, suggestedMin: isKda ? 0 : -5, suggestedMax: isKda ? undefined : 105 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            },
            plugins: {
                legend: { display: false },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: {
                        wheel: { enabled: true, modifierKey: 'ctrl' },
                        pinch: { enabled: true },
                        mode: 'y',
                        sensitivity: 10,
                    },
                    limits: { x: { minRange: 1 }, y: { minRange: 0.1 } }
                }
            }
        }
    });

    if (isKda) {
        kdaChart = chartInstance;
        // Attach KDA reset listener
        if (resetZoomBtnKda) {
            resetZoomBtnKda.style.display = 'inline-block';
            resetZoomBtnKda.onclick = () => kdaChart.resetZoom();
        }
    } else {
        hsrChart = chartInstance;
        // Attach HSR reset listener
        if (resetZoomBtnHsr) {
            resetZoomBtnHsr.style.display = 'inline-block';
            resetZoomBtnHsr.onclick = () => hsrChart.resetZoom();
        }
    }
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

function updateChart(allGames, chartInstance, dataKey) {
    if (!chartInstance) return;

    const sortedGames = allGames.sort((a, b) => a.date.localeCompare(b.date));

    chartInstance.data.labels = sortedGames.map(game => game.date);
    chartInstance.data.datasets[0].data = sortedGames.map(game => game[dataKey]);
    chartInstance.update();
}

// NEW: HSR specific overall update
function updateOverallHSR(allHsrData) {
    if (allHsrData.length === 0) {
        overallHsrDisplay.textContent = '0.00%';
        return;
    }
    const totalHsr = allHsrData.reduce((sum, data) => sum + data.hsrRate, 0);
    const averageHsr = (totalHsr / allHsrData.length).toFixed(2);
    overallHsrDisplay.textContent = `${averageHsr}%`;
}


// =================================================================
// 6. REALTIME LISTENERS
// =================================================================

function startKdaRealtimeListener() {
    initializeChart('kda-chart');

    const path = getCollectionPath('KDA');
    const gamesCollectionRef = collection(db, path);
    const gamesQuery = query(gamesCollectionRef);

    // Unsubscribe from any previous listener
    if (currentListenerUnsubscribe) currentListenerUnsubscribe();

    currentListenerUnsubscribe = onSnapshot(gamesQuery, (snapshot) => {
        if (!kdaList) return;

        const allDailyData = [];
        kdaList.innerHTML = '';

        snapshot.forEach((doc) => {
            const dailyData = doc.data();
            const dateString = dailyData.date || doc.id;

            if (dateString && dateString.length === 10 && dateString.includes('-')) {
                const kills = parseInt(dailyData.totalKills) || 0;
                const deaths = parseInt(dailyData.totalDeaths) || 0;
                const assists = parseInt(dailyData.totalAssists) || 0;

                let kdaRatio = parseFloat(dailyData.kdaRatio);
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

        const sortedDisplayData = allDailyData.sort((a, b) => b.date.localeCompare(a.date));

        if (sortedDisplayData.length === 0) {
            kdaList.innerHTML = `<li style="text-align: center; background-color: #333; border-left: 5px solid #FFC300;">No KDA games logged yet.</li>`;
        }

        sortedDisplayData.forEach(dailyData => {
            const scoreText = `${dailyData.totalKills}/${dailyData.totalDeaths}/${dailyData.totalAssists}`;
            const kdaRatioText = `KDA: ${calculateKda(dailyData.totalKills, dailyData.totalDeaths, dailyData.totalAssists)}`;

            const li = document.createElement('li');
            li.innerHTML = `
                <span class="daily-date">${dailyData.date}</span>
                <span class="daily-score">Scores: ${scoreText}</span>
                <span class="daily-kda-ratio">${kdaRatioText}</span>
                
                <div class="action-buttons">
                    <button class="edit-btn" data-date="${dailyData.date}">Edit</button>
                    <button class="delete-btn" data-date="${dailyData.date}">Delete</button>
                </div>
            `;
            kdaList.appendChild(li);

            // Re-attach listeners for new buttons
            li.querySelector('.edit-btn').addEventListener('click', (e) => editKdaEntry(dailyData));
            li.querySelector('.delete-btn').addEventListener('click', (e) => deleteKdaEntry(dailyData.date));
        });

        updateOverallKDA(allDailyData);
        updateChart(allDailyData, kdaChart, 'kdaRatio');

    }, (error) => {
        console.error("FATAL ERROR: KDA Real-time listener failed to sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}

// NEW: HSR Realtime Listener
function startHsrRealtimeListener() {
    initializeChart('hsr-chart');

    const path = getCollectionPath('HSR');
    const hsrCollectionRef = collection(db, path);
    const hsrQuery = query(hsrCollectionRef);

    // Unsubscribe from any previous listener
    if (currentListenerUnsubscribe) currentListenerUnsubscribe();

    currentListenerUnsubscribe = onSnapshot(hsrQuery, (snapshot) => {
        if (!hsrList) return;

        const allDailyData = [];
        hsrList.innerHTML = '';

        snapshot.forEach((doc) => {
            const dailyData = doc.data();
            const dateString = dailyData.date || doc.id;

            if (dateString && dateString.length === 10 && dateString.includes('-')) {
                const hsrRate = parseFloat(dailyData.hsrRate) || 0;

                allDailyData.push({
                    date: dateString,
                    hsrRate: hsrRate
                });
            }
        });

        const sortedDisplayData = allDailyData.sort((a, b) => b.date.localeCompare(a.date));

        if (sortedDisplayData.length === 0) {
            hsrList.innerHTML = `<li style="text-align: center; background-color: #333; border-left: 5px solid #FFC300;">No HSR rates logged yet.</li>`;
        }

        sortedDisplayData.forEach(dailyData => {
            const scoreText = `${dailyData.hsrRate.toFixed(2)}%`;

            const li = document.createElement('li');
            li.innerHTML = `
                <span class="daily-date">${dailyData.date}</span>
                <span class="daily-score">Rate: ${scoreText}</span>
                <div class="action-buttons">
                    <button class="edit-btn" data-date="${dailyData.date}">Edit</button>
                    <button class="delete-btn" data-date="${dailyData.date}">Delete</button>
                </div>
            `;
            hsrList.appendChild(li);

            // Re-attach listeners for new buttons
            li.querySelector('.edit-btn').addEventListener('click', (e) => editHsrEntry(dailyData));
            li.querySelector('.delete-btn').addEventListener('click', (e) => deleteHsrEntry(dailyData.date));
        });

        updateOverallHSR(allDailyData);
        updateChart(allDailyData, hsrChart, 'hsrRate');

    }, (error) => {
        console.error("FATAL ERROR: HSR Real-time listener failed to sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}


// =================================================================
// 7. EVENT HANDLERS AND INITIALIZATION
// =================================================================

function switchTrackerMode(mode) {
    if (mode === 'KDA') {
        kdaTitleBtn.classList.add('active');
        hsrTitleBtn.classList.remove('active');
        kdaContent.classList.add('active');
        kdaContent.classList.remove('hidden');
        hsrContent.classList.add('hidden');
        hsrContent.classList.remove('active');
        startKdaRealtimeListener();
    } else if (mode === 'HSR') {
        kdaTitleBtn.classList.remove('active');
        hsrTitleBtn.classList.add('active');
        kdaContent.classList.add('hidden');
        kdaContent.classList.remove('active');
        hsrContent.classList.add('active');
        hsrContent.classList.remove('hidden');
        startHsrRealtimeListener();
    }
}

if (addGameBtn) {
    addGameBtn.addEventListener('click', addGame);
}

if (addHsrBtn) {
    addHsrBtn.addEventListener('click', addHSR);
}

if (kdaTitleBtn) {
    kdaTitleBtn.addEventListener('click', () => {
        switchTrackerMode('KDA');
    });
}

if (hsrTitleBtn) {
    hsrTitleBtn.addEventListener('click', () => {
        switchTrackerMode('HSR');
    });
}


// Start the application
setInitialDate();
// Start with KDA mode active
switchTrackerMode('KDA');