# co-campus

Turn photos of whiteboards, lecture slides, and PDF documents into organized, searchable AI study hubs.

co-campus is a React Native / Expo (TypeScript) mobile application designed to streamline student study workflows. It leverages vision-capable LLMs to extract structured summaries, topic breakdowns, action items, flashcards, and curated YouTube explainer videos from handwritten or printed class materials, automatically filing everything into subject folders.

---

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Prerequisites](#installation--prerequisites)
- [Environment Setup & Security](#environment-setup--security)
- [Running the Application](#running-the-application)
- [Database Schema](#database-schema-firestore)
- [Demo & Testing Script](#demo--testing-script)
- [License](#license)

---

## Key Features

- **Multi-Format Input** — Capture study material using the device camera, photo gallery, or upload PDF files and documents directly.
- **AI Vision Extraction** — Uses GPT-4o-mini vision capabilities to parse notes into a strictly structured JSON schema containing:
  - A 150–300 word cohesive study summary
  - Categorized topic breakdowns with bulleted concepts
  - Actionable tasks with detected due dates
  - Best-effort OCR text transcripts
- **Automated Flashcard Generation** — Generates approximately 8 high-yield question-and-answer study cards per set for self-testing.
- **Targeted YouTube Video Search** — Queries YouTube Data API v3 (`search.list`) for the top 3 relevant explainer videos per extracted topic.
- **Smart Auto-Foldering** — Automatically infers the academic subject (e.g., Calculus II, Data Structures) and groups notes into subject folders without manual organization.
- **Zero Re-Fetch Persistence** — Saves extracted notes, flashcards, and video recommendations in Firebase Firestore under anonymous user IDs. Reopening saved notes loads instantly from cache with zero redundant API calls.
- **Modern Dark UI** — Clean dark interface built with custom React Native primitives.

---

## Tech Stack

| Category | Technology |
|---|---|
| Mobile Framework | React Native, Expo SDK 51, TypeScript |
| State & Data Layer | Firebase Firestore, Firebase Anonymous Auth, Async Storage |
| AI & Integration APIs | OpenAI Chat Completions API (`gpt-4o-mini`), YouTube Data API v3 |
| Native Utilities | `expo-image-picker`, `expo-document-picker`, `expo-file-system` |

---

## Project Structure

```text
co-campus/
├── .env                     # Local environment variables (git-ignored)
├── assets/                  # App icons, splash screens, and images
├── services/                # Core business logic and API integrations
│   ├── firebase.ts          # Firebase Auth & Firestore initialization
│   ├── storage.ts           # Firestore helper functions & slugification logic
│   ├── llm.ts               # Vision OCR & flashcard generation pipeline
│   └── youtube.ts           # YouTube Data API v3 client
├── screens/                 # Application screen components
│   ├── HomeScreen.tsx       # Subject folders & saved notes dashboard
│   ├── CaptureScreen.tsx    # Camera, photo, and PDF picker pipeline
│   └── ResultsScreen.tsx    # 5-tab study material viewer
├── types/                   # Strict TypeScript type definitions
│   └── index.ts
├── App.tsx                  # Root entry point and screen routing
├── package.json
└── README.md
```

---

## Installation & Prerequisites

### 1. Prerequisites

Before setting up co-campus, ensure you have the following installed on your machine:

- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher) or yarn
- Expo Go installed on your iOS (App Store) or Android (Play Store) device for testing, or an initialized simulator (Xcode / Android Studio)

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/co-campus.git
cd co-campus
```

### 3. Install Dependencies

```bash
npm install
```

---

## Environment Setup & Security

### Creating the .env File

In Expo, local secret keys and environment variables are stored in a file named `.env` placed directly in the root directory of the project (in the same folder as `package.json` and `App.tsx`).

**Why a .env file:**

- **Source control security** — Keeping secrets inside `.env` prevents API keys from being hardcoded into commits or published to public repositories.
- **Environment separation** — Allows individual developers to swap in their own credentials or switch between staging and production without changing application code.

### Step-by-Step Setup

1. Open a terminal in the root folder of co-campus.
2. Create the file:

   ```bash
   touch .env
   ```

3. Populate it with your credentials:

   ```
   # Firebase Configuration
   EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

   # AI & External API Keys
   EXPO_PUBLIC_LLM_API_KEY=your_openai_api_key_here
   EXPO_PUBLIC_YOUTUBE_API_KEY=your_youtube_data_api_v3_key_here
   ```

### Security Note: Expo Client-Side Keys (EXPO_PUBLIC_*)

**How EXPO_PUBLIC_ variables work**

In Expo SDK 49 and newer, environment variables intended for use within mobile JavaScript code must start with the prefix `EXPO_PUBLIC_`. When you run `npx expo start` or build the application binary, Expo reads these variables and bakes their literal values into the compiled JavaScript bundle delivered to the app runtime.

**The security risk**

Because `EXPO_PUBLIC_*` variables are embedded directly into the compiled app bundle:

- They are visible on the client side. Anyone who downloads the app binary or inspects network traffic can decompile the JavaScript bundle and extract `EXPO_PUBLIC_LLM_API_KEY` or `EXPO_PUBLIC_YOUTUBE_API_KEY`.
- An attacker could steal OpenAI or YouTube API keys and issue requests on your account, leading to unexpected billing charges or rate-limit exhaustion.

**Why client-side keys are acceptable for this build**

For a demo build, hackathon project, or local prototype, storing keys in `EXPO_PUBLIC_*` is acceptable because it eliminates the complexity of setting up and paying for backend server infrastructure during early development.

**Production migration strategy**

Before releasing co-campus to the iOS App Store or Google Play Store, migrate sensitive API calls behind a secure backend:

1. **Move LLM and YouTube calls to Cloud Functions** — Set up Firebase Cloud Functions (or a Node.js/Express server). Move the calls in `services/llm.ts` and `services/youtube.ts` into backend HTTP endpoints.
2. **Store keys on the server** — Store secret keys inside server environment variables (e.g., Firebase Secret Manager or AWS Parameter Store), never prefixed with `EXPO_PUBLIC_`.
3. **Authenticate client requests** — Have the co-campus mobile app make authenticated HTTPS requests to your Cloud Functions. The backend verifies the user's Firebase Auth token and executes the API requests securely without ever exposing keys to the mobile device.

---

## Running the Application

1. **Verify .gitignore** — Ensure `.env` is listed inside `.gitignore` so local credentials are never tracked by git.
2. **Start the Expo server** — Clear cache when launching after creating or editing `.env`:

   ```bash
   npx expo start -c
   ```

3. **Open on device or simulator:**
   - Physical device: Open Expo Go (Android) or the native Camera app (iOS) and scan the QR code printed in the terminal.
   - iOS Simulator: Press `i` in the terminal.
   - Android Emulator: Press `a` in the terminal.

---

## Database Schema (Firestore)

```text
users/{userId}
   └── subjects/{subjectSlug}   [Document]
          ├── id: string (e.g., "calculus-ii")
          ├── name: string (e.g., "Calculus II")
          ├── noteCount: number
          └── updatedAt: timestamp
          │
          └── notes/{noteId}   [Document]
                ├── id: string
                ├── createdAt: timestamp
                ├── subject: string
                ├── subjectSlug: string
                ├── title: string
                ├── extraction: { subject, title, topics[], tasks[], rawText, generatedNotes }
                ├── flashcards: [{ question, answer }]
                └── topicVideos: [{ heading, videos: [{ id, title, thumbnail, channelTitle }] }]
```

---

## Demo & Testing Script

1. **Launch co-campus** — The app logs in anonymously behind the scenes and loads the HomeScreen.
2. **Scan material** — Tap "Scan Notes" and choose Camera, Photos, or Files & PDFs.
3. **Pipeline stages** — Monitor the loading states:
   - "Reading your notes..." (Vision API)
   - "Generating flashcards..." (LLM flashcard generation)
   - "Finding relevant videos..." (YouTube Data API v3)
   - "Filing note in subject folder..." (Firestore persistence)
4. **Review results** — Explore the generated note tabs: Notes, Topics, Tasks, Flashcards (tap to flip), and Videos (tap thumbnail to open YouTube).
5. **Verify re-open performance** — Tap "Done" to return to the home screen, open the newly created subject folder, and select the saved note. It renders instantly without invoking any API calls.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
