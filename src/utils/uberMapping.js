const normalizeHeader = (header) =>
  String(header || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const scoreHeader = (header, patterns) => {
  const normalized = normalizeHeader(header);
  let score = 0;

  patterns.forEach((pattern) => {
    const normalizedPattern = normalizeHeader(pattern);

    if (normalized === normalizedPattern) {
      score = Math.max(score, 100);
      return;
    }

    if (normalized.includes(normalizedPattern)) {
      score = Math.max(score, 80);
      return;
    }

    const words = normalizedPattern.split(' ');
    const matchedWords = words.filter((word) => normalized.includes(word)).length;

    if (matchedWords === words.length && words.length) {
      score = Math.max(score, 70);
      return;
    }

    if (matchedWords > 0) {
      score = Math.max(score, matchedWords * 10);
    }
  });

  return score;
};

const detectField = (headers, patterns) => {
  let bestHeader = '';
  let bestScore = 0;

  headers.forEach((header) => {
    const score = scoreHeader(header, patterns);
    if (score > bestScore) {
      bestScore = score;
      bestHeader = header;
    }
  });

  return bestScore >= 50 ? bestHeader : '';
};

export const uberFieldDefinitions = [
  {
    id: 'orderId',
    label: 'Order ID',
    required: true,
    patterns: ['order id', 'merchant order id', 'order number', 'workflow id', 'trip id'],
  },
  {
    id: 'grossSales',
    label: 'Gross sales',
    required: false,
    patterns: ['food sales', 'subtotal', 'basket', 'item total', 'gross sales'],
  },
  {
    id: 'commission',
    label: 'Commission',
    required: true,
    patterns: ['uber fee', 'service fee', 'commission', 'marketplace fee'],
  },
  {
    id: 'netPayout',
    label: 'Net payout',
    required: true,
    patterns: ['restaurant payout', 'transfer', 'total payout', 'net payout', 'payout'],
  },
];

export const posFieldDefinitions = [
  {
    id: 'orderId',
    label: 'Order ID',
    required: true,
    patterns: ['order id', 'order number', 'ticket id', 'check id', 'receipt id', 'sale id'],
  },
  {
    id: 'grossSales',
    label: 'Gross sales',
    required: true,
    patterns: ['gross sales', 'gross', 'sales total', 'order total', 'total', 'subtotal'],
  },
];

export const detectUberMapping = (headers) =>
  Object.fromEntries(
    uberFieldDefinitions.map((field) => [field.id, detectField(headers, field.patterns)]),
  );

export const detectPosMapping = (headers) =>
  Object.fromEntries(
    posFieldDefinitions.map((field) => [field.id, detectField(headers, field.patterns)]),
  );

export const getMissingRequiredFields = (mapping, definitions) =>
  definitions.filter((field) => field.required && !mapping[field.id]).map((field) => field.label);

export const getColumnOptions = (headers) =>
  headers.map((header) => ({
    label: header,
    value: header,
  }));
