// --- グローバル定数 ---
const PLAYER_IDS = ['blue1', 'blue2', 'blue3', 'blue4', 'blue5', 'red1', 'red2', 'red3', 'red4', 'red5'];

// ▼▼▼【あなたのエリア定義に合わせて、この10個の説明を書き換えてください】▼▼▼
const AREA_DEFINITIONS = [
    { label: "エリア1", description: "右コーナー3P" },
    { label: "エリア2", description: "右ウィング3P" },
    { label: "エリア3", description: "トップ3P" },
    { label: "エリア4", description: "左ウィング3P" },
    { label: "エリア5", description: "左コーナー3P" },
    { label: "エリア6", description: "右ミドル" },
    { label: "エリア7", description: "左ミドル" },
    { label: "エリア8", description: "ハイポスト" },
    { label: "エリア9", description: "ゴール下(右)" },
    { label: "エリア10", description: "ゴール下(左)" }
];
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// --- グローバル変数 ---
// モーダル関連
let modalOverlay, mainContent, importProfilesBtn, exportProfilesBtn, profilesCsvInput, playerProfilesForm, proceedToBoardBtn;
// 戦術ボード関連
let courtContainer, players, playerInfoDiv, resetBtn, exportBtn, saveFrameBtn, timeDisplay, timelineCursor, timelineKeyframes, prevFrameBtn, nextFrameBtn, importBtn, csvFileInput, playPauseBtn;
// 状態・データ管理
let activePlayer = null, selectedPlayer = null;
let recordedData = []; // 戦術データ
let playerProfiles = {}; // 選手データ
let currentTime = 0.0;
const maxTime = 24.0;
let isPlaying = false;
let playbackInterval = null;

// ===================================================================
//  初期化処理
// ===================================================================
document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
    // --- モーダル関連の要素を取得 ---
    modalOverlay = document.getElementById('modal-overlay');
    mainContent = document.getElementById('main-content');
    importProfilesBtn = document.getElementById('import-profiles-btn');
    exportProfilesBtn = document.getElementById('export-profiles-btn');
    profilesCsvInput = document.getElementById('profiles-csv-input');
    playerProfilesForm = document.getElementById('player-profiles-form');
    proceedToBoardBtn = document.getElementById('proceed-to-board-btn');

    // --- 戦術ボード関連の要素を取得 ---
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
    importBtn = document.getElementById('import-btn'); // 戦術CSVインポート
    csvFileInput = document.getElementById('csv-file-input'); // 戦術CSVインポート
    playPauseBtn = document.getElementById('play-pause-btn');

    // --- モーダル関連のイベントリスナー ---
    importProfilesBtn.addEventListener('click', () => profilesCsvInput.click());
    profilesCsvInput.addEventListener('change', importPlayerProfiles);
    exportProfilesBtn.addEventListener('click', exportPlayerProfiles);
    proceedToBoardBtn.addEventListener('click', closeModal);
    // フォームの入力内容をリアルタイムで監視
    playerProfilesForm.addEventListener('input', validateProfileForm);
    // 選手登録フォームを動的に生成
    generateProfileForm();

    // --- 戦術ボード関連のイベントリスナー ---
    courtContainer.addEventListener('mousedown', dragStart);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', dragEnd);
    courtContainer.addEventListener('touchstart', dragStart, { passive: false });
    window.addEventListener('touchmove', drag, { passive: false });
    window.addEventListener('touchend', dragEnd);
    
    courtContainer.addEventListener('click', selectPlayer);
    resetBtn.addEventListener('click', resetRecording);
    exportBtn.addEventListener('click', exportTacticsCSV); 
    saveFrameBtn.addEventListener('click', saveCurrentFrame);
    prevFrameBtn.addEventListener('click', () => navigateTime(-0.5));
    nextFrameBtn.addEventListener('click', () => navigateTime(0.5));
    importBtn.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', importTacticsCSV);
    playPauseBtn.addEventListener('click', togglePlayback);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') navigateTime(0.5);
        else if (e.key === 'ArrowLeft') navigateTime(-0.5);
        else if (e.key === ' ') {
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

    // --- 戦術ボードの初期状態設定 ---
    exportBtn.disabled = true;
    updateStatusDisplay();
    updateTimelineUI();
    resetPlayerPositions(); 
}

// ===================================================================
//  選手データ・モーダル関連の関数
// ===================================================================

/**
 * ▼▼▼【更新点】▼▼▼
 * 選手登録フォームのHTMLを動的に生成する (ヘッダーラベルに説明文を追加)
 */
function generateProfileForm() {
    // 1. 説明文の追加
    let formHTML = '<p class="form-instruction"><b>入力形式:</b> 身長は[cm]、各エリアのシュート率は <b>0〜100 の数字（百分率）</b>で入力してください (例: 80)。</p>';
    
    // 2. ヘッダー行の追加 (ラベルに説明文を<br>で追加)
    formHTML += `<div class="profile-input-row header-row">`;
    formHTML += `<label>選手ID</label>`;
    formHTML += `<label>身長<br>(cm)</label>`;
    AREA_DEFINITIONS.forEach((area, index) => {
        // 例: "エリア1<br>(右コーナー3P)" というHTMLを生成
        formHTML += `<label title="${area.description}">${area.label}<br>(${area.description})</label>`;
    });
    formHTML += `</div>`;

    // 3. 各選手の入力行を生成
    PLAYER_IDS.forEach(id => {
        formHTML += `<div class="profile-input-row" id="profile-row-${id}">`;
        formHTML += `<label>${id.toUpperCase()}</label>`; // Column 1: ID
        formHTML += `<input type="number" name="height_${id}" placeholder="cm" data-id="${id}" data-field="height">`; // Column 2: Height
        AREA_DEFINITIONS.forEach((area, index) => { // Columns 3-12: Areas
            formHTML += `<input type="number" name="area_${index + 1}_${id}" placeholder="%" min="0" max="100" data-id="${id}" data-field="area_${index + 1}">`;
        });
        formHTML += `</div>`;
    });
    playerProfilesForm.innerHTML = formHTML;
}

/**
 * フォームがすべて入力されているか検証し、OKならボタンを有効化
 */
function validateProfileForm() {
    let allValid = true;
    playerProfiles = {};
    
    for (const id of PLAYER_IDS) {
        const heightInput = document.querySelector(`input[name="height_${id}"]`);
        if (heightInput.value.trim() === '') allValid = false;
        
        playerProfiles[id] = {
            height: heightInput.value || 0
        };
        
        for (let i = 1; i <= AREA_DEFINITIONS.length; i++) {
            const areaInput = document.querySelector(`input[name="area_${i}_${id}"]`);
            if (areaInput.value.trim() === '') allValid = false;
            playerProfiles[id][`area_${i}`] = areaInput.value || 0;
        }
    }
    
    proceedToBoardBtn.disabled = !allValid;
    return allValid;
}

/**
 * モーダルを閉じて戦術ボードへ進む
 */
function closeModal() {
    modalOverlay.style.display = 'none'; // モーダルを非表示
    mainContent.classList.remove('content-locked'); // メインコンテンツのロック解除
    document.body.style.overflow = 'auto'; // ページのスクロールを許可
}

/**
 * 選手プロフィールCSVをインポートする
 */
function importPlayerProfiles(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvText = e.target.result;
            const lines = csvText.trim().split('\n');
            const headers = lines.shift().trim().split(','); // "player_id", "height", "area_1", ...

            lines.forEach(line => {
                const values = line.trim().split(',');
                const profile = {};
                headers.forEach((header, i) => profile[header] = values[i]);
                
                const id = profile.player_id;
                if (PLAYER_IDS.includes(id)) {
                    // フォームに値を設定
                    document.querySelector(`input[name="height_${id}"]`).value = profile.height;
                    for (let i = 1; i <= AREA_DEFINITIONS.length; i++) {
                        document.querySelector(`input[name="area_${i}_${id}"]`).value = profile[`area_${i}`];
                    }
                }
            });
            validateProfileForm();
            alert('選手プロフィールをインポートしました。');
        } catch (error) {
            alert(`インポートに失敗しました。\nエラー: ${error.message}`);
        } finally {
            profilesCsvInput.value = '';
        }
    };
    reader.readAsText(file);
}

/**
 * 選手プロフィールCSVをエクスポートする
 */
function exportPlayerProfiles() {
    if (!validateProfileForm()) {
        alert('CSVをエクスポートするには、全ての選手データを入力してください。');
        return;
    }
    
    // CSVのヘッダーは "area_1", "area_2"... のまま変更しない
    const headers = ['player_id', 'height', ...AREA_DEFINITIONS.map((area, i) => `area_${i + 1}`)];
    const rows = [headers.join(',')];
    
    for (const id of PLAYER_IDS) {
        const row = [
            id,
            playerProfiles[id].height,
            ...AREA_DEFINITIONS.map((area, i) => playerProfiles[id][`area_${i + 1}`])
        ];
        rows.push(row.join(','));
    }
    
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "player_profiles.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        const style = window.getComputedStyle(selectedPlayer);
        const x = Math.round(parseFloat(selectedPlayer.style.left || style.left || 0));
        const y = Math.round(parseFloat(selectedPlayer.style.top || style.top || 0));
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
    
    const positions = Array.from(players).map(player => {
        const style = window.getComputedStyle(player);
        return {
            id: player.id,
            x: Math.round(parseFloat(player.style.left || style.left || 0)),
            y: Math.round(parseFloat(player.style.top || style.top || 0)),
            ball: player.classList.contains('ball-holder') ? 1 : 0
        };
    });

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
    if (recordedData.length === 0) return;
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
    }, 500);
}

function pausePlayback() {
    isPlaying = false;
    playPauseBtn.textContent = '再生 ▶';
    clearInterval(playbackInterval);
}

// ===================================================================
//  操作パネル機能（リセット・インポート・エクスポート）
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
    pausePlayback();
    const confirmReset = confirm("本当にすべての戦術データをリセットしますか？");
    if (confirmReset) {
        recordedData = [];
        jumpToTime(0.0);
        exportBtn.disabled = true;
        renderTimelineKeyframes();
        resetPlayerPositions();
    }
}

/**
 * 戦術CSVをインポートする
 */
function importTacticsCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvText = e.target.result;
            const lines = csvText.trim().split('\n');
            const headers = lines.shift().trim().split(',');
            if (headers[0] !== 'timestamp') {
                throw new Error('無効な戦術CSVファイル形式です。ヘッダーが正しくありません。');
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

/**
 * 戦術CSVをエクスポートする
 */
function exportTacticsCSV() {
    if (recordedData.length === 0) {
        alert("エクスポートする戦術データがありません。");
        return;
    }

    const lastTimestamp = Math.max(...recordedData.map(d => parseFloat(d.timestamp)));
    const allTimestamps = [];
    for (let t = 0; t <= lastTimestamp; t += 0.5) {
        allTimestamps.push(t.toFixed(1));
    }
    
    const interpolatedData = allTimestamps.map(ts => {
        const frame = { timestamp: ts, positions: {} };
        players.forEach(player => {
            const lastRelevantFrame = recordedData
                .filter(d => parseFloat(d.timestamp) <= parseFloat(ts))
                .pop();
            
            let pos = null;
            if (lastRelevantFrame) {
                pos = lastRelevantFrame.positions.find(p => p.id === player.id);
            }
            
            if (lastRelevantFrame === undefined) { 
                const style = window.getComputedStyle(player);
                pos = {
                    x: Math.round(parseFloat(style.left || 0)),
                    y: Math.round(parseFloat(style.top || 0)),
                    ball: 0
                };
            }
            
            frame.positions[player.id] = pos || { x: 0, y: 0, ball: 0 };
        });
        return frame;
    });

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