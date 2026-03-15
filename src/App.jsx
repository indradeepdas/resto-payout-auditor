import { useEffect, useMemo, useState } from 'react';
import { trackEvent } from './analytics.js';
import { exportToCsv, exportWorkbook, parseDataFile } from './utils/parser.js';
import {
  detectPosMapping,
  detectUberMapping,
  getColumnOptions,
  getMissingRequiredFields,
  posFieldDefinitions,
  uberFieldDefinitions,
} from './utils/uberMapping.js';
import {
  DEFAULT_COMMISSION_PCT,
  DEFAULT_TOLERANCE,
  reconcileOrders,
} from './utils/reconcile.js';

const createDemoDataset = () => {
  const posRows = [
    { 'Order ID': 'UE-1001', 'Gross Sales': '42.50' },
    { 'Order ID': 'UE-1002', 'Gross Sales': '30.00' },
    { 'Order ID': 'UE-1003', 'Gross Sales': '24.80' },
    { 'Order ID': 'UE-1004', 'Gross Sales': '51.00' },
    { 'Order ID': 'UE-1005', 'Gross Sales': '17.40' },
    { 'Order ID': 'UE-1006', 'Gross Sales': '63.20' },
  ];

  const payoutRows = [
    {
      'Order ID': 'UE1001',
      'Food Sales': '42.50',
      'Uber Fee': '12.75',
      'Restaurant Payout': '29.75',
    },
    {
      'Order ID': 'UE1002',
      'Food Sales': '30.00',
      'Uber Fee': '11.00',
      'Restaurant Payout': '19.00',
    },
    {
      'Order ID': 'UE1003',
      'Food Sales': '24.80',
      'Uber Fee': '7.44',
      'Restaurant Payout': '17.36',
    },
    {
      'Order ID': 'UE1005',
      'Food Sales': '17.40',
      'Uber Fee': '5.22',
      'Restaurant Payout': '9.50',
    },
    {
      'Order ID': 'UE1006',
      'Food Sales': '63.20',
      'Uber Fee': '18.96',
      'Restaurant Payout': '44.24',
    },
  ];

  return {
    pos: {
      fileName: 'demo-pos-orders.csv',
      headers: Object.keys(posRows[0]),
      rows: posRows,
    },
    payout: {
      fileName: 'demo-uber-payout.csv',
      headers: Object.keys(payoutRows[0]),
      rows: payoutRows,
    },
  };
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0));

const summaryCards = [
  { key: 'ordersAnalyzed', label: 'Orders analyzed', format: (value) => value },
  { key: 'issuesFound', label: 'Issues found', format: (value) => value },
  { key: 'estimatedLeakage', label: 'Estimated leakage', format: formatCurrency },
  { key: 'topIssueType', label: 'Top issue type', format: (value) => value },
];

const emptyStateMessage =
  'Upload both files or use demo data to generate an audit. All processing stays in the browser.';
const getFileType = (fileName = '') => fileName.split('.').pop()?.toLowerCase() || 'unknown';
const auditTrackingState = {
  pageViewTracked: false,
  started: new Set(),
  succeeded: new Set(),
  failed: new Set(),
};

const resetAuditTracking = () => {
  auditTrackingState.started.clear();
  auditTrackingState.succeeded.clear();
  auditTrackingState.failed.clear();
};

function App() {
  const [payoutData, setPayoutData] = useState(null);
  const [posData, setPosData] = useState(null);
  const [payoutMapping, setPayoutMapping] = useState({});
  const [posMapping, setPosMapping] = useState({});
  const [expectedCommissionPct, setExpectedCommissionPct] = useState(DEFAULT_COMMISSION_PCT);
  const [fileError, setFileError] = useState('');
  const [isParsing, setIsParsing] = useState({ payout: false, pos: false });
  const resolvedCommissionPct =
    expectedCommissionPct === '' ? DEFAULT_COMMISSION_PCT : Number(expectedCommissionPct);

  const applyAutoDetectedMappings = (nextPayoutData = payoutData, nextPosData = posData) => {
    if (nextPayoutData) {
      setPayoutMapping(detectUberMapping(nextPayoutData.headers));
    }

    if (nextPosData) {
      setPosMapping(detectPosMapping(nextPosData.headers));
    }
  };

  const handleFileLoad = async (event, kind) => {
    const [file] = event.target.files || [];

    if (!file) {
      return;
    }

    setFileError('');
    setIsParsing((current) => ({ ...current, [kind]: true }));
    resetAuditTracking();

    try {
      const parsed = await parseDataFile(file);

      if (kind === 'payout') {
        setPayoutData(parsed);
        setPayoutMapping(detectUberMapping(parsed.headers));
        trackEvent('payout_file_uploaded', {
          row_count: parsed.rows.length,
          file_name: parsed.fileName,
          file_type: getFileType(parsed.fileName),
          payout_columns_count: parsed.headers.length,
        });
      } else {
        setPosData(parsed);
        setPosMapping(detectPosMapping(parsed.headers));
        trackEvent('orders_file_uploaded', {
          row_count: parsed.rows.length,
          file_name: parsed.fileName,
          file_type: getFileType(parsed.fileName),
          order_columns_count: parsed.headers.length,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not parse the selected file.';
      setFileError(errorMessage);
      trackEvent('audit_failed', {
        file_name: file.name,
        file_type: getFileType(file.name),
        error_message: errorMessage,
      });
    } finally {
      setIsParsing((current) => ({ ...current, [kind]: false }));
      event.target.value = '';
    }
  };

  const handleDemoMode = () => {
    const demo = createDemoDataset();
    setFileError('');
    resetAuditTracking();
    setPosData(demo.pos);
    setPayoutData(demo.payout);
    applyAutoDetectedMappings(demo.payout, demo.pos);
    trackEvent('demo_data_used', {
      row_count: demo.pos.rows.length + demo.payout.rows.length,
      payout_columns_count: demo.payout.headers.length,
      order_columns_count: demo.pos.headers.length,
    });
  };

  const handleAutoDetectClick = () => {
    applyAutoDetectedMappings();
    trackEvent('auto_detect_clicked', {
      payout_columns_count: payoutData?.headers.length,
      order_columns_count: posData?.headers.length,
    });
  };

  const handleReset = () => {
    setFileError('');
    resetAuditTracking();
    setPosData(null);
    setPayoutData(null);
    setPosMapping({});
    setPayoutMapping({});
  };

  const mappingErrors = useMemo(() => {
    const nextErrors = [];

    if (posData) {
      const missingPos = getMissingRequiredFields(posMapping, posFieldDefinitions);
      if (missingPos.length) {
        nextErrors.push(`POS export is missing required mappings: ${missingPos.join(', ')}.`);
      }
    }

    if (payoutData) {
      const missingPayout = getMissingRequiredFields(payoutMapping, uberFieldDefinitions);
      if (missingPayout.length) {
        nextErrors.push(`Uber payout file is missing required mappings: ${missingPayout.join(', ')}.`);
      }
    }

    return nextErrors;
  }, [posData, posMapping, payoutData, payoutMapping]);
  const errors = fileError ? [fileError, ...mappingErrors] : mappingErrors;
  const reconciliation = useMemo(() => {
    if (!posData || !payoutData || mappingErrors.length) {
      return null;
    }

    return reconcileOrders({
      posRows: posData.rows,
      payoutRows: payoutData.rows,
      posMapping,
      payoutMapping,
      expectedCommissionPct: Number.isFinite(resolvedCommissionPct)
        ? resolvedCommissionPct
        : DEFAULT_COMMISSION_PCT,
      tolerance: DEFAULT_TOLERANCE,
    });
  }, [mappingErrors.length, payoutData, payoutMapping, posData, posMapping, resolvedCommissionPct]);

  const issueRows = reconciliation?.issues || [];
  const fullRows = reconciliation?.fullRows || [];
  const summary = reconciliation?.summary;
  const canAudit = Boolean(posData && payoutData && !mappingErrors.length);
  const baseAuditProperties = useMemo(
    () => ({
      expected_commission_pct: Number.isFinite(resolvedCommissionPct)
        ? resolvedCommissionPct
        : DEFAULT_COMMISSION_PCT,
      payout_columns_count: payoutData?.headers.length,
      order_columns_count: posData?.headers.length,
    }),
    [posData?.headers.length, payoutData?.headers.length, resolvedCommissionPct],
  );
  const auditSignature = useMemo(
    () =>
      canAudit
        ? JSON.stringify({
            payoutFile: payoutData.fileName,
            payoutRows: payoutData.rows.length,
            payoutMapping,
            posFile: posData.fileName,
            posRows: posData.rows.length,
            posMapping,
            expectedCommissionPct: baseAuditProperties.expected_commission_pct,
          })
        : '',
    [baseAuditProperties.expected_commission_pct, canAudit, payoutData, payoutMapping, posData, posMapping],
  );
  const auditFailureSignature = useMemo(
    () =>
      posData && payoutData && mappingErrors.length
        ? JSON.stringify({
            payoutFile: payoutData.fileName,
            posFile: posData.fileName,
            mappingErrors,
          })
        : '',
    [mappingErrors, payoutData, posData],
  );

  useEffect(() => {
    if (auditTrackingState.pageViewTracked) {
      return;
    }

    auditTrackingState.pageViewTracked = true;
    trackEvent('page_view');
  }, []);

  useEffect(() => {
    if (!canAudit || !auditSignature || auditTrackingState.started.has(auditSignature)) {
      return;
    }

    auditTrackingState.started.add(auditSignature);
    trackEvent('audit_started', baseAuditProperties);
  }, [auditSignature, baseAuditProperties, canAudit]);

  useEffect(() => {
    if (!auditFailureSignature || auditTrackingState.failed.has(auditFailureSignature)) {
      return;
    }

    auditTrackingState.failed.add(auditFailureSignature);
    trackEvent('audit_failed', {
      ...baseAuditProperties,
      error_message: mappingErrors.join(' '),
    });
  }, [auditFailureSignature, baseAuditProperties, mappingErrors]);

  useEffect(() => {
    if (!summary || !auditSignature || auditTrackingState.succeeded.has(auditSignature)) {
      return;
    }

    const auditProperties = {
      ...baseAuditProperties,
      orders_analyzed: summary.ordersAnalyzed,
      issues_found: summary.issuesFound,
      top_issue_type: summary.topIssueType,
    };

    auditTrackingState.succeeded.add(auditSignature);
    trackEvent('audit_succeeded', auditProperties);

    if (summary.issuesFound > 0) {
      trackEvent('payout_discrepancy_detected', {
        ...auditProperties,
        discrepancy_amount_eur: summary.estimatedLeakage,
      });
    }
  }, [auditSignature, baseAuditProperties, summary]);

  const exportCsvFile = () => {
    if (!fullRows.length) {
      return;
    }

    trackEvent('csv_downloaded', {
      ...baseAuditProperties,
      orders_analyzed: summary?.ordersAnalyzed,
      issues_found: summary?.issuesFound,
      top_issue_type: summary?.topIssueType,
      discrepancy_amount_eur: summary?.estimatedLeakage,
    });
    exportToCsv('uber-payout-reconciliation.csv', fullRows);
  };

  const exportExcelFile = async () => {
    if (!summary || !fullRows.length) {
      return;
    }

    trackEvent('excel_downloaded', {
      ...baseAuditProperties,
      orders_analyzed: summary.ordersAnalyzed,
      issues_found: summary.issuesFound,
      top_issue_type: summary.topIssueType,
      discrepancy_amount_eur: summary.estimatedLeakage,
    });
    await exportWorkbook('uber-payout-audit.xlsx', [
      {
        name: 'Summary',
        rows: [
          {
            'Orders analyzed': summary.ordersAnalyzed,
            'Issues found': summary.issuesFound,
            'Estimated leakage': summary.estimatedLeakage,
            'Top issue type': summary.topIssueType,
            'Expected commission %': baseAuditProperties.expected_commission_pct,
            'Tolerance EUR': DEFAULT_TOLERANCE,
          },
        ],
      },
      {
        name: 'Issues',
        rows: issueRows,
      },
      {
        name: 'Full reconciliation',
        rows: fullRows,
      },
    ]);
  };

  const payoutOptions = payoutData ? getColumnOptions(payoutData.headers) : [];
  const posOptions = posData ? getColumnOptions(posData.headers) : [];
  const busy = isParsing.payout || isParsing.pos;

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <main className="page">
        <section className="hero card hero-card">
          <div className="hero-copy">
            <span className="eyebrow">Client-side payout diagnostics</span>
            <h1>Uber Eats Payout Audit Engine</h1>
            <p>
              Upload your Uber payout export and POS order file to detect commission
              anomalies, missing orders, and settlement leakage.
            </p>
          </div>

          <div className="hero-meta">
            <div>
              <strong>Privacy-safe</strong>
              <span>All uploads stay in your browser.</span>
            </div>
            <div>
              <strong>Tolerance</strong>
              <span>{formatCurrency(DEFAULT_TOLERANCE)}</span>
            </div>
          </div>
        </section>

        <section className="controls-grid">
          <div className="card uploader-card">
            <div className="section-header">
              <div>
                <h2>Upload files</h2>
                <p>CSV and XLSX are supported for both sources.</p>
              </div>
              <button className="secondary-button" type="button" onClick={handleDemoMode}>
                Try demo data
              </button>
            </div>

            <div className="upload-grid">
              <label className="upload-tile">
                <span>Uber payout file</span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => handleFileLoad(event, 'payout')}
                />
                <small>{payoutData?.fileName || 'No file loaded'}</small>
              </label>

              <label className="upload-tile">
                <span>POS order export</span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => handleFileLoad(event, 'pos')}
                />
                <small>{posData?.fileName || 'No file loaded'}</small>
              </label>
            </div>

            <div className="toolbar">
              <label className="inline-field">
                <span>Expected commission %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={expectedCommissionPct}
                  onChange={(event) => setExpectedCommissionPct(event.target.value)}
                />
              </label>

              <button className="ghost-button" type="button" onClick={handleReset}>
                Clear data
              </button>

              <button
                className="ghost-button"
                type="button"
                onClick={handleAutoDetectClick}
                disabled={!payoutData && !posData}
              >
                Re-run auto-detect
              </button>
            </div>

            {busy ? <div className="notice">Parsing file...</div> : null}
            {!busy && !posData && !payoutData ? <div className="notice">{emptyStateMessage}</div> : null}

            {errors.length ? (
              <div className="error-panel" role="alert">
                {errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}
          </div>

          <div className="card export-card">
            <h2>Export audit</h2>
            <p>Download the reconciled dataset as CSV or generate a multi-sheet Excel workbook.</p>

            <div className="export-actions">
              <button
                className="primary-button"
                type="button"
                onClick={exportCsvFile}
                disabled={!fullRows.length}
              >
                Download CSV
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={exportExcelFile}
                disabled={!fullRows.length}
              >
                Download Excel
              </button>
            </div>
          </div>
        </section>

        <section className="mapping-grid">
          <MappingCard
            title="Uber column mapping"
            definitions={uberFieldDefinitions}
            options={payoutOptions}
            mapping={payoutMapping}
            onChange={setPayoutMapping}
            disabled={!payoutData}
          />
          <MappingCard
            title="POS column mapping"
            definitions={posFieldDefinitions}
            options={posOptions}
            mapping={posMapping}
            onChange={setPosMapping}
            disabled={!posData}
          />
        </section>

        <section className="summary-grid">
          {summaryCards.map((card) => (
            <div className="card summary-card" key={card.key}>
              <span>{card.label}</span>
              <strong>{summary ? card.format(summary[card.key]) : '--'}</strong>
            </div>
          ))}
        </section>

        <section className="card table-card">
          <div className="section-header">
            <div>
              <h2>Issue table</h2>
              <p>Only orders with detected anomalies are shown.</p>
            </div>
            <span className="chip">
              {fullRows.length ? `${fullRows.length} orders reconciled` : 'Awaiting data'}
            </span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Gross Sales</th>
                  <th>Commission</th>
                  <th>Expected Commission</th>
                  <th>Net Payout</th>
                  <th>Expected Net</th>
                  <th>Net Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {issueRows.length ? (
                  issueRows.map((row) => (
                    <tr key={`${row.orderId}-${row.status}`}>
                      <td>{row.orderId}</td>
                      <td>{formatCurrency(row.grossSales)}</td>
                      <td>{formatCurrency(row.commission)}</td>
                      <td>{formatCurrency(row.expectedCommission)}</td>
                      <td>{formatCurrency(row.netPayout)}</td>
                      <td>{formatCurrency(row.expectedNet)}</td>
                      <td className={row.netVariance < 0 ? 'negative' : 'positive'}>
                        {formatCurrency(row.netVariance)}
                      </td>
                      <td>
                        <span className="status-pill">{row.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="empty-table">
                      {summary
                        ? 'No anomalies detected within the configured tolerance.'
                        : 'Load both files to review issues.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function MappingCard({ title, definitions, options, mapping, onChange, disabled }) {
  const updateMapping = (fieldId, value) => {
    onChange((current) => ({
      ...current,
      [fieldId]: value,
    }));
  };

  return (
    <div className="card mapping-card">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          <p>Automatic detection runs on upload. Use overrides when headers differ.</p>
        </div>
      </div>

      <div className="mapping-fields">
        {definitions.map((field) => (
          <label className="mapping-field" key={field.id}>
            <span>
              {field.label}
              {field.required ? ' *' : ''}
            </span>
            <select
              value={mapping[field.id] || ''}
              onChange={(event) => updateMapping(field.id, event.target.value)}
              disabled={disabled}
            >
              <option value="">{field.required ? 'Select a column' : 'Not used'}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

export default App;
