# CodeRush 2.0 | Team Project Repository

## Project Information

* **Team Name**: Innov8ors
* **Project Title**: Nexrow Policy-Driven Router & Autonomous Escrow Building the Future of Payments and ensuring the trust and payment between Freelancers and Clients
* **Track/Theme**: Web3 & Blockchain (Algorand Track) / AI Integration (x402 Protocol)

---

## Project Description

### The Challenge
AI agents and decentralized applications frequently need to request and pay for external compute resources, APIs, data queries, or freelance services. However, this creates three significant challenges:
1. **Wallet Exposure (Security)**: Giving an AI agent full access to an unrestricted hot wallet makes it vulnerable. A single prompt injection or bug could drain the entire balance.
2. **Result Verification (Audit)**: How can the agent programmatically verify that a provider actually delivered the correct results before releasing payment?
3. **Route Optimization (Policy)**: How does the agent choose the best provider (latency, price, quality) based on custom business rules?

### The Solution: Nexrow
Nexrow is a policy-driven task router and autonomous settlement protocol that implements the **x402 (HTTP 402 Payment Required)** architecture:
* **Task Decomposition**: Projects are broken down into granular milestones, each with distinct deliverable requirements.
* **x402 Policy Router**: Matches and ranks available service providers (freelancers) based on a selected routing policy (Highest Quality, Lowest Price, Fastest Speed, or Balanced).
* **On-Chain Escrows**: Locks the milestone budget inside a secure **Algorand TEAL Stateful Smart Contract**. Funds are sealed and cannot be accessed by anyone except the target freelancer upon verified completion, or refunded to the client.
* **🤖 Impartial AI Auditor**: Uses **Google Gemini 1.5 Flash** (via browser SDK or n8n workflows) to parse deliverables, read code/text documents, scan image screenshots, evaluate progress against the contract scope, and automatically trigger the smart contract release on-chain in 3 seconds.
* **Web3 Wallet Panel**: Allows users to manage keyphrases, inspect testnet dispenser balances, and audit payment reconciliation ledgers live.

---

## Technical Stack

* **Frontend**: React 18, Vite, Vanilla HSL CSS (Modern responsive design with glassmorphic cards and custom typography).
* **Backend & Contracts**: Algorand TEAL (Transaction Execution Approval Language) Stateful v8 Contracts, `algosdk` for client-side transaction compilation and signing.
* **Database**: Firebase Firestore (real-time collections for contracts, milestones, profiles, providers, and payments).
* **Tools / APIs**: 
  * **Google Gemini 1.5 Flash API** (direct browser-side integration with base64 text/image encoders).
  * **n8n Automation Workflows** (optional workflow hooks using `nexrow-ai-verification.json`).
  * **Vercel CLI** for production hosting.

---

## Setup and Installation

Provide instructions on how to run your project locally:

### 1. Clone the repository
```bash
git clone https://github.com/your-username/nexrow-main.git
cd nexrow-main
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory. Copy and fill in the following configurations:

```env
# Firebase API Credentials
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_PROJECT.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_FIREBASE_MEASUREMENT_ID

# Algorand Testnet Node Credentials
VITE_ALGORAND_NETWORK=testnet
VITE_ALGORAND_NODE_URL=https://testnet-api.algonode.cloud
VITE_ALGORAND_ASSET_ID=10458941

# Option A: Gemini API key for direct browser-side review (Recommended)
# Get a free key at: https://aistudio.google.com/
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Option B: Optional n8n Webhook URL for external workflow reviews
VITE_N8N_WEBHOOK_URL=
```

### 4. Seed Provider Data
Populate the Firestore database with the 20 pre-configured freelancer profiles:
```bash
node seed-freelancers.js
```

### 5. Start the development server
```bash
npm run dev
```

The application will run locally at [http://localhost:5173](http://localhost:5173)  or On Vercel : https://nexrow-main.vercel.app

You can also view the Future Scope Demo at : https://akeel-guhagarkar.github.io/nexrow-ai-escrow/
