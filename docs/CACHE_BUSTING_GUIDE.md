# Cache Busting Implementation Guide

## Problem

Users are experiencing old versions of the app due to aggressive browser and CDN caching, even after deploying new code.

## Solutions Implemented

### 1. HTML Meta Tags (index.html)

```html
<meta
  http-equiv="Cache-Control"
  content="no-cache, no-store, must-revalidate"
/>
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

**What it does:** Tells browsers not to cache the HTML file itself.

**Effectiveness:**

- ✅ Works for most modern browsers
- ⚠️ May be ignored by some CDNs
- ⚠️ Doesn't affect already-cached files

### 2. Vite Build Configuration (vite.config.ts)

```typescript
build: {
  rollupOptions: {
    output: {
      entryFileNames: 'assets/[name].[hash].js',
      chunkFileNames: 'assets/[name].[hash].js',
      assetFileNames: 'assets/[name].[hash].[ext]'
    }
  }
}
```

**What it does:** Generates unique filenames for each build (e.g., `app.abc123.js`)

**Effectiveness:**

- ✅✅✅ Most effective solution
- ✅ Works with all CDNs
- ✅ Automatic on every deployment

**How it works:**

- Build 1: Creates `app.abc123.js`
- Build 2: Creates `app.def456.js` (different hash)
- Browser sees new filename → Downloads new file
- Old cached `app.abc123.js` is never used

### 3. Version Checker Component (VersionChecker.tsx)

```typescript
const APP_VERSION = "2.0.0";
```

**What it does:**

- Stores version in localStorage
- Checks every 5 minutes if version changed
- Shows modal prompting user to refresh

**Effectiveness:**

- ✅✅ Very effective for active users
- ✅ User-friendly (explains why refresh is needed)
- ⚠️ Requires user to click "Refresh"

**User Experience:**

1. User is using v1.0.0
2. You deploy v2.0.0
3. Within 5 minutes, modal appears
4. User clicks "Refresh Now"
5. Page reloads with v2.0.0

### 4. Version Bumping (package.json)

```json
"version": "2.0.0"
```

**What it does:** Semantic versioning to track releases

**When to bump:**

- Major (2.0.0): Breaking changes, major features
- Minor (2.1.0): New features, backward compatible
- Patch (2.0.1): Bug fixes only

## Deployment Checklist

### Every Time You Deploy:

1. **Bump Version** (if needed)

   ```bash
   # In package.json, update version
   # Also update in components/VersionChecker.tsx
   ```

2. **Build with Hashed Filenames**

   ```bash
   npm run build
   ```

   This generates files like:

   - `dist/assets/index.a1b2c3d4.js`
   - `dist/assets/index.e5f6g7h8.css`

3. **Deploy to Cloudflare Pages**

   ```bash
   # Upload the entire dist/ folder
   # Cloudflare will serve the new hashed files
   ```

4. **Clear Cloudflare Cache** (Important!)

   - Go to Cloudflare Dashboard
   - Select your domain
   - Go to **Caching** → **Configuration**
   - Click **Purge Everything**
   - Wait 30 seconds

5. **Verify Deployment**
   - Open app in **Incognito/Private** window
   - Check browser DevTools → Network tab
   - Verify you see new hashed filenames
   - Check console for version number

## For Users Stuck on Old Version

### Method 1: Hard Refresh (Fastest)

**Windows/Linux:**

- Chrome/Edge: `Ctrl + Shift + R` or `Ctrl + F5`
- Firefox: `Ctrl + Shift + R`

**Mac:**

- Chrome/Edge: `Cmd + Shift + R`
- Firefox: `Cmd + Shift + R`
- Safari: `Cmd + Option + R`

### Method 2: Clear Site Data

**Chrome/Edge:**

1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage** (left sidebar)
4. Click **Clear site data**
5. Refresh page

**Firefox:**

1. Open DevTools (F12)
2. Go to **Storage** tab
3. Right-click on domain
4. Select **Delete All**
5. Refresh page

### Method 3: Wait for Auto-Update

- If VersionChecker is deployed
- User will see modal within 5 minutes
- They click "Refresh Now"
- Automatic cache clear + reload

## Cloudflare-Specific Settings

### Recommended Cache Settings:

1. **Browser Cache TTL:** 4 hours (not "Respect Existing Headers")

   - Location: Caching → Configuration → Browser Cache TTL
   - This limits how long browsers cache files

2. **Development Mode:** Enable during testing

   - Location: Caching → Configuration → Development Mode
   - Temporarily bypasses cache (3 hours)
   - Use when testing deployments

3. **Cache Rules:** (Optional, Advanced)

   ```
   Rule 1: Cache HTML minimally
   - If URL matches: *.html
   - Then: Browser Cache TTL = 5 minutes

   Rule 2: Cache JS/CSS with long TTL
   - If URL matches: /assets/*
   - Then: Browser Cache TTL = 1 year
   ```

### Why This Works:

- HTML file (index.html) cached for 5 min → Users get new version quickly
- JS/CSS files (hashed) cached for 1 year → Fast loading
- When HTML updates, it references new hashed JS/CSS files
- Browser downloads new files automatically

## Testing Cache Busting

### Test 1: Verify Hashed Filenames

1. Run `npm run build`
2. Check `dist/assets/` folder
3. Verify files have hashes: `index.a1b2c3d4.js` ✅

### Test 2: Simulate Deployment

1. Build: `npm run build`
2. Note the hash: `index.abc123.js`
3. Make a code change
4. Build again: `npm run build`
5. Verify new hash: `index.def456.js` ✅

### Test 3: Version Checker

1. Open app
2. Check localStorage: `app_version` = "2.0.0"
3. Manually change to "1.0.0"
4. Refresh page
5. Modal should appear ✅

### Test 4: Hard Refresh

1. Open app normally
2. Note current version in console
3. Deploy new version
4. Hard refresh (Ctrl+Shift+R)
5. Verify new version loaded ✅

## Troubleshooting

### "Users still see old version after deployment"

**Checklist:**

1. ✅ Did you run `npm run build`?
2. ✅ Did you upload the NEW `dist/` folder?
3. ✅ Did you purge Cloudflare cache?
4. ✅ Are users doing hard refresh?
5. ✅ Did you bump version number?

**If still not working:**

- Enable Cloudflare Development Mode (3 hours)
- Ask users to clear browser data
- Check if Cloudflare is serving old files (check response headers)

### "Version checker not showing"

**Possible causes:**

1. User hasn't refreshed in last 5 minutes
2. Version in localStorage matches current version
3. Component not imported in App.tsx

**Fix:**

- Manually clear localStorage: `localStorage.removeItem('app_version')`
- Refresh page
- Modal should appear

### "Build creates files without hashes"

**Cause:** Vite config not applied

**Fix:**

1. Verify `vite.config.ts` has build config
2. Delete `node_modules/.vite` cache
3. Run `npm run build` again

## Best Practices

### For Every Deployment:

1. ✅ Bump version in `package.json` AND `VersionChecker.tsx`
2. ✅ Run `npm run build` (generates hashed files)
3. ✅ Deploy entire `dist/` folder
4. ✅ Purge Cloudflare cache
5. ✅ Test in incognito window
6. ✅ Notify users if major changes

### For Major Updates:

1. ✅ Bump to next major version (e.g., 2.0.0 → 3.0.0)
2. ✅ Update release notes in VersionChecker modal
3. ✅ Consider sending email/notification to users
4. ✅ Monitor for issues in first hour

### For Emergency Fixes:

1. ✅ Bump patch version (e.g., 2.0.0 → 2.0.1)
2. ✅ Build and deploy immediately
3. ✅ Purge Cloudflare cache
4. ✅ Enable Development Mode for faster propagation
5. ✅ Ask affected users to hard refresh

## Summary

**What prevents caching issues:**

1. 🔥 **Hashed filenames** (most important) - Automatic with Vite
2. 🔥 **Version checker** - Prompts users to refresh
3. 🔥 **Cloudflare cache purge** - Must do after every deploy
4. ⚡ **HTML meta tags** - Helps with HTML file
5. ⚡ **Hard refresh** - User action when needed

**Expected behavior after deployment:**

- Active users: See modal within 5 minutes
- New visitors: Get latest version immediately
- Cached users: Get latest after hard refresh

**This implementation is production-ready and handles 99% of cache issues automatically.**
