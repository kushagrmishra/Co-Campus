# 🎓 Campus Copilot

> Turn photos of whiteboards, lecture slides, and PDFs into organized, searchable study hubs with AI.

Campus Copilot is a React Native / Expo (TypeScript) mobile application designed for students. It leverages vision-capable LLMs to extract structured summaries, key topics, action items, flashcards, and curated YouTube explainer videos from handwritten or printed class material—auto-filing everything into smart subject folders.

---

## 🚀 Features

* **Multi-Format Input:** Scan using the camera, pick from your photo gallery, or upload PDF files and documents.
* **AI Vision Extraction:** Uses GPT-4o-mini vision capabilities to parse notes into:
  * 150–300 word human-readable written study summaries
  * Categorized topic breakdowns with bullet points
  * Actionable tasks with detected due dates
  * Raw OCR text transcripts
* **Instant Flashcard Generation:** Automatically generates ~8 high-yield study flashcards per note set.
* **YouTube Explainer Integration:** Queries the YouTube Data API v3 for the top 3 relevant explainer videos per topic.
* **Smart Auto-Foldering:** Automatically infers the academic subject (e.g., *Calculus II*, *Data Structures*) and files notes into subject folders without manual organization.
* **Cost-Efficient Local Persistence:** Saves notes, flashcards, and video recommendations in Firebase Firestore. Reopening saved notes loads instantly from local state with **zero redundant API calls**.
* **Dark-Themed Mobile UI:** Sleek dark interface optimized for scanning and reviewing content on mobile devices.

---

## 🛠 Tech Stack

* **Framework:** React Native, Expo SDK 51, TypeScript
* **State & Storage:** Firebase Firestore, Firebase Anonymous Auth, React Native Async Storage
* **AI & Media APIs:** OpenAI API (GPT-4o-mini), YouTube Data API v3
* **Native Modules:** `expo-image-picker`, `expo-document-picker`, `expo-file-system`

---

## 📂 Project Structure

```text
campus-copilot/
├── assets/                  # App icons and splash screens
├── services/                # API integrations & data layer
│   ├── firebase.ts          # Firebase Auth & Firestore init
│   ├── storage.ts           # Firestore helper functions & slugification
│   ├── llm.ts               # Vision OCR & flashcard generation logic
│   └── youtube.ts           # YouTube Data API integration
├── screens/                 # Mobile screen views
│   ├── HomeScreen.tsx       # Subject folders & saved notes list
│   ├── CaptureScreen.tsx    # Camera, photos, and file input pipeline
│   └── ResultsScreen.tsx    # 5-tab study material dashboard
├── types/                   # TypeScript interfaces & strict data schemas
│   └── index.ts
├── .env                     # Local environment variables (git-ignored)
├── App.tsx                  # App entry point & navigation state
├── package.json
└── README.md
