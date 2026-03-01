require('dotenv').config();
const { google } = require('googleapis');

const SHEET_ID = {
  Members: 1346601628,
  Inventory: 1048319064,
  Conflict: 1422891271
};

// ================= AUTH =================
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// ================= INIT SHEETS =================
const sheets = google.sheets({ version: 'v4', auth });

// ================= GET DATA =================
async function getData(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range
  });

  return res.data.values || [];
}

// ================= APPEND =================
async function appendData(range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values]
    }
  });
}

// ================= UPDATE ROW =================
async function updateRow(range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: values
    }
  });
}

// ================= GET NEXT ID =================
async function getNextId(range, prefix) {
  const rows = await getData(range);
  const nextNumber = rows.length + 1;
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

// ================= VAULT TOTAL =================
async function getVaultTotal() {
  const rows = await getData("Vault!D2:D");
  return rows.reduce((sum, row) => {
    const value = parseInt(row[0]);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
}

// ================= DELETE ROW =================
async function deleteRow(range) {
  const sheetName = range.split("!")[0];
  const rowNumber = range.match(/\d+/)[0];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: SHEET_ID[sheetName],
              dimension: "ROWS",
              startIndex: parseInt(rowNumber) - 1,
              endIndex: parseInt(rowNumber)
            }
          }
        }
      ]
    }
  });
}
// ================= EXPORT =================
module.exports = {
  appendData,
  getNextId,
  getVaultTotal,
  getData,
  updateRow,
  deleteRow
};
