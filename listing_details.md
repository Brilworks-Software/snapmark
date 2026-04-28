# SnapMark: Chrome Web Store Listing Details

Use the following details to list **SnapMark** on the Chrome Web Store.

---

## 📝 General Information

**Title:** 
SnapMark: Screenshot, Annotate & Share Instantly

**Summary (Max 150 characters):**
Capture any area of your screen, annotate with arrows, shapes, text & blur, then share instantly via link. No login required.

**Detailed Description:**
SnapMark is the fastest way to capture your screen and provide visual feedback. Whether you're a developer reporting a bug, a designer sharing a critique, or a student highlighting research, SnapMark makes it effortless.

**Key Features:**
- 🎯 **Precision Capture**: Select any region or capture the full visible area.
- 🎨 **Pro Annotation Tools**: High-quality arrows, rectangles, circles, and free-hand pen.
- 💬 **Typography**: Add bold text notes to provide context.
- 🔒 **Privacy Blur**: Redact sensitive info (PII, passwords) before sharing.
- 🚀 **Instant Sharing**: Upload directly to your Supabase storage and copy a public link in one click.
- 📋 **Clipboard Ready**: Instantly copy merged images to your clipboard for pasting.
- 📜 **Recent History**: Keep your last 10 captures accessible locally.

---

## 🖼️ Visual Assets

| Asset Type | Requirement | Status |
| :--- | :--- | :--- |
| **Icon** | 128x128 PNG | ✅ Found in `icons/icon128.png` |
| **Screenshot 1** | 1280x800 or 640x400 | ✅ Use `website/assets/hero.png` |
| **Promo Tile** | 440x280 | ⚠️ Needs resize from `hero.png` |

---

## 🛡️ Privacy Policy

Since SnapMark allows users to upload images to a third-party service (Supabase), a privacy policy is required.

**Privacy Policy URL:** `https://your-vercel-domain.com/privacy`

**Draft Text:**
> SnapMark does not collect any personal information. All screenshots captured are stored locally on your device. When you choose to use the "Share" feature, the image is uploaded to a Supabase project configured by the user. SnapMark does not have access to your Supabase credentials or the uploaded data.

---

## ⚙️ Submission Checklist

1. **ZIP the project**: Select all files *except* `.git`, `website`, and `editor/supabase-config.js`.
2. **Upload to Developer Dashboard**: Go to [Chrome Web Store Dev Console](https://chrome.google.com/webstore/devconsole).
3. **Set Permissions**: In the dashboard, justify the use of `activeTab`, `scripting`, and `storage` (already handled in `manifest.json`).
4. **Publish**: Select "Public" or "Unlisted".
