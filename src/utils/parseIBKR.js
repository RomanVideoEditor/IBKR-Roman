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
  const lines = csvText.split('\n').map(l => l.replace(/^\uFEFF/, '').trimEnd());

  // Positions — "Open Positions,Data,Summary,Stocks,USD,SYMBOL,qty,mult,costPrice,costBasis,closePrice,value,unrealizedPL"
  const positions = [];
  for (const line of lines) {
    if (!line.startsWith('Open Positions,Data,Summary,Stocks')) continue;
    const cols = parseCsvLine(line);
    // cols: [0]Open Positions [1]Data [2]Summary [3]Stocks [4]USD [5]Symbol [6]Qty [7]Mult [8]CostPrice [9]CostBasis [10]ClosePrice [11]Value [12]UnrealizedPL
    const symbol = cols[5]?.trim();
    const quantity = parseFloat(cols[6]) || 0;
    if (!symbol || quantity === 0) continue;
    positions.push({
      symbol,
      quantity,
      avgCost: parseFloat(cols[8]) || 0,
      marketValue: parseFloat(cols[11]) || 0,
      unrealizedPnl: parseFloat(cols[12]) || 0,
      currency: cols[4]?.trim() || 'USD',
      assetClass: 'Stocks',
    });
  }

  // Trades — "Trades,Data,Order,Stocks,USD,SYMBOL,DATE,..."
  const trades = [];
  for (const line of lines) {
    if (!line.startsWith('Trades,Data,Order')) continue;
    const cols = parseCsvLine(line);
    // cols: [0]Trades [1]Data [2]Order [3]Stocks [4]USD [5]Symbol [6]Date/Time [7]Qty [8]T.Price [9]C.Price [10]Proceeds [11]CommFee [12]Basis [13]RealizedPL [14]MTM [15]Code
    const symbol = cols[5]?.trim();
    const dateTime = cols[6]?.trim();
    if (!symbol || !dateTime) continue;
    trades.push({
      symbol,
      dateTime,
      quantity: parseFloat(cols[7]) || 0,
      price: parseFloat(cols[8]) || 0,
      proceeds: parseFloat(cols[10]) || 0,
      commFee: parseFloat(cols[11]) || 0,
      realizedPnl: parseFloat(cols[13]) || 0,
      currency: cols[4]?.trim() || 'USD',
      buySell: parseFloat(cols[7]) > 0 ? 'BUY' : 'SELL',
    });
  }
  trades.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  // Cash — "Cash Report,Data,Ending Cash,Base Currency Summary,AMOUNT,..."
  let cashBalance = 0;
  for (const line of lines) {
    if (line.startsWith('Cash Report,Data,Ending Cash,Base Currency Summary')) {
      const cols = parseCsvLine(line);
      cashBalance = parseFloat(cols[4]) || 0;
      break;
    }
  }

  // Deposits — "Deposits & Withdrawals,Data,Total in USD,,,AMOUNT"
  let totalDeposited = 0;
  for (const line of lines) {
    if (line.startsWith('Deposits & Withdrawals,Data,Total in USD')) {
      const cols = parseCsvLine(line);
      totalDeposited = parseFloat(cols[cols.length - 1]) || 0;
      break;
    }
  }

  // Period end date from Statement
  let periodEnd = null, periodStart = null;
  for (const line of lines) {
    if (line.startsWith('Statement,Data,Period')) {
      const matches = [...line.matchAll(/(\w+ \d+, \d{4})/g)];
      if (matches.length >= 2) {
        periodStart = new Date(matches[0][1]);
        periodEnd = new Date(matches[1][1]);
      } else if (matches.length === 1) {
        periodEnd = new Date(matches[0][1]);
      }
      break;
    }
  }

  // NAV
  let navStart = 0, navEnd = 0, twr = 0;
  for (const line of lines) {
    if (line.startsWith('Net Asset Value,Data,Total,')) {
      const cols = parseCsvLine(line);
      navStart = parseFloat(cols[2]) || 0;
      navEnd = parseFloat(cols[4]) || 0;
    }
    if (line.startsWith('Net Asset Value,Data,') && line.includes('%') && !line.includes('Total')) {
      const cols = parseCsvLine(line);
      twr = parseFloat((cols[2] || cols[1] || '').replace('%','')) || 0;
    }
  }

  return { positions, trades, cashBalance, totalDeposited, periodStart, periodEnd, navStart, navEnd, twr };
}
