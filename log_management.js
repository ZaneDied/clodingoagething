
// ==========================================
// Individual Log Management (Attached to Window)
// ==========================================

window.deleteIndividualLog = async (metricType, date, logId) => {
    if (!confirm('Are you sure you want to delete this specific game log?')) return;

    try {
        let collectionName;
        if (metricType === 'kda') collectionName = 'games'; // KDA_COLLECTION_NAME
        else if (metricType === 'hsr') collectionName = 'headshots'; // HSR_COLLECTION_NAME
        else if (metricType === 'adr') collectionName = 'adr'; // ADR_COLLECTION_NAME

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
            // If no logs left, maybe delete the day? Or keep empty?
            // Let's keep it empty but with 0 values
            await setDoc(docRef, updates);
            // Or deleteDoc(docRef) if we want to remove the day entirely
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
        if (metricType === 'kda') collectionName = 'games';
        else if (metricType === 'hsr') collectionName = 'headshots';
        else if (metricType === 'adr') collectionName = 'adr';

        const docRef = doc(db, 'users', userId, collectionName, date);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const logs = data.logs || [];
        const logIndex = logs.findIndex(log => (log.id || 'legacy') === logId);

        if (logIndex === -1) return;

        const log = logs[logIndex];
        let newLog = { ...log };

        if (metricType === 'kda') {
            const k = prompt('Enter Kills:', log.kills);
            const d = prompt('Enter Deaths:', log.deaths);
            const a = prompt('Enter Assists:', log.assists);

            if (k === null || d === null || a === null) return;

            newLog.kills = parseInt(k) || 0;
            newLog.deaths = parseInt(d) || 0;
            newLog.assists = parseInt(a) || 0;
            newLog.kda = parseFloat(calculateKda(newLog.kills, newLog.deaths, newLog.assists));

        } else if (metricType === 'hsr') {
            const rate = prompt('Enter Headshot Rate (%):', log.hsrRate);
            if (rate === null) return;
            newLog.hsrRate = parseFloat(rate) || 0;

        } else if (metricType === 'adr') {
            const val = prompt('Enter ADR Value:', log.adrValue);
            if (val === null) return;
            newLog.adrValue = parseFloat(val) || 0;
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

    } catch (error) {
        console.error('Error editing individual log:', error);
        alert('Error editing log: ' + error.message);
    }
};

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
