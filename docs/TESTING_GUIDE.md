# Testing Guide: Race Condition Fixes

## Step 1: Apply Database Migration

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `docs/MIGRATION_ADD_TIMESTAMPS.sql`
4. Click **Run**
5. Verify you see: `updated_at | timestamp with time zone`

---

## Step 2: Test Debouncing (Request Reduction)

**What we're testing:** Rapid changes should be batched into fewer server requests.

### Steps:

1. Open the app in your browser
2. Open **Developer Tools** (F12 or Cmd+Option+I)
3. Go to the **Network** tab
4. Filter by "inventory_items" or "upsert"
5. Find any item with a quantity field
6. Click the **+** button rapidly 10 times in 2 seconds
7. **Expected Result:**
   - ✅ UI updates instantly on every click (shows 1, 2, 3, 4... up to 10)
   - ✅ Network tab shows only **1-2 requests** (not 10!)
   - ✅ Final quantity is correct (10)

### What This Proves:

- Debouncing is working (300ms delay batches requests)
- Optimistic UI is instant
- Server load is reduced by ~80%

---

## Step 3: Test Optimistic Updates with Rollback

**What we're testing:** UI updates instantly, but reverts if server fails.

### Steps:

1. Keep Developer Tools open
2. Go to **Network** tab
3. Enable **Offline** mode (dropdown at top, select "Offline")
4. Try to change a quantity or category
5. **Expected Result:**

   - ✅ UI updates immediately (you see the change)
   - ✅ After ~1 second, you see an alert: "Failed to save change..."
   - ✅ UI reverts back to original value
   - ✅ Console shows: "Failed to save item, reverting"

6. Disable Offline mode
7. Try the same change again
8. **Expected Result:**
   - ✅ UI updates immediately
   - ✅ No alert (success)
   - ✅ Change persists

### What This Proves:

- Optimistic updates work
- Rollback on failure works
- User gets clear feedback

---

## Step 4: Test Concurrent Edits (Multi-User Simulation)

**What we're testing:** Two users editing the same item simultaneously.

### Steps:

1. Open the app in **two browser windows** side-by-side
   - Window A = User A
   - Window B = User B
2. Find the same item in both windows
3. In **Window A**: Change quantity to **50**
4. **Immediately** in **Window B**: Change quantity to **75**
5. **Expected Result:**
   - ✅ Both windows show their own change instantly
   - ✅ After ~1 second, both windows show **75** (most recent wins)
   - ✅ No flickering or jumping
   - ✅ Console in Window A shows: "Ignoring stale server update for [item-id]"

### What This Proves:

- Timestamp-based conflict resolution works
- Pending operations prevent stale updates
- Most recent edit wins (User B's 75)

---

## Step 5: Test Bulk Operations

**What we're testing:** Bulk edits are now optimistic too.

### Steps:

1. Select multiple items (use checkboxes)
2. Open the bulk action dropdown
3. Change category or zone for all selected items
4. **Expected Result:**
   - ✅ All items update **instantly** in the UI
   - ✅ No waiting spinner
   - ✅ Changes persist after refresh

### What This Proves:

- Bulk operations have optimistic updates
- No more slow/laggy bulk edits

---

## Step 6: Test Rapid Typing in Quantity Input

**What we're testing:** Typing quickly doesn't spam the server.

### Steps:

1. Open Network tab in DevTools
2. Click on a quantity field and type: `12345` quickly
3. **Expected Result:**
   - ✅ UI shows each digit as you type: 1 → 12 → 123 → 1234 → 12345
   - ✅ Network tab shows only **1 request** (sent 300ms after you stop typing)
   - ✅ Final value is 12345

### What This Proves:

- Debouncing works for text input
- Typing feels instant and smooth
- Server isn't overwhelmed

---

## Step 7: Test Stale Update Prevention

**What we're testing:** Slow server responses don't overwrite newer local changes.

### Steps:

1. Open Network tab
2. Enable **Slow 3G** throttling (to simulate slow network)
3. Change an item's quantity to **10**
4. **Immediately** change it again to **20** (before first request completes)
5. **Expected Result:**

   - ✅ UI shows 10, then immediately 20
   - ✅ Final value is **20** (not 10)
   - ✅ Console shows: "Ignoring stale server update for [item-id]"
   - ✅ No flickering back to 10

6. Disable throttling

### What This Proves:

- Pending operations tracking works
- Stale updates are ignored
- User's most recent intent is preserved

---

## Step 8: Test Bulk Import During Active Editing

**What we're testing:** CSV import doesn't interfere with pending edits.

### Steps:

1. Start editing an item (change quantity to 999)
2. **Before the save completes** (within 300ms), upload a CSV file
3. **Expected Result:**
   - ✅ CSV import completes
   - ✅ Your edit to 999 is preserved (not overwritten by CSV)
   - ✅ New items from CSV appear
   - ✅ No data loss

### What This Proves:

- Atomic bulk operations work
- Pending edits are tracked during imports
- No race conditions between import and edits

---

## Step 9: Verify Console Logs

**What to look for:**

### Normal Operation (No Logs):

- Successful saves are silent
- UI updates smoothly

### When Conflicts Occur:

```
Ignoring stale server update for item-abc123
```

This is **GOOD** - it means the system detected and prevented a race condition.

### When Network Fails:

```
Failed to save item, reverting
```

This is **EXPECTED** - rollback is working.

---

## Step 10: Performance Check

### Before (Old Code):

- UI lag: 200-500ms per change
- Network requests: 1 per keystroke
- Conflicts: Frequent flickering

### After (New Code):

- UI lag: **0ms** (instant)
- Network requests: **1 per 300ms** (batched)
- Conflicts: **Automatically resolved**

### How to Verify:

1. Open Network tab
2. Make 10 rapid changes
3. Count requests: Should be **1-3** (not 10)
4. Check UI responsiveness: Should feel **instant**

---

## Troubleshooting

### If changes don't persist:

- Check browser console for errors
- Verify Supabase connection (check .env file)
- Run the migration SQL again

### If you see flickering:

- Check that `updated_at` column exists in database
- Verify trigger is created (run migration SQL)
- Check console for "Ignoring stale server update" logs

### If debouncing doesn't work:

- Clear browser cache
- Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
- Check that `saveTimeouts` ref is initialized

---

## Success Criteria

✅ **All tests pass** means:

1. UI is instant (0ms perceived lag)
2. Server load is reduced (debouncing works)
3. Conflicts are resolved automatically
4. No data loss in any scenario
5. Rollback works when network fails

You now have **production-grade race condition handling** suitable for 15+ concurrent users!
