// src/utils/parseIBKR.js

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvToObjects(lines) {
  if (!lines || lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    result.push(obj);
  }
  return result;
}

export function parseIBKRCsv(csvText) {
  const sections = {};
  const lines = csvText.split('\n');
  let currentSection = null;
  let currentLines = [];

  for (const line of lines) {
    const firstComma = line.indexOf(',');
    const header = firstComma >= 0 ? line.substring(0, firstComma).trim() : line.trim();
    if (!header) continue;

    if (header !== currentSection) {
      if (currentSection && currentLines.length > 1) {
        sections[currentSection] = currentLines;
      }
      currentSection = header;
      currentLines = [line.substring(firstComma + 1)];
    } else {
      currentLines.push(line.substring(firstComma + 1));
    }
  }
  if (currentSection && currentLines.length > 1) {
    sections[currentSection] = currentLines;
  }

  const positions = parseCsvToObjects(sections['Open Positions'] || sections['Positions'] || []);
  const trades = parseCsvToObjects(sections['Trades'] || []);
  const cashReport = parseCsvToObjects(sections['Cash Report'] || sections['Account Information'] || []);

  return { positions, trades, cashReport };
}

export function extractPositions(rawPositions) {
  return rawPositions
    .filter(row => row['Symbol'] && row['Symbol'] !== 'Symbol')
    .map(row => ({
      symbol: row['Symbol']?.trim(),
      quantity: parseFloat(row['Quantity'] || row['Pos'] || 0),
      avgCost: parseFloat(row['Average Cost'] || row['Avg Cost'] || row['Cost Price'] || 0),
      marketValue: parseFloat(row['Market Value'] || 0),
      unrealizedPnl: parseFloat(row['Unrealized P&L'] || row['Unrealized PNL'] || 0),
      currency: row['Currency']?.trim() || 'USD',
      assetClass: row['Asset Class'] || row['Type'] || 'STK',
    }))
    .filter(p => p.symbol && p.quantity !== 0);
}

export function extractTrades(rawTrades) {
  return rawTrades
    .filter(row => row['Symbol'] && row['Symbol'] !== 'Symbol' && row['Date/Time'])
    .map(row => ({
      symbol: row['Symbol']?.trim(),
      dateTime: row['Date/Time']?.trim(),
      quantity: parseFloat(row['Quantity'] || 0),
      price: parseFloat(row['T. Price'] || row['Price'] || 0),
      proceeds: parseFloat(row['Proceeds'] || 0),
      commFee: parseFloat(row['Comm/Fee'] || row['Commission'] || 0),
      realizedPnl: parseFloat(row['Realized P&L'] || 0),
      currency: row['Currency']?.trim() || 'USD',
      buySell: row['Buy/Sell']?.trim() || (parseFloat(row['Quantity']) > 0 ? 'BUY' : 'SELL'),
    }))
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
}
