/* ============================================================
   SentiTube v3 – content.js
   ============================================================ */

const API_BASE = 'http://localhost:8000'; // ← change if needed
const SIMULATE = false;

const SENTIMENTS = ['positive', 'negative', 'neutral'];

/* ──────────────────────────────────────────────────────────────
   BATCH API CALL
   ENDPOINT : POST {API_BASE}/predict_batch
   REQUEST  : { "comments": [ { "comment_id": "st-0", "comment_text": "..." }, ... ] }
   RESPONSE : { "results":  [ { "comment_id": "st-0", "sentiment": "positive", "confidence": 0.94 }, ... ] }
   ────────────────────────────────────────────────────────────── */
async function fetchBatchSentiment(comments) {
    if (SIMULATE) {
        await new Promise(r => setTimeout(r, 300 + Math.random() * 300));
        return {
            results: comments.map(c => ({
                comment_id: c.comment_id,
                sentiment: SENTIMENTS[Math.floor(Math.random() * SENTIMENTS.length)],
                confidence: parseFloat((0.70 + Math.random() * 0.29).toFixed(2))
            }))
        };
    }

    const res = await fetch(`${API_BASE}/predict_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })   // ← sends full array, not one comment
    });
    if (!res.ok) throw new Error(`/predict_batch returned ${res.status}`);
    return res.json();
}

/* ── Styles ─────────────────────────────────────────────────── */
function injectStyles() {
    if (document.getElementById('sentitube-styles')) return;
    const s = document.createElement('style');
    s.id = 'sentitube-styles';
    s.textContent = `
    .sentitube-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
      text-transform: uppercase; padding: 2px 9px;
      border-radius: 20px; border: 1px solid;
      margin-left: 8px; vertical-align: middle;
      font-family: 'Space Grotesk','Segoe UI',sans-serif;
      cursor: default; white-space: nowrap;
      position: relative; top: -1px;
      transition: transform 0.15s;
      user-select: none;
    }
    .sentitube-badge:hover { transform: scale(1.07); }
    .sentitube-badge .st-dot {
      width: 5px; height: 5px; border-radius: 50%; display: inline-block;
    }
    .sentitube-badge.positive { background:#0d2e1a; color:#4ade80; border-color:#166534; }
    .sentitube-badge.positive .st-dot { background:#4ade80; }
    .sentitube-badge.negative { background:#2e0d0d; color:#f87171; border-color:#991b1b; }
    .sentitube-badge.negative .st-dot { background:#f87171; }
    .sentitube-badge.neutral  { background:#2b2510; color:#facc15; border-color:#854d0e; }
    .sentitube-badge.neutral  .st-dot { background:#facc15; }
    .sentitube-badge.st-loading {
      background:#1a1a1a; color:#555; border-color:#333;
      animation: st-pulse 1s infinite;
    }
    .sentitube-badge.st-loading .st-dot { background:#555; }
    @keyframes st-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

    .sentitube-toast {
      position: fixed; bottom: 24px; right: 24px;
      background: #1c1c1e; color: #fff;
      font-family: 'Space Grotesk','Segoe UI',sans-serif;
      font-size: 13px; font-weight: 500;
      padding: 10px 18px; border-radius: 8px;
      border: 1px solid #333; z-index: 99999;
      display: flex; align-items: center; gap: 10px;
      animation: st-in 0.3s ease;
    }
    @keyframes st-in  { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes st-out { to{transform:translateY(20px);opacity:0} }
  `;
    document.head.appendChild(s);
}

function showToast(msg, icon = '✅') {
    document.querySelector('.sentitube-toast')?.remove();
    const t = document.createElement('div');
    t.className = 'sentitube-toast';
    t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'st-out 0.3s ease forwards';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

/* ── Main: collect unlabeled comments → one batch call ──────── */
async function labelComments() {
    injectStyles();

    const selectors = [
        'ytd-comment-thread-renderer #content-text',
        'ytd-comment-renderer #content-text',
        'yt-formatted-string#content-text'
    ];

    let allCommentEls = [];
    for (const sel of selectors) {
        const found = [...document.querySelectorAll(sel)];
        if (found.length) { allCommentEls = found; break; }
    }

    if (!allCommentEls.length) {
        showToast('No comments found — scroll down to load them first.', '⚠️');
        return { count: 0, positive: 0, negative: 0, neutral: 0 };
    }

    // Skip comments that already have a badge (incremental labeling)
    const unlabeled = allCommentEls.filter(el => {
        const parent = el.closest('ytd-comment-renderer, ytd-comment-thread-renderer') || el.parentElement;
        return !parent.querySelector('.sentitube-badge');
    });

    if (!unlabeled.length) {
        showToast('All visible comments are already labeled.', 'ℹ️');
        return { count: 0, positive: 0, negative: 0, neutral: 0 };
    }

    // Build batch payload + insert loading badges immediately
    const batchPayload = [];    // sent to API: [ { comment_id, comment_text }, ... ]
    const badgeMap = new Map(); // comment_id → loading badge DOM node

    unlabeled.forEach((el, i) => {
        const id = `st-${Date.now()}-${i}`;

        batchPayload.push({
            comment_id: id,
            comment_text: el.innerText.trim()
        });

        const loadingBadge = document.createElement('span');
        loadingBadge.className = 'sentitube-badge st-loading';
        loadingBadge.innerHTML = `<span class="st-dot"></span>…`;
        el.after(loadingBadge);

        badgeMap.set(id, loadingBadge);
    });

    showToast(`Analyzing ${unlabeled.length} comment${unlabeled.length > 1 ? 's' : ''}…`, '🔍');

    // One batch API call
    let results = [];
    try {
        const data = await fetchBatchSentiment(batchPayload);
        results = data.results || [];
    } catch (err) {
        badgeMap.forEach(badge => badge.remove());
        showToast(`API error: ${err.message}`, '❌');
        return { count: 0, positive: 0, negative: 0, neutral: 0 };
    }

    // Replace each loading badge with the real sentiment badge
    // and count the tally — this is what popup.js reads for the stat cards
    const tally = { positive: 0, negative: 0, neutral: 0 };
    let labeled = 0;

    results.forEach(result => {
        const sentiment = result.sentiment || 'neutral';
        const confidence = result.confidence != null
            ? ` — ${Math.round(result.confidence * 100)}% confidence`
            : '';

        const badge = badgeMap.get(result.comment_id);
        if (badge) {
            badge.className = `sentitube-badge ${sentiment}`;
            badge.title = `SentiTube: ${sentiment}${confidence}`;
            badge.innerHTML = `<span class="st-dot"></span>${sentiment}`;
        }

        if (sentiment in tally) tally[sentiment]++;
        labeled++;
    });

    // Remove any loading badges the API didn't return a result for
    badgeMap.forEach(badge => {
        if (badge.classList.contains('st-loading')) badge.remove();
    });

    if (labeled > 0) {
        showToast(`Labeled ${labeled} comment${labeled > 1 ? 's' : ''}`, '🎯');
    }

    // Return real counts — popup.js adds these to its running totals
    return {
        count: labeled,
        positive: tally.positive,
        negative: tally.negative,
        neutral: tally.neutral
    };
}

function clearLabels() {
    document.querySelectorAll('.sentitube-badge').forEach(b => b.remove());
    showToast('Labels cleared', '🗑️');
}

/* ── Message listener ───────────────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'labelComments') {
        labelComments().then(sendResponse);
    } else if (msg.action === 'clearLabels') {
        clearLabels();
        sendResponse({ ok: true });
    } else if (msg.action === 'getVideoId') {
        const match = location.href.match(/[?&]v=([^&]+)/);
        sendResponse({ videoId: match ? match[1] : null });
    }
    return true;
});