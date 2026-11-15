# Saathi

Saathi is a phone-first shop book for small shops and stalls. It helps an owner record sales, keep stock straight, follow customer credit, and see estimated gross profit without typing through a complicated point-of-sale system.

## Two shop versions

- **Satyam Bhaiya's shop:** open the `/satyam/` link. It always opens his personal edition and starts with his name. His actual item list, prices, customers and sales are entered by him and stay on his phone.
- **Community shop:** open the `/shop/` link. It always opens a clean "My Shop" edition for another shop owner.

Each link is locked to its own edition. A shop book or backup from one edition cannot be opened from the other link. Sharing the hosted link does not share anyone's shop records.

## Included

- Large tap targets and a short bottom menu for phones
- Sales, customer credit, payment entries, stock counts and per-item margin estimates
- Dark mode, English and Hindi labels, and a soft pointer-responsive shop-color background
- A header language switch and phone-first voice drafts using the phone keyboard microphone, with an editable transcript and confirmation before saving
- Offline use and install-to-home-screen support
- Encrypted on-device storage, PIN lock, encrypted backup and restore
- Monthly CSV download for a budget or spreadsheet
- Clear checks for stock, payments, high amounts and price/cost mistakes
- A free tier and two clearly marked future plan proposals (no payments or cloud sync are active)

## Privacy and safety

Only the static app files are sent to GitHub Pages. Sales, customer names, inventory and amounts are encrypted separately in each browser using AES-GCM with a key derived from the owner's PIN. The app does not send shop data to a server. Different browsers do not share or sync records. To transfer records, download the encrypted backup from More in the source browser, then restore it in the same shop edition in the other browser with the same PIN. The encrypted backup can only be restored with the PIN. The monthly CSV is intentionally readable, so the app asks the owner to keep it private.

This is a local-first prototype, not a security-certified accounting product. Device malware, someone who knows the PIN, clearing browser storage, or losing the PIN without an encrypted backup can still affect records. Keep the phone locked and save a backup somewhere safe. Saathi is not a bank, tax advisor, or payment processor.

Voice entry is designed for phones: tap Dictate, open the text field, then use the microphone on the phone keyboard. Keyboard voice typing follows the keyboard or device provider privacy settings. Saathi does not store audio. An optional in-app microphone uses browser speech recognition and may be unavailable on some phones. Transcripts can be edited; entries require review and confirmation before being saved. Saathi is installable as a standalone PWA from its hosted HTTPS link; once installed, it opens without browser controls.

## GitHub Pages

The GitHub Actions workflow in `.github/workflows/pages.yml` publishes the static files whenever `main` is updated. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source. GitHub Pages is free for public repositories on GitHub Free; the repository and app source will therefore be public, but shop records are not part of the source or deployment.

The site has two clean edition links:

- `https://<your-github-name>.github.io/<repository-name>/satyam/` — Satyam Bhaiya's personal shop setup.
- `https://<your-github-name>.github.io/<repository-name>/shop/` — a fresh "My Shop" setup for any shop owner.
- `https://<your-github-name>.github.io/<repository-name>/satyam/demo/` — a public, read-only panel showcase with fictional sample figures, separate from Satyam Bhaiya’s personal shop book.

The first two links open the app with separate encrypted shop books on the device. The demo link opens sample figures only; its data is generated locally for display, is not saved or uploaded, and cannot change personal shop records.
