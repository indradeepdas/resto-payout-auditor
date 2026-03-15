const HIGH_CONFIDENCE_THRESHOLD = 80;
const RECOVERY_RECOMMENDATION =
  'Generate the claim pack and submit a dispute to the platform with supporting evidence.';

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeIssueTypes = (status) => {
  const issueTypes = String(status || 'Matched')
    .split('/')
    .map((value) => value.trim())
    .filter(Boolean);

  return issueTypes.length ? issueTypes : ['Matched'];
};

const getPrimaryIssueType = (status) => {
  const issueTypes = normalizeIssueTypes(status);

  if (issueTypes.includes('Missing in payout')) {
    return 'Missing in payout';
  }

  if (issueTypes.includes('Net payout mismatch')) {
    return 'Net payout mismatch';
  }

  if (issueTypes.includes('Commission mismatch')) {
    return 'Commission mismatch';
  }

  return 'Matched';
};

const getRecoveryAttributes = (row, issueType) => {
  const expectedNet = roundCurrency(Number(row.expectedNet || 0));
  const grossSales = roundCurrency(Number(row.grossSales || 0));
  const commissionVariance = roundCurrency(
    Math.abs(Number(row.commission || 0) - Number(row.expectedCommission || 0)),
  );
  const netVariance = roundCurrency(Math.abs(Number(row.netVariance || 0)));

  if (issueType === 'Missing in payout') {
    return {
      recoverability_level: 'high',
      recoverability_score: 90,
      discrepancy_amount_eur: expectedNet || grossSales,
      estimated_recoverable_amount_eur: expectedNet || grossSales,
      suggested_reason: 'Order exists in POS but is missing in platform payout export.',
      suggested_action: 'Submit payout dispute with order evidence.',
    };
  }

  if (issueType === 'Commission mismatch') {
    return {
      recoverability_level: 'medium',
      recoverability_score: 75,
      discrepancy_amount_eur: commissionVariance,
      estimated_recoverable_amount_eur: commissionVariance,
      suggested_reason: 'Commission charged exceeds expected contract logic.',
      suggested_action: 'Request commission adjustment review.',
    };
  }

  if (issueType === 'Net payout mismatch') {
    const isHighConfidence = netVariance > 2;

    return {
      recoverability_level: isHighConfidence ? 'high' : 'medium',
      recoverability_score: isHighConfidence ? 85 : 65,
      discrepancy_amount_eur: netVariance,
      estimated_recoverable_amount_eur: netVariance,
      suggested_reason: 'Actual payout differs from expected payout.',
      suggested_action: 'Submit payout discrepancy claim.',
    };
  }

  return {
    recoverability_level: 'low',
    recoverability_score: 0,
    discrepancy_amount_eur: 0,
    estimated_recoverable_amount_eur: 0,
    suggested_reason: '',
    suggested_action: '',
  };
};

const sortByRecoverability = (left, right) => {
  if (right.recoverability_score !== left.recoverability_score) {
    return right.recoverability_score - left.recoverability_score;
  }

  return right.estimated_recoverable_amount_eur - left.estimated_recoverable_amount_eur;
};

export const scoreRecoveryIssues = (issueRows = []) =>
  issueRows
    .map((row) => {
      const issueType = getPrimaryIssueType(row.status);

      return {
        ...row,
        issue_type: issueType,
        issue_types: normalizeIssueTypes(row.status),
        ...getRecoveryAttributes(row, issueType),
      };
    })
    .sort(sortByRecoverability);

export const buildRecoverySummary = (recoveryRows = []) => {
  const recoverableRows = recoveryRows.filter(
    (row) => row.estimated_recoverable_amount_eur > 0,
  );
  const topIssueCounter = new Map();

  const totalDiscrepancyAmount = roundCurrency(
    recoverableRows.reduce((sum, row) => sum + row.discrepancy_amount_eur, 0),
  );
  const estimatedRecoverableAmount = roundCurrency(
    recoverableRows.reduce((sum, row) => sum + row.estimated_recoverable_amount_eur, 0),
  );
  const highConfidenceClaimCount = recoverableRows.filter(
    (row) => row.recoverability_score >= HIGH_CONFIDENCE_THRESHOLD,
  ).length;

  recoverableRows.forEach((row) => {
    topIssueCounter.set(row.issue_type, (topIssueCounter.get(row.issue_type) || 0) + 1);
  });

  const topRecoverabilityIssueType =
    [...topIssueCounter.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'None';

  return {
    totalDiscrepancyAmount,
    estimatedRecoverableAmount,
    highConfidenceClaimCount,
    topRecoverabilityIssueType,
    recommendedNextStep: recoverableRows.length
      ? RECOVERY_RECOMMENDATION
      : 'No recovery action recommended until discrepancies are detected.',
    issueCount: recoverableRows.length,
  };
};

export const generateClaimPack = ({
  recoveryRows = [],
  auditSummary,
  platformName = 'Uber Eats',
}) => {
  const recoverableRows = recoveryRows.filter(
    (row) => row.estimated_recoverable_amount_eur > 0,
  );
  const recoverySummary = buildRecoverySummary(recoverableRows);

  return {
    generated_at: new Date().toISOString(),
    platform_name: platformName,
    total_orders_analyzed: auditSummary?.ordersAnalyzed || 0,
    total_issues_found: auditSummary?.issuesFound || 0,
    total_discrepancy_amount_eur: recoverySummary.totalDiscrepancyAmount,
    estimated_recoverable_amount_eur: recoverySummary.estimatedRecoverableAmount,
    claim_lines: recoverableRows.map((row) => ({
      order_id: row.orderId,
      issue_type: row.issue_type,
      recoverability_level: row.recoverability_level,
      recoverability_score: row.recoverability_score,
      estimated_recoverable_amount_eur: row.estimated_recoverable_amount_eur,
      suggested_reason: row.suggested_reason,
      suggested_action: row.suggested_action,
    })),
  };
};

export const claimPackToCsvRows = (claimPack) => {
  if (!claimPack) {
    return [];
  }

  if (!claimPack.claim_lines.length) {
    return [
      {
        generated_at: claimPack.generated_at,
        platform_name: claimPack.platform_name,
        total_orders_analyzed: claimPack.total_orders_analyzed,
        total_issues_found: claimPack.total_issues_found,
        total_discrepancy_amount_eur: claimPack.total_discrepancy_amount_eur,
        estimated_recoverable_amount_eur: claimPack.estimated_recoverable_amount_eur,
      },
    ];
  }

  return claimPack.claim_lines.map((claimLine) => ({
    generated_at: claimPack.generated_at,
    platform_name: claimPack.platform_name,
    total_orders_analyzed: claimPack.total_orders_analyzed,
    total_issues_found: claimPack.total_issues_found,
    total_discrepancy_amount_eur: claimPack.total_discrepancy_amount_eur,
    estimated_recoverable_amount_eur: claimPack.estimated_recoverable_amount_eur,
    ...claimLine,
  }));
};

export const getHighConfidenceClaims = (recoveryRows = []) =>
  recoveryRows.filter((row) => row.recoverability_score >= HIGH_CONFIDENCE_THRESHOLD);
