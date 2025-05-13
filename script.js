// 単語データを保持する配列
let wordData = [];

// 現在の表示画面
let currentScreen = 'home';

// 最近出題された単語を記録する配列
let recentlyTestedWords = [];

// ユーザーの進捗データ
let progressData = {
    totalTests: 0,
    wordMastery: {}, // {word: {attempts: 0, correct: 0, recentAttempts: []}}
    recentlyWrongWords: [], // 最近間違えた単語のリスト
    testHistory: []
};

// 現在のテスト状態
let currentTest = {
    type: 'en_to_ja',
    words: [],
    currentQuestionIndex: 0,
    answers: [],
    startTime: null,
    endTime: null,
    timerInterval: null,
    timerSeconds: 0,
    timerStartTime: null, // 実時間計測用に追加
    timerEnabled: true,
    showExamples: true,
    enableSound: true,
    questionStartTime: null, // 問ごとの時間計測用
    questionTimes: [] // 各問題の回答時間を記録
};

// 音声合成インスタンス
let synth = window.speechSynthesis;
let audioCache = {};

// ユーザーの学習記録データ
let studyRecord = {
    days: {}, // {date: {testCount, wordCount, avgScore, studyTime, activities}}
    streak: 0,
    totalDays: 0
};

// フラッシュカードデータ
let flashcardData = {
    words: [],
    currentIndex: 0,
    type: 'en_to_ja',
    enableSound: true,
    autoNext: false,
    knownWords: [],
    unknownWords: [],
    startTime: null, // 開始時間を追加
    studyTime: 0 // 学習時間を追加
};

// グラフ描画用
let performanceChart = null;

// DOM読み込み後の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('アプリ初期化中...');
    
    // タブ切り替え設定
    setupTabs();
    
    // モックデータ（実際のアプリではwords.jsを読み込む）
    setupMockData();
    
    // ローカルストレージから進捗データを読み込む
    loadProgressData();
    
    // ボタンイベント設定
    setupButtonEvents();
    
    // 進捗データの表示を更新
    updateProgressUI();
    
    // カレンダー機能をセットアップ
    setupCalendar();
    
    // 日次記録を更新
    updateDailyRecord();
    
    // 初期化時にSpeechSynthesisをセットアップ
    initSpeechSynthesis();
    
    // グラフ描画用のChartJSを読み込み
    loadChartJs();
    
    // フラッシュカード結果画面用のスタイル追加
    addFlashcardResultStyles();
    
    console.log('アプリの初期化が完了しました');
});

// フラッシュカード結果画面用のスタイル追加
function addFlashcardResultStyles() {
    const style = document.createElement('style');
    style.textContent = `
    .flashcard-results {
        padding: 15px;
        margin-top: 15px;
    }

    .flashcard-results-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 15px 0;
    }

    .stat-item {
        background-color: var(--light-color);
        padding: 10px;
        border-radius: 5px;
        text-align: center;
    }

    .stat-label {
        font-size: 12px;
        color: #7f8c8d;
    }

    .stat-value {
        font-size: 1.3rem;
        font-weight: 500;
    }
    
    /* フラッシュカードアニメーション改善 */
    .flashcard-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transition: opacity 0.3s ease;
    }

    .flashcard-front, .flashcard-back {
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 15px;
        transition: opacity 0.3s ease;
    }

    .flashcard-back {
        opacity: 0;
        visibility: hidden;
    }

    .flashcard.flipped .flashcard-front {
        opacity: 0;
        visibility: hidden;
    }

    .flashcard.flipped .flashcard-back {
        opacity: 1;
        visibility: visible;
    }
    `;
    document.head.appendChild(style);
}

// Chart.jsの動的読み込み
function loadChartJs() {
    if (typeof Chart !== 'undefined') return;
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.0/chart.min.js';
    script.onload = function() {
        console.log('Chart.js読み込み完了');
    };
    document.head.appendChild(script);
}

// モックデータのセットアップ
function setupMockData() {
    wordData = [
        {Word: 'issue', POS: 'n', '日本語訳': '問題、論点', 'テキストで使われている文章 (例)': 'Climate change is a pressing issue for our generation.', '単語を使った代表的な熟語など': 'environmental issues, social issues, raise an issue'},
        {Word: 'affect', POS: 'v', '日本語訳': '影響を与える', 'テキストで使われている文章 (例)': 'Pollution can seriously affect human health.', '単語を使った代表的な熟語など': 'deeply affect, affect change, affect a person'},
        {Word: 'solve', POS: 'v', '日本語訳': '解決する', 'テキストで使われている文章 (例)': 'Scientists are trying to solve the problem of food waste.', '単語を使った代表的な熟語など': 'solve a problem, solve a puzzle, solve a crime'},
        {Word: 'impact', POS: 'n', '日本語訳': '影響、衝撃', 'テキストで使われている文章 (例)': 'The new technology had a significant impact on daily life.', '単語を使った代表的な熟語など': 'positive impact, negative impact, have an impact on'},
        {Word: 'global', POS: 'adj', '日本語訳': '世界的な、地球規模の', 'テキストで使われている文章 (例)': 'Global warming is a serious threat to our planet.', '単語を使った代表的な熟語など': 'global warming, global market, global economy'},
        {Word: 'develop', POS: 'v', '日本語訳': '発展させる、開発する', 'テキストで使われている文章 (例)': 'Researchers are working to develop new energy sources.', '単語を使った代表的な熟語など': 'develop a skill, develop a plan, develop a new product'},
        {Word: 'reduce', POS: 'v', '日本語訳': '減らす、削減する', 'テキストで使われている文章 (例)': 'We should try to reduce our use of plastic bags.', '単語を使った代表的な熟語など': 'reduce waste, reduce costs, reduce risk'},
        {Word: 'protect', POS: 'v', '日本語訳': '保護する、守る', 'テキストで使われている文章 (例)': 'It is important to protect endangered species.', '単語を使った代表的な熟語など': 'protect from, protect against, protect the environment'},
        {Word: 'resource', POS: 'n', '日本語訳': '資源', 'テキストで使われている文章 (例)': 'Water is a vital resource for all living things.', '単語を使った代表的な熟語など': 'natural resources, human resources, allocate resources'},
        {Word: 'community', POS: 'n', '日本語訳': '地域社会、共同体', 'テキストで使われている文章 (例)': 'Volunteering helps build a stronger community.', '単語を使った代表的な熟語など': 'local community, online community, community spirit'},
    ];
    console.log('モックデータがセットアップされました:', wordData.length, '件');
    
    // 実際のアプリではwords.jsからデータを読み込むなどの処理を行う
    try {
        if (typeof wordsDataCSV !== 'undefined') {
            parseWordsDataCSV(wordsDataCSV);
        }
    } catch (e) {
        console.log('CSVからの読み込みはスキップされました', e);
    }
}

// CSVデータを解析（words.jsが存在する場合）
function parseWordsDataCSV(csv) {
    try {
        const lines = csv.trim().split('\n');
        if (lines.length <= 1) return; // ヘッダーのみの場合はスキップ
        
        const header = lines[0].split(',');
        const parsedWords = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const wordObj = {};
            
            for (let j = 0; j < header.length; j++) {
                wordObj[header[j]] = values[j] || '';
            }
            
            parsedWords.push(wordObj);
        }
        
        if (parsedWords.length > 0) {
            wordData = parsedWords;
            console.log('CSVから単語データを読み込みました:', wordData.length, '件');
        }
    } catch (e) {
        console.error('CSVデータの解析中にエラーが発生しました:', e);
    }
}

// タブ切り替え設定
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    for (let tab of tabs) {
        tab.addEventListener('click', function() {
            switchScreen(this.getAttribute('data-screen'));
        });
        
        // タッチデバイス対応
        tab.addEventListener('touchend', function(e) {
            e.preventDefault();
            switchScreen(this.getAttribute('data-screen'));
        }, false);
    }
}

// 画面切り替え
function switchScreen(screenName) {
    console.log('画面切り替え:', screenName);
    
    // タブのアクティブ状態を更新
    const tabs = document.querySelectorAll('.tab');
    for (let tab of tabs) {
        if (tab.getAttribute('data-screen') === screenName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    }
    
    // 画面の表示を切り替え
    const screens = document.querySelectorAll('.screen');
    for (let screen of screens) {
        if (screen.id === screenName + '-screen') {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    }
    
    // 現在の画面を記録
    currentScreen = screenName;
    
    // 各画面が選択された場合の処理
    if (screenName === 'progress') {
        updateProgressUI();
    } else if (screenName === 'calendar') {
        updateCalendarUI();
    } else if (screenName === 'stats') {
        updateStatsUI();
    }
}

// ボタンイベント設定
function setupButtonEvents() {
    // ホーム画面のボタン
    document.getElementById('quick-start-btn').addEventListener('click', startQuickTest);
    document.getElementById('custom-test-btn').addEventListener('click', function() {
        switchScreen('options');
    });
    
    // オプション画面のイベント
    document.getElementById('test-type').addEventListener('change', function() {
        const posSelector = document.getElementById('pos-selector');
        if (this.value === 'pos') {
            posSelector.style.display = 'block';
        } else {
            posSelector.style.display = 'none';
        }
    });
    
    document.getElementById('start-test-btn').addEventListener('click', startCustomTest);
    
    // テスト画面のイベント
    setupTestEvents();
    
    // 結果画面のボタン
    document.getElementById('retry-btn').addEventListener('click', retryTest);
    document.getElementById('new-test-btn').addEventListener('click', function() {
        // 前回のテスト設定を保持してオプション画面に遷移せずに新しいテストを開始
        const testType = currentTest.type;
        const wordCount = currentTest.words.length;
        const timerEnabled = currentTest.timerEnabled;
        const showExamples = currentTest.showExamples;
        const enableSound = currentTest.enableSound;
        
        // 新しいランダム単語を取得
        const selectedWords = getRandomWords(wordCount, 'all', []);
        
        // 新しいテストを開始
        startTest(testType, selectedWords, timerEnabled, showExamples, enableSound);
    });
    
    // フラッシュカード画面のボタン
    setupFlashcardEvents();
    
    // カレンダー画面のボタン
    document.getElementById('prev-month').addEventListener('click', function() {
        navigateCalendar(-1);
    });
    
    document.getElementById('next-month').addEventListener('click', function() {
        navigateCalendar(1);
    });
    
    // 統計グラフ画面のボタン
    if (document.querySelectorAll('.chart-filter').length > 0) {
        document.querySelectorAll('.chart-filter').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('.chart-filter').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                drawPerformanceChart(this.dataset.type);
            });
        });
    }
}

// テスト画面のイベント設定
function setupTestEvents() {
    // 次へボタン
    document.getElementById('next-btn').addEventListener('click', function() {
        if (!this.disabled) {
            this.disabled = true;
            goToNextQuestion();
        }
    });
    
    // 終了ボタン
    document.getElementById('finish-btn').addEventListener('click', function() {
        if (!this.disabled) {
            this.disabled = true;
            finishTest();
        }
    });
    
    // 答えのオプションイベント委任
    const answerOptionsContainer = document.getElementById('answer-options');
    answerOptionsContainer.addEventListener('click', function(event) {
        const answerOption = event.target.closest('.answer-option');
        if (answerOption && !answerOption.classList.contains('correct') && !answerOption.classList.contains('wrong')) {
            checkAnswer(answerOption);
        }
    });
    
    // タッチデバイス対応
    answerOptionsContainer.addEventListener('touchend', function(event) {
        const answerOption = event.target.closest('.answer-option');
        if (answerOption && !answerOption.classList.contains('correct') && !answerOption.classList.contains('wrong')) {
            event.preventDefault();
            checkAnswer(answerOption);
        }
    }, false);
    
    // 発音ボタン
    document.getElementById('pronounce-question').addEventListener('click', function() {
        if (currentTest.enableSound && currentTest.type !== 'ja_to_en') {
            const wordObj = currentTest.words[currentTest.currentQuestionIndex];
            speak(wordObj.Word);
        }
    });
    
    document.getElementById('pronounce-example').addEventListener('click', function() {
        if (currentTest.enableSound) {
            const wordObj = currentTest.words[currentTest.currentQuestionIndex];
            speak(wordObj['テキストで使われている文章 (例)']);
        }
    });
}

// フラッシュカード画面のイベント設定
function setupFlashcardEvents() {
    // フラッシュカード開始ボタン
    document.getElementById('start-flashcard-btn').addEventListener('click', startFlashcards);
    
    // フラッシュカードをタップしたときの処理
    document.getElementById('current-flashcard').addEventListener('click', flipFlashcard);
    
    // 前の単語ボタン
    document.getElementById('flashcard-prev').addEventListener('click', function(e) {
        e.stopPropagation();
        prevFlashcard();
    });
    
    // 次の単語ボタン
    document.getElementById('flashcard-next').addEventListener('click', function(e) {
        e.stopPropagation();
        nextFlashcard();
    });
    
    // 発音ボタン
    document.getElementById('flashcard-pronounce').addEventListener('click', function(e) {
        e.stopPropagation();
        if (flashcardData.enableSound) {
            const word = flashcardData.words[flashcardData.currentIndex].Word;
            speak(word);
        }
    });
    
    document.getElementById('flashcard-example-pronounce').addEventListener('click', function(e) {
        e.stopPropagation();
        if (flashcardData.enableSound) {
            const example = flashcardData.words[flashcardData.currentIndex]['テキストで使われている文章 (例)'];
            speak(example);
        }
    });
    
    // 知っているボタン
    document.getElementById('flashcard-known').addEventListener('click', function(e) {
        e.stopPropagation();
        markAsKnown();
    });
    
    // まだ覚えていないボタン
    document.getElementById('flashcard-unknown').addEventListener('click', function(e) {
        e.stopPropagation();
        markAsUnknown();
    });
    
    // 終了ボタン
    document.getElementById('flashcard-finish').addEventListener('click', finishFlashcards);
}

// iOS SafariでのSpeechSynthesisの初期化
function initSpeechSynthesis() {
    if ('speechSynthesis' in window) {
        console.log('音声合成機能を初期化しています...');
        
        try {
            // iOS Safariでの初期化手順
            let utterance = new SpeechSynthesisUtterance("");
            utterance.volume = 0;
            utterance.rate = 0;
            utterance.pitch = 0;
            speechSynthesis.speak(utterance);
            speechSynthesis.cancel();
            
            setTimeout(function() {
                synth.getVoices();
                console.log('音声合成機能の初期化が完了しました');
            }, 200);
        } catch (e) {
            console.error('音声合成機能の初期化に失敗しました:', e);
        }
    } else {
        console.warn('音声合成機能がこのブラウザでサポートされていません');
    }
}

// テキスト読み上げ機能
function speak(text) {
    if (!('speechSynthesis' in window) || !text || text.trim() === '') {
        return;
    }
    
    try {
        // 既に実行中の音声を停止
        if (synth.speaking) {
            synth.cancel();
        }
        
        // 新しい音声を作成
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 音声の設定（iPhoneに最適化）
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // 利用可能な英語音声を選択
        const voices = synth.getVoices();
        const englishVoices = voices.filter(voice => voice.lang && voice.lang.includes('en'));
        
        if (englishVoices.length > 0) {
            // 英語音声の中から最適なものを選択
            const preferredVoice = englishVoices.find(voice => voice.name.includes('Google') && voice.name.includes('US')) ||
                                  englishVoices.find(voice => voice.lang === 'en-US') ||
                                  englishVoices[0];
            
            utterance.voice = preferredVoice;
        }
        
        // 音声を再生
        synth.speak(utterance);
        
    } catch (e) {
        console.error('音声再生エラー:', e);
    }
}

// 進捗データの読み込み
function loadProgressData() {
    try {
        const savedData = localStorage.getItem('englishTestProgress');
        if (savedData) {
            progressData = JSON.parse(savedData);
            
            // 古い形式のデータを新形式に変換（recentAttemptsがない場合）
            for (const word in progressData.wordMastery) {
                if (!progressData.wordMastery[word].recentAttempts) {
                    progressData.wordMastery[word].recentAttempts = [];
                }
            }
            
            // recentlyWrongWordsがなければ初期化
            if (!progressData.recentlyWrongWords) {
                progressData.recentlyWrongWords = [];
            }
            
            console.log('進捗データを読み込みました');
        }
    } catch (e) {
        console.error('進捗データの読み込みに失敗しました:', e);
        progressData = {
            totalTests: 0,
            wordMastery: {},
            recentlyWrongWords: [],
            testHistory: []
        };
    }
}

// 進捗データの保存
function saveProgressData() {
    try {
        localStorage.setItem('englishTestProgress', JSON.stringify(progressData));
        console.log('進捗データを保存しました');
    } catch (e) {
        console.error('進捗データの保存に失敗しました:', e);
    }
}

// クイックテスト開始
function startQuickTest() {
    // たまにrecentlyTestedWordsをリセットして新鮮な単語選択を促進
    if (Math.random() < 0.15) { // 15%の確率でリセット
        recentlyTestedWords = [];
        console.log("単語の出題履歴をリセットしました");
    }

    // クイックテストのデフォルト設定
    currentTest = {
        type: 'en_to_ja',
        words: [],
        currentQuestionIndex: 0,
        answers: [],
        startTime: null,
        endTime: null,
        timerInterval: null,
        timerSeconds: 0,
        timerStartTime: null, // 実時間計測用
        timerEnabled: true,
        showExamples: true,
        enableSound: true,
        questionStartTime: null, // 問ごとの時間計測用
        questionTimes: [] // 各問題の回答時間
    };
    
    // ランダムに10問選ぶ
    const selectedWords = getRandomWords(10, 'all', []);
    
    // テスト開始
    startTest('en_to_ja', selectedWords, true, true, true);
}

// カスタムテスト開始
function startCustomTest() {
    const testType = document.getElementById('test-type').value;
    const questionCount = parseInt(document.getElementById('question-count').value) || 10;
    const difficulty = document.getElementById('difficulty').value;
    const timerEnabled = document.getElementById('timer-enabled').checked;
    const showExamples = document.getElementById('show-examples').checked;
    const enableSound = document.getElementById('enable-sound').checked;
    
    // 品詞選択（品詞別テストの場合のみ使用）
    let selectedPOS = [];
    if (testType === 'pos') {
        const posCheckboxes = document.querySelectorAll('#pos-selector input[type="checkbox"]:checked');
        selectedPOS = Array.from(posCheckboxes).map(cb => cb.value);
        
        if (selectedPOS.length === 0) {
            alert('少なくとも1つの品詞を選択してください。');
            return;
        }
    }
    
    // 選択された条件に基づいて単語を選ぶ
    const selectedWords = getRandomWords(questionCount, difficulty, selectedPOS);
    
    // テスト開始
    startTest(testType, selectedWords, timerEnabled, showExamples, enableSound);
}

// ランダムに単語を選択（改良版 - 苦手な単語を優先）
function getRandomWords(count, difficulty, partOfSpeech) {
    let filteredWords = [...wordData];
    
    // wordDataに十分な単語があるか確認
    if (!filteredWords || filteredWords.length === 0) {
        console.error('単語データが利用できません。モックデータを使用します。');
        setupMockData();
        filteredWords = [...wordData];
    }
    
    // 難易度でフィルタリング
    let difficultyFiltered = filteredWords;
    if (difficulty !== 'all') {
        const wordIndexRanges = {
            'easy': [0, Math.floor(filteredWords.length * 0.3)],
            'medium': [Math.floor(filteredWords.length * 0.3), Math.floor(filteredWords.length * 0.7)],
            'hard': [Math.floor(filteredWords.length * 0.7), filteredWords.length]
        };
        
        const range = wordIndexRanges[difficulty];
        difficultyFiltered = filteredWords.slice(range[0], range[1]);
        
        // フィルタリング後に十分な単語があるか確認
        if (difficultyFiltered.length < count) {
            console.warn(`難易度「${difficulty}」の単語が${count}個未満です。より広い範囲から選択します。`);
            // 必要な場合は範囲を拡大
            difficultyFiltered = filteredWords;
        }
    }
    
    // 品詞でフィルタリング
    let posFiltered = difficultyFiltered;
    if (partOfSpeech && partOfSpeech.length > 0) {
        posFiltered = difficultyFiltered.filter(word => partOfSpeech.includes(word.POS));
        
        // フィルタリング後に十分な単語があるか確認
        if (posFiltered.length < count) {
            console.warn(`指定された品詞の単語が${count}個未満です。より広い範囲から選択します。`);
            // 必要な場合は難易度フィルターのみに戻す
            posFiltered = difficultyFiltered;
        }
    }
    
    // 各単語に重み付け（間違えた回数や最近の学習状況に応じて）
    const weightedWords = posFiltered.map(word => {
        const wordMastery = progressData.wordMastery[word.Word] || { attempts: 0, correct: 0, recentAttempts: [] };
        const correctRate = wordMastery.attempts > 0 ? wordMastery.correct / wordMastery.attempts : 0;
        
        // 正解率が低いほど高い重みを付ける（最大10倍）
        const accuracyWeight = wordMastery.attempts > 0 ? Math.max(1, 10 * (1 - correctRate)) : 1;
        
        // 出題回数が少ない単語にもボーナス重みを付ける
        const attemptBonus = Math.max(1, 2 - (0.1 * wordMastery.attempts));
        
        // 最近出題された単語には低い重みを付ける（ペナルティを0.2から0.5に緩和）
        const recentlyTestedPenalty = recentlyTestedWords.includes(word.Word) ? 0.5 : 1;
        
        // 最近の回答状況も考慮（間違えが多いとより出やすく）- 重みを強化
        const recentAttempts = wordMastery.recentAttempts || [];
        const recentCorrectRate = recentAttempts.length > 0 
            ? recentAttempts.filter(x => x).length / recentAttempts.length 
            : 1;
        // 最近間違えた単語の重みを強化（5から7に増加）
        const recentWeight = recentAttempts.length > 0 ? Math.max(1, 7 * (1 - recentCorrectRate)) : 1;
        
        // 最近間違えたリストにある単語にさらに重みを追加
        const recentlyWrongBonus = progressData.recentlyWrongWords.includes(word.Word) ? 1.5 : 1;
        
        return {
            word: word,
            weight: accuracyWeight * attemptBonus * recentlyTestedPenalty * recentWeight * recentlyWrongBonus
        };
    });
    
    // 重み付き選択関数（改良版）
    function weightedRandomSelect(items, count) {
        if (items.length === 0) return [];
        
        // シャッフルしてから選択することで、同じ単語ばかりが選ばれるのを防ぐ
        let shuffledItems = [...items];
        for (let i = shuffledItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
        }
        
        const selected = [];
        let remainingItems = shuffledItems;
        
        while (selected.length < count && remainingItems.length > 0) {
            let totalWeight = remainingItems.reduce((sum, item) => sum + item.weight, 0);
            
            // 重みに基づいてランダムな値を選ぶ
            let randomWeight = Math.random() * totalWeight;
            let currentWeight = 0;
            let selectedIndex = -1;
            
            // 重みの累積値を計算して選択
            for (let j = 0; j < remainingItems.length; j++) {
                currentWeight += remainingItems[j].weight;
                if (randomWeight <= currentWeight) {
                    selectedIndex = j;
                    break;
                }
            }
            
            // 選択された単語を結果に追加
            if (selectedIndex >= 0) {
                selected.push(remainingItems[selectedIndex].word);
                // 選択したアイテムを削除して重複を防ぐ
                remainingItems.splice(selectedIndex, 1);
            } else {
                break; // 万が一選択できない場合は終了
            }
        }
        
        return selected;
    }
    
    // 重み付き選択で単語を選ぶ
    const selectedWords = weightedRandomSelect(weightedWords, Math.min(count, posFiltered.length));
    
    // 選択された単語を最近出題リストに追加（最大保持数を10に減らして新しい単語が出やすくする）
    recentlyTestedWords = [...selectedWords.map(word => word.Word), ...recentlyTestedWords].slice(0, 10);
    
    return selectedWords;
}

// テスト開始
function startTest(testType, words, timerEnabled, showExamples, enableSound) {
    if (!words || words.length === 0) {
        alert('テストに使用できる単語がありません。');
        return;
    }
    
    // テスト状態の初期化
    currentTest = {
        type: testType,
        words: words,
        currentQuestionIndex: 0,
        answers: Array(words.length).fill(null),
        startTime: new Date(),
        endTime: null,
        timerInterval: null,
        timerSeconds: 0,
        timerStartTime: null,
        timerEnabled: timerEnabled,
        showExamples: showExamples,
        enableSound: enableSound,
        questionStartTime: null,
        questionTimes: []
    };
    
    // 画面を切り替え
    switchScreen('test');
    
    // タイマー開始
    if (timerEnabled) {
        startTimer();
    } else {
        document.getElementById('timer').textContent = '--:--';
    }
    
    // 最初の問題を表示
    displayQuestion();
    
    // 次へボタンを非活性化
    document.getElementById('next-btn').disabled = true;
    document.getElementById('finish-btn').disabled = true;
    
    // 問題開始時間を記録
    currentTest.questionStartTime = Date.now();
}

// タイマーを開始（修正版 - 正確な時間計測）
function startTimer() {
    // タイマー初期化
    currentTest.timerSeconds = 0;
    currentTest.timerStartTime = Date.now(); // 実時間を記録
    updateTimerDisplay();
    
    // 既存のタイマーをクリア
    if (currentTest.timerInterval) {
        clearInterval(currentTest.timerInterval);
    }
    
    // 新しいタイマー開始 - 実時間ベースに修正
    currentTest.timerInterval = setInterval(function() {
        const elapsedSeconds = Math.floor((Date.now() - currentTest.timerStartTime) / 1000);
        currentTest.timerSeconds = elapsedSeconds;
        updateTimerDisplay();
    }, 500); // 更新頻度を0.5秒に
}

// タイマー表示の更新
function updateTimerDisplay() {
    const minutes = Math.floor(currentTest.timerSeconds / 60);
    const seconds = currentTest.timerSeconds % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer').textContent = formattedTime;
}

// 問題を表示
function displayQuestion() {
    const wordObj = currentTest.words[currentTest.currentQuestionIndex];
    
    // 問題カウンター更新
    document.getElementById('question-counter').textContent = `${currentTest.currentQuestionIndex + 1} / ${currentTest.words.length}`;
    
    // 例文コンテナを非表示
    document.getElementById('example-container').classList.add('hidden');
    
    // 質問テキストと発音ボタンの設定
    const questionText = document.getElementById('question-text');
    const pronounceBtn = document.getElementById('pronounce-question');
    
    let question = '';
    let hint = '';
    let options = [];
    let showPronounceBtn = false;
    
    // テストタイプに応じた問題設定
    switch (currentTest.type) {
        case 'en_to_ja':
            document.getElementById('test-title').textContent = '英単語 → 日本語';
            question = wordObj.Word;
            hint = `[${getPOSFullName(wordObj.POS)}]`;
            options = generateOptions(wordObj, '日本語訳');
            showPronounceBtn = true;
            break;
        case 'ja_to_en':
            document.getElementById('test-title').textContent = '日本語 → 英単語';
            question = wordObj['日本語訳'];
            hint = `[${getPOSFullName(wordObj.POS)}]`;
            options = generateOptions(wordObj, 'Word');
            showPronounceBtn = false;
            break;
        case 'pos':
            document.getElementById('test-title').textContent = '品詞別テスト';
            question = wordObj.Word;
            hint = '品詞は？';
            options = generatePOSOptions(wordObj.POS);
            showPronounceBtn = true;
            break;
        case 'random':
            const randomType = Math.random() > 0.5 ? 'en_to_ja' : 'ja_to_en';
            if (randomType === 'en_to_ja') {
                document.getElementById('test-title').textContent = 'ランダム: 英→日';
                question = wordObj.Word;
                hint = `[${getPOSFullName(wordObj.POS)}]`;
                options = generateOptions(wordObj, '日本語訳');
                showPronounceBtn = true;
            } else {
                document.getElementById('test-title').textContent = 'ランダム: 日→英';
                question = wordObj['日本語訳'];
                hint = `[${getPOSFullName(wordObj.POS)}]`;
                options = generateOptions(wordObj, 'Word');
                showPronounceBtn = false;
            }
            break;
    }
    
    // 問題文とヒントを設定
    questionText.textContent = question;
    document.getElementById('question-hint').textContent = hint;
    pronounceBtn.style.display = showPronounceBtn ? 'inline-flex' : 'none';
    
    // 発音
    if (showPronounceBtn && currentTest.enableSound) {
        setTimeout(() => speak(wordObj.Word), 100);
    }
    
    // 選択肢を表示
    const answerOptionsContainer = document.getElementById('answer-options');
    answerOptionsContainer.innerHTML = '';
    
    options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'answer-option';
        optionDiv.textContent = option.text;
        optionDiv.dataset.option = index;
        optionDiv.dataset.correct = option.correct;
        answerOptionsContainer.appendChild(optionDiv);
        
        // 日本語→英語の場合、選択肢に発音ボタンを追加
        if ((currentTest.type === 'ja_to_en' || (currentTest.type === 'random' && !showPronounceBtn)) && currentTest.enableSound) {
            const pronBtn = document.createElement('button');
            pronBtn.className = 'sound-btn';
            pronBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            pronBtn.style.marginLeft = '5px';
            pronBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                speak(option.text);
            });
            optionDiv.appendChild(pronBtn);
        }
    });
    
    // ボタンの状態制御
    const nextBtn = document.getElementById('next-btn');
    const finishBtn = document.getElementById('finish-btn');
    
    if (currentTest.currentQuestionIndex === currentTest.words.length - 1) {
        nextBtn.classList.add('hidden');
        finishBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.remove('hidden');
        finishBtn.classList.add('hidden');
    }
    
    nextBtn.disabled = true;
    finishBtn.disabled = true;
    
    // 問題の開始時間を記録（回答時間計測用）
    currentTest.questionStartTime = Date.now();
}

// 選択肢を生成
function generateOptions(wordObj, answerField) {
    const correctAnswer = wordObj[answerField];
    
    // 同じフィールドから3つの誤答を取得
    let incorrectAnswers = [];
    let attemptCount = 0;
    
    while (incorrectAnswers.length < 3 && attemptCount < 100) {
        attemptCount++;
        const randomIndex = Math.floor(Math.random() * wordData.length);
        const randomWord = wordData[randomIndex];
        
        if (randomWord && 
            randomWord[answerField] && 
            randomWord[answerField] !== correctAnswer && 
            !incorrectAnswers.includes(randomWord[answerField])) {
            incorrectAnswers.push(randomWord[answerField]);
        }
    }
    
    // 不足している場合はダミーデータで補完
    while (incorrectAnswers.length < 3) {
        incorrectAnswers.push(`選択肢 ${incorrectAnswers.length + 1}`);
    }
    
    // 正解と誤答を組み合わせる
    let options = [
        { text: correctAnswer, correct: true },
        ...incorrectAnswers.map(answer => ({ text: answer, correct: false }))
    ];
    
    // オプションをシャッフル
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    
    return options;
}

// 品詞の選択肢を生成
function generatePOSOptions(correctPOS) {
    const allPOS = ['n', 'v', 'adj', 'adv', 'prep', 'conj'];
    const incorrectPOS = allPOS.filter(pos => pos !== correctPOS);
    
    // 正解の品詞と3つの誤答を組み合わせる
    let options = [
        { text: getPOSFullName(correctPOS), correct: true },
        ...incorrectPOS.slice(0, 3).map(pos => ({ text: getPOSFullName(pos), correct: false }))
    ];
    
    // オプションをシャッフル
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    
    return options;
}

// 品詞の略称から正式名称を取得
function getPOSFullName(pos) {
    const posMap = {
        'n': '名詞 (noun)',
        'v': '動詞 (verb)',
        'adj': '形容詞 (adj)',
        'adv': '副詞 (adv)',
        'prep': '前置詞 (prep)',
        'conj': '接続詞 (conj)'
    };
    
    return posMap[pos] || pos;
}

// 回答をチェック
function checkAnswer(answerElement) {
    if (!answerElement || 
        answerElement.classList.contains('correct') || 
        answerElement.classList.contains('wrong')) {
        return;
    }
    
    // 回答時間を記録
    const answerTime = Math.round((Date.now() - currentTest.questionStartTime) / 1000);
    // 異常な回答時間のフィルタリング (30分を超える値は除外)
    const validAnswerTime = answerTime >= 0 && answerTime < 1800 ? answerTime : 30;
    currentTest.questionTimes.push(validAnswerTime);
    
    const isCorrect = answerElement.dataset.correct === 'true';
    const wordObj = currentTest.words[currentTest.currentQuestionIndex];
    
    // 見た目を更新
    const allOptions = document.querySelectorAll('.answer-option');
    allOptions.forEach(option => {
        if (option.dataset.correct === 'true') {
            option.classList.add('correct');
        }
        else if (option === answerElement && !isCorrect) {
            option.classList.add('wrong');
        }
    });
    
    // 回答を記録
    currentTest.answers[currentTest.currentQuestionIndex] = {
        word: wordObj.Word,
        correct: isCorrect,
        time: validAnswerTime // 正規化された回答時間を記録
    };
    
    // 例文を表示
    if (currentTest.showExamples) {
        const exampleContainer = document.getElementById('example-container');
        document.getElementById('example-text').textContent = wordObj['テキストで使われている文章 (例)'] || 'No example available';
        document.getElementById('idiom-text').textContent = wordObj['単語を使った代表的な熟語など'] || 'No idioms available';
        exampleContainer.classList.remove('hidden');
        
        // 正解の場合、自動的に例文を読み上げる
        if (isCorrect && currentTest.enableSound) {
            setTimeout(() => speak(wordObj['テキストで使われている文章 (例)']), 1000);
        }
    }
    
    // 次へ/終了ボタンを有効化
    document.getElementById('next-btn').disabled = false;
    document.getElementById('finish-btn').disabled = false;
    
    // 進捗データを更新
    updateWordMastery(wordObj.Word, isCorrect);
}

// 単語の習熟度データを更新（最近間違えた単語を強調するように改良）
function updateWordMastery(word, isCorrect) {
    if (!progressData.wordMastery[word]) {
        progressData.wordMastery[word] = {
            attempts: 0,
            correct: 0,
            recentAttempts: [],
            lastUpdated: new Date().toISOString()
        };
    }
    
    progressData.wordMastery[word].attempts++;
    if (isCorrect) {
        progressData.wordMastery[word].correct++;
    } else {
        // 間違えた単語を特別に記録
        if (!progressData.recentlyWrongWords) {
            progressData.recentlyWrongWords = [];
        }
        
        // 間違えた単語を優先リストに追加（重複を避けつつ）
        if (!progressData.recentlyWrongWords.includes(word)) {
            progressData.recentlyWrongWords.unshift(word);
            progressData.recentlyWrongWords = progressData.recentlyWrongWords.slice(0, 15);
        }
    }
    
    // 直近の5回の結果を記録
    if (!progressData.wordMastery[word].recentAttempts) {
        progressData.wordMastery[word].recentAttempts = [];
    }
    
    progressData.wordMastery[word].recentAttempts.unshift(isCorrect);
    progressData.wordMastery[word].recentAttempts = progressData.wordMastery[word].recentAttempts.slice(0, 5);
    progressData.wordMastery[word].lastUpdated = new Date().toISOString();
    
    // 進捗データをローカルストレージに保存
    saveProgressData();
}

// 次の問題へ
function goToNextQuestion() {
    currentTest.currentQuestionIndex++;
    
    // 次の問題があるかをチェック
    if (currentTest.currentQuestionIndex < currentTest.words.length) {
        // 次の問題を表示
        displayQuestion();
    } else {
        // テスト終了
        finishTest();
    }
}

// テスト終了
function finishTest() {
    // タイマー停止
    if (currentTest.timerInterval) {
        clearInterval(currentTest.timerInterval);
        currentTest.timerInterval = null;
    }
    
    currentTest.endTime = new Date();
    
    // テスト結果を計算
    const totalQuestions = currentTest.words.length;
    const correctAnswers = currentTest.answers.filter(answer => answer && answer.correct).length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    
    // 平均回答時間を計算（異常値除外）
    let avgAnswerTime = 0;
    if (currentTest.questionTimes.length > 0) {
        // 異常値（30分以上または負の値）を除外
        const validTimes = currentTest.questionTimes.filter(time => time >= 0 && time < 1800);
        if (validTimes.length > 0) {
            avgAnswerTime = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
            // 小数点第1位までに丸める
            avgAnswerTime = Math.round(avgAnswerTime * 10) / 10;
        }
    }
    
    // テスト履歴に追加
    const testResult = {
        date: new Date().toISOString(),
        type: currentTest.type,
        totalQuestions,
        correctAnswers,
        score,
        timeSeconds: currentTest.timerSeconds,
        avgAnswerTime: avgAnswerTime,
        questionTimes: currentTest.questionTimes
    };
    
    progressData.testHistory.push(testResult);
    progressData.totalTests++;
    
    // 進捗データを保存
    saveProgressData();
    
    // 日次学習記録を更新
    updateStudyRecord('test', {
        testType: getTestTypeName(currentTest.type),
        wordCount: totalQuestions,
        score: score,
        timeSeconds: currentTest.timerSeconds,
        avgAnswerTime: avgAnswerTime
    });
    
    // 結果画面を表示
    displayResults(testResult);
}

// テストタイプの名前を取得
function getTestTypeName(type) {
    const typeNames = {
        'en_to_ja': '英語→日本語テスト',
        'ja_to_en': '日本語→英語テスト',
        'pos': '品詞別テスト',
        'random': 'ランダムテスト',
        'flashcard': 'フラッシュカード学習'
    };
    return typeNames[type] || '英単語テスト';
}

// 結果表示
function displayResults(result) {
    // 結果画面に切り替え
    switchScreen('results');
    
    // スコア表示
    document.getElementById('score-display').textContent = `${result.score}%`;
    
    // 詳細情報
    document.getElementById('total-questions').textContent = result.totalQuestions;
    document.getElementById('correct-answers').textContent = result.correctAnswers;
    document.getElementById('incorrect-answers').textContent = result.totalQuestions - result.correctAnswers;
    
    // 所要時間
    const minutes = Math.floor(result.timeSeconds / 60);
    const seconds = result.timeSeconds % 60;
    document.getElementById('time-taken').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 同じ設定でもう一度テスト
function retryTest() {
    // テストのタイプと設定を保持したまま再開
    const testType = currentTest.type;
    const wordCount = currentTest.words.length;
    const timerEnabled = currentTest.timerEnabled;
    const showExamples = currentTest.showExamples;
    const enableSound = currentTest.enableSound;
    
    // 新しいランダム単語を取得
    const selectedWords = getRandomWords(wordCount, 'all', []);
    
    // 新しいテストを開始
    startTest(testType, selectedWords, timerEnabled, showExamples, enableSound);
}

// 進捗UI更新
function updateProgressUI() {
    // 統計データ
    document.getElementById('total-tests').textContent = progressData.totalTests;
    
    // 学習した単語数
    const learnedWords = Object.keys(progressData.wordMastery).length;
    document.getElementById('total-words').textContent = learnedWords;
    
    // 平均スコア
    let totalScore = 0;
    progressData.testHistory.forEach(test => {
        totalScore += test.score;
    });
    const avgScore = progressData.totalTests > 0 ? Math.round(totalScore / progressData.totalTests) : 0;
    document.getElementById('avg-score').textContent = `${avgScore}%`;
    
    // マスターした単語（正解率80%以上の単語）
    let masteredWords = 0;
    for (const word in progressData.wordMastery) {
        const data = progressData.wordMastery[word];
        if (data.attempts >= 3 && (data.correct / data.attempts) >= 0.8) {
            masteredWords++;
        }
    }
    document.getElementById('mastered-words').textContent = masteredWords;
    
    // 単語ごとの習熟度テーブル
    updateWordMasteryTable();
}

// 単語習熟度テーブルの更新（改良版 - 苦手な単語の強調）
function updateWordMasteryTable() {
    const tableBody = document.querySelector('#word-mastery-table tbody');
    tableBody.innerHTML = '';
    
    // ワード習熟度データをオブジェクトから配列に変換してソート
    const wordMasteryArray = [];
    for (const word in progressData.wordMastery) {
        const data = progressData.wordMastery[word];
        const wordObj = wordData.find(w => w.Word === word);
        
        if (wordObj) {
            const accuracy = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;
            
            // 直近の学習状況を計算（最新の5回）
            const recentAttempts = data.recentAttempts || [];
            const recentAccuracy = recentAttempts.length > 0 
                ? Math.round((recentAttempts.filter(x => x).length / recentAttempts.length) * 100) 
                : 0;
            
            let masteryLevel = 'low';
            if (accuracy >= 80) masteryLevel = 'high';
            else if (accuracy >= 50) masteryLevel = 'medium';
            
            // 直近の状況による苦手度
            let recentMasteryLevel = 'low';
            if (recentAccuracy >= 80) recentMasteryLevel = 'high';
            else if (recentAccuracy >= 50) recentMasteryLevel = 'medium';
            
            // 苦手度スコアの計算（直近の正解率を重視）
            const weaknessScore = recentAttempts.length > 0 
                ? 100 - ((recentAccuracy * 2 + accuracy) / 3) 
                : 100 - accuracy;
                
            wordMasteryArray.push({
                word,
                pos: wordObj.POS,
                meaning: wordObj['日本語訳'],
                attempts: data.attempts,
                correct: data.correct,
                accuracy,
                recentAccuracy,
                masteryLevel,
                recentMasteryLevel,
                recentAttempts,
                weaknessScore
            });
        }
    }
    
    // 苦手度でソート（高い順）
    wordMasteryArray.sort((a, b) => b.weaknessScore - a.weaknessScore);
    
    // テーブルに表示
    wordMasteryArray.forEach(item => {
        const row = document.createElement('tr');
        
        // 苦手度に応じた背景色
        if (item.weaknessScore > 70) {
            row.classList.add('high-weakness');
        } else if (item.weaknessScore > 40) {
            row.classList.add('medium-weakness');
        }
        
        // 直近の学習状況の視覚化
        let recentStatusHTML = '';
        if (item.recentAttempts && item.recentAttempts.length > 0) {
            recentStatusHTML = item.recentAttempts.map(correct => 
                `<span class="attempt-dot ${correct ? 'correct' : 'wrong'}" title="${correct ? '正解' : '不正解'}"></span>`
            ).join('');
            recentStatusHTML = `<div class="recent-attempts">${recentStatusHTML}</div>`;
        } else {
            recentStatusHTML = '<span class="no-recent-data">データなし</span>';
        }
        
        row.innerHTML = `
            <td>${item.word}</td>
            <td>${item.pos}</td>
            <td>${item.meaning}</td>
            <td>${item.accuracy}%</td>
            <td><span class="mastery-level mastery-${item.masteryLevel}">${getMasteryLevelName(item.masteryLevel)}</span></td>
            <td class="recent-status">${recentStatusHTML}</td>
            <td>
                <button class="sound-btn js-speak-word" data-word="${item.word}">
                    <i class="fas fa-volume-up"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // データがない場合のメッセージ
    if (wordMasteryArray.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align:center">まだ単語テストを行っていません。テストを開始して学習データを記録しましょう。</td>
        `;
        tableBody.appendChild(row);
    }
    
    // 発音ボタンにイベントを追加
    document.querySelectorAll('.js-speak-word').forEach(btn => {
        btn.addEventListener('click', function() {
            speak(this.dataset.word);
        });
    });
}

// 習熟度レベルの名称を取得
function getMasteryLevelName(level) {
    const levelMap = {
        'low': '低',
        'medium': '中',
        'high': '高'
    };
    
    return levelMap[level] || level;
}

// フラッシュカード学習を開始
function startFlashcards() {
    // 設定を取得
    flashcardData.type = document.getElementById('flashcard-type').value;
    flashcardData.count = parseInt(document.getElementById('flashcard-count').value) || 20;
    flashcardData.enableSound = document.getElementById('flashcard-sound').checked;
    flashcardData.autoNext = document.getElementById('flashcard-auto-next').checked;
    
    // 単語を選択（苦手を優先）- getRandomWords関数を使用してテストと同じロジックを適用
    flashcardData.words = getRandomWords(flashcardData.count, 'all', []);
    flashcardData.currentIndex = 0;
    flashcardData.knownWords = [];
    flashcardData.unknownWords = [];
    
    // 開始時間を記録
    flashcardData.startTime = new Date();
    flashcardData.studyTime = 0;
    
    // 設定画面を隠して、フラッシュカード画面を表示
    document.getElementById('flashcard-setup').classList.add('hidden');
    document.getElementById('flashcard-main').classList.remove('hidden');
    
    // 結果画面が表示されていたら隠す
    const resultsElement = document.getElementById('flashcard-results');
    if (resultsElement) {
        resultsElement.style.display = 'none';
    }
    
    // カードを非フリップ状態に
    const card = document.getElementById('current-flashcard');
    card.classList.remove('flipped');
    card.style.display = 'block';
    
    // コントロール要素を表示
    document.getElementById('flashcard-counter').style.display = 'block';
    document.getElementById('flashcard-controls').style.display = 'flex';
    document.getElementById('flashcard-finish').style.display = 'block';
    
    // 最初のカードを表示
    displayFlashcard();
    
    // 学習記録を更新
    updateStudyRecord('flashcard', {wordCount: flashcardData.count});
}

// フラッシュカードを表示
function displayFlashcard() {
    const wordObj = flashcardData.words[flashcardData.currentIndex];
    
    // カウンターを更新
    document.getElementById('flashcard-counter').textContent = `${flashcardData.currentIndex + 1} / ${flashcardData.words.length}`;
    
    // カードを初期状態（表面）に戻す
    const card = document.getElementById('current-flashcard');
    card.classList.remove('flipped');
    
    // 表面の情報を更新
    const frontWord = document.getElementById('flashcard-front-word');
    const hintText = document.getElementById('flashcard-hint');
    const pronounceBtn = document.getElementById('flashcard-pronounce');
    
    if (flashcardData.type === 'en_to_ja' || 
       (flashcardData.type === 'random' && Math.random() > 0.5)) {
        // 英語 → 日本語
        frontWord.textContent = wordObj.Word;
        hintText.textContent = `[${getPOSFullName(wordObj.POS)}]`;
        pronounceBtn.style.display = 'inline-block';
        
        // 音声があれば読み上げ
        if (flashcardData.enableSound) {
            setTimeout(() => speak(wordObj.Word), 500);
        }
    } else {
        // 日本語 → 英語
        frontWord.textContent = wordObj['日本語訳'];
        hintText.textContent = `[${getPOSFullName(wordObj.POS)}]`;
        pronounceBtn.style.display = 'none';
    }
    
    // 裏面の情報を更新
    document.getElementById('flashcard-meaning').textContent = 
        frontWord.textContent === wordObj.Word ? wordObj['日本語訳'] : wordObj.Word;
    
    document.getElementById('flashcard-example-text').textContent = 
        wordObj['テキストで使われている文章 (例)'] || 'No example available';
    
    document.getElementById('flashcard-idiom-text').textContent = 
        wordObj['単語を使った代表的な熟語など'] || 'No idioms available';
}

// フラッシュカードをフリップ（裏返す）
function flipFlashcard() {
    const card = document.getElementById('current-flashcard');
    card.classList.toggle('flipped');
    
    // 自動で次へ進む設定がONなら5秒後に次のカードへ
    if (card.classList.contains('flipped') && flashcardData.autoNext) {
        setTimeout(nextFlashcard, 5000);
    }
}

// 前のフラッシュカードへ
function prevFlashcard() {
    if (flashcardData.currentIndex > 0) {
        flashcardData.currentIndex--;
        displayFlashcard();
    }
}

// 次のフラッシュカードへ
function nextFlashcard() {
    if (flashcardData.currentIndex < flashcardData.words.length - 1) {
        flashcardData.currentIndex++;
        displayFlashcard();
    } else {
        // 最後のカードなら結果を表示
        finishFlashcards();
    }
}

// 知っていると登録
function markAsKnown() {
    const wordObj = flashcardData.words[flashcardData.currentIndex];
    flashcardData.knownWords.push(wordObj.Word);
    
    // この単語の習熟度データを更新（正解として記録）
    updateWordMastery(wordObj.Word, true);
    
    // 次のカードへ
    nextFlashcard();
}

// まだ覚えていないと登録
function markAsUnknown() {
    const wordObj = flashcardData.words[flashcardData.currentIndex];
    flashcardData.unknownWords.push(wordObj.Word);
    
    // この単語の習熟度データを更新（不正解として記録）
    updateWordMastery(wordObj.Word, false);
    
    // 次のカードへ
    nextFlashcard();
}

// フラッシュカード学習を終了（結果を履歴に残す）
function finishFlashcards() {
    // 終了時間と学習時間を計算
    const endTime = new Date();
    const studyTimeSeconds = Math.floor((endTime - flashcardData.startTime) / 1000);
    flashcardData.studyTime = studyTimeSeconds;

    // 結果を計算
    const totalWords = flashcardData.words.length;
    const knownWords = flashcardData.knownWords.length;
    const unknownWords = flashcardData.unknownWords.length;
    const skippedWords = totalWords - knownWords - unknownWords;
    
    // スコア計算（知っていた単語の割合）
    const answeredWords = knownWords + unknownWords;
    const score = answeredWords > 0 ? Math.round((knownWords / answeredWords) * 100) : 0;
    
    // テスト履歴に追加
    const flashcardResult = {
        date: new Date().toISOString(),
        type: 'flashcard',
        totalQuestions: totalWords,
        correctAnswers: knownWords,
        score: score,
        timeSeconds: studyTimeSeconds,
        avgAnswerTime: answeredWords > 0 ? Math.round((studyTimeSeconds / answeredWords) * 10) / 10 : 0
    };
    
    progressData.testHistory.push(flashcardResult);
    progressData.totalTests++;
    
    // 進捗データを保存
    saveProgressData();
    
    // 学習記録を詳細に更新
    updateStudyRecord('flashcard', {
        wordCount: totalWords,
        knownWords: knownWords,
        unknownWords: unknownWords,
        score: score,
        timeSeconds: studyTimeSeconds
    });
    
    // フラッシュカード結果画面を表示する要素を追加
    if (!document.getElementById('flashcard-results')) {
        const resultsDiv = document.createElement('div');
        resultsDiv.id = 'flashcard-results';
        resultsDiv.className = 'flashcard-results card';
        resultsDiv.innerHTML = `
            <h3 class="text-center">フラッシュカード結果</h3>
            <div class="flashcard-results-stats">
                <div class="stat-item">
                    <div class="stat-label">総単語数</div>
                    <div id="fc-total-words" class="stat-value"></div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">知っている単語</div>
                    <div id="fc-known-words" class="stat-value correct-value"></div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">覚えていない単語</div>
                    <div id="fc-unknown-words" class="stat-value wrong-value"></div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">スキップした単語</div>
                    <div id="fc-skipped-words" class="stat-value"></div>
                </div>
            </div>
            <div class="buttons-container">
                <button id="fc-new-session-btn" class="btn btn-success">新しいセッション</button>
                <button id="fc-back-btn" class="btn">戻る</button>
            </div>
        `;
        
        document.getElementById('flashcard-main').appendChild(resultsDiv);
        
        // ボタンのイベントリスナーを設定
        document.getElementById('fc-new-session-btn').addEventListener('click', function() {
            document.getElementById('flashcard-results').style.display = 'none';
            document.getElementById('flashcard-setup').classList.remove('hidden');
            document.getElementById('flashcard-main').classList.add('hidden');
        });
        
        document.getElementById('fc-back-btn').addEventListener('click', function() {
            document.getElementById('flashcard-results').style.display = 'none';
            document.getElementById('flashcard-setup').classList.remove('hidden');
            document.getElementById('flashcard-main').classList.add('hidden');
        });
    }
    
    // 結果を表示
    document.getElementById('fc-total-words').textContent = totalWords;
    document.getElementById('fc-known-words').textContent = knownWords;
    document.getElementById('fc-unknown-words').textContent = unknownWords;
    document.getElementById('fc-skipped-words').textContent = skippedWords;
    
    // 結果画面を表示
    document.getElementById('flashcard-results').style.display = 'block';
    document.getElementById('current-flashcard').style.display = 'none';
    document.getElementById('flashcard-counter').style.display = 'none';
    document.getElementById('flashcard-finish').style.display = 'none';
    document.getElementById('flashcard-controls').style.display = 'none';
}

// カレンダーUIの更新
function updateCalendarUI() {
    // 学習記録をローカルストレージから読み込み
    loadStudyRecord();
    
    // 現在の日付を取得
    const today = new Date();
    let calendarMonth = today.getMonth();
    let calendarYear = today.getFullYear();
    
    // カレンダーステータスを表示
    updateCalendarStats();
    
    // カレンダーを生成
    generateCalendar(calendarYear, calendarMonth);
    
    // 当日の詳細を表示（追加）
    const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    if (studyRecord.days[dateKey]) {
        showDayDetails(dateKey);
    } else {
        document.getElementById('day-details').classList.add('hidden');
    }
}

// カレンダーステータスの更新
function updateCalendarStats() {
    document.getElementById('calendar-streak').textContent = studyRecord.streak;
    
    // 今月の学習日数を計算
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    let monthlyCount = 0;
    
    for (const dateKey in studyRecord.days) {
        const date = new Date(dateKey);
        if (date.getFullYear() === year && date.getMonth() + 1 === month) {
            monthlyCount++;
        }
    }
    
    document.getElementById('calendar-month-total').textContent = monthlyCount;
    document.getElementById('calendar-total-days').textContent = studyRecord.totalDays;
}

// カレンダーの生成
function generateCalendar(year, month) {
    const calendarDays = document.getElementById('calendar-days');
    calendarDays.innerHTML = '';
    
    // 月の表記を更新
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('current-month-year').textContent = `${year}年${monthNames[month]}`;
    
    // 月の最初の日の曜日を取得
    const firstDay = new Date(year, month, 1).getDay();
    
    // 月の最終日を取得
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    // 前月の最終日を取得
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    
    // カレンダーの日数を表示
    let date = 1;
    let nextMonthDate = 1;
    
    for (let i = 0; i < 42; i++) {
        if (i % 7 === 0 && i > 0 && date > lastDate) {
            break;
        }
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        // 前月の日付
        if (i < firstDay) {
            const prevDate = prevMonthLastDate - firstDay + i + 1;
            dayElement.textContent = prevDate;
            dayElement.style.opacity = '0.3';
        }
        // 当月の日付
        else if (date <= lastDate) {
            dayElement.textContent = date;
            
            // 今日の日付をハイライト
            const today = new Date();
            if (year === today.getFullYear() && month === today.getMonth() && date === today.getDate()) {
                dayElement.classList.add('today');
            }
            
            // 学習記録のある日付をマーク
            const dateKey = `${year}-${month + 1}-${date}`;
            if (studyRecord.days[dateKey]) {
                dayElement.classList.add('has-activity');
                
                // 日付をクリックしたときの処理
                dayElement.addEventListener('click', function() {
                    showDayDetails(dateKey);
                });
                
                dayElement.addEventListener('touchend', function(e) {
                    e.preventDefault();
                    showDayDetails(dateKey);
                }, false);
            }
            
            date++;
        }
        // 翌月の日付
        else {
            dayElement.textContent = nextMonthDate;
            dayElement.style.opacity = '0.3';
            nextMonthDate++;
        }
        
        calendarDays.appendChild(dayElement);
    }
}

// カレンダーナビゲーション
function navigateCalendar(direction) {
    // 現在表示中の年月を取得
    const currentMonthYear = document.getElementById('current-month-year').textContent;
    const match = currentMonthYear.match(/(\d+)年(\d+)月/);
    
    if (match) {
        let year = parseInt(match[1]);
        let month = parseInt(match[2]) - 1;
        
        // 月を移動
        month += direction;
        
        // 年の切り替え
        if (month < 0) {
            month = 11;
            year--;
        } else if (month > 11) {
            month = 0;
            year++;
        }
        
        // カレンダーを再生成
        generateCalendar(year, month);
        
        // 日付詳細を非表示
        document.getElementById('day-details').classList.add('hidden');
    }
}

// 日付の詳細表示
function showDayDetails(dateKey) {
    const dayDetails = document.getElementById('day-details');
    
    // 日付の詳細がない場合は何もしない
    if (!studyRecord.days[dateKey]) {
        dayDetails.classList.add('hidden');
        return;
    }
    
    // 日付表示
    const dateParts = dateKey.split('-');
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    document.getElementById('selected-date').textContent = `${year}年${month}月${day}日`;
    
    // 統計データ表示
    const dayData = studyRecord.days[dateKey];
    document.getElementById('day-test-count').textContent = dayData.testCount || 0;
    document.getElementById('day-word-count').textContent = dayData.wordCount || 0;
    document.getElementById('day-avg-score').textContent = dayData.avgScore ? `${dayData.avgScore}%` : '0%';
    document.getElementById('day-study-time').textContent = dayData.studyTime ? `${dayData.studyTime}分` : '0分';
    
    // 活動リスト表示
    const activityList = document.getElementById('day-activity-list');
    activityList.innerHTML = '';
    
    if (dayData.activities && dayData.activities.length > 0) {
        dayData.activities.forEach(activity => {
            const li = document.createElement('li');
            li.textContent = activity;
            activityList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = '記録された活動はありません';
        activityList.appendChild(li);
    }
    
    // 表示
    dayDetails.classList.remove('hidden');
}

// 学習記録の読み込み
function loadStudyRecord() {
    try {
        const savedData = localStorage.getItem('englishStudyRecord');
        if (savedData) {
            studyRecord = JSON.parse(savedData);
            console.log('学習記録を読み込みました');
        }
    } catch (e) {
        console.error('学習記録の読み込みに失敗しました:', e);
        studyRecord = {
            days: {},
            streak: 0,
            totalDays: 0
        };
    }
}

// 学習記録の保存
function saveStudyRecord() {
    try {
        localStorage.setItem('englishStudyRecord', JSON.stringify(studyRecord));
        console.log('学習記録を保存しました');
    } catch (e) {
        console.error('学習記録の保存に失敗しました:', e);
    }
}

// 日次学習記録の更新
function updateDailyRecord() {
    // 今日の日付を取得
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    
    // 学習記録をロード
    loadStudyRecord();
    
    // 今日の記録がなければ初期化
    if (!studyRecord.days[dateKey]) {
        studyRecord.days[dateKey] = {
            testCount: 0,
            wordCount: 0,
            avgScore: 0,
            studyTime: 0,
            activities: []
        };
        
        // 連続学習日数の計算
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
        
        if (studyRecord.days[yesterdayKey]) {
            studyRecord.streak++;
        } else {
            studyRecord.streak = 1;
        }
        
        studyRecord.totalDays++;
        
        // 記録を保存
        saveStudyRecord();
    }
}

// 学習記録を更新（異常値チェックを追加）
function updateStudyRecord(activityType, data) {
    // 今日の日付を取得
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const time = `${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}`;
    
    // 学習記録をロード
    loadStudyRecord();
    
    // 今日の記録がなければ初期化
    if (!studyRecord.days[dateKey]) {
        updateDailyRecord();
    }
    
    // 記録を更新
    const dayData = studyRecord.days[dateKey];
    
    switch (activityType) {
        case 'test':
            dayData.testCount++;
            dayData.wordCount += data.wordCount || 0;
            
            // 平均スコアの更新
            if (data.score) {
                const totalScore = (dayData.avgScore * (dayData.testCount - 1) + data.score) / dayData.testCount;
                dayData.avgScore = Math.round(totalScore);
            }
            
            // 学習時間の更新
            if (data.timeSeconds) {
                dayData.studyTime += Math.round(data.timeSeconds / 60);
            }
            
            // 活動記録の追加（異常値チェック）
            let activityDetail = `${time} - ${data.testType || '英単語テスト'} (${data.score || 0}%正解)`;
            if (data.avgAnswerTime !== undefined && data.avgAnswerTime !== null) {
                // 異常値チェック（30分 = 1800秒を超える場合は表示しない）
                if (data.avgAnswerTime >= 0 && data.avgAnswerTime < 1800) {
                    activityDetail += ` 平均回答時間: ${data.avgAnswerTime.toFixed(1)}秒/問`;
                }
            }
            dayData.activities.push(activityDetail);
            break;
            
        case 'flashcard':
            dayData.wordCount += data.wordCount || 0;
            
            // スコア情報がある場合は追加
            if (data.score !== undefined) {
                // スコアを平均に組み込む
                const totalScore = (dayData.avgScore * dayData.testCount + data.score) / (dayData.testCount + 1);
                dayData.avgScore = Math.round(totalScore);
                dayData.testCount++; // テスト回数としてカウント
            }
            
            // 学習時間の更新
            if (data.timeSeconds) {
                // 実際の学習時間を記録
                dayData.studyTime += Math.round(data.timeSeconds / 60);
            } else {
                // 時間データがない場合は1単語につき10秒と仮定
                dayData.studyTime += Math.round((data.wordCount || 0) * 10 / 60);
            }
            
            // 活動記録の追加
            let flashcardActivity = `${time} - フラッシュカード学習 (${data.wordCount || 0}単語)`;
            
            // 正解率情報がある場合は追加
            if (data.knownWords !== undefined && data.unknownWords !== undefined) {
                const answeredWords = data.knownWords + data.unknownWords;
                if (answeredWords > 0) {
                    const correctRate = Math.round((data.knownWords / answeredWords) * 100);
                    flashcardActivity += ` ${correctRate}%正解`;
                }
            } else if (data.score !== undefined) {
                flashcardActivity += ` ${data.score}%正解`;
            }
            
            dayData.activities.push(flashcardActivity);
            break;
    }
    
    // 記録を保存
    saveStudyRecord();
    
    // カレンダー表示が開いていれば更新
    if (currentScreen === 'calendar') {
        updateCalendarUI();
    } else if (currentScreen === 'stats') {
        updateStatsUI();
    }
}

// 統計画面の表示を更新
function updateStatsUI() {
    if (typeof Chart === 'undefined') {
        loadChartJs();
        setTimeout(updateStatsUI, 500); // Chart.jsが読み込まれるのを待つ
        return;
    }
    
    const testHistory = progressData.testHistory || [];
    if (testHistory.length === 0) {
        if (document.getElementById('performance-chart')) {
            document.getElementById('performance-chart').innerHTML = '<div class="no-data">データがありません。テストを実施してください。</div>';
        }
        return;
    }
    
    // 初期表示は正答率
    drawPerformanceChart('accuracy');
    
    // フィルターボタンのイベント設定（すでに設定されていなければ）
    const chartFilters = document.querySelectorAll('.chart-filter');
    if (chartFilters.length > 0) {
        chartFilters.forEach(button => {
            button.addEventListener('click', function() {
                chartFilters.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                drawPerformanceChart(this.dataset.type);
            });
        });
    }
    
    // 統計データの詳細を更新
    updateStatsDetails();
}

// 統計グラフを描画
function drawPerformanceChart(type) {
    if (!document.getElementById('performance-chart') || typeof Chart === 'undefined') return;
    
    const testHistory = progressData.testHistory || [];
    if (testHistory.length === 0) return;
    
    // 日付ごとにデータをグループ化
    const groupedData = {};
    testHistory.forEach(test => {
        const date = new Date(test.date).toLocaleDateString();
        if (!groupedData[date]) {
            groupedData[date] = {
                tests: 0,
                correctTotal: 0,
                scoreTotal: 0,
                timeTotal: 0,
                wordTotal: 0,
                avgTimeTotal: 0
            };
        }
        
        groupedData[date].tests++;
        groupedData[date].correctTotal += test.correctAnswers;
        groupedData[date].scoreTotal += test.score;
        groupedData[date].timeTotal += test.timeSeconds;
        groupedData[date].wordTotal += test.totalQuestions;
        if (test.avgAnswerTime) {
            groupedData[date].avgTimeTotal += test.avgAnswerTime;
        }
    });
    
    // 日付の配列（ソート済み）
    const dates = Object.keys(groupedData).sort((a, b) => new Date(a) - new Date(b));
    
    // グラフデータの準備
    let chartData;
    let chartOptions;
    let chartTitle;
    
    switch (type) {
        case 'accuracy':
            chartTitle = '正答率の推移';
            chartData = dates.map(date => {
                const data = groupedData[date];
                return data.tests > 0 ? data.scoreTotal / data.tests : 0;
            });
            chartOptions = {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: '正答率 (%)'
                        }
                    }
                }
            };
            break;
            
        case 'speed':
        chartTitle = '平均回答時間の推移 (秒/問)';
            chartData = dates.map(date => {
                const data = groupedData[date];
                return data.tests > 0 ? (data.avgTimeTotal / data.tests).toFixed(1) : 0;
            });
            chartOptions = {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '秒/問'
                        }
                    }
                }
            };
            break;
            
        case 'words':
            chartTitle = '学習単語数の推移';
            chartData = dates.map(date => groupedData[date].wordTotal);
            chartOptions = {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '単語数'
                        }
                    }
                }
            };
            break;
    }
    
    // 既存のチャートを破棄
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    // チャートの描画
    const ctx = document.getElementById('performance-chart').getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(date => date.split('/').slice(1).join('/')), // 年を省略
            datasets: [{
                label: chartTitle,
                data: chartData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            ...chartOptions
        }
    });
}

// 統計詳細の更新
function updateStatsDetails() {
    if (!document.getElementById('stats-start-date')) return;
    
    const testHistory = progressData.testHistory || [];
    if (testHistory.length === 0) return;
    
    // 学習開始日
    const firstTestDate = new Date(testHistory[0].date);
    document.getElementById('stats-start-date').textContent = firstTestDate.toLocaleDateString();
    
    // 学習した日数の計算
    const uniqueDays = new Set();
    testHistory.forEach(test => {
        const date = new Date(test.date).toLocaleDateString();
        uniqueDays.add(date);
    });
    document.getElementById('stats-days-studied').textContent = `${uniqueDays.size}日`;
    
    // 総テスト数
    document.getElementById('stats-total-tests').textContent = testHistory.length;
    
    // 平均正答率
    const avgScore = testHistory.reduce((sum, test) => sum + test.score, 0) / testHistory.length;
    document.getElementById('stats-avg-accuracy').textContent = `${avgScore.toFixed(1)}%`;
    
    // 平均回答時間（異常値のフィルタリング）
    let avgTimePerQuestion = 0;
    let totalQuestionsWithTime = 0;
    
    testHistory.forEach(test => {
        if (test.avgAnswerTime !== undefined && test.avgAnswerTime !== null && 
            test.avgAnswerTime >= 0 && test.avgAnswerTime < 1800) { // 異常値を除外
            avgTimePerQuestion += test.avgAnswerTime * test.totalQuestions;
            totalQuestionsWithTime += test.totalQuestions;
        }
    });
    
    if (totalQuestionsWithTime > 0) {
        avgTimePerQuestion = avgTimePerQuestion / totalQuestionsWithTime;
    }
    
    document.getElementById('stats-avg-speed').textContent = `${avgTimePerQuestion.toFixed(1)}秒/問`;
    
    // 最近の傾向（直近5回と前5回の比較）
    if (testHistory.length >= 10) {
        const recent5 = testHistory.slice(-5);
        const previous5 = testHistory.slice(-10, -5);
        
        const recentAvgScore = recent5.reduce((sum, test) => sum + test.score, 0) / 5;
        const previousAvgScore = previous5.reduce((sum, test) => sum + test.score, 0) / 5;
        
        const trend = recentAvgScore - previousAvgScore;
        
        let trendText = '';
        if (trend > 5) trendText = '上昇中 ↑';
        else if (trend < -5) trendText = '下降中 ↓';
        else trendText = '安定 →';
        
        document.getElementById('stats-trend').textContent = trendText;
    } else {
        document.getElementById('stats-trend').textContent = 'データ不足';
    }
}

// カレンダー機能のセットアップ
function setupCalendar() {
    // 現在の日付を取得
    const today = new Date();
    let calendarMonth = today.getMonth();
    let calendarYear = today.getFullYear();
    
    // 学習記録をロード
    loadStudyRecord();
    
    // カレンダーを初期化
    if (document.getElementById('calendar-days')) {
        generateCalendar(calendarYear, calendarMonth);
    }
    
    // カレンダーナビゲーションボタンのイベント設定
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    
    if (prevMonthBtn && nextMonthBtn) {
        prevMonthBtn.addEventListener('click', function() {
            navigateCalendar(-1);
        });
        
        nextMonthBtn.addEventListener('click', function() {
            navigateCalendar(1);
        });
    }
}
// 画面の回転問題を修正するためのより強力な解決策
document.addEventListener('DOMContentLoaded', function() {
    // すべての重要な要素に回転をリセットするスタイルを強制適用
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        * {
            transform: none !important;
            rotate: none !important;
        }
        
        body, .app-container, .content-container, 
        .screen, .test-screen, .question-container, 
        .answer-options, .example-container,
        #test-screen, #question-text, #answer-options > div {
            transform: none !important;
            rotate: 0deg !important;
        }
    `;
    document.head.appendChild(styleElement);
    
    // 重要な要素の回転状態を直接リセット
    const criticalElements = [
        'body', '.app-container', '.content-container', 
        '#test-screen', '#question-text', '.question', 
        '.answer-options', '.answer-option'
    ];
    
    criticalElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.style.cssText += '; transform: none !important; rotate: 0deg !important;';
            
            // インラインスタイルも削除
            if (el.getAttribute('style') && 
                (el.getAttribute('style').includes('transform:') || 
                 el.getAttribute('style').includes('rotate:'))) {
                
                let style = el.getAttribute('style');
                style = style.replace(/transform:[^;]+;?/g, '');
                style = style.replace(/rotate:[^;]+;?/g, '');
                el.setAttribute('style', style + '; transform: none !important; rotate: 0deg !important;');
            }
        });
    });
    
    // スタイルが適用されたことを確認
    console.log('強化された回転修正が適用されました');
    
    // 0.5秒後にもう一度適用（遅延読み込みされるコンテンツ用）
    setTimeout(() => {
        criticalElements.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.cssText += '; transform: none !important; rotate: 0deg !important;';
            });
        });
        console.log('遅延回転修正が適用されました');
    }, 500);
});