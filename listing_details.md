# SnapMark: Chrome Web Store Submission Details

Use these exact justifications to ensure fast approval and avoid rejection.

---

## 📝 General Information

**Title:** 
SnapMark: Pro Screenshot & Annotation Tool

**Summary (Max 150 characters):**
Fastest free screenshot tool. Capture any area, annotate with arrows, shapes, text & blur, then share instantly via link. No login required.

**Single Purpose Description:**
SnapMark is a dedicated productivity extension for capturing, annotating, and sharing screenshots directly from the browser. It provides a non-destructive markup layer to facilitate visual feedback and communication.

---

## 🔒 Privacy & Permissions Justification

| Permission | Justification for Chrome Reviewers |
| :--- | :--- |
| **`storage`** | Used to store user preferences (stroke color/size) and a local history of the last 10 captures for quick re-editing. Data is stored entirely on the user's device. |
| **`activeTab`** | Required to capture the visual contents of the currently active tab when the user clicks the "Capture" button. Permission is transient and only granted upon user action. |
| **`scripting`** | Necessary to inject a lightweight UI overlay for region selection into the current web page, allowing users to drag and select a capture area. |
| **`tabs`** | Used to open the annotation editor in a new tab immediately after a capture is taken, providing a full-screen workspace for markup. |
| **Host Permissions** | Required to capture screenshots and provide the selection overlay across all websites where the user initiates a capture. |

**Are you using remote code?**
> **No.** All logic and libraries (including Supabase JS) are bundled locally within the extension package to comply with Manifest V3 security policies.

---

## 📊 Data Usage Disclosures

**What user data do you collect?**
- **Website Content**: The extension captures visual screenshots of the pages you visit. This is stored locally and only uploaded if you explicitly use the "Share" feature.
- **User Activity**: Mouse positions and clicks are tracked *only* during the active region selection process to determine the capture coordinates.

**Certifications:**
- ✅ I do not sell or transfer user data to third parties.
- ✅ I do not use or transfer user data for purposes unrelated to the item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 🖼️ Store Assets

- **Privacy Policy URL**: `https://snapmark.brilworks.com/privacy.html`
- **Icon**: `icons/icon128.png`
- **Screenshots**: Use `assets/hero.png` (High-res).

---

## ⚙️ Submission Checklist

1. **Localize Libraries**: ✅ Already done (Supabase JS is now local).
2. **ZIP the project**: Select `background`, `content`, `editor`, `icons`, `popup`, `_locales`, and `manifest.json`. **Exclude** `.git`, `assets`, `index.html`, etc.
3. **Upload**: Go to [Developer Console](https://chrome.google.com/webstore/devconsole).
