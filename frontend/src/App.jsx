import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Receipt, BarChart3, Bell, RefreshCw, Search, Loader2,
  CheckCircle2, XCircle, Sparkles, Settings2, Wifi, WifiOff
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Demo data — used automatically if the real API (localhost:5000) isn't
// reachable, so the dashboard always looks fully alive during a live demo.
// ---------------------------------------------------------------------------
const MOCK_TRANSACTIONS = [
  { id: 't1', customerName: 'Ananya Rao', amount: 4999, method: 'UPI', failureReason: 'insufficient_funds', status: 'failed' },
  { id: 't2', customerName: 'Vikram Singh', amount: 12499, method: 'Card', failureReason: 'bank_declined', status: 'failed' },
  { id: 't3', customerName: 'Priya Menon', amount: 899, method: 'UPI', failureReason: 'otp_timeout', status: 'failed' },
  { id: 't4', customerName: 'Rohan Gupta', amount: 25000, method: 'Netbanking', failureReason: 'network_error', status: 'failed' },
  { id: 't5', customerName: 'Sneha Iyer', amount: 1599, method: 'Card', failureReason: 'card_expired', status: 'failed' },
  { id: 't6', customerName: 'Karan Malhotra', amount: 7999, method: 'UPI', failureReason: 'insufficient_funds', status: 'failed' },
  { id: 't7', customerName: 'Divya Nair', amount: 3200, method: 'Wallet', failureReason: 'bank_declined', status: 'failed' },
];

const STRATEGIES = [
  'Retrying via UPI intent',
  'Sending a payment link on WhatsApp',
  'Switching to backup gateway',
  'Offering EMI conversion',
  'Retrying with saved backup card',
];

const REASON_LABEL = {
  insufficient_funds: 'Insufficient funds',
  bank_declined: 'Bank declined',
  otp_timeout: 'OTP timeout',
  network_error: 'Network error',
  card_expired: 'Card expired',
};

const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const inr = (n) => `\u20B9${n.toLocaleString('en-IN')}`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 9);

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 2) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

// ---------------------------------------------------------------------------

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(null);
  const [feed, setFeed] = useState([]);
  const [runningIds, setRunningIds] = useState(new Set());
  const [runningAll, setRunningAll] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/transactions');
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      setTransactions(data);
      setIsLive(true);
    } catch (err) {
      setTransactions(MOCK_TRANSACTIONS.map((t) => ({ ...t })));
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const pushFeed = (entry) => {
    setFeed((f) => [{ id: uid(), ts: Date.now(), ...entry }, ...f].slice(0, 40));
  };

  const setTxStatus = (id, status) => {
    setTransactions((txs) => txs.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const runAgent = async (tx) => {
    // Handle both real MongoDB _ids and your mock IDs
    const targetId = tx._id || tx.id; 
    setRunningIds((s) => new Set(s).add(targetId));
    setTxStatus(targetId, 'recovery_in_progress');

    pushFeed({ name: tx.customerName, tone: 'info', text: `Sending to Gemini AI for analysis...` });

    try {
      // 1. Call the REAL backend route we built in Step 4
      const response = await fetch(`http://localhost:5000/api/recover/${targetId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        const updatedTx = data.transaction;
        const aiAction = updatedTx.aiRecommendation?.action;
        const aiReason = updatedTx.aiRecommendation?.reason;

        // 2. Stream the AI's actual thought process to your UI feed
        pushFeed({ name: tx.customerName, tone: 'progress', text: `AI Decision: ${aiAction}. ${aiReason}` });
        await wait(1000); // 1-second pause so the judges can read it

        // 3. Handle the final outcome
        if (aiAction === 'PAYMENT_LINK') {
          setTxStatus(targetId, 'recovered');
          pushFeed({ name: tx.customerName, tone: 'success', text: `Razorpay Payment Link generated!` });
          
          // Demo Magic: Find the link in the audit trail and open it!
          const linkLog = updatedTx.auditTrail.find(log => log.message.includes('https://rzp.io'));
          if (linkLog) {
             const url = linkLog.message.split('Generated: ')[1]; 
             if(url) window.open(url, '_blank'); // Opens the real checkout page
          }
        } else if (aiAction === 'ESCALATE') {
          setTxStatus(targetId, 'failed_permanently');
          pushFeed({ name: tx.customerName, tone: 'danger', text: `Escalated to human review team.` });
        } else {
          setTxStatus(targetId, 'recovered');
          pushFeed({ name: tx.customerName, tone: 'success', text: `Action applied successfully.` });
        }
      } else {
        throw new Error("Backend failed");
      }
    } catch (error) {
      console.error(error);
      pushFeed({ name: tx.customerName, tone: 'danger', text: `Error connecting to AI backend.` });
      setTxStatus(targetId, 'failed');
    } finally {
      setRunningIds((s) => { const n = new Set(s); n.delete(targetId); return n; });
      fetchTransactions(); // Sync the table with the real database
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    const queued = transactions.filter((t) => t.status === 'failed');
    await Promise.all(queued.map((tx, i) => wait(i * 350).then(() => runAgent(tx))));
    setRunningAll(false);
  };

  const failedCount = transactions.filter((t) => t.status === 'failed').length;
  const revenueAtRisk = transactions
    .filter((t) => t.status === 'failed' || t.status === 'recovery_in_progress')
    .reduce((a, t) => a + t.amount, 0);
  const revenueRecovered = transactions
    .filter((t) => t.status === 'recovered')
    .reduce((a, t) => a + t.amount, 0);
  const attempted = transactions.filter((t) => t.status === 'recovered' || t.status === 'failed_permanently').length;
  const recoveredCount = transactions.filter((t) => t.status === 'recovered').length;
  const recoveryRate = attempted > 0 ? Math.round((recoveredCount / attempted) * 100) : 0;
  const anyRunning = runningIds.size > 0 || runningAll;

  return (
    <div className="rzp-app">
      <GlobalStyles />

      {anyRunning && <div className="rzp-top-progress" />}

      {/* SIDEBAR */}
      <aside className="rzp-sidebar">
        <div className="rzp-sidebar-header">
          <div className="rzp-logo-badge">rzp</div>
          <span className="rzp-logo-text">Razorpay</span>
        </div>

        <nav className="rzp-nav">
          <a href="#" className="rzp-nav-item rzp-nav-item--active">
            <Zap size={18} strokeWidth={2.25} />
            <span>AI Recovery Agent</span>
          </a>
          <a href="#" className="rzp-nav-item">
            <Receipt size={18} strokeWidth={2} />
            <span>Transactions</span>
          </a>
          <a href="#" className="rzp-nav-item">
            <BarChart3 size={18} strokeWidth={2} />
            <span>Reports</span>
          </a>
          <a href="#" className="rzp-nav-item">
            <Settings2 size={18} strokeWidth={2} />
            <span>Settings</span>
          </a>
        </nav>

        <div className="rzp-sidebar-footer">
          <div className="rzp-sidebar-footer-title">
            <Sparkles size={14} />
            <span>Agent uptime</span>
          </div>
          <p className="rzp-sidebar-footer-text">
            Watching every failed payment and retrying automatically, 24/7.
          </p>
        </div>
      </aside>

      {/* MAIN */}
      <div className="rzp-main">
        {/* TOPBAR */}
        <header className="rzp-topbar">
          <div className="rzp-breadcrumb">
            <span className="rzp-breadcrumb-current">Dashboard</span>
            <span className="rzp-breadcrumb-sep">/</span>
            <span>AI Recovery</span>
          </div>

          <div className="rzp-topbar-right">
            {isLive === false && (
              <span className="rzp-pill rzp-pill--neutral">
                <WifiOff size={12} /> Demo data
              </span>
            )}
            {isLive === true && (
              <span className="rzp-pill rzp-pill--success">
                <Wifi size={12} /> Live
              </span>
            )}
            <span className="rzp-pill rzp-pill--warning">Test Mode</span>
            <div className="rzp-divider" />
            <button className="rzp-icon-btn" aria-label="Notifications">
              <Bell size={19} strokeWidth={1.8} />
            </button>
            <div className="rzp-avatar">RP</div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="rzp-content">
          <div className="rzp-container">

            <div className="rzp-page-header">
              <div>
                <h1 className="rzp-title">Revenue recovery</h1>
                <p className="rzp-subtitle">Your AI agent watches every failed payment and wins it back automatically.</p>
              </div>
              <div className="rzp-actions">
                <button onClick={fetchTransactions} className="rzp-btn rzp-btn--secondary">
                  <RefreshCw size={16} />
                  Refresh
                </button>
                <button
                  onClick={runAll}
                  disabled={runningAll || failedCount === 0}
                  className="rzp-btn rzp-btn--primary"
                >
                  {runningAll ? <Loader2 size={16} className="rzp-spin" /> : <Zap size={16} strokeWidth={2.25} />}
                  {runningAll ? 'Agents working\u2026' : `Run agent on all (${failedCount})`}
                </button>
              </div>
            </div>

            <div className="rzp-metrics">
              <MetricCard label="Failed payments" value={String(failedCount)} loading={loading} />
              <MetricCard label="Revenue at risk" value={inr(revenueAtRisk)} loading={loading} accent="#E03A5D" />
              <MetricCard label="Revenue recovered" value={inr(revenueRecovered)} loading={loading} accent="#0F9D78" />
              <RecoveryRateCard rate={recoveryRate} attempted={attempted} loading={loading} />
            </div>

            <div className="rzp-panels">
              <div className="rzp-card rzp-table-card">
                <div className="rzp-card-header">
                  <h2 className="rzp-card-title">Failed payments queue</h2>
                  <span className="rzp-card-meta">{transactions.length} total</span>
                </div>

                {loading ? (
                  <div className="rzp-table-loading">
                    {[...Array(5)].map((_, i) => <div key={i} className="rzp-skeleton rzp-skeleton--row" />)}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="rzp-empty">
                    <CheckCircle2 size={32} color="#0F9D78" />
                    <p className="rzp-empty-title">All caught up</p>
                    <p className="rzp-empty-text">No failed payments waiting on recovery.</p>
                  </div>
                ) : (
                  <div className="rzp-table-scroll">
                    <table className="rzp-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Amount</th>
                          <th>Reason</th>
                          <th>Status</th>
                          <th className="rzp-th-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <TxRow key={tx.id || tx._id} tx={tx} running={runningIds.has(tx.id)} onRun={() => runAgent(tx)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <AgentFeed feed={feed} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MetricCard({ label, value, loading, accent }) {
  return (
    <div className="rzp-card rzp-metric" style={accent ? { borderLeftColor: accent } : undefined}>
      <p className="rzp-metric-label">{label}</p>
      {loading ? <div className="rzp-skeleton rzp-skeleton--metric" /> : <p className="rzp-metric-value">{value}</p>}
    </div>
  );
}

function RecoveryRateCard({ rate, attempted, loading }) {
  const r = 20, c = 2 * Math.PI * r;
  const offset = c - (rate / 100) * c;
  return (
    <div className="rzp-card rzp-metric rzp-metric--ring">
      <div>
        <p className="rzp-metric-label">Recovery rate</p>
        {loading ? <div className="rzp-skeleton rzp-skeleton--metric" /> : <p className="rzp-metric-value">{rate}%</p>}
        <p className="rzp-metric-sub">{attempted} attempted</p>
      </div>
      {!loading && (
        <svg width="52" height="52" viewBox="0 0 52 52" className="rzp-ring">
          <circle cx="26" cy="26" r={r} fill="none" stroke="#EEF0F6" strokeWidth="5" />
          <circle
            cx="26" cy="26" r={r} fill="none" stroke="#4F5FF0" strokeWidth="5"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 26 26)"
          />
        </svg>
      )}
    </div>
  );
}

const STATUS_META = {
  failed: { label: 'Failed', cls: 'rzp-status--failed' },
  recovery_in_progress: { label: 'Recovering\u2026', cls: 'rzp-status--progress' },
  recovered: { label: 'Recovered', cls: 'rzp-status--recovered' },
  failed_permanently: { label: 'Unrecovered', cls: 'rzp-status--unrecovered' },
};

function TxRow({ tx, running, onRun }) {
  const meta = STATUS_META[tx.status] || STATUS_META.failed;
  return (
    <tr>
      <td className="rzp-td-strong">{tx.customerName}</td>
      <td className="rzp-td-amount">{inr(tx.amount)}</td>
      <td>
        <span className="rzp-reason-tag">{REASON_LABEL[tx.failureReason] || tx.failureReason}</span>
      </td>
      <td>
        <span className={`rzp-status ${meta.cls}`}>{meta.label}</span>
      </td>
      <td className="rzp-td-right">
        <button
          onClick={onRun}
          disabled={tx.status !== 'failed' || running}
          className={`rzp-run-btn ${tx.status === 'failed' && !running ? 'rzp-run-btn--active' : 'rzp-run-btn--disabled'}`}
        >
          {running ? <Loader2 size={14} className="rzp-spin" /> : <Zap size={14} />}
          {running ? 'Running' : 'Run agent'}
        </button>
      </td>
    </tr>
  );
}

const FEED_ICON = {
  info: { Icon: Search, cls: 'rzp-feed-icon--info' },
  progress: { Icon: Loader2, cls: 'rzp-feed-icon--info', spin: true },
  success: { Icon: CheckCircle2, cls: 'rzp-feed-icon--success' },
  danger: { Icon: XCircle, cls: 'rzp-feed-icon--danger' },
};

function AgentFeed({ feed }) {
  return (
    <div className="rzp-card rzp-feed-card">
      <div className="rzp-card-header">
        <h2 className="rzp-card-title">Agent activity</h2>
        {feed.length > 0 && (
          <span className="rzp-live-tag">
            <span className="rzp-live-dot" />
            Live
          </span>
        )}
      </div>
      <div className="rzp-feed-list">
        {feed.length === 0 ? (
          <div className="rzp-feed-empty">
            <Zap size={22} color="#C7CCF5" />
            <p>Run the agent on a payment to see it reason through the recovery here.</p>
          </div>
        ) : (
          feed.map((item) => {
            const { Icon, cls, spin } = FEED_ICON[item.tone];
            return (
              <div key={item.id} className="rzp-feed-item">
                <div className={`rzp-feed-icon ${cls}`}>
                  <Icon size={14} className={spin ? 'rzp-spin' : ''} strokeWidth={2.25} />
                </div>
                <div className="rzp-feed-body">
                  <p className="rzp-feed-text">{item.text}</p>
                  <p className="rzp-feed-meta">{item.name} \u00B7 {timeAgo(item.ts)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// All styling lives here as plain CSS, so this component looks correct
// regardless of whether Tailwind is configured in the host project.
// ---------------------------------------------------------------------------
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

      .rzp-app, .rzp-app * { box-sizing: border-box; }
      .rzp-app {
        display: flex;
        height: 100vh;
        width: 100%;
        background: #F5F6FA;
        color: #10132B;
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
        overflow: hidden;
        position: relative;
      }
      .rzp-display { font-family: 'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif; }

      .rzp-top-progress {
        position: absolute; top: 0; left: 0; height: 3px; width: 100%;
        background: linear-gradient(90deg, transparent, #4F5FF0, transparent);
        background-size: 200% 100%;
        animation: rzp-progress-sweep 1.1s linear infinite;
        z-index: 50;
      }
      @keyframes rzp-progress-sweep { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

      /* SIDEBAR */
      .rzp-sidebar {
        width: 248px;
        flex-shrink: 0;
        background: #0B1739;
        color: #AEB4D4;
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .rzp-sidebar-header {
        height: 64px;
        display: flex;
        align-items: center;
        padding: 0 20px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        gap: 10px;
        flex-shrink: 0;
      }
      .rzp-logo-badge {
        background: #fff;
        color: #0B1739;
        font-weight: 700;
        font-size: 13px;
        padding: 5px 8px;
        border-radius: 6px;
        font-family: 'Space Grotesk', sans-serif;
        letter-spacing: 0.02em;
      }
      .rzp-logo-text { color: #fff; font-weight: 600; font-size: 15px; font-family: 'Space Grotesk', sans-serif; }

      .rzp-nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 20px 12px;
        flex: 1;
      }
      .rzp-nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 14px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #AEB4D4;
        text-decoration: none;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .rzp-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
      .rzp-nav-item--active {
        background: #4F5FF0;
        color: #fff;
        box-shadow: 0 4px 14px rgba(79,95,240,0.35);
      }
      .rzp-nav-item--active:hover { background: #4F5FF0; }

      .rzp-sidebar-footer {
        margin: 4px 14px 18px;
        padding: 14px;
        border-radius: 12px;
        background: linear-gradient(155deg, rgba(79,95,240,0.18), rgba(255,255,255,0.03));
        border: 1px solid rgba(255,255,255,0.1);
        flex-shrink: 0;
      }
      .rzp-sidebar-footer-title {
        display: flex; align-items: center; gap: 7px;
        font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 6px;
      }
      .rzp-sidebar-footer-title svg { color: #8B95FF; }
      .rzp-sidebar-footer-text { font-size: 12px; line-height: 1.5; color: #8790B8; margin: 0; }

      /* MAIN */
      .rzp-main { flex: 1; display: flex; flex-direction: column; height: 100%; min-width: 0; overflow: hidden; }

      .rzp-topbar {
        height: 64px;
        flex-shrink: 0;
        background: #fff;
        border-bottom: 1px solid #E7E9F1;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 0 28px;
      }
      .rzp-breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #6B7094; }
      .rzp-breadcrumb-current { font-weight: 600; color: #10132B; }
      .rzp-breadcrumb-sep { color: #C7CBE0; }

      .rzp-topbar-right { display: flex; flex-direction: row; align-items: center; gap: 14px; }

      .rzp-pill {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 600;
        padding: 6px 12px; border-radius: 999px; border: 1px solid transparent;
        white-space: nowrap;
      }
      .rzp-pill--neutral { background: #F0F1F7; color: #6B7094; border-color: #E7E9F1; }
      .rzp-pill--success { background: #E6F7F1; color: #0F9D78; border-color: #CDEFE1; }
      .rzp-pill--warning { background: #FCF1DF; color: #C77D14; border-color: #F4E1BC; }

      .rzp-divider { width: 1px; height: 22px; background: #E7E9F1; }

      .rzp-icon-btn {
        background: none; border: none; cursor: pointer; color: #8790A8;
        display: flex; align-items: center; justify-content: center;
        padding: 6px; border-radius: 8px; transition: color 0.15s ease, background-color 0.15s ease;
      }
      .rzp-icon-btn:hover { color: #10132B; background: #F5F6FA; }

      .rzp-avatar {
        width: 34px; height: 34px; border-radius: 999px;
        background: linear-gradient(145deg, #4F5FF0, #6E7CF7);
        color: #fff; font-size: 12px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }

      /* CONTENT */
      .rzp-content { flex: 1; overflow-y: auto; padding: 28px; }
      .rzp-container { max-width: 1220px; margin: 0 auto; }

      .rzp-page-header {
        display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between;
        gap: 20px; margin-bottom: 28px; flex-wrap: wrap;
      }
      .rzp-title { font-size: 27px; font-weight: 600; margin: 0 0 6px; font-family: 'Space Grotesk', sans-serif; }
      .rzp-subtitle { font-size: 15px; color: #6B7094; margin: 0; }

      .rzp-actions { display: flex; flex-direction: row; gap: 10px; flex-shrink: 0; }

      .rzp-btn {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 14px; font-weight: 600; padding: 11px 18px;
        border-radius: 10px; border: 1px solid transparent; cursor: pointer;
        transition: background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
        white-space: nowrap;
      }
      .rzp-btn:active { transform: translateY(1px); }
      .rzp-btn--secondary { background: #fff; border-color: #E1E3EE; color: #3C4160; }
      .rzp-btn--secondary:hover { background: #FAFAFD; border-color: #D1D5E8; }
      .rzp-btn--primary { background: #4F5FF0; color: #fff; box-shadow: 0 3px 12px rgba(79,95,240,0.3); }
      .rzp-btn--primary:hover { background: #4150DE; }
      .rzp-btn--primary:disabled { background: #C7CCF5; box-shadow: none; cursor: not-allowed; }

      /* METRICS */
      .rzp-metrics {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-bottom: 24px;
      }
      .rzp-card {
        background: #fff; border: 1px solid #E7E9F1; border-radius: 14px;
      }
      .rzp-metric { padding: 20px; border-left: 3px solid transparent; }
      .rzp-metric-label { font-size: 13px; font-weight: 500; color: #6B7094; margin: 0 0 10px; }
      .rzp-metric-value { font-size: 28px; font-weight: 600; font-family: 'Space Grotesk', sans-serif; margin: 0; font-variant-numeric: tabular-nums; }
      .rzp-metric-sub { font-size: 12px; color: #A0A6C0; margin: 4px 0 0; }
      .rzp-metric--ring { display: flex; flex-direction: row; align-items: center; justify-content: space-between; }
      .rzp-ring circle:last-child { transition: stroke-dashoffset 0.6s ease; }

      /* PANELS */
      .rzp-panels {
        display: grid; grid-template-columns: 1fr 360px; gap: 18px; align-items: start;
      }

      .rzp-card-header {
        display: flex; flex-direction: row; align-items: center; justify-content: space-between;
        padding: 18px 22px; border-bottom: 1px solid #E7E9F1;
      }
      .rzp-card-title { font-size: 15px; font-weight: 600; margin: 0; }
      .rzp-card-meta { font-size: 12px; color: #8790A8; }

      .rzp-table-card { overflow: hidden; }
      .rzp-table-scroll { max-height: 480px; overflow-y: auto; }
      .rzp-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
      .rzp-table thead th {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
        color: #8790A8; font-weight: 600; padding: 12px 22px;
        border-bottom: 1px solid #EEF0F6; position: sticky; top: 0; background: #fff;
      }
      .rzp-th-right { text-align: right; }
      .rzp-table tbody tr { border-bottom: 1px solid #F1F2F8; transition: background-color 0.12s ease; }
      .rzp-table tbody tr:last-child { border-bottom: none; }
      .rzp-table tbody tr:hover { background: #FAFAFD; }
      .rzp-table td { padding: 14px 22px; vertical-align: middle; }
      .rzp-td-strong { font-weight: 500; }
      .rzp-td-amount { font-weight: 500; color: #3C4160; font-variant-numeric: tabular-nums; }
      .rzp-td-right { text-align: right; }

      .rzp-reason-tag {
        font-size: 12px; color: #6B7094; background: #F5F6FA;
        padding: 5px 10px; border-radius: 6px; border: 1px solid #EEF0F6; white-space: nowrap;
      }

      .rzp-status {
        display: inline-block; font-size: 12px; font-weight: 600;
        padding: 5px 11px; border-radius: 999px; border: 1px solid transparent; white-space: nowrap;
      }
      .rzp-status--failed { background: #FDEAEE; color: #E03A5D; border-color: #F7D2DB; }
      .rzp-status--progress { background: #EEF0FF; color: #4F5FF0; border-color: #DBE0FD; }
      .rzp-status--recovered { background: #E6F7F1; color: #0F9D78; border-color: #CDEFE1; }
      .rzp-status--unrecovered { background: #F0F1F7; color: #6B7094; border-color: #E1E3EE; }

      .rzp-run-btn {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 600; padding: 8px 14px;
        border-radius: 8px; border: none; cursor: pointer; white-space: nowrap;
        transition: background-color 0.15s ease;
      }
      .rzp-run-btn--active { background: #4F5FF0; color: #fff; }
      .rzp-run-btn--active:hover { background: #4150DE; }
      .rzp-run-btn--disabled { background: #F0F1F7; color: #A0A6C0; cursor: not-allowed; }

      /* EMPTY / LOADING */
      .rzp-empty { padding: 56px 20px; text-align: center; }
      .rzp-empty-title { font-weight: 600; font-size: 14px; margin: 12px 0 4px; }
      .rzp-empty-text { font-size: 14px; color: #8790A8; margin: 0; }
      .rzp-table-loading { padding: 22px; display: flex; flex-direction: column; gap: 12px; }

      .rzp-skeleton {
        background: linear-gradient(90deg, #EEF0F6 25%, #F7F8FC 37%, #EEF0F6 63%);
        background-size: 400px 100%;
        animation: rzp-shimmer 1.4s ease infinite;
        border-radius: 8px;
      }
      .rzp-skeleton--row { height: 46px; width: 100%; }
      .rzp-skeleton--metric { height: 30px; width: 90px; }
      @keyframes rzp-shimmer { 0% { background-position: -200px 0; } 100% { background-position: calc(200px + 100%) 0; } }

      /* AGENT FEED */
      .rzp-feed-card { display: flex; flex-direction: column; max-height: 560px; }
      .rzp-feed-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }

      .rzp-live-tag { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #0F9D78; }
      .rzp-live-dot { width: 6px; height: 6px; border-radius: 999px; background: #0F9D78; animation: rzp-pulse 1.6s ease-in-out infinite; }
      @keyframes rzp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

      .rzp-feed-empty { padding: 40px 16px; text-align: center; }
      .rzp-feed-empty p { font-size: 13.5px; color: #8790A8; margin: 10px 0 0; line-height: 1.5; }

      .rzp-feed-item { display: flex; flex-direction: row; gap: 12px; animation: rzp-slide-in 0.25s ease-out; }
      @keyframes rzp-slide-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

      .rzp-feed-icon {
        width: 26px; height: 26px; border-radius: 999px; flex-shrink: 0; margin-top: 2px;
        display: flex; align-items: center; justify-content: center;
      }
      .rzp-feed-icon--info { background: #EEF0FF; color: #4F5FF0; }
      .rzp-feed-icon--success { background: #E6F7F1; color: #0F9D78; }
      .rzp-feed-icon--danger { background: #FDEAEE; color: #E03A5D; }

      .rzp-feed-body { min-width: 0; }
      .rzp-feed-text { font-size: 13px; line-height: 1.4; margin: 0; color: #10132B; }
      .rzp-feed-meta { font-size: 11px; color: #A0A6C0; margin: 3px 0 0; }

      .rzp-spin { animation: rzp-rotate 0.8s linear infinite; }
      @keyframes rzp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      @media (max-width: 1080px) {
        .rzp-panels { grid-template-columns: 1fr; }
        .rzp-metrics { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  );
}