# ELO Tracker Debugging Guide

## Problem Symptoms
- HSR and ADR showing 0.00 for Past/Present/Future
- KDA ELO stuck at 1500
- Time counter showing 0 hours 0 minutes
- WEO Risk shows a value (e.g., 60%)

## How to Debug

### Step 1: Open Browser Console
**Chrome/Edge:**
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
- Press `Cmd+Option+I` (Mac)
- Click the "Console" tab

**Firefox:**
- Press `F12` or `Ctrl+Shift+K`
- Click the "Console" tab

### Step 2: Refresh and Click ELO Tab
1. Refresh the page (`F5` or `Ctrl+R`)
2. Click on the **ELO** tab
3. Look at the console output

### Step 3: What to Look For

#### ✅ **Good Output (Everything Working):**
```
=== Starting ELO Display Update ===
[KDA] Starting ELO calculation...
[KDA] Collection: users/PUBLIC/games
[KDA] Found 10 documents
KDA Metrics: {foundationMetric: 1.5, currentMetric: 1.7, ...}
Updating KDA display...
[HSR] Starting ELO calculation...
[HSR] Collection: users/PUBLIC/headshots  
[HSR] Found 8 documents
HSR Metrics: {foundationMetric: 22, currentMetric: 25, ...}
...
Total time: 5 hours 30 minutes
=== ELO Display Update Complete ===
```

#### ❌ **Problem Indicators:**

**No HSR/ADR Data:**
```
[HSR] ⚠️ No games found in collection
HSR Metrics: null
No HSR metrics available - do you have HSR data logged?
```
**Solution:** You need to log HSR and ADR data first!
- Go to **HSR tab** → Log some headshot rates
- Go to **ADR tab** → Log some ADR values
- Then check ELO tab again

**Firebase Permission Error:**
```
Error: Missing or insufficient permissions
```
**Solution:** Update your Firebase rules (see firebase_rules.txt)

**Field Name Error:**
```
[KDA] Found 10 documents
Error calculating ELO metrics for kda: ...
```
**Solution:** Data structure mismatch (already fixed in latest code)

### Step 4: Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| HSR/ADR all zeros | No data logged | Log HSR/ADR entries first |
| KDA shows WEO but ELO=1500 | Calculation error | Check console for errors |
| Time counter = 0 | No games counted | Data not being fetched |
| Firebase errors | Rules not updated | Update Firebase security rules |

### Step 5: Manual Test
Try logging a new game:
1. Go to **KDA tab**
2. Log a game (e.g., 10/5/8)
3. Go to **ELO tab**
4. Check console - you should see:
   ```
   [KDA] Starting ELO calculation...
   [KDA] Found X documents
   ```

### Step 6: Share Console Output
If still not working, copy the console output and share it. Look for:
- Red error messages
- "⚠️ No games found" warnings
- Any Firebase-related errors

## Quick Checklist
- [ ] I have KDA games logged
- [ ] I have HSR data logged  
- [ ] I have ADR data logged
- [ ] Firebase rules are updated
- [ ] Console shows no Firebase errors
- [ ] Page was refreshed after code changes
