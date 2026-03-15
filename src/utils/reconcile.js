export const DEFAULT_COMMISSION_PCT = 30;
export const DEFAULT_TOLERANCE = 1;

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const normalizeOrderId = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const parseCurrency = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? '').trim();

  if (!raw) {
    return 0;
  }

  const normalized = raw
    .replace(/\((.*)\)/, '-$1')
    .replace(/[^0-9,.\-]/g, '');

  let cleaned = normalized;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    cleaned = /^-?\d+,\d{1,2}$/.test(cleaned) ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  }

  const numeric = Number(cleaned);

  if (Number.isNaN(numeric)) {
    return 0;
  }

  return numeric;
};

const buildPayoutMap = (rows, mapping) => {
  const byId = new Map();

  rows.forEach((row) => {
    const orderId = normalizeOrderId(row[mapping.orderId]);
    if (orderId) {
      byId.set(orderId, row);
    }
  });

  return byId;
};

const classifyIssue = ({
  hasPayout,
  actualCommission,
  expectedCommission,
  actualNet,
  expectedNet,
  tolerance,
}) => {
  if (!hasPayout) {
    return ['Missing in payout'];
  }

  const issues = [];

  if (Math.abs(actualCommission - expectedCommission) > tolerance) {
    issues.push('Commission mismatch');
  }

  if (Math.abs(actualNet - expectedNet) > tolerance) {
    issues.push('Net payout mismatch');
  }

  return issues;
};

export const reconcileOrders = ({
  posRows,
  payoutRows,
  posMapping,
  payoutMapping,
  expectedCommissionPct = DEFAULT_COMMISSION_PCT,
  tolerance = DEFAULT_TOLERANCE,
}) => {
  const payoutById = buildPayoutMap(payoutRows, payoutMapping);
  const fullRows = [];
  const issues = [];
  const issueCounter = new Map();
  let estimatedLeakage = 0;

  posRows.forEach((posRow) => {
    const rawOrderId = posRow[posMapping.orderId];
    const normalizedOrderId = normalizeOrderId(rawOrderId);

    if (!normalizedOrderId) {
      return;
    }

    const grossSales = roundCurrency(parseCurrency(posRow[posMapping.grossSales]));
    const expectedCommission = roundCurrency(grossSales * (expectedCommissionPct / 100));
    const expectedNet = roundCurrency(grossSales - expectedCommission);
    const payoutRow = payoutById.get(normalizedOrderId);
    const payoutGross = payoutRow
      ? roundCurrency(
          parseCurrency(
            payoutMapping.grossSales ? payoutRow[payoutMapping.grossSales] : grossSales,
          ) || grossSales,
        )
      : grossSales;

    let commission = payoutRow ? roundCurrency(parseCurrency(payoutRow[payoutMapping.commission])) : 0;
    let netPayout = payoutRow ? roundCurrency(parseCurrency(payoutRow[payoutMapping.netPayout])) : 0;

    if (payoutRow && !commission && payoutGross) {
      commission = roundCurrency(payoutGross - netPayout);
    }

    if (payoutRow && !netPayout && payoutGross) {
      netPayout = roundCurrency(payoutGross - commission);
    }

    const netVariance = roundCurrency(netPayout - expectedNet);
    const issueTypes = classifyIssue({
      hasPayout: Boolean(payoutRow),
      actualCommission: commission,
      expectedCommission,
      actualNet: netPayout,
      expectedNet,
      tolerance,
    });

    const status = issueTypes.length ? issueTypes.join(' / ') : 'Matched';
    const record = {
      orderId: String(rawOrderId || '').trim(),
      grossSales,
      commission,
      expectedCommission,
      netPayout,
      expectedNet,
      netVariance,
      status,
    };

    fullRows.push(record);

    if (issueTypes.length) {
      issues.push(record);
      estimatedLeakage += Math.max(0, roundCurrency(expectedNet - netPayout));
      issueTypes.forEach((issueType) => {
        issueCounter.set(issueType, (issueCounter.get(issueType) || 0) + 1);
      });
    }
  });

  const sortedIssueTypes = [...issueCounter.entries()].sort((a, b) => b[1] - a[1]);
  const topIssueType = sortedIssueTypes.length ? sortedIssueTypes[0][0] : 'None';

  return {
    summary: {
      ordersAnalyzed: fullRows.length,
      issuesFound: issues.length,
      estimatedLeakage: roundCurrency(estimatedLeakage),
      topIssueType,
    },
    issues,
    fullRows,
  };
};
