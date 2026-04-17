/* ============================================================
   SentiTube v3 – popup.js

   ── WHERE TO SET YOUR API URL ────────────────────────────────
   Change API_BASE below. All fetch() calls in this file use it.

   ── SIMULATE MODE ────────────────────────────────────────────
   SIMULATE = true  → fake responses, no real HTTP calls.
   SIMULATE = false → real API calls to API_BASE.
   ============================================================ */

const API_BASE = 'http://localhost:8000';
const SIMULATE = false;

/* ── DOM refs ─────────────────────────────────────────────── */
// Tab 1
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const ps1Dot = document.getElementById('ps1-dot');
const ps1Text = document.getElementById('ps1-text');
const statsBox = document.getElementById('statsBox');
const posCount = document.getElementById('posCount');
const negCount = document.getElementById('negCount');
const neuCount = document.getElementById('neuCount');

// Tab 2
const fetchAnalysisBtn = document.getElementById('fetchAnalysisBtn');
const clearAnalysisBtn = document.getElementById('clearAnalysisBtn');
const ps2Dot = document.getElementById('ps2-dot');
const ps2Text = document.getElementById('ps2-text');
const videoIdBox = document.getElementById('videoIdBox');
const videoIdVal = document.getElementById('videoIdVal');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const sentBarWrap = document.getElementById('sentBarWrap');
const barPos = document.getElementById('barPos');
const barNeg = document.getElementById('barNeg');
const barNeu = document.getElementById('barNeu');
const lblPos = document.getElementById('lblPos');
const lblNeg = document.getElementById('lblNeg');
const lblNeu = document.getElementById('lblNeu');
const wordcloudWrap = document.getElementById('wordcloudWrap');
const wordcloudImg = document.getElementById('wordcloudImg');
const engWrap = document.getElementById('engWrap');
const engGrid = document.getElementById('engGrid');
const trendWrap = document.getElementById('trendWrap');
const trendBars = document.getElementById('trendBars');
const commentsWrap = document.getElementById('commentsWrap');
const commentList = document.getElementById('commentList');

/* Running totals for Tab 1 — accumulated across multiple
   "Analyze" clicks as the user scrolls and loads more comments */
let totalPos = 0, totalNeg = 0, totalNeu = 0;

/* ── Tab switching ────────────────────────────────────────── */
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
});

/* ── On load: detect page & extract video ID ─────────────── */
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = tab?.url || '';
    const onVideo = url.includes('youtube.com/watch');
    const onYT = url.includes('youtube.com');

    // Tab 1
    if (onVideo) {
        ps1Dot.className = 'status-dot green';
        ps1Text.textContent = 'YouTube video detected ✓';
        analyzeBtn.disabled = false;
    } else {
        ps1Dot.className = 'status-dot red';
        ps1Text.textContent = onYT ? 'Open a video to label comments' : 'Not on YouTube';
    }

    // Tab 2
    const match = url.match(/[?&]v=([^&]+)/);
    const videoId = match ? match[1] : null;

    if (videoId) {
        ps2Dot.className = 'status-dot green';
        ps2Text.textContent = 'Video ready for analysis ✓';
        show(videoIdBox);
        videoIdVal.textContent = videoId;
        fetchAnalysisBtn.disabled = false;
        fetchAnalysisBtn.dataset.videoId = videoId;
    } else {
        ps2Dot.className = 'status-dot red';
        ps2Text.textContent = onYT ? 'Open a YouTube video first' : 'Not on YouTube';
    }
});

/* ── Helpers ─────────────────────────────────────────────── */
function show(el) { el.style.display = 'block'; }
function hide(el) { el.style.display = 'none'; }

function setProgress(pct) {
    progressWrap.style.display = 'block';
    progressBar.style.width = `${pct}%`;
    if (pct >= 100) setTimeout(() => { progressWrap.style.display = 'none'; }, 600);
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ════════════════════════════════════════════════════════════
   TAB 1 — Label visible comments
   ──────────────────────────────────────────────────────────
   content.js does the actual API call (POST /predict_batch).
   It returns { count, positive, negative, neutral } which
   we use directly — no client-side randomization needed.
════════════════════════════════════════════════════════════ */

analyzeBtn.addEventListener('click', () => {
    analyzeBtn.textContent = 'Labeling…';
    analyzeBtn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.tabs.sendMessage(tab.id, { action: 'labelComments' }, response => {
            analyzeBtn.textContent = 'Analyze Visible Comments';
            analyzeBtn.disabled = false;

            if (chrome.runtime.lastError || !response) {
                ps1Text.textContent = 'Reload the YouTube tab first';
                ps1Dot.className = 'status-dot red';
                return;
            }

            const { count, positive = 0, negative = 0, neutral = 0 } = response;

            if (count > 0) {
                /* Accumulate totals so repeated clicks (scroll → analyze → scroll more
                   → analyze again) show a running total in the stat cards */
                totalPos += positive;
                totalNeg += negative;
                totalNeu += neutral;

                posCount.textContent = totalPos;
                negCount.textContent = totalNeg;
                neuCount.textContent = totalNeu;

                statsBox.style.display = 'grid';
                clearBtn.style.display = 'block';

                ps1Text.textContent = `${count} new comment${count > 1 ? 's' : ''} labeled`;
                ps1Dot.className = 'status-dot green';
            } else {
                /* count === 0 means either no comments loaded yet, or all are
                   already labeled — content.js sends a toast explaining which */
                ps1Text.textContent = 'No new comments to label';
            }
        });
    });
});

clearBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.tabs.sendMessage(tab.id, { action: 'clearLabels' });
        totalPos = totalNeg = totalNeu = 0;
        posCount.textContent = negCount.textContent = neuCount.textContent = '0';
        statsBox.style.display = 'none';
        clearBtn.style.display = 'none';
        ps1Text.textContent = 'Labels cleared';
        ps1Dot.className = 'status-dot yellow';
    });
});

/* ════════════════════════════════════════════════════════════
   TAB 2 — Video-level analysis
   ──────────────────────────────────────────────────────────
   ENDPOINT:  POST {API_BASE}/analyze_video
   See README.md for full request / response contract.
════════════════════════════════════════════════════════════ */

/* ── Simulate response ──────────────────────────────────── */
async function simulateVideoAnalysis(videoId) {
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

    const rand = (a, b) => Math.round(a + Math.random() * (b - a));
    const flt = (a, b) => parseFloat((a + Math.random() * (b - a)).toFixed(1));

    const totalFetched = rand(150, 800);
    const posP = flt(40, 65);
    const negP = flt(10, 28);
    const neuP = parseFloat(Math.max(0, 100 - posP - negP).toFixed(1));

    const sentOptions = ['positive', 'negative', 'neutral'];
    const weights = [posP / 100, negP / 100, neuP / 100];
    function weighted() {
        const r = Math.random();
        if (r < weights[0]) return 'positive';
        if (r < weights[0] + weights[1]) return 'negative';
        return 'neutral';
    }

    const sampleTexts = [
        "Absolutely incredible, watched it three times already!",
        "The editing on this is top notch, really impressed.",
        "Not sure I agree with the point at 4:30 but interesting.",
        "Why does this only have 10k views? Deserves millions.",
        "Audio quality could use improvement honestly.",
        "This is exactly what I needed today, thank you!",
        "Clickbait title, content doesn't match at all.",
        "Subscribed. Best channel I've found this year.",
        "Background music is too loud, couldn't hear narration.",
        "Finally someone explains this properly. Bookmarked.",
        "Meh, nothing new here I haven't seen before.",
        "3:45 is the best part, that transition was smooth.",
        "Please do a follow-up on part 2!",
        "Thumbnail brought me here and I was not disappointed.",
        "Could you share the resources in the description?",
        "First time on this channel, instant subscribe.",
        "The intro was too long, almost skipped.",
        "Brilliant breakdown, very easy to follow.",
        "I've been looking for this explanation for weeks.",
        "Decent video but could be much shorter.",
        "Love the production quality on this one.",
        "The host really knows their stuff.",
        "Came for the thumbnail, stayed for the content.",
        "Not bad but the pacing feels off.",
        "This changed how I think about the topic completely."
    ];

    const top_comments = sampleTexts.slice(0, 25).map((text, i) => ({
        comment_id: `yt_${videoId}_${i}`,
        author: `@user_${rand(100, 9999)}`,
        text,
        likes: rand(10, 3200),
        reply_count: rand(0, 80),
        sentiment: weighted(),
        confidence: parseFloat((0.72 + Math.random() * 0.27).toFixed(2))
    }));

    return {
        video_id: videoId,
        summary: {
            total_comments_fetched: totalFetched,
            positive_pct: posP,
            negative_pct: negP,
            neutral_pct: neuP,
            avg_confidence: parseFloat((0.80 + Math.random() * 0.15).toFixed(2))
        },
        engagement: {
            total_likes: rand(5000, 80000),
            avg_likes_per_comment: flt(15, 120),
            top_comment_likes: rand(800, 5000),
            total_replies: rand(50, 600)
        },
        trend: top_comments.map(c => c.sentiment),
        wordcloud_image: null,  // real server sends base64 PNG or URL
        top_comments
    };
}

/* ── Real API call ──────────────────────────────────────── */
async function fetchVideoAnalysis(videoId) {
    if (SIMULATE) return simulateVideoAnalysis(videoId);

    const res = await fetch(`${API_BASE}/analyze_video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, max_comments: 25 })
    });
    if (!res.ok) throw new Error(`/analyze_video returned ${res.status}`);
    return res.json();
}

/* ── Render ─────────────────────────────────────────────── */
function renderAnalysis(data) {
    const s = data.summary;

    // Overall sentiment % bar
    barPos.style.width = `${s.positive_pct}%`;
    barNeg.style.width = `${s.negative_pct}%`;
    barNeu.style.width = `${s.neutral_pct}%`;
    lblPos.textContent = `${s.positive_pct}% Pos`;
    lblNeg.textContent = `${s.negative_pct}% Neg`;
    lblNeu.textContent = `${s.neutral_pct}% Neu`;
    show(sentBarWrap);

    // Word cloud — base64 PNG or URL both work in <img src>
    if (data.wordcloud_image) {
        wordcloudImg.innerHTML = `<img src="${escapeHtml(data.wordcloud_image)}" alt="word cloud" style="width:100%;border-radius:8px;display:block;">`;
    } else {
        wordcloudImg.innerHTML = `<div style="color:#555;font-size:11px;text-align:center;padding:22px 14px;line-height:1.6;">
      Word cloud renders here.<br>
      API must return <code style="color:#888">wordcloud_image</code><br>
      as a base64 PNG or hosted URL.
    </div>`;
    }
    show(wordcloudWrap);

    // Engagement metrics
    const e = data.engagement;
    engGrid.innerHTML = `
    <div class="eng-card">
      <div class="eng-label">Total Comments</div>
      <div class="eng-value">${s.total_comments_fetched.toLocaleString()}</div>
      <div class="eng-sub">fetched from YouTube</div>
    </div>
    <div class="eng-card">
      <div class="eng-label">Total Likes</div>
      <div class="eng-value">${e.total_likes.toLocaleString()}</div>
      <div class="eng-sub">avg ${e.avg_likes_per_comment}/comment</div>
    </div>
    <div class="eng-card">
      <div class="eng-label">Top Comment</div>
      <div class="eng-value">${e.top_comment_likes.toLocaleString()}</div>
      <div class="eng-sub">likes on best comment</div>
    </div>
    <div class="eng-card">
      <div class="eng-label">Avg Confidence</div>
      <div class="eng-value">${Math.round(s.avg_confidence * 100)}%</div>
      <div class="eng-sub">model score</div>
    </div>
  `;
    show(engWrap);

    // Sentiment trend chart
    if (data.trend?.length) {
        trendBars.innerHTML = '';
        const MAX_H = 44;
        const heights = { positive: MAX_H, neutral: Math.round(MAX_H * 0.55), negative: Math.round(MAX_H * 0.3) };
        data.trend.forEach((sent, i) => {
            const col = document.createElement('div');
            col.className = 'trend-bar-col';
            const cls = sent === 'positive' ? 'pos' : sent === 'negative' ? 'neg' : 'neu';
            col.innerHTML = `
        <div class="trend-bar-inner ${cls}" style="height:${heights[sent] || 20}px"></div>
        <div class="trend-label">${i + 1}</div>
      `;
            trendBars.appendChild(col);
        });
        show(trendWrap);
    }

    // Top 25 comments
    if (data.top_comments?.length) {
        commentList.innerHTML = data.top_comments.map(c => `
      <div class="cmt-item">
        <span class="cmt-badge ${c.sentiment}">${c.sentiment}</span>
        <div>
          <div class="cmt-text">${escapeHtml(c.text)}</div>
          <div class="cmt-meta">
            ${escapeHtml(c.author)}
            · ${c.likes.toLocaleString()} likes
            · ${c.reply_count} replies
            · ${Math.round(c.confidence * 100)}% conf
          </div>
        </div>
      </div>
    `).join('');
        show(commentsWrap);
    }
}

function clearAnalysisResults() {
    [sentBarWrap, wordcloudWrap, engWrap, trendWrap, commentsWrap].forEach(hide);
    barPos.style.width = barNeg.style.width = barNeu.style.width = '0%';
    wordcloudImg.innerHTML = `<div style="color:#555;font-size:11px;text-align:center;padding:22px;">Word cloud will appear here</div>`;
    engGrid.innerHTML = trendBars.innerHTML = commentList.innerHTML = '';
    clearAnalysisBtn.style.display = 'none';
}

fetchAnalysisBtn.addEventListener('click', async () => {
    const videoId = fetchAnalysisBtn.dataset.videoId;
    if (!videoId) return;

    fetchAnalysisBtn.textContent = 'Fetching…';
    fetchAnalysisBtn.disabled = true;
    clearAnalysisResults();
    setProgress(20);

    try {
        setProgress(55);
        const data = await fetchVideoAnalysis(videoId);
        setProgress(100);
        renderAnalysis(data);
        clearAnalysisBtn.style.display = 'block';
        ps2Text.textContent = `Done · ${data.summary.total_comments_fetched} comments analyzed`;
        ps2Dot.className = 'status-dot green';
    } catch (err) {
        setProgress(100);
        ps2Text.textContent = `Error: ${err.message}`;
        ps2Dot.className = 'status-dot red';
    }

    fetchAnalysisBtn.textContent = 'Fetch Video Analysis';
    fetchAnalysisBtn.disabled = false;
});

clearAnalysisBtn.addEventListener('click', () => {
    clearAnalysisResults();
    ps2Text.textContent = 'Video ready for analysis ✓';
    ps2Dot.className = 'status-dot green';
});