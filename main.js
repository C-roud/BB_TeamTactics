// --- グローバル変数 ---
let courtContainer, players, playerInfoDiv, resetBtn, exportBtn, saveFrameBtn, timeDisplay, timelineCursor, timelineKeyframes, prevFrameBtn, nextFrameBtn, importBtn, csvFileInput, playPauseBtn;
let activePlayer = null, selectedPlayer = null;
let recordedData = [];
let currentTime = 0.0;
const maxTime = 24.0;
let isPlaying = false; // 再生中かどうかの状態
let playbackInterval = null; // 再生タイマーのID

// ===================================================================
//  初期化処理
// ===================================================================
document.addEventListener('DOMContentLoaded', initialize);

/**
 * アプリケーションを初期化する関数
 */
function initialize() {
    // HTML要素をまとめて取得
    courtContainer = document.getElementById('court-container');
    players = document.querySelectorAll('.player');
    playerInfoDiv = document.getElementById('player-info');
    resetBtn = document.getElementById('reset-btn');
    exportBtn = document.getElementById('export-btn');
    saveFrameBtn = document.getElementById('save-frame-btn');
    timeDisplay = document.getElementById('time-display');
    timelineCursor = document.getElementById('timeline-cursor');
    timelineKeyframes = document.getElementById('timeline-keyframes');
    prevFrameBtn = document.getElementById('prev-frame-btn');
    nextFrameBtn = document.getElementById('next-frame-btn');
    importBtn = document.getElementById('import-btn');
    csvFileInput = document.getElementById('csv-file-input');
    playPauseBtn = document.getElementById('play-pause-btn');

    // マウス操作とタッチ操作の両方に対応
    courtContainer.addEventListener('mousedown', dragStart);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', dragEnd);
    courtContainer.addEventListener('touchstart', dragStart, { passive: false });
    window.addEventListener('touchmove', drag, { passive: false });
    window.addEventListener('touchend', dragEnd);
    
    // イベントリスナーを登録
    courtContainer.addEventListener('click', selectPlayer);
    resetBtn.addEventListener('click', resetRecording);
    exportBtn.addEventListener('click', exportCSV);
    saveFrameBtn.addEventListener('click', saveCurrentFrame);
    prevFrameBtn.addEventListener('click', () => navigateTime(-0.5));
    nextFrameBtn.addEventListener('click', () => navigateTime(0.5));
    importBtn.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', importCSV);
    playPauseBtn.addEventListener('click', togglePlayback); // 再生・停止ボタンのイベント

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') navigateTime(0.5);
        else if (e.key === 'ArrowLeft') navigateTime(-0.5);
        else if (e.key === ' ') { // スペースキーで再生/停止
            e.preventDefault();
            togglePlayback();
        }
    });

    document.getElementById('timeline-bar').addEventListener('click', (e) => {
        const bar = e.target;
        const rect = bar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = Math.round((percentage * maxTime) / 0.5) * 0.5;
        jumpToTime(newTime);
    });

    // 初期状態の設定
    exportBtn.disabled = true;
    updateStatusDisplay();
    updateTimelineUI();
    
    // ▼▼▼【今回の修正点】▼▼▼
    // アプリ起動時にCSSの初期配置をJavaScriptのスタイルに適用する
    resetPlayerPositions(); 
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲
}

// ===================================================================
//  ドラッグ＆ドロップ関連
// ===================================================================
function dragStart(e) {
    if (e.type === 'touchstart') {
        activePlayer = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    } else {
        activePlayer = e.target;
    }
    if (!activePlayer || !activePlayer.classList.contains('player')) {
        activePlayer = null;
    }
}

function drag(e) {
    if (activePlayer === null) return;
    e.preventDefault();
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    const courtRect = courtContainer.getBoundingClientRect();
    let x = clientX - courtRect.left - (activePlayer.offsetWidth / 2);
    let y = clientY - courtRect.top - (activePlayer.offsetHeight / 2);
    x = Math.max(0, Math.min(x, courtRect.width - activePlayer.offsetWidth));
    y = Math.max(0, Math.min(y, courtRect.height - activePlayer.offsetHeight));
    activePlayer.style.left = x + 'px';
    activePlayer.style.top = y + 'px';
    if (activePlayer === selectedPlayer) {
        updateStatusDisplay();
    }
}

function dragEnd() {
    activePlayer = null;
}

// ===================================================================
//  プレイヤー選択 と ステータス表示
// ===================================================================
function selectPlayer(e) {
    const clickedPlayer = e.target;
    if (!clickedPlayer.classList.contains('player')) {
        if (selectedPlayer) {
            selectedPlayer.classList.remove('selected');
            selectedPlayer = null;
            updateStatusDisplay();
        }
        return;
    }
    players.forEach(p => p.classList.remove('selected'));
    clickedPlayer.classList.add('selected');
    selectedPlayer = clickedPlayer;
    updateStatusDisplay();
}

function updateStatusDisplay() {
    if (selectedPlayer) {
        // ▼▼▼ バグ修正: CSSから初期値を取得する処理を追加 ▼▼▼
        const style = window.getComputedStyle(selectedPlayer);
        const x = Math.round(parseFloat(selectedPlayer.style.left || style.left || 0));
        const y = Math.round(parseFloat(selectedPlayer.style.top || style.top || 0));
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲
        const isBallHolder = selectedPlayer.classList.contains('ball-holder');
        playerInfoDiv.innerHTML = `
            <div class="info-item"><span>選手ID:</span><span>${selectedPlayer.id}</span></div>
            <div class="info-item"><span>X座標:</span><span>${x}</span></div>
            <div class="info-item"><span>Y座標:</span><span>${y}</span></div>
            <div class="info-item"><span>ボールマン:</span><span>${isBallHolder ? 'TRUE' : 'FALSE'}</span></div>
            <button id="toggle-ball-holder-btn" class="${isBallHolder ? 'is-ball-holder' : ''}">
                ${isBallHolder ? 'ボール保持を解除' : 'ボール保持者にする'}
            </button>
        `;
        document.getElementById('toggle-ball-holder-btn').addEventListener('click', toggleBallHolder);
    } else {
        playerInfoDiv.innerHTML = '<p>選手を選択してください</p>';
    }
}

function toggleBallHolder() {
    if (!selectedPlayer) return;
    const isCurrentlyBallHolder = selectedPlayer.classList.contains('ball-holder');
    players.forEach(p => p.classList.remove('ball-holder'));
    if (!isCurrentlyBallHolder) {
        selectedPlayer.classList.add('ball-holder');
    }
    updateStatusDisplay();
}

// ===================================================================
//  タイムライン と キーフレーム編集
// ===================================================================
function navigateTime(amount) {
    const newTime = currentTime + amount;
    jumpToTime(newTime);
}

function jumpToTime(time) {
    currentTime = Math.max(0, Math.min(parseFloat(time.toFixed(1)), maxTime));
    const frame = recordedData.find(d => parseFloat(d.timestamp) === currentTime);
    if (frame) {
        players.forEach(player => {
            const posData = frame.positions.find(p => p.id === player.id);
            if (posData) {
                player.style.left = posData.x + 'px';
                player.style.top = posData.y + 'px';
                player.classList.toggle('ball-holder', posData.ball === 1);
            }
        });
    }
    updateTimelineUI();
    if(selectedPlayer) updateStatusDisplay();
}

function saveCurrentFrame() {
    const frameTimestamp = currentTime.toFixed(1);
    const existingFrameIndex = recordedData.findIndex(d => d.timestamp === frameTimestamp);
    
    // ▼▼▼ バグ修正: CSSから初期値を取得する処理を追加 ▼▼▼
    const positions = Array.from(players).map(player => {
        const style = window.getComputedStyle(player);
        return {
            id: player.id,
            x: Math.round(parseFloat(player.style.left || style.left || 0)),
            y: Math.round(parseFloat(player.style.top || style.top || 0)),
            ball: player.classList.contains('ball-holder') ? 1 : 0
        };
    });
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲

    if (existingFrameIndex > -1) {
        recordedData[existingFrameIndex].positions = positions;
    } else {
        recordedData.push({ timestamp: frameTimestamp, positions: positions });
        recordedData.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp));
    }
    exportBtn.disabled = recordedData.length === 0;
    renderTimelineKeyframes();
}

function updateTimelineUI() {
    timeDisplay.textContent = currentTime.toFixed(1);
    const percentage = (currentTime / maxTime) * 100;
    timelineCursor.style.left = `${percentage}%`;
}

function renderTimelineKeyframes() {
    timelineKeyframes.innerHTML = '';
    recordedData.forEach(frame => {
        const marker = document.createElement('div');
        marker.className = 'keyframe-marker';
        const percentage = (parseFloat(frame.timestamp) / maxTime) * 100;
        marker.style.left = `${percentage}%`;
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            jumpToTime(parseFloat(frame.timestamp));
        });
        timelineKeyframes.appendChild(marker);
    });
}

// ===================================================================
//  再生・停止機能
// ===================================================================
function togglePlayback() {
    if (isPlaying) {
        pausePlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (recordedData.length === 0) return; // データがなければ何もしない
    isPlaying = true;
    playPauseBtn.textContent = '停止 ⏸';
    
    if (currentTime >= maxTime) {
        jumpToTime(0.0);
    }
    
    playbackInterval = setInterval(() => {
        navigateTime(0.5);
        if (currentTime >= maxTime) {
            pausePlayback();
        }
    }, 500); // 0.5秒ごとにコマ送り
}

function pausePlayback() {
    isPlaying = false;
    playPauseBtn.textContent = '再生 ▶';
    clearInterval(playbackInterval);
}

// ===================================================================
//  操作パネル機能
// ===================================================================
function resetPlayerPositions() {
    const initialPositions = {
        'red1': { x: 319, y: 249 }, 'red2': { x: 238, y: 442 }, 'red3': { x: 238, y: 62 },
        'red4': { x: 38, y: 503 }, 'red5': { x: 38, y: 2 }, 'blue1': { x: 283, y: 250 },
        'blue2': { x: 213, y: 414 }, 'blue3': { x: 215, y: 90 }, 'blue4': { x: 39, y: 462 },
        'blue5': { x: 34, y: 35 }
    };
    players.forEach(player => {
        const pos = initialPositions[player.id];
        if (pos) {
            player.style.left = `${pos.x}px`;
            player.style.top = `${pos.y}px`;
        }
    });
}

function resetRecording() {
    pausePlayback(); // リセット時に再生中なら停止する
    const confirmReset = confirm("本当にすべてのデータをリセットしますか？");
    if (confirmReset) {
        recordedData = [];
        jumpToTime(0.0);
        exportBtn.disabled = true;
        renderTimelineKeyframes();
        resetPlayerPositions();
    }
}

function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvText = e.target.result;
            const lines = csvText.trim().split('\n');
            const headers = lines.shift().trim().split(',');
            if (headers[0] !== 'timestamp') {
                throw new Error('無効なCSVファイル形式です。ヘッダーが正しくありません。');
            }
            const newRecordedData = lines.map(line => {
                const values = line.trim().split(',');
                const frame = {
                    timestamp: values[0],
                    positions: []
                };
                for (let i = 1; i < headers.length; i += 3) {
                    const id = headers[i].replace('_x', '');
                    frame.positions.push({
                        id: id,
                        x: parseInt(values[i]),
                        y: parseInt(values[i + 1]),
                        ball: parseInt(values[i + 2])
                    });
                }
                return frame;
            });
            recordedData = newRecordedData;
            alert(`${file.name} を正常にインポートしました。`);
            jumpToTime(0.0);
            renderTimelineKeyframes();
            exportBtn.disabled = recordedData.length === 0;
        } catch (error) {
            alert(`インポートに失敗しました。\nエラー: ${error.message}`);
        } finally {
            csvFileInput.value = '';
        }
    };
    reader.readAsText(file);
}

function exportCSV() {
    if (recordedData.length === 0) {
        alert("エクスポートするデータがありません。");
        return;
    }

    // 1. 全てのタイムスタンプを0.5秒ごとに生成
    const lastTimestamp = Math.max(...recordedData.map(d => parseFloat(d.timestamp)));
    const allTimestamps = [];
    for (let t = 0; t <= lastTimestamp; t += 0.5) {
        allTimestamps.push(t.toFixed(1));
    }
    
    // 2. 補完されたデータを作成
    const interpolatedData = allTimestamps.map(ts => {
        const frame = { timestamp: ts, positions: {} };
        players.forEach(player => {
            // ts以前で最も新しいキーフレームを探す
            const lastRelevantFrame = recordedData
                .filter(d => parseFloat(d.timestamp) <= parseFloat(ts))
                .pop();
            
            let pos = null;
            if (lastRelevantFrame) {
                pos = lastRelevantFrame.positions.find(p => p.id === player.id);
            }
            
            // ▼▼▼ バグ修正: 直前のデータがない(t=0)場合はCSSから読み取る ▼▼▼
            if (lastRelevantFrame === undefined) { 
                const style = window.getComputedStyle(player);
                pos = {
                    x: Math.round(parseFloat(style.left || 0)),
                    y: Math.round(parseFloat(style.top || 0)),
                    ball: 0 // t=0ではボール保持者はいないと仮定
                };
            }
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲

            frame.positions[player.id] = pos || { x: 0, y: 0, ball: 0 };
        });
        return frame;
    });

    // 3. CSV文字列を生成
    const playerIDs = Array.from(players).map(p => p.id).sort();
    const headers = ['timestamp', ...playerIDs.flatMap(id => [`${id}_x`, `${id}_y`, `${id}_ball`])];
    
    const rows = interpolatedData.map(frame => {
        const row = [frame.timestamp];
        playerIDs.forEach(id => {
            const pos = frame.positions[id];
            row.push(pos.x, pos.y, pos.ball);
        });
        return row.join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');

    // 4. ダウンロード処理
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const MIN = String(now.getMinutes()).padStart(2, '0');
    const SS = String(now.getSeconds()).padStart(2, '0');
    const fileName = `tactics_${YYYY}${MM}${DD}_${HH}${MIN}${SS}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}