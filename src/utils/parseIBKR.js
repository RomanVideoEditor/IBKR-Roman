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
  const rawLines = csvText.split('\n');

  // Parse sections — IBKR format: "SectionName,Header/Data,col1,col2,..."
  for (const line of rawLines) {
    const firstComma = line.indexOf(',');
    if (firstComma < 0) continue;
    const sectionName = line.substring(0, firstComma).trim();
    const rest = line.substring(firstComma + 1);
    if (!sectionName) continue;
    if (!sections[sectionName]) sections[sectionName] = [];
    sections[sectionName].push(rest);
  }

  // For each section, filter to only Data rows and remove the Data/Header discriminator
  function getDataRows(sectionLines) {
    if (!sectionLines) return [];
    const header = sectionLines.find(l => l.startsWith('Header,'));
    const dataRows = sectionLines.filter(l => l.startsWith('Data,'));
    if (!header) return [];
    const headerCols = parseCsvLine(header).slice(1); // remove "Header"
    return dataRows.map(row => {
      const cols = parseCsvLine(row).slice(1); // remove "Data"
      const obj = {};
      headerCols.forEach((h, i) => { obj[h] = cols[i] || ''; });
      return obj;
    });
  }

  const positions = getDataRows(sections['Open Positions']);
  const trades = getDataRows(sections['Trades']);

  // Total deposited: look for "Total in USD" row in Deposits & Withdrawals
  const depositLines = sections['Deposits & Withdrawals'] || [];
  let totalDeposited = 0;
  for (const line of depositLines) {
    if (line.includes('Total in USD')) {
      const cols = parseCsvLine(line);
      const amount = parseFloat(cols[cols.length - 1]);
      if (!isNaN(amount) && amount > 0) {
        totalDeposited += amount;
        break;
      }
    }
  }

  return { positions, trades, totalDeposited };
}

export function extractPositions(rawPositions) {
  return rawPositions
    .filter(row => row['Symbol'] && row['Symbol'] !== 'Symbol' && row['DataDiscriminator'] === 'Summary')
    .map(row => ({
      symbol: row['Symbol']?.trim(),
      quantity: parseFloat(row['Quantity'] || 0),
      avgCost: parseFloat(row['Cost Price'] || 0),
      marketValue: parseFloat(row['Value'] || 0),
      unrealizedPnl: parseFloat(row['Unrealized P/L'] || 0),
      currency: row['Currency']?.trim() || 'USD',
      assetClass: row['Asset Category'] || 'Stocks',
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
