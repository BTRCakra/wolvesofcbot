require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.static('public'));

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function getData(range) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range
  });

  return res.data.values || [];
}

app.get('/api/vault', async (req, res) => {
  const data = await getData("Vault!A2:F");
  res.json(data);
});

app.get('/api/inventory', async (req, res) => {
  const data = await getData("Inventory!A2:F");
  res.json(data);
});

app.get('/api/conflict', async (req, res) => {
  const data = await getData("Conflict!A2:F");
  res.json(data);
});

app.listen(3000, () => {
  console.log("🌐 Dashboard running on http://localhost:3000");
});