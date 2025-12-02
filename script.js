import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    onSnapshot,
    arrayUnion,
    Timestamp
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
const ADR_COLLECTION_NAME = 'adr';
const ELO_METRICS_COLLECTION = 'elo_metrics';

// =================================================================
// ELO SYSTEM CONSTANTS
// =================================================================
const ELO_CONSTANTS = {
    BASELINE_ELO: 1500,           // R_Baseline
    GLOBAL_AVG_HSR: 20,           // 20% for HSR
    GLOBAL_AVG_KDA: 1.0,          // 1.0 for KDA
    GLOBAL_AVG_ADR: 80,           // 80 for ADR
    ELO_CONVERSION_FACTOR: 50,    // C_F
    K_FACTOR: 30,                 // K_Elo (base gain)
    TUNING_CONSTANT: 0.25,        // A (moderates proportional gain)
    MINUTES_PER_GAME: 30          // Time tracking
};

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

// --- ADR Elements ---
const adrContent = document.getElementById('adr-tracker-content');
const dateInputAdr = document.getElementById('date-input-adr');
const adrInput = document.getElementById('adr-input');
const addAdrBtn = document.getElementById('add-adr-btn');
const adrList = document.getElementById('adr-list');
const overallAdrDisplay = document.getElementById('overall-adr');
const resetZoomBtnAdr = document.getElementById('reset-zoom-btn-adr');

// --- Shared Elements ---
const userIdDisplay = document.getElementById('user-id-display');
const messageBox = document.getElementById('message-box');
const kdaTitleBtn = document.getElementById('kda-title-btn');
const hsrTitleBtn = document.getElementById('hsr-title-btn');
const adrTitleBtn = document.getElementById('adr-title-btn');
const eloTitleBtn = document.getElementById('elo-title-btn');
const eloContent = document.getElementById('elo-tracker-content');

let kdaChart; // Global variable to hold the KDA Chart.js instance
let hsrChart; // Global variable to hold the HSR Chart.js instance
let adrChart; // Global variable to hold the ADR Chart.js instance

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
    let collectionName = KDA_COLLECTION_NAME;
    if (mode === 'HSR') collectionName = HSR_COLLECTION_NAME;
    if (mode === 'ADR') collectionName = ADR_COLLECTION_NAME;

    return `users/${userId}/${collectionName}`;
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
    if (dateInputAdr) dateInputAdr.value = formattedDate;
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
        let existingGamesCount = 0;

        if (docSnap.exists()) {
            const data = docSnap.data();
            existingKills = parseInt(data.totalKills) || 0;
            existingDeaths = parseInt(data.totalDeaths) || 0;
            existingAssists = parseInt(data.totalAssists) || 0;
            existingGamesCount = parseInt(data.gamesCount) || 0;
        }

        const newTotalKills = existingKills + kills;
        const newTotalDeaths = existingDeaths + deaths;
        const newTotalAssists = existingAssists + assists;
        const newGamesCount = existingGamesCount + 1; // Increment game count

        const newKdaRatio = parseFloat(calculateKda(newTotalKills, newTotalDeaths, newTotalAssists));

        await setDoc(docRef, {
            date: gameDate,
            totalKills: newTotalKills,
            totalDeaths: newTotalDeaths,
            totalAssists: newTotalAssists,
            kdaRatio: newKdaRatio,
            gamesCount: newGamesCount, // Track individual games
            logs: arrayUnion({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                timestamp: Timestamp.now(),
                kills: kills,
                deaths: deaths,
                assists: assists,
                kda: parseFloat(calculateKda(kills, deaths, assists))
            })
        }, { merge: true });

        displayMessage(`Game #${newGamesCount} Logged! Score: ${kills}/${deaths}/${assists}. Daily KDA is now ${newKdaRatio}`, 'success');

        killsInput.value = '';
        deathsInput.value = '';
        assistsInput.value = '';

        // Recalculate ELO metrics for KDA
        await calculateEloMetrics('kda');

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
        // Get existing data to track entry count
        const docSnap = await getDoc(docRef);
        let existingEntryCount = 0;

        if (docSnap.exists()) {
            const data = docSnap.data();
            existingEntryCount = parseInt(data.entryCount) || 0;
        }

        const newEntryCount = existingEntryCount + 1;

        // HSR tracking updates the daily rate and tracks entry count
        await setDoc(docRef, {
            date: gameDate,
            hsrRate: hsrRate,
            entryCount: newEntryCount,
            logs: arrayUnion({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                timestamp: Timestamp.now(),
                hsrRate: hsrRate
            })
        }, { merge: true });

        displayMessage(`HSR Entry #${newEntryCount} Logged! Rate for ${gameDate}: ${hsrRate.toFixed(2)}%`, 'success');

        hsrRateInput.value = '';

        // Recalculate ELO metrics for HSR
        await calculateEloMetrics('hsr');

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
// 5. ADR LOGIC (NEW)
// =================================================================

const addADR = async () => {
    const gameDate = dateInputAdr.value;
    const adrValue = parseFloat(adrInput.value);

    if (!gameDate || isNaN(adrValue) || adrValue < 0) {
        displayMessage("Please enter a valid date and positive ADR value.", 'error');
        return;
    }

    const path = getCollectionPath('ADR');
    const docRef = doc(db, path, gameDate);

    try {
        // Get existing data to track entry count
        const docSnap = await getDoc(docRef);
        let existingEntryCount = 0;

        if (docSnap.exists()) {
            const data = docSnap.data();
            existingEntryCount = parseInt(data.entryCount) || 0;
        }

        const newEntryCount = existingEntryCount + 1;

        // ADR tracking updates the daily value and tracks entry count
        await setDoc(docRef, {
            date: gameDate,
            adrValue: adrValue,
            entryCount: newEntryCount,
            logs: arrayUnion({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                timestamp: Timestamp.now(),
                adrValue: adrValue
            })
        }, { merge: true });

        displayMessage(`ADR Entry #${newEntryCount} Logged! Value for ${gameDate}: ${adrValue.toFixed(1)}`, 'success');

        adrInput.value = '';

        // Recalculate ELO metrics for ADR
        await calculateEloMetrics('adr');

    } catch (error) {
        console.error("ERROR: Could not save ADR document.", error);
        displayMessage(`ERROR: Could not log ADR value.`, 'error');
    }
};

const deleteAdrEntry = async (dateString) => {
    if (!confirm(`Are you sure you want to delete the daily ADR value for ${dateString}?`)) {
        return;
    }

    const path = getCollectionPath('ADR');
    const docRef = doc(db, path, dateString);

    try {
        await deleteDoc(docRef);
        displayMessage(`Successfully deleted ADR entry for ${dateString}.`, 'success');
    } catch (error) {
        console.error("ERROR: Could not delete ADR document.", error);
        displayMessage(`ERROR: Could not delete ADR entry: ${error.message}`, 'error');
    }
};

const editAdrEntry = (dailyData) => {
    dateInputAdr.value = dailyData.date;
    adrInput.value = dailyData.adrValue;

    addAdrBtn.textContent = `UPDATE DAILY ADR (${dailyData.date})`;
    addAdrBtn.style.backgroundColor = '#f39c12';

    addAdrBtn.removeEventListener('click', addADR);
    addAdrBtn.addEventListener('click', handleUpdateAdrClick);

    displayMessage(`Ready to edit/replace daily ADR for ${dailyData.date}. Click "UPDATE" to save.`, 'success');
};


const handleUpdateAdrClick = async () => {
    const gameDate = dateInputAdr.value;
    const adrValue = parseFloat(adrInput.value);

    if (!gameDate || isNaN(adrValue) || adrValue < 0) {
        displayMessage("Please enter a valid date and positive ADR value.", 'error');
        return;
    }

    const path = getCollectionPath('ADR');
    const docRef = doc(db, path, gameDate);

    try {

        await setDoc(docRef, {
            date: gameDate,
            adrValue: adrValue
        });

        displayMessage(`Successfully updated daily ADR for ${gameDate}.`, 'success');

        adrInput.value = '';
        addAdrBtn.textContent = 'Log ADR (Daily Average)';
        addAdrBtn.style.backgroundColor = '#FFC300';

        addAdrBtn.removeEventListener('click', handleUpdateAdrClick);
        addAdrBtn.addEventListener('click', addADR);


    } catch (error) {
        console.error("ERROR: Could not update ADR document.", error);
        displayMessage(`ERROR: Could not update ADR entry: ${error.message}`, 'error');
    }
};


// =================================================================
// 5. CHARTS AND DATA UPDATE FUNCTIONS
// =================================================================

function initializeChart(chartId) {
    const canvasElement = document.getElementById(chartId);
    if (!canvasElement) return;

    const ctx = canvasElement.getContext('2d');
    let chartInstance;
    if (chartId === 'kda-chart') chartInstance = kdaChart;
    else if (chartId === 'hsr-chart') chartInstance = hsrChart;
    else if (chartId === 'adr-chart') chartInstance = adrChart;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const isKda = chartId === 'kda-chart';
    const isHsr = chartId === 'hsr-chart';
    const isAdr = chartId === 'adr-chart';

    let label = 'Value';
    if (isKda) label = 'KDA Ratio';
    if (isHsr) label = 'HSR %';
    if (isAdr) label = 'ADR';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
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
                    title: { display: true, text: label, color: '#f0f0f0' },
                    ticks: { color: '#f0f0f0', beginAtZero: isKda ? true : false, suggestedMin: isKda ? 0 : (isAdr ? 0 : -5), suggestedMax: isHsr ? 105 : undefined },
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
    } else if (isHsr) {
        hsrChart = chartInstance;
        // Attach HSR reset listener
        if (resetZoomBtnHsr) {
            resetZoomBtnHsr.style.display = 'inline-block';
            resetZoomBtnHsr.onclick = () => hsrChart.resetZoom();
        }
    } else if (isAdr) {
        adrChart = chartInstance;
        // Attach ADR reset listener
        if (resetZoomBtnAdr) {
            resetZoomBtnAdr.style.display = 'inline-block';
            resetZoomBtnAdr.onclick = () => adrChart.resetZoom();
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

function updateOverallADR(allAdrData) {
    if (allAdrData.length === 0) {
        overallAdrDisplay.textContent = '0.00';
        return;
    }
    const totalAdr = allAdrData.reduce((sum, data) => sum + data.adrValue, 0);
    const averageAdr = (totalAdr / allAdrData.length).toFixed(1);
    overallAdrDisplay.textContent = averageAdr;
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
                const gamesCount = parseInt(dailyData.gamesCount) || 1;
                const logs = dailyData.logs || [];

                let kdaRatio = parseFloat(dailyData.kdaRatio);
                if (isNaN(kdaRatio)) {
                    kdaRatio = parseFloat(calculateKda(kills, deaths, assists));
                }

                allDailyData.push({
                    date: dateString,
                    totalKills: kills,
                    totalDeaths: deaths,
                    totalAssists: assists,
                    kdaRatio: kdaRatio,
                    gamesCount: gamesCount,
                    logs: logs
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
            const gamesText = dailyData.gamesCount > 1 ? ` (${dailyData.gamesCount} games)` : ` (1 game)`;
            let logs = dailyData.logs || [];

            // Handle legacy data: if no logs but we have stats, create a synthetic log
            if (logs.length === 0 && (dailyData.totalKills > 0 || dailyData.totalDeaths > 0 || dailyData.totalAssists > 0)) {
                logs = [{
                    id: 'legacy-' + dailyData.date,
                    timestamp: null, // No specific time
                    kills: dailyData.totalKills,
                    deaths: dailyData.totalDeaths,
                    assists: dailyData.totalAssists,
                    kda: dailyData.kdaRatio,
                    isLegacy: true
                }];
            }

            const li = document.createElement('li');
            li.className = 'history-day-group';

            let logsHtml = '';
            if (logs.length > 0) {
                logsHtml = `<div class="game-logs-container">`;
                logs.forEach((log, index) => {
                    // Handle timestamp conversion safely
                    let timeStr = log.isLegacy ? 'Legacy Entry' : `Game ${index + 1}`;
                    if (log.timestamp && log.timestamp.seconds) {
                        timeStr = new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }

                    const logId = log.id || 'legacy';

                    // Only show delete button for individual logs if it's NOT a legacy synthetic log
                    // actually we can allow deleting legacy log if we want to clear the day? 
                    // But deleting individual legacy log might be tricky if it doesn't exist in DB.
                    // Let's disable individual actions for legacy synthetic logs for now, or handle them carefully.
                    // The user wants to edit. If we edit a legacy log, we should probably create a real log array?
                    // For now, let's just show them.

                    const actionsHtml = log.isLegacy ?
                        `<span style="font-size: 0.8em; color: #666;">(Legacy Data - Cannot Edit)</span>` :
                        `<button class="log-btn log-edit-btn" data-metric="kda" data-date="${dailyData.date}" data-id="${logId}">Edit</button>
                         <button class="log-btn log-delete-btn" data-metric="kda" data-date="${dailyData.date}" data-id="${logId}">Delete</button>`;

                    logsHtml += `
                        <div class="game-log-item">
                            <div class="game-log-details">
                                <span class="game-log-time">${timeStr}</span>
                                <span class="game-log-metric">KDA: ${log.kda ? log.kda.toFixed(2) : 'N/A'}</span>
                                <span style="color: #aaa; font-size: 0.9em;">${log.kills}/${log.deaths}/${log.assists}</span>
                            </div>
                            <div class="log-actions">
                                ${actionsHtml}
                            </div>
                        </div>
                    `;
                });
                logsHtml += `</div>`;
            }

            li.innerHTML = `
                <div class="daily-summary">
                    <div>
                        <span class="daily-date">${dailyData.date}</span>
                        <div style="font-size: 0.85em; color: #aaa;">${gamesText} | Daily Avg: ${kdaRatioText}</div>
                    </div>
                    <div class="action-buttons">
                        <button class="delete-btn" data-date="${dailyData.date}" title="Delete entire day">Delete Day</button>
                    </div>
                </div>
                ${logsHtml}
            `;
            kdaList.appendChild(li);

            // Re-attach listeners for daily buttons
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
                const entryCount = parseInt(dailyData.entryCount) || 1;
                const logs = dailyData.logs || [];

                allDailyData.push({
                    date: dateString,
                    hsrRate: hsrRate,
                    entryCount: entryCount,
                    logs: logs
                });
            }
        });

        const sortedDisplayData = allDailyData.sort((a, b) => b.date.localeCompare(a.date));

        if (sortedDisplayData.length === 0) {
            hsrList.innerHTML = `<li style="text-align: center; background-color: #333; border-left: 5px solid #FFC300;">No HSR rates logged yet.</li>`;
        }

        sortedDisplayData.forEach(dailyData => {
            const scoreText = `${dailyData.hsrRate.toFixed(2)}%`;
            const entriesText = dailyData.entryCount > 1 ? ` (${dailyData.entryCount} entries)` : ` (1 entry)`;
            let logs = dailyData.logs || [];

            // Handle legacy data
            if (logs.length === 0 && dailyData.hsrRate > 0) {
                logs = [{
                    id: 'legacy-' + dailyData.date,
                    timestamp: null,
                    hsrRate: dailyData.hsrRate,
                    isLegacy: true
                }];
            }

            const li = document.createElement('li');
            li.className = 'history-day-group';

            let logsHtml = '';
            if (logs.length > 0) {
                logsHtml = `<div class="game-logs-container">`;
                logs.forEach((log, index) => {
                    let timeStr = log.isLegacy ? 'Legacy Entry' : `Entry ${index + 1}`;
                    if (log.timestamp && log.timestamp.seconds) {
                        timeStr = new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }

                    const logId = log.id || 'legacy';

                    const actionsHtml = log.isLegacy ?
                        `<span style="font-size: 0.8em; color: #666;">(Legacy Data - Cannot Edit)</span>` :
                        `<button class="log-btn log-edit-btn" data-metric="hsr" data-date="${dailyData.date}" data-id="${logId}">Edit</button>
                         <button class="log-btn log-delete-btn" data-metric="hsr" data-date="${dailyData.date}" data-id="${logId}">Delete</button>`;

                    logsHtml += `
                        <div class="game-log-item">
                            <div class="game-log-details">
                                <span class="game-log-time">${timeStr}</span>
                                <span class="game-log-metric">Rate: ${log.hsrRate.toFixed(2)}%</span>
                            </div>
                            <div class="log-actions">
                                ${actionsHtml}
                            </div>
                        </div>
                    `;
                });
                logsHtml += `</div>`;
            }

            li.innerHTML = `
                <div class="daily-summary">
                    <div>
                        <span class="daily-date">${dailyData.date}</span>
                        <div style="font-size: 0.85em; color: #aaa;">${entriesText} | Daily Rate: ${scoreText}</div>
                    </div>
                    <div class="action-buttons">
                        <button class="delete-btn" data-date="${dailyData.date}" title="Delete entire day">Delete Day</button>
                    </div>
                </div>
                ${logsHtml}
            `;
            hsrList.appendChild(li);

            // Re-attach listeners for new buttons
            li.querySelector('.delete-btn').addEventListener('click', (e) => deleteHsrEntry(dailyData.date));
        });

        updateOverallHSR(allDailyData);
        updateChart(allDailyData, hsrChart, 'hsrRate');

    }, (error) => {
        console.error("FATAL ERROR: HSR Real-time listener failed to sync.", error);
        displayMessage(`FATAL SYNC ERROR: ${error.message}. Check console.`, 'error');
    });
}

// NEW: ADR Realtime Listener
function startAdrRealtimeListener() {
    initializeChart('adr-chart');

    const path = getCollectionPath('ADR');
    const adrCollectionRef = collection(db, path);
    const adrQuery = query(adrCollectionRef);

    // Unsubscribe from any previous listener
    if (currentListenerUnsubscribe) currentListenerUnsubscribe();

    currentListenerUnsubscribe = onSnapshot(adrQuery, (snapshot) => {
        if (!adrList) return;

        const allDailyData = [];
        adrList.innerHTML = '';

        snapshot.forEach((doc) => {
            const dailyData = doc.data();
            const dateString = dailyData.date || doc.id;

            if (dateString && dateString.length === 10 && dateString.includes('-')) {
                const adrValue = parseFloat(dailyData.adrValue) || 0;
                const entryCount = parseInt(dailyData.entryCount) || 1;
                const logs = dailyData.logs || [];

                allDailyData.push({
                    date: dateString,
                    adrValue: adrValue,
                    entryCount: entryCount,
                    logs: logs
                });
            }
        });

        const sortedDisplayData = allDailyData.sort((a, b) => b.date.localeCompare(a.date));

        if (sortedDisplayData.length === 0) {
            adrList.innerHTML = `<li style="text-align: center; background-color: #333; border-left: 5px solid #FFC300;">No ADR values logged yet.</li>`;
        }

        sortedDisplayData.forEach(dailyData => {
            const scoreText = `${dailyData.adrValue.toFixed(1)}`;
            const entriesText = dailyData.entryCount > 1 ? ` (${dailyData.entryCount} entries)` : ` (1 entry)`;
            let logs = dailyData.logs || [];

            // Handle legacy data
            if (logs.length === 0 && dailyData.adrValue > 0) {
                logs = [{
                    id: 'legacy-' + dailyData.date,
                    timestamp: null,
                    adrValue: dailyData.adrValue,
                    isLegacy: true
                }];
            }

            const li = document.createElement('li');
            li.className = 'history-day-group';

            let logsHtml = '';
            if (logs.length > 0) {
                logsHtml = `<div class="game-logs-container">`;
                logs.forEach((log, index) => {
                    let timeStr = log.isLegacy ? 'Legacy Entry' : `Entry ${index + 1}`;
                    if (log.timestamp && log.timestamp.seconds) {
                        timeStr = new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }

                    const logId = log.id || 'legacy';

                    const actionsHtml = log.isLegacy ?
                        `<span style="font-size: 0.8em; color: #666;">(Legacy Data - Cannot Edit)</span>` :
                        `<button class="log-btn log-edit-btn" data-metric="adr" data-date="${dailyData.date}" data-id="${logId}">Edit</button>
                         <button class="log-btn log-delete-btn" data-metric="adr" data-date="${dailyData.date}" data-id="${logId}">Delete</button>`;

                    logsHtml += `
                        <div class="game-log-item">
                            <div class="game-log-details">
                                <span class="game-log-time">${timeStr}</span>
                                <span class="game-log-metric">ADR: ${log.adrValue.toFixed(1)}</span>
                            </div>
                            <div class="log-actions">
                                ${actionsHtml}
                            </div>
                        </div>
                    `;
                });
                logsHtml += `</div>`;
            }

            li.innerHTML = `
                <div class="daily-summary">
                    <div>
                        <span class="daily-date">${dailyData.date}</span>
                        <div style="font-size: 0.85em; color: #aaa;">${entriesText} | Daily Value: ${scoreText}</div>
                    </div>
                    <div class="action-buttons">
                        <button class="delete-btn" data-date="${dailyData.date}" title="Delete entire day">Delete Day</button>
                    </div>
                </div>
                ${logsHtml}
            `;
            adrList.appendChild(li);

            // Re-attach listeners for new buttons
            li.querySelector('.delete-btn').addEventListener('click', (e) => deleteAdrEntry(dailyData.date));
        });

        updateOverallADR(allDailyData);
        updateChart(allDailyData, adrChart, 'adrValue');

    }, (error) => {
        console.error("FATAL ERROR: ADR Real-time listener failed to sync.", error);
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
        adrTitleBtn.classList.remove('active');
        eloTitleBtn.classList.remove('active');
        kdaContent.classList.add('active');
        kdaContent.classList.remove('hidden');
        hsrContent.classList.add('hidden');
        hsrContent.classList.remove('active');
        adrContent.classList.add('hidden');
        adrContent.classList.remove('active');
        eloContent.classList.add('hidden');
        eloContent.classList.remove('active');
        startKdaRealtimeListener();
    } else if (mode === 'HSR') {
        kdaTitleBtn.classList.remove('active');
        hsrTitleBtn.classList.add('active');
        adrTitleBtn.classList.remove('active');
        eloTitleBtn.classList.remove('active');
        kdaContent.classList.add('hidden');
        kdaContent.classList.remove('active');
        hsrContent.classList.add('active');
        hsrContent.classList.remove('hidden');
        adrContent.classList.add('hidden');
        adrContent.classList.remove('active');
        eloContent.classList.add('hidden');
        eloContent.classList.remove('active');
        startHsrRealtimeListener();
    } else if (mode === 'ADR') {
        kdaTitleBtn.classList.remove('active');
        hsrTitleBtn.classList.remove('active');
        adrTitleBtn.classList.add('active');
        eloTitleBtn.classList.remove('active');
        kdaContent.classList.add('hidden');
        kdaContent.classList.remove('active');
        hsrContent.classList.add('hidden');
        hsrContent.classList.remove('active');
        adrContent.classList.add('active');
        adrContent.classList.remove('hidden');
        eloContent.classList.add('hidden');
        eloContent.classList.remove('active');
        startAdrRealtimeListener();
    } else if (mode === 'ELO') {
        kdaTitleBtn.classList.remove('active');
        hsrTitleBtn.classList.remove('active');
        adrTitleBtn.classList.remove('active');
        eloTitleBtn.classList.add('active');
        kdaContent.classList.add('hidden');
        kdaContent.classList.remove('active');
        hsrContent.classList.add('hidden');
        hsrContent.classList.remove('active');
        adrContent.classList.add('hidden');
        adrContent.classList.remove('active');
        eloContent.classList.add('active');
        eloContent.classList.remove('hidden');
        // No listener for ELO yet
    }
}

if (addGameBtn) {
    addGameBtn.addEventListener('click', addGame);
}

if (addHsrBtn) {
    addHsrBtn.addEventListener('click', addHSR);
}

if (addAdrBtn) {
    addAdrBtn.addEventListener('click', addADR);
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

if (adrTitleBtn) {
    adrTitleBtn.addEventListener('click', () => {
        switchTrackerMode('ADR');
    });
}

if (eloTitleBtn) {
    eloTitleBtn.addEventListener('click', () => {
        switchTrackerMode('ELO');
        updateEloDisplay(); // Update ELO display when tab is clicked
    });
}

// =================================================================
// ELO SYSTEM FUNCTIONS
// =================================================================

/**
 * Calculate WEO Risk for the last 10 games
 * WEO = game where current metric < historical average up to that point
 */
function calculateWEORisk(games) {
    if (games.length === 0) return 0;

    const last10 = games.slice(-10); // Get last 10 games
    let weoCount = 0;

    for (let i = 0; i < last10.length; i++) {
        // Calculate historical average up to this game (not including current game)
        const gamesBeforeCurrent = games.slice(0, games.length - last10.length + i);

        if (gamesBeforeCurrent.length === 0) continue;

        const historicalAvg = gamesBeforeCurrent.reduce((sum, g) => sum + g.value, 0) / gamesBeforeCurrent.length;

        // Check if current game is below historical average
        if (last10[i].value < historicalAvg) {
            weoCount++;
        }
    }

    return (weoCount / last10.length) * 100; // Return as percentage
}

/**
 * Calculate Projected Elo Rank based on current performance
 */
function calculateProjectedElo(currentMetric, foundationMetric, metricType) {
    const { BASELINE_ELO, GLOBAL_AVG_HSR, GLOBAL_AVG_KDA, GLOBAL_AVG_ADR, ELO_CONVERSION_FACTOR } = ELO_CONSTANTS;

    // Determine global average based on metric type
    let globalAvg;
    if (metricType === 'hsr') {
        globalAvg = GLOBAL_AVG_HSR;
    } else if (metricType === 'kda') {
        globalAvg = GLOBAL_AVG_KDA;
    } else if (metricType === 'adr') {
        globalAvg = GLOBAL_AVG_ADR;
    } else {
        globalAvg = foundationMetric; // Fallback
    }

    // Calculate metric difference
    const metricDiff = currentMetric - globalAvg;

    // Calculate projected Elo
    // If metricDiff is negative (performance < globalAvg), ELO will drop below 1500
    const projectedElo = BASELINE_ELO + (metricDiff * ELO_CONVERSION_FACTOR);

    return Math.round(projectedElo);
}

/**
 * Calculate all ELO metrics for a given metric type
 */
async function calculateEloMetrics(metricType) {
    try {
        console.log(`[${metricType.toUpperCase()}] Starting ELO calculation...`);

        // Determine collection name
        let collectionName;
        if (metricType === 'kda') collectionName = KDA_COLLECTION_NAME;
        else if (metricType === 'hsr') collectionName = HSR_COLLECTION_NAME;
        else if (metricType === 'adr') collectionName = ADR_COLLECTION_NAME;

        console.log(`[${metricType.toUpperCase()}] Collection: users/${userId}/${collectionName}`);

        // Fetch all games for this metric
        const gamesRef = collection(db, 'users', userId, collectionName);
        const gamesSnapshot = await new Promise((resolve) => {
            const unsubscribe = onSnapshot(gamesRef, (snapshot) => {
                unsubscribe();
                resolve(snapshot);
            });
        });

        if (gamesSnapshot.empty) {
            console.log(`[${metricType.toUpperCase()}] ⚠️ No games found in collection - Resetting ELO`);

            // Reset ELO metrics to default state
            const resetMetrics = {
                metricType,
                foundationMetric: 0,
                totalGamesPlayed: 0,
                timeInvested: 0,
                currentMetric: 0,
                momentumChange: 0,
                last5Games: [],
                targetMetric: 0,
                projectedEloRank: 1500, // Reset to baseline
                weoRisk: 'Low',
                gamesPerDay: {},
                lastUpdated: new Date()
            };

            // Store reset state in Firebase
            const eloDocRef = doc(db, 'users', userId, ELO_METRICS_COLLECTION, metricType);
            await setDoc(eloDocRef, resetMetrics);

            return resetMetrics;
        }

        console.log(`[${metricType.toUpperCase()}] Found ${gamesSnapshot.size} documents`);

        // Extract game values with dates
        const games = [];
        gamesSnapshot.forEach((doc) => {
            const data = doc.data();
            let value;

            if (metricType === 'kda') {
                const k = data.totalKills || 0;
                const d = data.totalDeaths || 1; // Avoid division by zero
                const a = data.totalAssists || 0;
                value = (k + a) / d;
            } else if (metricType === 'hsr') {
                value = data.hsrRate || 0;
            } else if (metricType === 'adr') {
                value = data.adrValue || 0;
            }

            games.push({
                date: doc.id,
                value: value,
                timestamp: data.timestamp || new Date()
            });
        });

        // Sort by date
        games.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate total games played
        let totalGames;
        if (metricType === 'kda') {
            totalGames = 0;
            gamesSnapshot.forEach((doc) => {
                const data = doc.data();
                totalGames += (data.gamesCount || 1);
            });
            console.log(`[${metricType.toUpperCase()}] Total individual games: ${totalGames}`);
        } else {
            totalGames = games.length;
        }

        // --- NEW LOGIC: Pure Iterative ELO Calculation (From Scratch) ---
        // 1. Get Target Multiplier (Public Firebase + Local Fallback)
        let multiplier = 1.5; // Default

        const multiplierInput = document.getElementById('target-multiplier-input');
        if (multiplierInput) {
            multiplier = parseFloat(multiplierInput.value);
        }

        // 2. Initialize ELO State
        let currentElo = ELO_CONSTANTS.BASELINE_ELO; // Start at 1500
        let foundationMetric = 0;

        // Set initial baseline (The "Zero" comparison)
        if (metricType === 'kda') foundationMetric = ELO_CONSTANTS.GLOBAL_AVG_KDA;
        else if (metricType === 'hsr') foundationMetric = ELO_CONSTANTS.GLOBAL_AVG_HSR;
        else if (metricType === 'adr') foundationMetric = ELO_CONSTANTS.GLOBAL_AVG_ADR;

        // 3. Iterate through ALL games chronologically
        // We do NOT use any saved state. We replay history.
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        games.forEach((game, index) => {
            // SKIP FUTURE GAMES
            if (game.date > today) return;

            const performance = game.value;

            // Calculate Diff: Performance vs Foundation (Previous Game)
            const diff = performance - foundationMetric;

            // Calculate ELO Change
            // ELO += (Diff * ConversionFactor)
            const change = diff * ELO_CONSTANTS.ELO_CONVERSION_FACTOR;

            currentElo += change;

            // Update Foundation for NEXT iteration
            // The next game will be compared to THIS game's performance
            foundationMetric = performance;
        });

        // 4. Final Metrics for Display
        const validGames = games.filter(g => g.date <= today);
        const lastGame = validGames[validGames.length - 1];

        let currentMetric = null;
        let displayFoundation = 0;

        // Check if we have data for TODAY
        if (lastGame && lastGame.date === today) {
            // We have data for today
            currentMetric = lastGame.value;

            // Foundation is the game BEFORE today (2nd to last)
            if (validGames.length > 1) {
                displayFoundation = validGames[validGames.length - 2].value;
            } else {
                // Fallback to baseline if today is the ONLY game
                if (metricType === 'kda') displayFoundation = ELO_CONSTANTS.GLOBAL_AVG_KDA;
                else if (metricType === 'hsr') displayFoundation = ELO_CONSTANTS.GLOBAL_AVG_HSR;
                else if (metricType === 'adr') displayFoundation = ELO_CONSTANTS.GLOBAL_AVG_ADR;
            }
        } else {
            // No data for today - Empty State
            currentMetric = null; // Indicates "Waiting for data"

            // Foundation is the LAST recorded game (Yesterday or earlier)
            if (lastGame) {
                displayFoundation = lastGame.value;
            } else {
                // No games ever? Baseline.
                if (metricType === 'kda') displayFoundation = ELO_CONSTANTS.GLOBAL_AVG_KDA;
                else if (metricType === 'hsr') displayFoundation = ELO_CONSTANTS.GLOBAL_AVG_HSR;
                else if (metricType === 'adr') displayFoundation = ELO_CONSTANTS.GLOBAL_AVG_ADR;
            }
        }

        const targetMetric = displayFoundation * multiplier;

        // Momentum: Compare Current vs Foundation (if Current exists)
        // If no current, momentum is 0 or undefined
        const momentumChange = (currentMetric !== null && displayFoundation > 0)
            ? ((currentMetric / displayFoundation) - 1) * 100
            : 0;

        const weoRisk = calculateWEORisk(validGames);
        const projectedEloRank = Math.round(currentElo); // The final result of the loop

        // Calculate Time Invested
        const timeInvested = totalGames * ELO_CONSTANTS.MINUTES_PER_GAME;

        // Count games per day
        const gamesPerDay = {};
        gamesSnapshot.forEach((doc) => {
            const data = doc.data();
            const dateKey = doc.id;
            let count = 1;
            if (metricType === 'kda') count = parseInt(data.gamesCount) || 1;
            else count = parseInt(data.entryCount) || 1;
            gamesPerDay[dateKey] = count;
        });

        // Prepare ELO metrics object (for display updates)
        const eloMetrics = {
            metricType,
            foundationMetric: displayFoundation,
            totalGamesPlayed: totalGames,
            timeInvested,
            currentMetric,
            momentumChange,
            last5Games: validGames.slice(-5).map(g => g.value),
            targetMetric,
            projectedEloRank,
            weoRisk,
            gamesPerDay,
            lastUpdated: new Date()
        };

        // We still save the *result* to Firebase so other devices can see the latest ELO
        // BUT we don't read it back for calculation. Calculation is always fresh.
        const eloDocRef = doc(db, 'users', userId, ELO_METRICS_COLLECTION, metricType);
        await setDoc(eloDocRef, eloMetrics);

        return eloMetrics;

    } catch (error) {
        console.error(`[${metricType.toUpperCase()}] Error calculating ELO:`, error);
        return null;
    }
}

// ==========================================
// Target Multiplier Logic (Public Firebase)
// ==========================================
async function initTargetMultiplier() {
    const displayContainer = document.getElementById('multiplier-display-container');
    const editContainer = document.getElementById('multiplier-edit-container');
    const valueDisplay = document.getElementById('multiplier-value-display');
    const input = document.getElementById('target-multiplier-input');
    const editBtn = document.getElementById('edit-multiplier-btn');
    const confirmBtn = document.getElementById('confirm-multiplier-btn');
    const cancelBtn = document.getElementById('cancel-multiplier-btn');

    if (!input) return;

    // 1. Load from Firebase
    try {
        const settingsRef = doc(db, 'users', userId, 'settings', 'elo');
        const docSnap = await getDoc(settingsRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.targetMultiplier) {
                input.value = data.targetMultiplier;
                valueDisplay.textContent = data.targetMultiplier;
            }
        }
    } catch (error) {
        console.error("Error loading multiplier:", error);
    }

    // 2. UI Event Listeners
    editBtn.onclick = () => {
        displayContainer.style.display = 'none';
        editContainer.style.display = 'flex';
        input.focus();
    };

    cancelBtn.onclick = () => {
        input.value = valueDisplay.textContent; // Reset to saved value
        editContainer.style.display = 'none';
        displayContainer.style.display = 'flex';
    };

    confirmBtn.onclick = async () => {
        const newVal = parseFloat(input.value);
        if (isNaN(newVal) || newVal < 1.0) {
            alert("Please enter a valid multiplier (>= 1.0)");
            return;
        }

        // Update UI immediately
        valueDisplay.textContent = newVal;
        editContainer.style.display = 'none';
        displayContainer.style.display = 'flex';

        // Save to Firebase
        try {
            const settingsRef = doc(db, 'users', userId, 'settings', 'elo');
            await setDoc(settingsRef, { targetMultiplier: newVal }, { merge: true });
            console.log("Multiplier saved to Firebase");
        } catch (error) {
            console.error("Error saving multiplier:", error);
        }

        // Recalculate ELO
        console.log("Recalculating ELO with new multiplier...");
        await calculateEloMetrics('kda');
        await calculateEloMetrics('hsr');
        await calculateEloMetrics('adr');
    };
}

// Start the application
initTargetMultiplier(); // Initialize multiplier logic
setInitialDate();

async function updateEloDisplay() {
    try {
        console.log('=== Starting ELO Display Update ===');

        // Fetch ELO metrics for all three types (Calculate Fresh)
        const kdaMetrics = await calculateEloMetrics('kda');
        console.log('KDA Metrics:', kdaMetrics);

        const hsrMetrics = await calculateEloMetrics('hsr');
        console.log('HSR Metrics:', hsrMetrics);

        const adrMetrics = await calculateEloMetrics('adr');
        console.log('ADR Metrics:', adrMetrics);

        // Update KDA display
        if (kdaMetrics) {
            console.log('Updating KDA display...');
            updateMetricDisplay('kda', kdaMetrics);
        } else {
            console.warn('No KDA metrics available');
        }

        // Update HSR display
        if (hsrMetrics) {
            console.log('Updating HSR display...');
            updateMetricDisplay('hsr', hsrMetrics);
        } else {
            console.warn('No HSR metrics available - do you have HSR data logged?');
        }

        // Update ADR display
        if (adrMetrics) {
            console.log('Updating ADR display...');
            updateMetricDisplay('adr', adrMetrics);
        } else {
            console.warn('No ADR metrics available - do you have ADR data logged?');
        }

        // Calculate overall projected Elo (average of all three)
        const validMetrics = [kdaMetrics, hsrMetrics, adrMetrics].filter(m => m !== null);
        console.log('Valid metrics count:', validMetrics.length);

        if (validMetrics.length > 0) {
            const avgElo = validMetrics.reduce((sum, m) => sum + m.projectedEloRank, 0) / validMetrics.length;
            console.log('Average ELO:', avgElo);
            document.getElementById('overall-elo-rank').textContent = Math.round(avgElo);
        }

        // Update total time invested (MAX logs per day logic)
        // 1. Collect all unique dates
        const allDates = new Set();
        const kdaGames = kdaMetrics?.gamesPerDay || {};
        const hsrGames = hsrMetrics?.gamesPerDay || {};
        const adrGames = adrMetrics?.gamesPerDay || {};

        Object.keys(kdaGames).forEach(d => allDates.add(d));
        Object.keys(hsrGames).forEach(d => allDates.add(d));
        Object.keys(adrGames).forEach(d => allDates.add(d));

        // 2. Sum max games for each date
        let totalMaxGames = 0;
        allDates.forEach(date => {
            const kdaCount = kdaGames[date] || 0;
            const hsrCount = hsrGames[date] || 0;
            const adrCount = adrGames[date] || 0;
            const maxForDay = Math.max(kdaCount, hsrCount, adrCount);
            totalMaxGames += maxForDay;
        });

        const totalTime = totalMaxGames * 30; // 30 mins per game
        const hours = Math.floor(totalTime / 60);
        const minutes = totalTime % 60;
        console.log('Total time (Max Logs Logic):', hours, 'hours', minutes, 'minutes');
        document.getElementById('total-time-invested').textContent = `${hours} hours ${minutes} minutes`;

        console.log('=== ELO Display Update Complete ===');

    } catch (error) {
        console.error('Error updating ELO display:', error);
    }
}


/**
 * Update individual metric display
 */
function updateMetricDisplay(metricType, metrics) {
    const prefix = metricType;
    const isHSR = metricType === 'hsr';
    const suffix = isHSR ? '%' : '';

    // Update Past/Present/Future values
    document.getElementById(`${prefix}-past`).textContent =
        metrics.foundationMetric.toFixed(2) + suffix;

    // Update WEO Risk
    document.getElementById(`${prefix}-weo`).textContent =
        `${metrics.weoRisk.toFixed(1)}%`;

    // Update Games count
    document.getElementById(`${prefix}-games`).textContent =
        metrics.totalGamesPlayed;

    // Update individual ELO rank for this metric
    const eloRankEl = document.getElementById(`${prefix}-elo-rank`);
    if (eloRankEl) {
        eloRankEl.textContent = `ELO: ${metrics.projectedEloRank}`;
    }

    // Update Present (Current)
    const presentEl = document.getElementById(`${metricType}-present`);
    const presentLayer = document.getElementById(`${metricType}-present-layer`);

    if (metrics.currentMetric !== null) {
        // Data exists for today
        presentEl.textContent = formatMetric(metrics.currentMetric, metricType);
        presentLayer.classList.remove('waiting'); // Ensure waiting class is removed
    } else {
        // No data for today
        presentEl.textContent = "Waiting for Data...";
        presentLayer.classList.add('waiting'); // Add styling class if needed
    }

    // Update Future (Target)
    const futureEl = document.getElementById(`${metricType}-future`);
    futureEl.textContent = formatMetric(metrics.targetMetric, metricType);

    // Update Visual Bars
    const barFill = document.getElementById(`${metricType}-bar-fill`);
    const barTarget = document.getElementById(`${metricType}-bar-target`);

    // Calculate percentages for bars (relative to Target * 1.2 for headroom)
    const maxScale = metrics.targetMetric * 1.2 || 100; // Avoid div by zero

    // Green Bar (Current)
    let fillPercent = 0;
    if (metrics.currentMetric !== null) {
        fillPercent = (metrics.currentMetric / maxScale) * 100;
    }
    barFill.style.width = `${Math.min(fillPercent, 100)}%`;

    // Yellow Line (Target)
    const targetPercent = (metrics.targetMetric / maxScale) * 100;
    barTarget.style.left = `${Math.min(targetPercent, 100)}%`;

    // Update Stats
    const momentumEl = document.getElementById(`${metricType}-momentum`);
    const momentumVal = metrics.momentumChange;
    momentumEl.textContent = `${momentumVal > 0 ? '+' : ''}${momentumVal.toFixed(1)}%`;
    momentumEl.className = momentumVal >= 0 ? 'positive-momentum' : 'negative-momentum';

    if (metrics.currentMetric === null) {
        momentumEl.textContent = "--";
        momentumEl.className = '';
    }
}


// ==========================================
// Individual Log Management (Attached to Window)
// ==========================================

window.deleteIndividualLog = async (metricType, date, logId) => {
    if (!confirm('Are you sure you want to delete this specific game log?')) return;

    try {
        let collectionName;
        if (metricType === 'kda') collectionName = KDA_COLLECTION_NAME;
        else if (metricType === 'hsr') collectionName = HSR_COLLECTION_NAME;
        else if (metricType === 'adr') collectionName = ADR_COLLECTION_NAME;

        const docRef = doc(db, 'users', userId, collectionName, date);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return;

        const data = docSnap.data();
        let logs = data.logs || [];

        // Filter out the log to delete
        const updatedLogs = logs.filter(log => (log.id || 'legacy') !== logId);

        // Recalculate daily totals
        const updates = recalculateDailyTotals(updatedLogs, metricType);
        updates.logs = updatedLogs;

        // Update document
        if (updatedLogs.length === 0) {
            // If no logs left, keep empty but with 0 values
            await setDoc(docRef, updates);
        } else {
            await setDoc(docRef, updates, { merge: true });
        }

        console.log(`Deleted log ${logId} from ${date}`);

        // Recalculate ELO
        await calculateEloMetrics(metricType);

    } catch (error) {
        console.error('Error deleting individual log:', error);
        alert('Error deleting log: ' + error.message);
    }
};

window.editIndividualLog = async (metricType, date, logId) => {
    try {
        let collectionName;
        if (metricType === 'kda') collectionName = KDA_COLLECTION_NAME;
        else if (metricType === 'hsr') collectionName = HSR_COLLECTION_NAME;
        else if (metricType === 'adr') collectionName = ADR_COLLECTION_NAME;

        const docRef = doc(db, 'users', userId, collectionName, date);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const logs = data.logs || [];
        const log = logs.find(l => (l.id || 'legacy') === logId);

        if (!log) return;

        // Populate Modal
        const modal = document.getElementById('edit-log-modal');
        const formContainer = document.getElementById('edit-fields-container');

        document.getElementById('edit-metric-type').value = metricType;
        document.getElementById('edit-log-date').value = date;
        document.getElementById('edit-log-id').value = logId;

        formContainer.innerHTML = ''; // Clear previous fields

        if (metricType === 'kda') {
            formContainer.innerHTML = `
                <div class="form-group">
                    <label>Kills</label>
                    <input type="number" id="edit-kills" value="${log.kills}" min="0">
                </div>
                <div class="form-group">
                    <label>Deaths</label>
                    <input type="number" id="edit-deaths" value="${log.deaths}" min="0">
                </div>
                <div class="form-group">
                    <label>Assists</label>
                    <input type="number" id="edit-assists" value="${log.assists}" min="0">
                </div>
            `;
        } else if (metricType === 'hsr') {
            formContainer.innerHTML = `
                <div class="form-group">
                    <label>Headshot Rate (%)</label>
                    <input type="number" id="edit-hsr" value="${log.hsrRate}" step="0.01" min="0" max="100">
                </div>
            `;
        } else if (metricType === 'adr') {
            formContainer.innerHTML = `
                <div class="form-group">
                    <label>ADR Value</label>
                    <input type="number" id="edit-adr" value="${log.adrValue}" step="0.1" min="0">
                </div>
            `;
        }

        modal.style.display = 'block';

    } catch (error) {
        console.error('Error opening edit modal:', error);
        alert('Error: ' + error.message);
    }
};

// Modal Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('edit-log-modal');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const saveBtn = document.getElementById('save-edit-btn');

    const closeModal = () => {
        modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    window.onclick = (event) => {
        if (event.target === modal) {
            closeModal();
        }
    };

    if (saveBtn) {
        saveBtn.onclick = async () => {
            const metricType = document.getElementById('edit-metric-type').value;
            const date = document.getElementById('edit-log-date').value;
            const logId = document.getElementById('edit-log-id').value;

            try {
                let collectionName;
                if (metricType === 'kda') collectionName = KDA_COLLECTION_NAME;
                else if (metricType === 'hsr') collectionName = HSR_COLLECTION_NAME;
                else if (metricType === 'adr') collectionName = ADR_COLLECTION_NAME;

                const docRef = doc(db, 'users', userId, collectionName, date);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) return;

                const data = docSnap.data();
                const logs = data.logs || [];
                const logIndex = logs.findIndex(l => (l.id || 'legacy') === logId);

                if (logIndex === -1) return;

                const log = logs[logIndex];
                let newLog = { ...log };

                if (metricType === 'kda') {
                    const k = parseInt(document.getElementById('edit-kills').value) || 0;
                    const d = parseInt(document.getElementById('edit-deaths').value) || 0;
                    const a = parseInt(document.getElementById('edit-assists').value) || 0;

                    newLog.kills = k;
                    newLog.deaths = d;
                    newLog.assists = a;
                    newLog.kda = parseFloat(calculateKda(k, d, a));

                } else if (metricType === 'hsr') {
                    newLog.hsrRate = parseFloat(document.getElementById('edit-hsr').value) || 0;
                } else if (metricType === 'adr') {
                    newLog.adrValue = parseFloat(document.getElementById('edit-adr').value) || 0;
                }

                // Update logs array
                logs[logIndex] = newLog;

                // Recalculate totals
                const updates = recalculateDailyTotals(logs, metricType);
                updates.logs = logs;

                await setDoc(docRef, updates, { merge: true });
                console.log(`Updated log ${logId} in ${date}`);

                // Recalculate ELO
                await calculateEloMetrics(metricType);

                closeModal();

            } catch (error) {
                console.error('Error saving edit:', error);
                alert('Error saving: ' + error.message);
            }
        };
    }
});

function recalculateDailyTotals(logs, metricType) {
    if (metricType === 'kda') {
        let totalKills = 0;
        let totalDeaths = 0;
        let totalAssists = 0;

        logs.forEach(log => {
            totalKills += (log.kills || 0);
            totalDeaths += (log.deaths || 0);
            totalAssists += (log.assists || 0);
        });

        const kdaRatio = parseFloat(calculateKda(totalKills, totalDeaths, totalAssists));

        return {
            totalKills,
            totalDeaths,
            totalAssists,
            kdaRatio,
            gamesCount: logs.length
        };
    } else if (metricType === 'hsr') {
        if (logs.length === 0) return { hsrRate: 0, entryCount: 0 };

        const sum = logs.reduce((acc, log) => acc + (log.hsrRate || 0), 0);
        const avg = sum / logs.length;

        return {
            hsrRate: avg,
            entryCount: logs.length
        };
    } else if (metricType === 'adr') {
        if (logs.length === 0) return { adrValue: 0, entryCount: 0 };

        const sum = logs.reduce((acc, log) => acc + (log.adrValue || 0), 0);
        const avg = sum / logs.length;

        return {
            adrValue: avg,
            entryCount: logs.length
        };
    }
}

// ==========================================
// Event Delegation for Dynamic Buttons
// ==========================================

function setupLogListListeners(listElement, metricType) {
    if (!listElement) return;

    listElement.addEventListener('click', (e) => {
        // Find the closest button if clicked on icon/text inside
        const btn = e.target.closest('.log-btn');
        if (!btn) return;

        const date = btn.dataset.date;
        const id = btn.dataset.id;
        // Allow override from data-metric, fallback to list metric
        const metric = btn.dataset.metric || metricType;

        if (btn.classList.contains('log-edit-btn')) {
            console.log(`Edit clicked: ${metric} ${date} ${id}`);
            editIndividualLog(metric, date, id);
        } else if (btn.classList.contains('log-delete-btn')) {
            console.log(`Delete clicked: ${metric} ${date} ${id}`);
            deleteIndividualLog(metric, date, id);
        }
    });
}

// Initialize listeners
setupLogListListeners(kdaList, 'kda');
setupLogListListeners(hsrList, 'hsr');
setupLogListListeners(adrList, 'adr');

// Target Multiplier Event Listener
const targetMultiplierInput = document.getElementById('target-multiplier-input');
if (targetMultiplierInput) {
    targetMultiplierInput.addEventListener('change', async () => {
        const newVal = targetMultiplierInput.value;
        console.log(`Target Multiplier changed to ${newVal}, recalculating ELO...`);
        localStorage.setItem('eloTargetMultiplier', newVal);

        await calculateEloMetrics('kda');
        await calculateEloMetrics('hsr');
        await calculateEloMetrics('adr');
    });
}

// Start the application
setInitialDate();
// Start with KDA mode active
switchTrackerMode('KDA');