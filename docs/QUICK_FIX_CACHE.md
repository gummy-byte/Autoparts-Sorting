# Quick Fix: "I'm Seeing the Old Version"

## For End Users

### ⚡ Quick Fix (30 seconds)

**On Windows/Linux:**
Press `Ctrl + Shift + R`

**On Mac:**
Press `Cmd + Shift + R`

This is called a "Hard Refresh" and forces your browser to download the latest version.

---

### 🔄 If Hard Refresh Doesn't Work

**Chrome/Edge:**

1. Press `F12` to open Developer Tools
2. Click the **Application** tab at the top
3. Click **Clear storage** on the left
4. Click the blue **Clear site data** button
5. Close Developer Tools
6. Refresh the page normally

**Firefox:**

1. Press `F12` to open Developer Tools
2. Click the **Storage** tab
3. Right-click on your site's name
4. Click **Delete All**
5. Close Developer Tools
6. Refresh the page

---

### 📱 On Mobile

**iPhone/iPad (Safari):**

1. Go to Settings → Safari
2. Tap **Clear History and Website Data**
3. Reopen the app

**Android (Chrome):**

1. Go to Settings → Privacy → Clear browsing data
2. Select **Cached images and files**
3. Tap **Clear data**
4. Reopen the app

---

### ✨ Auto-Update Feature

If you see a blue modal that says **"Update Available"**, just click the **"Refresh Now"** button. This will automatically update the app for you!

---

## For Administrators

### After Every Deployment:

1. **Build the app:**

   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Pages**

3. **Clear Cloudflare Cache:**

   - Go to Cloudflare Dashboard
   - Caching → Configuration
   - Click **Purge Everything**

4. **Notify users:**
   - Send message: "Please refresh the app (Ctrl+Shift+R)"
   - Or wait for auto-update modal (appears within 5 minutes)

### Version Bumping:

**Before deploying, update version in TWO places:**

1. `package.json`:

   ```json
   "version": "2.1.0"
   ```

2. `components/VersionChecker.tsx`:
   ```typescript
   const APP_VERSION = "2.1.0";
   ```

**Version numbers:**

- `2.0.0` → `3.0.0` = Major changes
- `2.0.0` → `2.1.0` = New features
- `2.0.0` → `2.0.1` = Bug fixes

---

## Common Issues

### "I cleared cache but still see old version"

**Try this:**

1. Close ALL browser tabs with the app
2. Clear browser cache again
3. Open app in **Incognito/Private** window
4. If it works there, your normal browser needs deeper cleaning

**Deep clean (Chrome/Edge):**

1. Go to `chrome://settings/clearBrowserData`
2. Select **All time**
3. Check **Cached images and files**
4. Click **Clear data**

### "Update modal keeps appearing"

**This is normal if:**

- You're testing and manually changing versions
- Multiple deployments happened quickly

**To stop it:**

- Click "Refresh Now" button
- Or wait for page to fully load new version

### "Some users see new version, others don't"

**Causes:**

1. Cloudflare cache not purged → Purge it
2. Users haven't refreshed → Send notification
3. Browser cache very aggressive → Ask for hard refresh

**Solution:**

- Enable Cloudflare Development Mode for 3 hours
- This bypasses all caching temporarily
- Gives users time to update

---

## Need Help?

**For users:** Contact your administrator

**For administrators:** See `docs/CACHE_BUSTING_GUIDE.md` for detailed troubleshooting
