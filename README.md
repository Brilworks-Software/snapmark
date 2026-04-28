# SnapMark: Screenshot, Annotate & Share Instantly 🚀

SnapMark is a powerful, lightweight Chrome extension designed for speed and productivity. Capture any part of your screen, add professional annotations, and share instantly via a link—all within seconds.

![SnapMark Banner](https://via.placeholder.com/1200x600?text=SnapMark+Extension)

## ✨ Features

- **Precision Capture**: Select specific regions or capture the entire visible area.
- **Pro Annotation Suite**:
  - **Arrows & Shapes**: Point out details with precision.
  - **Pen Tool**: Free-hand drawing for quick highlights.
  - **Text Tool**: Add clear context with professional typography.
  - **Blur/Redact**: Instantly hide sensitive information.
- **Instant Sharing**: Upload to Supabase Storage and get a shareable link in one click.
- **Copy to Clipboard**: One-click copy for quick pasting into Slack, Discord, or Email.
- **Local History**: Keep track of your last 10 screenshots locally.
- **Privacy First**: No account required. Your data is stored in your own Supabase project.

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3.
- **Backend**: Supabase (Storage & Database).
- **Extension API**: Manifest V3.

## 🚀 Getting Started

### Prerequisites

- A Supabase account and project.
- A public bucket named `screenshots` in your Supabase project.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/snapmark.git
   ```
2. Setup Supabase:
   - Copy `editor/supabase-config.example.js` to `editor/supabase-config.js`.
   - Fill in your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** (top right).
   - Click **Load unpacked** and select the root directory of this project.

## 📂 Project Structure

```text
snapmark/
├── _locales/          # Internationalization
├── background/        # Service worker for screenshot logic
├── content/           # Content scripts for region selection
├── editor/            # Annotation UI and Supabase integration
├── icons/             # Extension icons
├── popup/             # Extension popup menu
├── supabase/          # Database migrations
└── manifest.json      # Extension manifest
```

## 🛡️ Security

- **RLS (Row Level Security)**: Ensure your `screenshots` bucket has appropriate RLS policies for anonymous access if you want public sharing.
- **Config Management**: Your credentials are kept in `supabase-config.js`, which is ignored by Git to prevent leaks.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Built with ❤️ by [Brilworks](https://brilworks.com)
