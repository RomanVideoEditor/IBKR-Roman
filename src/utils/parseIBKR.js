// src/utils/parseIBKR.js

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

export function parseIBKRCsv(csvText) {
  const sections = {};
  for (const line of csvText.split('\n')) {
    const fc = line.indexOf(',');
    if (fc < 0) continue;
    const name = line.substring(0, fc).trim();
    const rest = line.substring(fc + 1);
    if (!name) continue;
    if (!sections[name]) sections[name] = [];
    sections[name].push(rest);
  }

  function getDataRows(lines) {
    if (!lines) return [];
    const header = lines.find(l => l.startsWith('Header,'));
    if (!header) return [];
    const cols = parseCsvLine(header).slice(1);
    return lines.filter(l => l.startsWith('Data,')).map(row => {
      const vals = parseCsvLine(row).slice(1);
      const obj = {};
      cols.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  }

  // Period dates
  let periodStart = null, periodEnd = null;
  for (const line of (sections['Statement'] || [])) {
    if (line.includes('Period')) {
      const matches = [...line.matchAll(/(\w+ \d+, \d{4})/g)];
      if (matches.length >= 2) {
        periodStart = new Date(matches[0][1]);
        periodEnd = new Date(matches[1][1]);
      } else if (matches.length === 1) {
        periodEnd = new Date(matches[0][1]);
      }
    }
  }

  // NAV data
  let navStart = 0, navEnd = 0, twr = 0;
  for (const line of (sections['Net Asset Value'] || [])) {
    if (line.includes('Total') && line.startsWith('Data,')) {
      const cols = parseCsvLine(line).slice(1);
      navStart = parseFloat(cols[1]) || 0;
      navEnd = parseFloat(cols[3]) || 0;
    }
    if (line.startsWith('Data,') && line.includes('%')) {
      const cols = parseCsvLine(line).slice(1);
      const twrStr = cols[0] || cols[1] || '';
      twr = parseFloat(twrStr.replace('%', '')) || 0;
    }
  }

  // Positions
  const positions = getDataRows(sections['Open Positions']);

  // Trades
  const trades = getDataRows(sections['Trades']);

  // Cash
  let cashBalance = 0;
  for (const line of (sections['Cash Report'] || [])) {
    if (line.includes('Ending Cash') && line.includes('Base Currency Summary')) {
      const cols = parseCsvLine(line);
      cashBalance = parseFloat(cols[3]) || 0;
      break;
    }
  }

  // Deposits
  let totalDeposited = 0;
  const depositRows = [];
  for (const line of (sections['Deposits & Withdrawals'] || [])) {
    if (line.includes('Total in USD')) {
      const cols = parseCsvLine(line);
      totalDeposited = parseFloat(cols[cols.length - 1]) || 0;
    }
    if (line.startsWith('Data,') && !line.includes('Total')) {
      const cols = parseCsvLine(line).slice(1);
      // Currency, Date, Description, Amount
      if (cols[0] !== 'Total in USD' && cols[1] && cols[3]) {
        const amt = parseFloat(cols[3]);
        if (!isNaN(amt) && cols[0] !== 'Total') {
          depositRows.push({ date: cols[1], currency: cols[0], amount: amt });
        }
      }
    }
  }

  return { positions, trades, cashBalance, totalDeposited, depositRows, periodStart, periodEnd, navStart, navEnd, twr };
}

export function extractPositions(rawPositions) {
  return rawPositions
    .filter(r => r['Symbol'] && r['Symbol'] !== 'Symbol' && r['DataDiscriminator'] === 'Summary')
    .map(r => ({
      symbol: r['Symbol']?.trim(),
      quantity: parseFloat(r['Quantity'] || 0),
      avgCost: parseFloat(r['Cost Price'] || 0),
      marketValue: parseFloat(r['Value'] || 0),
      unrealizedPnl: parseFloat(r['Unrealized P/L'] || 0),
      currency: r['Currency']?.trim() || 'USD',
      assetClass: r['Asset Category'] || 'Stocks',
    }))
    .filter(p => p.symbol && p.quantity !== 0);
}

export function extractTrades(rawTrades) {
  return rawTrades
    .filter(r => r['Symbol'] && r['Symbol'] !== 'Symbol' && r['Date/Time'])
    .map(r => ({
      symbol: r['Symbol']?.trim(),
      dateTime: r['Date/Time']?.trim(),
      quantity: parseFloat(r['Quantity'] || 0),
      price: parseFloat(r['T. Price'] || r['Price'] || 0),
      proceeds: parseFloat(r['Proceeds'] || 0),
      commFee: parseFloat(r['Comm/Fee'] || 0),
      realizedPnl: parseFloat(r['Realized P&L'] || 0),
      currency: r['Currency']?.trim() || 'USD',
      buySell: r['Buy/Sell']?.trim() || (parseFloat(r['Quantity']) > 0 ? 'BUY' : 'SELL'),
    }))
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
}
