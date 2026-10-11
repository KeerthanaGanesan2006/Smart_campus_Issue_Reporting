# Smart Campus Issue Reporting — CampusCare

A beginner-friendly full-stack project using HTML, CSS, JavaScript, Node.js, Express and MongoDB.

## Pages included
1. `index.html` — login and student registration
2. `student.html` — student dashboard and quick summary
3. `report.html` — submit complaint, choose category/location/priority, upload image
4. `my-complaints.html` — search and track complaints
5. `admin.html` — overview, analytics, assign staff and update status
6. `staff.html` — view assigned complaints and update status

The frontend shares **one CSS file** (`public/style.css`) and **one JavaScript file** (`public/app.js`). `server.js` is the backend API.

## Requirements
- Node.js LTS installed
- MongoDB Community Server running locally, or a MongoDB Atlas connection string

## Step 1 — Extract and open
Extract the ZIP. Open the `Smart_Campus_Issue_Reporting` folder in VS Code.

## Step 2 — Install packages
Open the VS Code terminal in the project folder and run:
```bash
npm install
```

## Step 3 — Configure environment
Copy `.env.example` to a new file named `.env`.
Set `JWT_SECRET` to a long random string. To create admin/staff accounts, also add:
```env
SETUP_KEY=make_this_a_long_private_setup_key
```
If MongoDB is not local, replace `MONGODB_URI` with your Atlas connection string. Keep `.env` private and never upload it to GitHub.

## Step 4 — Start MongoDB
For a local MongoDB installation, start the MongoDB Server service in Windows Services. The default connection is:
`mongodb://127.0.0.1:27017/smart_campus`

If using Atlas, make sure your IP is allowed in Atlas Network Access and your database username/password are correct.

## Step 5 — Start the backend
In the project folder terminal:
```bash
npm start
```
You should see `MongoDB connected.` and `Server running at http://localhost:5000`.
Open **http://localhost:5000** in your browser. Do not double-click the HTML file; use the server URL.

## Step 6 — Create a student
On the login page, choose **Create student account**. Student registration is open for this demo.

## Step 7 — Create an admin account and staff account
Use the following example from PowerShell, changing the key/passwords and emails to your own. Ensure `SETUP_KEY` is in `.env` and restart the server after editing `.env`.

Create admin:
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/setup/create-role-user -Headers @{"x-setup-key"="make_this_a_long_private_setup_key"} -ContentType "application/json" -Body '{"name":"Campus Admin","email":"admin@campus.test","password":"Admin123!","role":"admin"}'
```

Create staff:
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/setup/create-role-user -Headers @{"x-setup-key"="make_this_a_long_private_setup_key"} -ContentType "application/json" -Body '{"name":"Maintenance Staff","email":"staff@campus.test","password":"Staff123!","role":"staff"}'
```

Then sign in with those accounts at `http://localhost:5000`. These are examples only; change the passwords. The setup endpoint is for a local college demo only; disable/remove it before deployment.

## Project workflow
Student registers/logs in → submits a report → Express validates and saves it in MongoDB → admin sees all reports → admin assigns staff → staff updates status → student tracks the updated status.

## Troubleshooting
- **Failed to fetch:** Open the app through `http://localhost:5000`, not by opening HTML directly. Check the terminal for server errors.
- **MongoDB connection failed:** Start MongoDB service or verify `MONGODB_URI`.
- **Port already in use:** Change `PORT=5001` in `.env`, then open `http://localhost:5001`.
- **Image upload rejected:** Use an image under 4 MB.
- **Admin cannot see staff:** Create at least one staff account using Step 7.
- **Forgot to create `.env`:** Copy `.env.example` and rename the copy to `.env` (make sure it is not `.env.txt`).

## API routes
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/complaints`
- `GET /api/complaints`
- `GET /api/users/staff` (admin)
- `PATCH /api/complaints/:id/assign` (admin)
- `PATCH /api/complaints/:id/status` (admin/staff)
- `GET /api/analytics` (admin)

## Important note
This is a learning/demo project, not a production-ready campus reporting service. Before real deployment, add stricter rate limiting, audit logs, file scanning, email/in-app notifications, secure secret management, and review the setup endpoint and permissions.
