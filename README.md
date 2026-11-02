# ⚙️ JobConcierge Backend API (NestJS)

This is the core engine of the application. It connects to the Supabase PostgreSQL database, handles user authentication, and uses Puppeteer to generate ATS-optimized PDF resumes.

## 🛠 Local Development
1. Open the terminal in this folder.
2. Run `npm install`.
3. Create a `.env` file in the root directory and add your database and AI keys:
   \`\`\`env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_SUPABASE_URL:5432/postgres"
   GEMINI_API_KEY="your-gemini-key"
   NODE_ENV="development"
   PORT=3001
   \`\`\`
4. Run `npm run start:dev` to start the server.

##   Production Build (Namecheap Deployment)
Because NestJS uses TypeScript, it **must** be compiled into JavaScript before it goes to the server.

### Step 1: Create the Build
Run this command in the terminal:
\`\`\`bash
npm run build
\`\`\`
This creates a **`dist`** folder containing the compiled application.

### Step 2: Package for Namecheap
Zip the following files/folders into a single `.zip` file:
1. The `dist` folder
2. `package.json`
3. `package-lock.json`
4. Your production `.env` file (Make sure `NODE_ENV="production"` is set).
*(Do NOT include the `node_modules` or `src` folders!)*

### Step 3: cPanel Setup Instructions
1. Upload and extract the `.zip` file into a private folder on the server (NOT in `public_html`).
2. Go to **Setup Node.js App** in cPanel.
3. Create a new application:
   - **Node.js Version:** 18.x or 20.x
   - **Application Mode:** Production
   - **Application Root:** The folder where you extracted the zip.
   - **Application Startup File:** `dist/main.js`
4. Click **"Run NPM Install"** in the cPanel interface.
5. Click **"Start App"**.

### ⚠️ IMPORTANT: The Puppeteer Warning
This backend uses **Puppeteer** to generate PDFs, which requires Google Chrome to run on the server. If this is Namecheap **Shared Hosting**, PDF generation will likely crash because shared hosting blocks Chrome installations. If this happens, the team will need to swap Puppeteer for a cloud browser API (like Browserless.io) or upgrade to a Namecheap VPS.