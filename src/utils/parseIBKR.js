// src/utils/parseIBKR.js
import Papa from 'papaparse';

export function parseIBKRCsv(csvText) {
  const sections = {};
  const lines = csvText.split('\n');
  let currentSection = null;
  let currentLines = [];

  for (const line of lines) {
    const cols = line.split(',');
    const header = cols[0]?.trim();

    if (!header) continue;

    if (header !== currentSection) {
      if (currentSection && currentLines.length > 1) {
        sections[currentSection] = currentLines;
      }
      currentSection = header;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  if (currentSection && currentLines.length > 1) {
    sections[currentSection] = currentLines;
  }

  const positions = parseSection(sections['Open Positions'] || sections['Positions']);
  const trades = parseSection(sections['Trades']);
  const cashReport = parseSection(sections['Cash Report'] || sections['Account Information']);

  return { positions, trades, cashReport };
}

function parseSection(lines) {
  if (!lines || lines.length < 2) return [];
  const csv = lines.join('\n');
  const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return result.data || [];
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
