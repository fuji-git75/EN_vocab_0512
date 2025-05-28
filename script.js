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
    testHistory: [],
    folders: {
        default: { name: 'デフォルト', words: [] }
    },
    activeFolder: 'default'
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

// アプリ設定
let appSettings = {
    defaultScreen: 'search', // デフォルトを検索画面に設定
    selectedFolders: [],  // 選択されたフォルダーを保存
    selectedTestFolder: 'all',  // テスト用に選択されたフォルダ
    selectedFlashcardFolder: 'all'  // フラッシュカード用に選択されたフォルダ
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
    
    // フォルダセレクトボックスを更新
    updateFolderSelects();
    
    // モックデータ（実際のアプリではwords.jsを読み込む）
    setupMockData();
    
    // ローカルストレージから進捗データを読み込む
    loadProgressData();
    
    // アプリ設定を読み込む
    loadAppSettings();
    
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
    
    // 検索機能の初期化
    initSearchFeature();
    
    // 初期画面を表示
    switchScreen(appSettings.defaultScreen);
    
    console.log('アプリの初期化が完了しました');
});

// 検索機能の初期化
function initSearchFeature() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResult = document.getElementById('search-result');
    const addToFolderBtn = document.getElementById('add-to-folder-btn');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const newFolderName = document.getElementById('new-folder-name');
    const folderList = document.getElementById('folder-list');
    const folderSelect = document.getElementById('folder-select');
    const importFile = document.getElementById('import-file');
    const importBtn = document.getElementById('import-btn');
    
    // 検索ボタンのイベント
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // フォルダに追加
    addToFolderBtn.addEventListener('click', addWordToFolder);
    
    // フォルダ作成
    createFolderBtn.addEventListener('click', createNewFolder);
    
    // ファイル選択
    importFile.addEventListener('change', (e) => {
        importBtn.disabled = !e.target.files.length;
    });
    
    // インポート実行
    importBtn.addEventListener('click', importWordList);
    
    // フォルダリストを更新
    updateFolderList();
}

// スペルチェック機能
async function checkSpelling(word) {
    // 文字列でない場合は空配列を返す
    if (typeof word !== 'string' || !word) {
        return [];
    }
    
    // 内蔵辞書とwords.jsの全単語を収集
    const allWords = new Set();
    
    // 内蔵辞書から
    Object.keys(japaneseDict).forEach(w => allWords.add(w.toLowerCase()));
    
    // words.jsから
    if (wordData && Array.isArray(wordData)) {
        wordData.forEach(w => {
            if (w && w.Word) {
                allWords.add(w.Word.toLowerCase());
            }
        });
    }
    
    const lowerWord = word.toLowerCase();
    
    // 完全一致したら空配列を返す
    if (allWords.has(lowerWord)) {
        return [];
    }
    
    // レーベンシュタイン距離を計算する関数
    function levenshteinDistance(a, b) {
        const matrix = [];
        
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    }
    
    // 類似単語を探す
    const suggestions = [];
    
    allWords.forEach(dictWord => {
        const distance = levenshteinDistance(lowerWord, dictWord);
        
        if (distance <= 3) { // 距離3以下の候補を収集
            suggestions.push({ word: dictWord, distance: distance });
        }
    });
    
    // 距離でソートして上位5件を返す
    return suggestions
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .map(s => s.word);
}

// 単語検索を実行
async function performSearch(wordToSearch = null) {
    // イベントオブジェクトが渡された場合は無視
    if (wordToSearch && typeof wordToSearch === 'object' && wordToSearch.constructor.name.includes('Event')) {
        wordToSearch = null;
    }
    
    const searchInput = document.getElementById('search-input');
    const searchWord = wordToSearch || searchInput.value.trim();
    
    if (!searchWord || typeof searchWord !== 'string') return;
    
    // 検索中の表示
    const searchResult = document.getElementById('search-result');
    searchResult.classList.remove('hidden');
    
    // スペルチェック
    const suggestions = await checkSpelling(searchWord);
    
    // 候補がある場合は選択肢を表示
    if (suggestions.length > 0) {
        showSpellingSuggestions(searchWord, suggestions);
        return;
    }
    
    // 正しいスペルの場合は通常の検索を実行
    executeSearch(searchWord);
}

// スペル候補を表示
function showSpellingSuggestions(originalWord, suggestions) {
    const searchResult = document.getElementById('search-result');
    searchResult.classList.remove('hidden');
    
    document.getElementById('search-word').textContent = originalWord;
    document.getElementById('search-meaning').innerHTML = `
        <div style="color: #e74c3c; margin-bottom: 10px;">
            「${originalWord}」が見つかりませんでした。
        </div>
        <div style="margin-bottom: 10px;">もしかして：</div>
        <div class="spelling-suggestions">
            ${suggestions.map(word => `
                <button class="suggestion-btn" onclick="window.performSearch('${word}')" style="
                    margin: 5px;
                    padding: 8px 16px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    ${word}
                </button>
            `).join('')}
        </div>
    `;
    document.getElementById('search-example').textContent = '';
    document.getElementById('search-idioms').textContent = '';
    
    // フォルダに追加ボタンを非表示
    const addBtn = document.getElementById('add-to-folder-btn');
    if (addBtn) addBtn.style.display = 'none';
}

// 実際の検索を実行
async function executeSearch(word) {
    const searchResult = document.getElementById('search-result');
    
    // 検索フィールドを更新
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = word;
    }
    
    document.getElementById('search-word').textContent = word;
    document.getElementById('search-meaning').textContent = '検索中...';
    document.getElementById('search-example').textContent = '';
    document.getElementById('search-idioms').textContent = '';
    
    try {
        // 最適な方法で単語情報を取得
        const wordInfo = await getCompleteWordInfo(word);
        displaySearchResult(wordInfo);
        
        // フォルダに追加ボタンを表示
        const addBtn = document.getElementById('add-to-folder-btn');
        if (addBtn) addBtn.style.display = 'block';
    } catch (error) {
        console.error('検索エラー:', error);
        // エラー時は基本情報を表示
        displayBasicResult(word);
    }
}

// 検索結果を表示
function displaySearchResult(wordInfo) {
    const searchResult = document.getElementById('search-result');
    searchResult.classList.remove('hidden');
    
    document.getElementById('search-word').textContent = wordInfo.Word;
    document.getElementById('search-pos').textContent = `[${wordInfo.POS}]`;
    document.getElementById('search-meaning').textContent = wordInfo['日本語訳'];
    document.getElementById('search-example').textContent = wordInfo['テキストで使われている文章 (例)'] || wordInfo['その他語を使った英語の例文'];
    document.getElementById('search-idioms').textContent = wordInfo['単語を使った代表的な熟語など'] || '―';
    
    // 音声ボタンの設定
    const pronounceBtn = document.getElementById('search-pronounce');
    pronounceBtn.onclick = () => speak(wordInfo.Word);
    
    const examplePronounceBtn = document.getElementById('search-example-pronounce');
    examplePronounceBtn.onclick = () => speak(document.getElementById('search-example').textContent);
    
    // 一時的に保存
    searchResult.dataset.currentWord = JSON.stringify(wordInfo);
}

// 完全な単語情報を取得する統合関数
async function getCompleteWordInfo(word) {
    // 文字列でない場合はエラー
    if (typeof word !== 'string' || !word) {
        throw new Error('Invalid word parameter');
    }
    
    // 結果オブジェクトを初期化
    let wordInfo = {
        Word: word,
        POS: 'n/v/adj',
        '日本語訳': '',
        'テキストで使われている文章 (例)': '',
        '単語を使った代表的な熟語など': ''
    };
    
    // 1. まずwords.jsから検索
    const localWord = wordData.find(w => w.Word.toLowerCase() === word.toLowerCase());
    if (localWord) {
        return localWord;
    }
    
    // 2. 内蔵辞書から日本語訳を取得
    const dictTranslation = getJapaneseTranslationFromDict(word.toLowerCase());
    if (dictTranslation) {
        wordInfo['日本語訳'] = dictTranslation;
    }
    
    // 3. 外部APIから補完情報を取得
    try {
        const apiInfo = await fetchFromMultipleAPIs(word);
        
        // APIから取得した情報で補完
        if (!wordInfo['日本語訳'] && apiInfo.translation) {
            wordInfo['日本語訳'] = apiInfo.translation;
        }
        if (apiInfo.pos) {
            wordInfo.POS = apiInfo.pos;
        }
        if (apiInfo.example) {
            wordInfo['テキストで使われている文章 (例)'] = apiInfo.example;
        }
        if (apiInfo.synonyms) {
            wordInfo['単語を使った代表的な熟語など'] = apiInfo.synonyms;
        }
    } catch (error) {
        console.log('API取得エラー:', error);
    }
    
    // 4. 日本語訳がまだない場合は、簡易的な翻訳を試みる
    if (!wordInfo['日本語訳']) {
        wordInfo['日本語訳'] = await getSimpleTranslation(word);
    }
    
    return wordInfo;
}

// 複数のAPIから情報を取得
async function fetchFromMultipleAPIs(word) {
    const results = {
        translation: '',
        pos: '',
        example: '',
        synonyms: ''
    };
    
    // 1. MyMemory Translation APIで日本語訳を取得
    try {
        const translationResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ja`);
        if (translationResponse.ok) {
            const translationData = await translationResponse.json();
            if (translationData.responseStatus === 200 && translationData.responseData && translationData.responseData.translatedText) {
                results.translation = translationData.responseData.translatedText;
            }
        }
    } catch (error) {
        console.log('MyMemory API エラー:', error);
    }
    
    // 2. Free Dictionary APIで例文と品詞情報を取得
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (response.ok) {
            const data = await response.json();
            const entry = data[0];
            const meanings = entry.meanings || [];
            
            if (meanings.length > 0) {
                const firstMeaning = meanings[0];
                results.pos = mapPOS(firstMeaning.partOfSpeech);
                
                const definitions = firstMeaning.definitions || [];
                if (definitions.length > 0) {
                    if (definitions[0].example) {
                        results.example = definitions[0].example;
                    }
                    
                    // 同義語を収集
                    const synonyms = [];
                    definitions.forEach(def => {
                        if (def.synonyms && def.synonyms.length > 0) {
                            synonyms.push(...def.synonyms);
                        }
                    });
                    if (synonyms.length > 0) {
                        results.synonyms = `類義語: ${[...new Set(synonyms)].slice(0, 5).join(', ')}`;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Dictionary API エラー:', error);
    }
    
    return results;
}

// 品詞をマッピング
function mapPOS(pos) {
    const posMap = {
        'noun': 'n',
        'verb': 'v',
        'adjective': 'adj',
        'adverb': 'adv',
        'preposition': 'prep',
        'conjunction': 'conj',
        'pronoun': 'pron',
        'interjection': 'interj'
    };
    return posMap[pos?.toLowerCase()] || 'n/v/adj';
}

// 簡易的な翻訳を取得
async function getSimpleTranslation(word) {
    // よく使われる接頭辞・接尾辞から推測
    const prefixSuffix = {
        'un': '非〜、不〜',
        're': '再〜',
        'pre': '前〜',
        'post': '後〜',
        'over': '過度の〜',
        'under': '不足の〜',
        'tion': '〜すること',
        'ment': '〜すること',
        'ness': '〜であること',
        'ful': '〜に満ちた',
        'less': '〜のない',
        'able': '〜できる',
        'ible': '〜できる',
        'ly': '〜に（副詞）',
        'er': '〜する人/もの',
        'or': '〜する人/もの',
        'ist': '〜主義者、〜家',
        'ism': '〜主義',
        'ize': '〜化する',
        'ise': '〜化する'
    };
    
    // 接頭辞・接尾辞のヒントを追加
    let hint = '';
    for (const [affix, meaning] of Object.entries(prefixSuffix)) {
        if (word.startsWith(affix) || word.endsWith(affix)) {
            hint = ` (${meaning})`;
            break;
        }
    }
    
    return `${word}${hint} (要確認)`;
}

// 日本語辞書データ
const japaneseDict = {
    // 基本動詞
    'be': 'である、いる',
    'have': '持つ、ある',
    'do': 'する',
    'say': '言う',
    'go': '行く',
    'get': '得る、もらう',
    'make': '作る',
    'know': '知る',
    'think': '考える、思う',
    'take': '取る、連れて行く',
    'see': '見る',
    'come': '来る',
    'want': '欲しい、したい',
    'look': '見る、〜に見える',
    'use': '使う',
    'find': '見つける',
    'give': '与える',
    'tell': '話す、伝える',
    'work': '働く、機能する',
    'call': '呼ぶ、電話する',
    'try': '試す',
    'ask': '尋ねる、頼む',
    'need': '必要とする',
    'feel': '感じる',
    'become': 'なる',
    'leave': '去る、残す',
    'put': '置く',
    'mean': '意味する',
    'keep': '保つ',
    'let': '〜させる',
    'begin': '始める',
    'seem': '〜のようだ',
    'help': '助ける',
    'talk': '話す',
    'turn': '回る、変わる',
    'start': '始める',
    'show': '見せる',
    'hear': '聞く',
    'play': '遊ぶ、演奏する',
    'run': '走る',
    'move': '動く',
    'like': '好き',
    'live': '住む、生きる',
    'believe': '信じる',
    'hold': '持つ、保つ',
    'bring': '持ってくる',
    'happen': '起こる',
    'write': '書く',
    'provide': '提供する',
    'sit': '座る',
    'stand': '立つ',
    'lose': '失う',
    'pay': '払う',
    'meet': '会う',
    'include': '含む',
    'continue': '続ける',
    'set': '設定する',
    'learn': '学ぶ',
    'change': '変える',
    'lead': '導く',
    'understand': '理解する',
    'watch': '見る、観察する',
    'follow': '従う、ついて行く',
    'stop': '止める',
    'create': '作る、創造する',
    'speak': '話す',
    'read': '読む',
    'allow': '許可する',
    'add': '加える',
    'spend': '費やす',
    'grow': '成長する',
    'open': '開く',
    'walk': '歩く',
    'win': '勝つ',
    'offer': '提供する',
    'remember': '覚えている',
    'love': '愛する',
    'consider': '考慮する',
    'appear': '現れる',
    'buy': '買う',
    'wait': '待つ',
    'serve': '仕える、提供する',
    'die': '死ぬ',
    'send': '送る',
    'expect': '期待する',
    'build': '建てる',
    'stay': '滞在する',
    'fall': '落ちる',
    'cut': '切る',
    'reach': '届く、達する',
    'kill': '殺す',
    'remain': '残る',
    'suggest': '提案する',
    'raise': '上げる',
    'pass': '通る、合格する',
    'sell': '売る',
    'require': '必要とする',
    'report': '報告する',
    'decide': '決める',
    'pull': '引く',
    
    // 基本名詞
    'time': '時間',
    'person': '人',
    'year': '年',
    'way': '方法、道',
    'day': '日',
    'man': '男',
    'thing': '物、こと',
    'woman': '女性',
    'life': '人生、命',
    'child': '子供',
    'world': '世界',
    'school': '学校',
    'state': '状態、州',
    'family': '家族',
    'student': '学生',
    'group': 'グループ',
    'country': '国',
    'problem': '問題',
    'hand': '手',
    'part': '部分',
    'place': '場所',
    'case': '場合、事例',
    'week': '週',
    'company': '会社',
    'system': 'システム',
    'program': 'プログラム',
    'question': '質問',
    'work': '仕事',
    'government': '政府',
    'number': '数',
    'night': '夜',
    'point': '点、ポイント',
    'home': '家',
    'water': '水',
    'room': '部屋',
    'mother': '母',
    'area': '地域、領域',
    'money': 'お金',
    'story': '物語',
    'fact': '事実',
    'month': '月',
    'book': '本',
    'eye': '目',
    'job': '仕事',
    'word': '言葉',
    'business': 'ビジネス',
    'issue': '問題',
    'side': '側',
    'kind': '種類',
    'head': '頭',
    'house': '家',
    'service': 'サービス',
    'friend': '友達',
    'father': '父',
    'power': '力',
    'hour': '時間',
    'game': 'ゲーム',
    'line': '線、列',
    'end': '終わり',
    'member': 'メンバー',
    'law': '法律',
    'car': '車',
    'city': '都市',
    'community': 'コミュニティ',
    'name': '名前',
    
    // 基本形容詞
    'good': '良い',
    'new': '新しい',
    'first': '最初の',
    'last': '最後の',
    'long': '長い',
    'great': '素晴らしい',
    'little': '小さい',
    'own': '自分の',
    'other': '他の',
    'old': '古い',
    'right': '正しい',
    'big': '大きい',
    'high': '高い',
    'different': '異なる',
    'small': '小さい',
    'large': '大きい',
    'next': '次の',
    'early': '早い',
    'young': '若い',
    'important': '重要な',
    'few': '少ない',
    'public': '公共の',
    'bad': '悪い',
    'same': '同じ',
    'able': 'できる',
    
    // 基本的な単語
    'hello': 'こんにちは',
    'goodbye': 'さようなら',
    'please': 'お願いします',
    'thank': 'ありがとう',
    'sorry': 'ごめんなさい',
    'yes': 'はい',
    'no': 'いいえ',
    'maybe': 'たぶん',
    'ok': '大丈夫',
    'okay': '大丈夫',
    
    // 数字
    'one': '1、一つ',
    'two': '2、二つ',
    'three': '3、三つ',
    'four': '4、四つ',
    'five': '5、五つ',
    'six': '6、六つ',
    'seven': '7、七つ',
    'eight': '8、八つ',
    'nine': '9、九つ',
    'ten': '10、十',
    'hundred': '100、百',
    'thousand': '1000、千',
    'million': '100万',
    'billion': '10億',
    
    // 曜日
    'monday': '月曜日',
    'tuesday': '火曜日',
    'wednesday': '水曜日',
    'thursday': '木曜日',
    'friday': '金曜日',
    'saturday': '土曜日',
    'sunday': '日曜日',
    
    // 月
    'january': '1月',
    'february': '2月',
    'march': '3月',
    'april': '4月',
    'may': '5月',
    'june': '6月',
    'july': '7月',
    'august': '8月',
    'september': '9月',
    'october': '10月',
    'november': '11月',
    'december': '12月',
    
    // 色
    'red': '赤',
    'blue': '青',
    'green': '緑',
    'yellow': '黄色',
    'black': '黒',
    'white': '白',
    'orange': 'オレンジ',
    'purple': '紫',
    'pink': 'ピンク',
    'brown': '茶色',
    'gray': '灰色',
    'grey': '灰色',
    
    // 追加の頻出単語
    'about': '〜について',
    'after': '〜の後に',
    'again': '再び',
    'all': 'すべて',
    'also': 'また',
    'an': '一つの',
    'and': 'そして',
    'another': '別の',
    'any': 'どんな〜でも',
    'are': '〜である',
    'as': '〜として',
    'at': '〜で',
    'back': '後ろ、戻る',
    'because': 'なぜなら',
    'been': '〜であった',
    'before': '〜の前に',
    'being': '〜であること',
    'between': '〜の間に',
    'both': '両方',
    'but': 'しかし',
    'by': '〜によって',
    'can': '〜できる',
    'could': '〜できた',
    'did': '〜した',
    'down': '下へ',
    'each': 'それぞれ',
    'even': '〜さえ',
    'every': 'すべての',
    'for': '〜のために',
    'from': '〜から',
    'had': '持っていた',
    'has': '持っている',
    'her': '彼女の',
    'here': 'ここ',
    'him': '彼を',
    'his': '彼の',
    'how': 'どのように',
    'if': 'もし',
    'in': '〜の中に',
    'into': '〜の中へ',
    'is': '〜である',
    'it': 'それ',
    'its': 'それの',
    'just': 'ちょうど',
    'may': '〜かもしれない',
    'me': '私を',
    'more': 'もっと',
    'most': '最も',
    'much': 'たくさん',
    'must': '〜しなければならない',
    'my': '私の',
    'never': '決して〜ない',
    'not': '〜でない',
    'now': '今',
    'of': '〜の',
    'off': '離れて',
    'on': '〜の上に',
    'only': 'だけ',
    'or': 'または',
    'our': '私たちの',
    'out': '外へ',
    'over': '〜の上に',
    'own': '自分の',
    'said': '言った',
    'same': '同じ',
    'she': '彼女',
    'should': '〜すべき',
    'since': '〜以来',
    'so': 'だから',
    'some': 'いくつかの',
    'still': 'まだ',
    'such': 'そのような',
    'than': '〜より',
    'that': 'それ',
    'the': 'その',
    'their': '彼らの',
    'them': '彼らを',
    'then': 'それから',
    'there': 'そこ',
    'these': 'これら',
    'they': '彼ら',
    'this': 'これ',
    'those': 'それら',
    'through': '〜を通って',
    'to': '〜へ',
    'too': '〜も',
    'under': '〜の下に',
    'up': '上へ',
    'very': 'とても',
    'was': '〜だった',
    'we': '私たち',
    'well': 'よく',
    'were': '〜だった',
    'what': '何',
    'when': 'いつ',
    'where': 'どこ',
    'which': 'どれ',
    'while': '〜の間',
    'who': '誰',
    'why': 'なぜ',
    'will': '〜だろう',
    'with': '〜と一緒に',
    'would': '〜だろう',
    'you': 'あなた',
    'your': 'あなたの',
    
    // ビジネス・学習関連
    'account': 'アカウント、口座',
    'action': '行動',
    'activity': '活動',
    'address': '住所、演説',
    'advance': '前進、進歩',
    'advantage': '利点',
    'advice': 'アドバイス',
    'affect': '影響する',
    'age': '年齢',
    'agency': '代理店',
    'agreement': '合意',
    'air': '空気',
    'amount': '量',
    'analysis': '分析',
    'answer': '答え',
    'apply': '申し込む、適用する',
    'application': '申請、応用、アプリケーション',
    'appointment': '予約、約束、任命',
    'approach': 'アプローチ、接近',
    'argue': '議論する',
    'article': '記事',
    'attack': '攻撃',
    'attention': '注意',
    'available': '利用可能な',
    'average': '平均',
    'avoid': '避ける',
    'bank': '銀行',
    'base': '基盤、基地',
    'basic': '基本的な',
    'beautiful': '美しい',
    'behavior': '行動',
    'benefit': '利益',
    'best': '最高の',
    'better': 'より良い',
    'bill': '請求書',
    'board': '板、委員会',
    'body': '体',
    'break': '壊す、休憩',
    'budget': '予算',
    'building': '建物',
    'campaign': 'キャンペーン',
    'cancer': 'がん',
    'capital': '資本、首都',
    'card': 'カード',
    'care': '世話、気にする',
    'career': 'キャリア',
    'carry': '運ぶ',
    'catch': '捕まえる',
    'cause': '原因',
    'cell': '細胞',
    'center': '中心',
    'central': '中央の',
    'century': '世紀',
    'certain': '確かな',
    'chair': '椅子',
    'challenge': '挑戦',
    'chance': 'チャンス',
    'character': '性格、文字',
    'charge': '料金、充電',
    'check': 'チェック',
    'choice': '選択',
    'choose': '選ぶ',
    'church': '教会',
    'citizen': '市民',
    'civil': '市民の',
    'claim': '主張',
    'class': 'クラス、階級',
    'clear': '明確な',
    'close': '閉じる、近い',
    'coach': 'コーチ',
    'cold': '冷たい',
    'collection': 'コレクション',
    'college': '大学',
    'color': '色',
    'commercial': '商業の',
    'common': '一般的な',
    'compare': '比較する',
    'computer': 'コンピューター',
    'concern': '懸念',
    'condition': '状態',
    'conference': '会議',
    'congress': '議会',
    'connect': '接続する',
    'consider': '考慮する',
    'consumer': '消費者',
    'contain': '含む',
    'control': 'コントロール',
    'cost': '費用',
    'couple': 'カップル',
    'course': 'コース',
    'court': '裁判所',
    'cover': '覆う',
    'crime': '犯罪',
    'cultural': '文化的な',
    'culture': '文化',
    'cup': 'カップ',
    'current': '現在の',
    'customer': '顧客',
    'dark': '暗い',
    'data': 'データ',
    'daughter': '娘',
    'deal': '取引',
    'death': '死',
    'debate': '討論',
    'decade': '10年間',
    'decision': '決定',
    'deep': '深い',
    'defense': '防衛',
    'degree': '度、学位',
    'democratic': '民主的な',
    'department': '部門',
    'describe': '説明する',
    'design': 'デザイン',
    'despite': '〜にもかかわらず',
    'detail': '詳細',
    'determine': '決定する',
    'develop': '開発する',
    'development': '開発',
    'difference': '違い',
    'difficult': '難しい',
    'dinner': '夕食',
    'direction': '方向',
    'director': 'ディレクター',
    'discover': '発見する',
    'discuss': '議論する',
    'disease': '病気',
    'doctor': '医者',
    'dog': '犬',
    'door': 'ドア',
    'dream': '夢',
    'drive': '運転する',
    'drop': '落とす',
    'drug': '薬',
    'during': '〜の間',
    'east': '東',
    'easy': '簡単な',
    'eat': '食べる',
    'economic': '経済的な',
    'economy': '経済',
    'edge': '端',
    'education': '教育',
    'effect': '効果',
    'effort': '努力',
    'eight': '8',
    'either': 'どちらか',
    'election': '選挙',
    'else': '他の',
    'employee': '従業員',
    'energy': 'エネルギー',
    'enjoy': '楽しむ',
    'enough': '十分な',
    'enter': '入る',
    'entire': '全体の',
    'environment': '環境',
    'environmental': '環境の',
    'especially': '特に',
    'establish': '設立する',
    'evening': '夕方',
    'event': 'イベント',
    'ever': '今までに',
    'everybody': '誰もが',
    'everyone': '誰もが',
    'everything': 'すべて',
    'evidence': '証拠',
    'exactly': '正確に',
    'example': '例',
    'executive': '幹部',
    'exist': '存在する',
    'experience': '経験',
    'expert': '専門家',
    'explain': '説明する',
    'face': '顔',
    'factor': '要因',
    'fail': '失敗する',
    'false': '偽の',
    'famous': '有名な',
    'far': '遠い',
    'fast': '速い',
    'fear': '恐れ',
    'federal': '連邦の',
    'feeling': '感情',
    'field': '分野',
    'fight': '戦う',
    'figure': '人物、数字',
    'fill': '満たす',
    'film': '映画',
    'final': '最終的な',
    'finally': 'ついに',
    'financial': '財政的な',
    'fine': '素晴らしい',
    'finger': '指',
    'finish': '終える',
    'fire': '火',
    'firm': '会社',
    'fish': '魚',
    'floor': '床',
    'fly': '飛ぶ',
    'focus': '焦点',
    'food': '食べ物',
    'foot': '足',
    'force': '力',
    'foreign': '外国の',
    'forget': '忘れる',
    'form': '形',
    'former': '前の',
    'forward': '前へ',
    'four': '4',
    'free': '自由な',
    'fresh': '新鮮な',
    'front': '前',
    'full': '満ちた',
    'fund': '資金',
    'future': '未来',
    'garden': '庭',
    'gas': 'ガス',
    'general': '一般的な',
    'generation': '世代',
    'girl': '女の子',
    'glass': 'ガラス',
    'global': 'グローバル',
    'goal': '目標',
    'gold': '金',
    'gone': '行ってしまった',
    'government': '政府',
    'great': '素晴らしい',
    'ground': '地面',
    'growth': '成長',
    'guess': '推測する',
    'gun': '銃',
    'guy': '男',
    'hair': '髪',
    'half': '半分',
    'hang': '掛ける',
    'happy': '幸せな',
    'hard': '硬い、難しい',
    'health': '健康',
    'heart': '心臓',
    'heat': '熱',
    'heavy': '重い',
    'herself': '彼女自身',
    'himself': '彼自身',
    'history': '歴史',
    'hit': '打つ',
    'hope': '希望',
    'hospital': '病院',
    'hot': '熱い',
    'hotel': 'ホテル',
    'huge': '巨大な',
    'human': '人間',
    'hundred': '百',
    'husband': '夫',
    'idea': 'アイデア',
    'identify': '識別する',
    'image': '画像',
    'imagine': '想像する',
    'impact': '影響',
    'improve': '改善する',
    'increase': '増加する',
    'indeed': '確かに',
    'indicate': '示す',
    'individual': '個人',
    'industry': '産業',
    'information': '情報',
    'inside': '内側',
    'instead': '代わりに',
    'institution': '機関',
    'interest': '興味',
    'interesting': '面白い',
    'international': '国際的な',
    'interview': 'インタビュー',
    'investment': '投資',
    'involve': '含む',
    'itself': 'それ自体',
    'join': '参加する',
    'key': '鍵',
    'kid': '子供',
    'kitchen': '台所',
    'knowledge': '知識',
    'land': '土地',
    'language': '言語',
    'large': '大きい',
    'late': '遅い',
    'later': '後で',
    'laugh': '笑う',
    'lawyer': '弁護士',
    'lay': '置く',
    'leader': 'リーダー',
    'least': '最も少ない',
    'leg': '脚',
    'legal': '法的な',
    'less': 'より少ない',
    'letter': '手紙',
    'level': 'レベル',
    'lie': '嘘、横になる',
    'light': '光',
    'likely': 'ありそうな',
    'list': 'リスト',
    'listen': '聞く',
    'local': '地元の',
    'long': '長い',
    'loss': '損失',
    'lot': 'たくさん',
    'low': '低い',
    'machine': '機械',
    'magazine': '雑誌',
    'main': '主な',
    'maintain': '維持する',
    'major': '主要な',
    'majority': '多数',
    'manage': '管理する',
    'management': '管理',
    'manager': 'マネージャー',
    'many': '多くの',
    'market': '市場',
    'marriage': '結婚',
    'material': '材料',
    'matter': '問題',
    'maybe': 'たぶん',
    'measure': '測る',
    'media': 'メディア',
    'medical': '医学の',
    'meeting': '会議',
    'memory': '記憶',
    'mention': '言及する',
    'message': 'メッセージ',
    'method': '方法',
    'middle': '中間',
    'might': '〜かもしれない',
    'military': '軍の',
    'mind': '心',
    'minute': '分',
    'miss': '逃す',
    'mission': '使命',
    'model': 'モデル',
    'modern': '現代的な',
    'moment': '瞬間',
    'morning': '朝',
    'mouth': '口',
    'movement': '動き',
    'movie': '映画',
    'music': '音楽',
    'myself': '私自身',
    'nation': '国家',
    'national': '国の',
    'natural': '自然な',
    'nature': '自然',
    'near': '近い',
    'nearly': 'ほとんど',
    'necessary': '必要な',
    'network': 'ネットワーク',
    'news': 'ニュース',
    'newspaper': '新聞',
    'nice': '素敵な',
    'none': '誰も〜ない',
    'nonetheless': 'それにもかかわらず',
    'nor': '〜も〜ない',
    'north': '北',
    'note': 'メモ',
    'nothing': '何もない',
    'notice': '気づく',
    'nevertheless': 'それにもかかわらず',
    'office': 'オフィス',
    'officer': '役員',
    'official': '公式の',
    'often': 'しばしば',
    'oil': '油',
    'once': '一度',
    'operation': '操作',
    'opportunity': '機会',
    'option': 'オプション',
    'order': '注文',
    'organization': '組織',
    'others': '他の人',
    'outside': '外側',
    'page': 'ページ',
    'pain': '痛み',
    'painting': '絵画',
    'paper': '紙',
    'parent': '親',
    'park': '公園',
    'particular': '特定の',
    'particularly': '特に',
    'partner': 'パートナー',
    'party': 'パーティー',
    'patient': '患者',
    'pattern': 'パターン',
    'peace': '平和',
    'people': '人々',
    'per': '〜につき',
    'perform': '実行する',
    'performance': 'パフォーマンス',
    'perhaps': 'おそらく',
    'period': '期間',
    'personal': '個人的な',
    'phone': '電話',
    'physical': '物理的な',
    'pick': '選ぶ',
    'picture': '写真',
    'piece': '一片',
    'plan': '計画',
    'plant': '植物',
    'player': 'プレイヤー',
    'pm': '午後',
    'point': '点',
    'police': '警察',
    'policy': '政策',
    'political': '政治的な',
    'politics': '政治',
    'poor': '貧しい',
    'popular': '人気のある',
    'population': '人口',
    'position': '位置',
    'positive': '肯定的な',
    'possible': '可能な',
    'practice': '練習',
    'prepare': '準備する',
    'present': '現在',
    'president': '大統領',
    'pressure': '圧力',
    'pretty': 'かなり',
    'prevent': '防ぐ',
    'price': '価格',
    'private': '私的な',
    'probably': 'おそらく',
    'procedure': '手順',
    'process': 'プロセス',
    'produce': '生産する',
    'product': '製品',
    'production': '生産',
    'professional': 'プロフェッショナル',
    'professor': '教授',
    'project': 'プロジェクト',
    'promise': '約束',
    'promote': '促進する',
    'promotion': '昇進、販促',
    'property': '財産',
    'proposal': '提案',
    'propose': '提案する',
    'protect': '守る',
    'prove': '証明する',
    'provide': '提供する',
    'provision': '提供、条項',
    'public': '公共の',
    'purchase': '購入',
    'purpose': '目的',
    'pursue': '追求する',
    'push': '押す',
    'qualification': '資格',
    'quality': '品質',
    'quantity': '数量',
    'quarter': '四半期',
    'quickly': '素早く',
    'quite': 'かなり',
    'race': 'レース',
    'radio': 'ラジオ',
    'range': '範囲',
    'rate': '率',
    'rather': 'むしろ',
    'reality': '現実',
    'realize': '気づく',
    'really': '本当に',
    'reason': '理由',
    'receipt': '領収書',
    'receive': '受け取る',
    'recent': '最近の',
    'recently': '最近',
    'recognize': '認識する',
    'recommend': '推薦する',
    'recommendation': '推薦',
    'record': '記録',
    'recover': '回復する',
    'reduce': '減らす',
    'refer': '参照する',
    'reference': '参照',
    'reflect': '反映する',
    'refuse': '拒否する',
    'regard': 'みなす',
    'region': '地域',
    'register': '登録する',
    'registration': '登録',
    'regular': '定期的な',
    'regulation': '規制',
    'reject': '拒絶する',
    'relate': '関係する',
    'relationship': '関係',
    'religious': '宗教的な',
    'remove': '取り除く',
    'represent': '代表する',
    'republican': '共和党の',
    'research': '研究',
    'resource': '資源',
    'respond': '応答する',
    'response': '応答',
    'responsibility': '責任',
    'rest': '休み',
    'result': '結果',
    'return': '戻る',
    'reveal': '明らかにする',
    'rich': '金持ちの',
    'rise': '上がる',
    'risk': 'リスク',
    'road': '道路',
    'rock': '岩',
    'role': '役割',
    'rule': 'ルール',
    'safe': '安全な',
    'save': '保存する',
    'saving': '節約',
    'scale': '規模',
    'scan': 'スキャン',
    'schedule': 'スケジュール',
    'scheme': '計画',
    'scope': '範囲',
    'score': 'スコア',
    'screen': '画面',
    'scene': '場面',
    'science': '科学',
    'scientist': '科学者',
    'score': 'スコア',
    'sea': '海',
    'season': '季節',
    'seat': '座席',
    'second': '2番目',
    'section': 'セクション',
    'security': 'セキュリティ',
    'seek': '探す',
    'sense': '感覚',
    'series': 'シリーズ',
    'serious': '真剣な',
    'several': 'いくつかの',
    'sex': '性',
    'sexual': '性的な',
    'shake': '振る',
    'share': '共有する',
    'shoot': '撃つ',
    'short': '短い',
    'shot': 'ショット',
    'shoulder': '肩',
    'sign': 'サイン',
    'significant': '重要な',
    'similar': '似た',
    'simple': '簡単な',
    'simply': '単に',
    'sing': '歌う',
    'single': '単一の',
    'sister': '姉妹',
    'site': 'サイト',
    'situation': '状況',
    'size': 'サイズ',
    'skill': 'スキル',
    'skin': '肌',
    'smile': '微笑む',
    'social': '社会的な',
    'society': '社会',
    'soldier': '兵士',
    'somebody': '誰か',
    'someone': '誰か',
    'something': '何か',
    'sometimes': '時々',
    'son': '息子',
    'song': '歌',
    'soon': 'すぐに',
    'sort': '種類',
    'sound': '音',
    'source': 'ソース',
    'south': '南',
    'southern': '南の',
    'space': '空間',
    'special': '特別な',
    'specific': '特定の',
    'speech': 'スピーチ',
    'sport': 'スポーツ',
    'spring': '春',
    'staff': 'スタッフ',
    'stage': 'ステージ',
    'standard': '標準',
    'star': '星',
    'statement': '声明',
    'station': '駅',
    'step': 'ステップ',
    'stock': '在庫',
    'store': '店',
    'strategy': '戦略',
    'street': '通り',
    'strong': '強い',
    'structure': '構造',
    'stuff': 'もの',
    'style': 'スタイル',
    'subject': '主題',
    'success': '成功',
    'successful': '成功した',
    'suddenly': '突然',
    'suffer': '苦しむ',
    'summer': '夏',
    'support': 'サポート',
    'sure': '確かな',
    'surface': '表面',
    'system': 'システム',
    'table': 'テーブル',
    'task': 'タスク',
    'tax': '税',
    'teach': '教える',
    'teacher': '先生',
    'team': 'チーム',
    'technology': 'テクノロジー',
    'television': 'テレビ',
    'tend': '傾向がある',
    'term': '期間',
    'test': 'テスト',
    'text': 'テキスト',
    'thank': '感謝する',
    'themselves': '彼ら自身',
    'theory': '理論',
    'third': '3番目',
    'thought': '考え',
    'thousand': '千',
    'threat': '脅威',
    'throughout': '〜中',
    'throw': '投げる',
    'thus': 'このように',
    'today': '今日',
    'together': '一緒に',
    'tonight': '今夜',
    'top': 'トップ',
    'total': '合計',
    'tough': 'タフな',
    'toward': '〜に向かって',
    'town': '町',
    'trade': '貿易',
    'traditional': '伝統的な',
    'training': 'トレーニング',
    'travel': '旅行',
    'treat': '扱う',
    'treatment': '治療',
    'tree': '木',
    'trial': '試験',
    'trip': '旅行',
    'trouble': 'トラブル',
    'true': '真実の',
    'truth': '真実',
    'try': '試す',
    'turn': '回る',
    'tv': 'テレビ',
    'type': 'タイプ',
    'understand': '理解する',
    'unit': '単位',
    'united': '統一された',
    'university': '大学',
    'unless': '〜でない限り',
    'until': '〜まで',
    'upon': '〜の上に',
    'us': '私たちを',
    'usually': '通常',
    'value': '価値',
    'various': '様々な',
    'victim': '被害者',
    'view': '見解',
    'violence': '暴力',
    'visit': '訪問',
    'voice': '声',
    'vote': '投票',
    'wait': '待つ',
    'wall': '壁',
    'war': '戦争',
    'watch': '見る',
    'weapon': '武器',
    'wear': '着る',
    'weather': '天気',
    'weight': '重さ',
    'west': '西',
    'western': '西の',
    'whatever': '何でも',
    'whether': '〜かどうか',
    'whom': '誰を',
    'whose': '誰の',
    'wide': '広い',
    'wife': '妻',
    'wind': '風',
    'window': '窓',
    'wish': '願う',
    'within': '〜の中に',
    'without': '〜なしで',
    'wonder': '不思議に思う',
    'wood': '木材',
    'worker': '労働者',
    'world': '世界',
    'worry': '心配する',
    'worth': '価値がある',
    'writer': '作家',
    'wrong': '間違った',
    'yard': 'ヤード',
    'yeah': 'うん',
    'yet': 'まだ',
    'yourself': 'あなた自身',
    'youth': '若者'
};

// 内蔵辞書から直接取得（await不要）
function getJapaneseTranslationFromDict(word) {
    return japaneseDict[word] || null;
}

// 外部APIから例文を取得
async function fetchWordExamples(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!response.ok) return {};
        
        const data = await response.json();
        const entry = data[0];
        const meanings = entry.meanings || [];
        
        let example = '';
        let pos = '';
        let synonyms = '';
        
        if (meanings.length > 0) {
            const firstMeaning = meanings[0];
            pos = firstMeaning.partOfSpeech || '';
            
            const definitions = firstMeaning.definitions || [];
            if (definitions.length > 0 && definitions[0].example) {
                example = definitions[0].example;
            }
            
            // 同義語を収集
            const allSynonyms = [];
            definitions.forEach(def => {
                if (def.synonyms && def.synonyms.length > 0) {
                    allSynonyms.push(...def.synonyms);
                }
            });
            if (allSynonyms.length > 0) {
                synonyms = `類義語: ${[...new Set(allSynonyms)].slice(0, 5).join(', ')}`;
            }
        }
        
        // 品詞をマッピング
        const posMap = {
            'noun': 'n',
            'verb': 'v',
            'adjective': 'adj',
            'adverb': 'adv',
            'preposition': 'prep',
            'conjunction': 'conj',
            'pronoun': 'pron',
            'interjection': 'interj'
        };
        
        return {
            pos: posMap[pos.toLowerCase()] || 'n/v/adj',
            example: example,
            synonyms: synonyms
        };
    } catch (error) {
        return {};
    }
}


// MyMemory Translation APIを使用して日本語訳を取得
async function getJapaneseTranslationFromAPI(word) {
    try {
        // MyMemory APIを使用（無料、1日あたり5000文字まで）
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ja`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Translation API error');
        }
        
        const data = await response.json();
        
        // APIレスポンスの確認
        if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
            // 翻訳された文字列を返す
            return data.responseData.translatedText;
        }
        
        return null;
    } catch (error) {
        console.error('Translation API error:', error);
        return null;
    }
}

// 外部APIから単語情報を取得
async function fetchWordFromAPI(word) {
    try {
        // Free Dictionary APIを使用
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        
        if (!response.ok) {
            throw new Error('単語が見つかりませんでした');
        }
        
        const data = await response.json();
        const entry = data[0];
        
        // APIのレスポンスを整形
        const meanings = entry.meanings || [];
        let allDefinitions = [];
        let allExamples = [];
        let allSynonyms = [];
        let mainPOS = '';
        
        // すべての意味を収集
        meanings.forEach((meaning, index) => {
            if (index === 0) {
                mainPOS = meaning.partOfSpeech || 'noun';
            }
            
            const definitions = meaning.definitions || [];
            definitions.forEach(def => {
                if (def.definition) {
                    allDefinitions.push(def.definition);
                }
                if (def.example) {
                    allExamples.push(def.example);
                }
                if (def.synonyms && def.synonyms.length > 0) {
                    allSynonyms = [...allSynonyms, ...def.synonyms];
                }
            });
        });
        
        // 品詞をマッピング
        const posMap = {
            'noun': 'n',
            'verb': 'v',
            'adjective': 'adj',
            'adverb': 'adv',
            'preposition': 'prep',
            'conjunction': 'conj',
            'pronoun': 'pron',
            'interjection': 'interj'
        };
        
        // 日本語訳を生成
        let japaneseTranslation = '';
        
        // まず内蔵辞書をチェック
        const dictTranslation = getJapaneseTranslationFromDict(word.toLowerCase());
        if (dictTranslation) {
            japaneseTranslation = dictTranslation;
        } else {
            // 内蔵辞書にない場合は、MyMemory APIを使用
            const apiTranslation = await getJapaneseTranslationFromAPI(word);
            if (apiTranslation) {
                japaneseTranslation = apiTranslation;
            } else {
                // APIも失敗した場合は、英語定義を簡潔に表示
                const shortDef = allDefinitions[0] ? allDefinitions[0].split('.')[0] : 'No definition available';
                japaneseTranslation = `${shortDef} (要確認)`;
                
                // 品詞情報を追加
                if (mainPOS) {
                    const posJapanese = {
                        'noun': '名詞',
                        'verb': '動詞',
                        'adjective': '形容詞',
                        'adverb': '副詞',
                        'preposition': '前置詞',
                        'conjunction': '接続詞',
                        'pronoun': '代名詞',
                        'interjection': '感動詞'
                    };
                    japaneseTranslation = `[${posJapanese[mainPOS.toLowerCase()] || mainPOS}] ${japaneseTranslation}`;
                }
            }
        }
        
        // 例文を整形
        const exampleText = allExamples.length > 0 ? allExamples[0] : '';
        
        // 同義語を整形
        const uniqueSynonyms = [...new Set(allSynonyms)].slice(0, 5);
        const synonymText = uniqueSynonyms.length > 0 ? `類義語: ${uniqueSynonyms.join(', ')}` : '';
        
        return {
            Word: word,
            POS: posMap[mainPOS.toLowerCase()] || 'n',
            '日本語訳': japaneseTranslation,
            'テキストで使われている文章 (例)': exampleText,
            '単語を使った代表的な熟語など': synonymText
        };
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// 基本的な結果を表示（辞書にない場合）
function displayBasicResult(word) {
    const searchResult = document.getElementById('search-result');
    searchResult.classList.remove('hidden');
    
    const basicInfo = {
        Word: word,
        POS: 'n/v/adj',
        '日本語訳': '（単語が見つかりませんでした）',
        'テキストで使われている文章 (例)': '',
        '単語を使った代表的な熟語など': ''
    };
    
    displaySearchResult(basicInfo);
}

// フォルダに単語を追加
function addWordToFolder() {
    const searchResult = document.getElementById('search-result');
    const folderSelect = document.getElementById('folder-select');
    const selectedFolder = folderSelect.value;
    
    if (!searchResult.dataset.currentWord) return;
    
    const wordInfo = JSON.parse(searchResult.dataset.currentWord);
    
    // フォルダに追加
    if (!progressData.folders[selectedFolder].words.find(w => w.Word === wordInfo.Word)) {
        progressData.folders[selectedFolder].words.push(wordInfo);
        
        // 最後に追加したフォルダを記録
        progressData.lastAddedFolder = selectedFolder;
        
        saveProgressData();
        updateFolderList();
        
        // 成功メッセージ
        const message = document.createElement('div');
        message.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #2ecc71; color: white; padding: 15px 30px; border-radius: 5px; z-index: 10000; font-size: 16px;';
        message.textContent = `「${wordInfo.Word}」を「${progressData.folders[selectedFolder].name}」に追加しました`;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 2000);
        
        // 検索フィールドをクリアして次の検索の準備
        document.getElementById('search-input').value = '';
        document.getElementById('search-input').focus();
    } else {
        alert('この単語は既に登録されています');
    }
}

// 新しいフォルダを作成
function createNewFolder() {
    const newFolderName = document.getElementById('new-folder-name');
    const folderName = newFolderName.value.trim();
    
    if (!folderName) return;
    
    const folderId = 'folder_' + Date.now();
    progressData.folders[folderId] = {
        name: folderName,
        words: []
    };
    
    saveProgressData();
    updateFolderList();
    newFolderName.value = '';
}

// フォルダリストを更新
function updateFolderList() {
    const folderList = document.getElementById('folder-list');
    const folderSelect = document.getElementById('folder-select');
    
    // リストをクリア
    folderList.innerHTML = '';
    folderSelect.innerHTML = '';
    
    // フォルダを表示
    Object.entries(progressData.folders).forEach(([id, folder]) => {
        // フォルダリスト項目
        const folderItem = document.createElement('div');
        folderItem.className = 'folder-item';
        folderItem.dataset.folder = id;
        if (id === progressData.activeFolder) {
            folderItem.classList.add('active');
        }
        
        folderItem.innerHTML = `
            <i class="fas fa-folder"></i>
            <span>${folder.name}</span>
            <span class="folder-count">(${folder.words.length})</span>
        `;
        
        folderItem.addEventListener('click', () => selectFolder(id));
        folderList.appendChild(folderItem);
        
        // セレクトボックスオプション
        const option = document.createElement('option');
        option.value = id;
        option.textContent = folder.name;
        folderSelect.appendChild(option);
    });
    
    // 最後に追加したフォルダがあれば、それを選択
    if (progressData.lastAddedFolder && progressData.folders[progressData.lastAddedFolder]) {
        folderSelect.value = progressData.lastAddedFolder;
    }
    
    // テストとフラッシュカードのフォルダセレクトも更新
    updateFolderSelects();
}

// フォルダを選択
function selectFolder(folderId) {
    progressData.activeFolder = folderId;
    saveProgressData();
    updateFolderList();
}

// 単語リストをインポート
async function importWordList() {
    const importFile = document.getElementById('import-file');
    const folderSelect = document.getElementById('folder-select');
    const selectedFolder = folderSelect.value;
    
    if (!importFile.files.length) return;
    
    const file = importFile.files[0];
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    let importedCount = 0;
    
    for (const line of lines) {
        const word = line.trim().split(',')[0]; // CSVの場合は最初のカラムを単語として扱う
        if (!word) continue;
        
        // 既存の辞書から検索
        let wordInfo = wordData.find(w => w.Word.toLowerCase() === word.toLowerCase());
        
        if (!wordInfo) {
            // 辞書にない場合は基本情報を作成
            wordInfo = {
                Word: word,
                POS: 'n/v/adj',
                '日本語訳': '（要確認）',
                'テキストで使われている文章 (例)': '',
                '単語を使った代表的な熟語など': ''
            };
        }
        
        // フォルダに追加（重複チェック）
        if (!progressData.folders[selectedFolder].words.find(w => w.Word === wordInfo.Word)) {
            progressData.folders[selectedFolder].words.push(wordInfo);
            importedCount++;
        }
    }
    
    saveProgressData();
    updateFolderList();
    
    alert(`${importedCount}個の単語をインポートしました`);
    importFile.value = '';
    document.getElementById('import-btn').disabled = true;
}

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
    
    // 音声合成を停止
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
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
    
    // 検索画面のボタン
    setupSearchEvents();
    
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
    
    // 設定保存ボタン
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function() {
            const defaultScreenSelect = document.getElementById('default-screen');
            if (defaultScreenSelect) {
                appSettings.defaultScreen = defaultScreenSelect.value;
                saveAppSettings();
                
                // 成功メッセージを表示
                const message = document.createElement('div');
                message.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #2ecc71; color: white; padding: 15px 30px; border-radius: 5px; z-index: 10000; font-size: 16px;';
                message.textContent = '設定を保存しました';
                document.body.appendChild(message);
                
                setTimeout(() => {
                    message.remove();
                }, 2000);
            }
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
        if (answerOption && 
            !answerOption.classList.contains('correct') && 
            !answerOption.classList.contains('wrong') &&
            answerOption.style.pointerEvents !== 'none' &&
            !currentTest.questionAnswered) {
            checkAnswer(answerOption);
        }
    });
    
    // タッチデバイス対応
    answerOptionsContainer.addEventListener('touchend', function(event) {
        const answerOption = event.target.closest('.answer-option');
        if (answerOption && 
            !answerOption.classList.contains('correct') && 
            !answerOption.classList.contains('wrong') &&
            answerOption.style.pointerEvents !== 'none' &&
            !currentTest.questionAnswered) {
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

// 検索画面のイベント設定
function setupSearchEvents() {
    // 検索ボタン
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            performSearch();
        });
    }
    
    // Enterキーで検索
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // フォルダに追加ボタン
    const addToFolderBtn = document.getElementById('add-to-folder-btn');
    if (addToFolderBtn) {
        addToFolderBtn.addEventListener('click', addWordToFolder);
    }
    
    // 新しいフォルダ作成ボタン
    const createFolderBtn = document.getElementById('create-folder-btn');
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', createNewFolder);
    }
    
    // ファイルインポート
    const importFile = document.getElementById('import-file');
    const importBtn = document.getElementById('import-btn');
    
    if (importFile) {
        importFile.addEventListener('change', function() {
            if (importBtn) {
                importBtn.disabled = !this.files.length;
            }
        });
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', function() {
            const file = importFile.files[0];
            if (file) {
                importWordList(file);
            }
        });
    }
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
        
        // テキストをクリーンアップ（アスタリスクや特殊文字を除去）
        let cleanText = text
            .replace(/\*/g, '') // アスタリスクを除去
            .replace(/[\[\]\{\}\(\)]/g, '') // 括弧類を除去
            .replace(/[""''「」『』]/g, '') // 引用符を除去
            .replace(/\s+/g, ' ') // 連続する空白を単一の空白に
            .trim();
        
        // 新しい音声を作成
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
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
            
            // foldersがなければ初期化
            if (!progressData.folders) {
                progressData.folders = {
                    default: { name: 'デフォルト', words: [] }
                };
            }
            
            // activeFolderがなければ初期化
            if (!progressData.activeFolder) {
                progressData.activeFolder = 'default';
            }
            
            console.log('進捗データを読み込みました');
        } else {
            // 保存データがない場合も初期化
            progressData.folders = {
                default: { name: 'デフォルト', words: [] }
            };
            progressData.activeFolder = 'default';
        }
    } catch (e) {
        console.error('進捗データの読み込みに失敗しました:', e);
        progressData = {
            totalTests: 0,
            wordMastery: {},
            recentlyWrongWords: [],
            testHistory: [],
            folders: {
                default: { name: 'デフォルト', words: [] }
            },
            activeFolder: 'default'
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

// アプリ設定を読み込む
function loadAppSettings() {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
        appSettings = JSON.parse(savedSettings);
        console.log('アプリ設定を読み込みました:', appSettings);
        
        // 設定画面のセレクトボックスを更新
        const defaultScreenSelect = document.getElementById('default-screen');
        if (defaultScreenSelect) {
            defaultScreenSelect.value = appSettings.defaultScreen;
        }
    }
}

// アプリ設定を保存
function saveAppSettings() {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    console.log('アプリ設定を保存しました:', appSettings);
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

// フォルダセレクトボックスを更新
function updateFolderSelects() {
    const testFolderSelect = document.getElementById('test-folder');
    const flashcardFolderSelect = document.getElementById('flashcard-folder');
    
    if (testFolderSelect) {
        testFolderSelect.innerHTML = '<option value="all">すべての単語</option>';
        Object.entries(progressData.folders).forEach(([id, folder]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${folder.name} (${folder.words.length})`;
            testFolderSelect.appendChild(option);
        });
        
        // 保存された選択を復元
        if (appSettings.selectedTestFolder) {
            testFolderSelect.value = appSettings.selectedTestFolder;
        }
    }
    
    if (flashcardFolderSelect) {
        flashcardFolderSelect.innerHTML = '<option value="all">すべての単語</option>';
        Object.entries(progressData.folders).forEach(([id, folder]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${folder.name} (${folder.words.length})`;
            flashcardFolderSelect.appendChild(option);
        });
        
        // 保存された選択を復元
        if (appSettings.selectedFlashcardFolder) {
            flashcardFolderSelect.value = appSettings.selectedFlashcardFolder;
        }
    }
}

// カスタムテスト開始
function startCustomTest() {
    const testType = document.getElementById('test-type').value;
    const questionCount = parseInt(document.getElementById('question-count').value) || 10;
    const difficulty = document.getElementById('difficulty').value;
    const timerEnabled = document.getElementById('timer-enabled').checked;
    const showExamples = document.getElementById('show-examples').checked;
    const enableSound = document.getElementById('enable-sound').checked;
    
    // 選択されたフォルダを保存
    const testFolderSelect = document.getElementById('test-folder');
    if (testFolderSelect) {
        appSettings.selectedTestFolder = testFolderSelect.value;
        saveAppSettings();
    }
    
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
    // フォルダ選択を確認
    const testFolderSelect = document.getElementById('test-folder');
    const testFolder = testFolderSelect ? testFolderSelect.value : 'all';
    let filteredWords = [];
    
    if (testFolder === 'all') {
        // すべての単語を使用
        filteredWords = [...wordData];
    } else if (progressData.folders[testFolder]) {
        // 選択されたフォルダの単語を使用
        filteredWords = [...progressData.folders[testFolder].words];
        console.log('フォルダから取得した単語:', filteredWords);
        
        // フォルダ内の単語が適切な形式であることを確認
        filteredWords = filteredWords.filter(word => {
            if (!word || typeof word !== 'object') {
                console.warn('無効な単語データ:', word);
                return false;
            }
            if (!word.Word || !word['日本語訳']) {
                console.warn('必須フィールドが不足:', word);
                return false;
            }
            return true;
        });
        
        // 必須フィールドが欠けている場合はデフォルト値を設定
        filteredWords = filteredWords.map(word => ({
            Word: word.Word || '',
            POS: word.POS || 'n/v/adj',
            '日本語訳': word['日本語訳'] || '',
            'テキストで使われている文章 (例)': word['テキストで使われている文章 (例)'] || '',
            '単語を使った代表的な熟語など': word['単語を使った代表的な熟語など'] || ''
        }));
    } else {
        // デフォルトに戻る
        filteredWords = [...wordData];
    }
    
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
        questionTimes: [],
        questionAnswered: false  // 現在の問題に回答済みかどうかのフラグ
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
    // currentTestとwordsの存在チェック
    if (!currentTest || !currentTest.words || currentTest.words.length === 0) {
        console.error('テストデータが正しく初期化されていません');
        alert('テストデータにエラーがあります。ホーム画面に戻ります。');
        switchScreen('home');
        return;
    }
    
    // 新しい問題のため回答フラグをリセット
    currentTest.questionAnswered = false;
    
    const wordObj = currentTest.words[currentTest.currentQuestionIndex];
    
    if (!wordObj) {
        console.error('単語オブジェクトが見つかりません:', currentTest.currentQuestionIndex);
        return;
    }
    
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
        // 選択肢を有効化
        optionDiv.style.pointerEvents = 'auto';
        optionDiv.style.cursor = 'pointer';
        optionDiv.classList.remove('disabled');
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
        answerElement.classList.contains('wrong') ||
        currentTest.questionAnswered) {
        return;
    }
    
    // 回答済みフラグを立てる
    currentTest.questionAnswered = true;
    
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
        // すべての選択肢を無効化
        option.style.pointerEvents = 'none';
        option.style.cursor = 'default';
        option.classList.add('disabled');
        
        if (option.dataset.correct === 'true') {
            option.classList.add('correct');
        }
        else if (option === answerElement && !isCorrect) {
            option.classList.add('wrong');
        }
    });
    
    // 回答を記録（wordObjが存在する場合のみ）
    if (wordObj && wordObj.Word) {
        currentTest.answers[currentTest.currentQuestionIndex] = {
            word: wordObj.Word,
            correct: isCorrect,
            time: validAnswerTime // 正規化された回答時間を記録
        };
    } else {
        console.error('テストエラー: 単語オブジェクトが存在しません');
        return;
    }
    
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
    
    // フォルダから単語を選択
    const flashcardFolderSelect = document.getElementById('flashcard-folder');
    const flashcardFolder = flashcardFolderSelect ? flashcardFolderSelect.value : 'all';
    let availableWords = [];
    
    if (flashcardFolder === 'all') {
        // すべての単語から選択（苦手を優先）
        flashcardData.words = getRandomWords(flashcardData.count, 'all', []);
    } else if (progressData.folders[flashcardFolder]) {
        // 選択されたフォルダの単語からシャッフル
        availableWords = [...progressData.folders[flashcardFolder].words];
        const shuffled = availableWords.sort(() => Math.random() - 0.5);
        flashcardData.words = shuffled.slice(0, Math.min(flashcardData.count, availableWords.length));
    } else {
        // デフォルト
        flashcardData.words = getRandomWords(flashcardData.count, 'all', []);
    }
    
    if (flashcardData.words.length === 0) {
        alert('選択されたフォルダに単語がありません。');
        return;
    }
    
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
    
    // コントロール要素を表示（存在チェック付き）
    const counterElement = document.getElementById('flashcard-counter');
    const controlsElement = document.getElementById('flashcard-controls');
    const finishElement = document.getElementById('flashcard-finish');
    
    if (counterElement) counterElement.style.display = 'block';
    if (controlsElement) controlsElement.style.display = 'flex';
    if (finishElement) finishElement.style.display = 'block';
    
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
    const currentCard = document.getElementById('current-flashcard');
    const counterElement = document.getElementById('flashcard-counter');
    const finishElement = document.getElementById('flashcard-finish');
    const controlsElement = document.getElementById('flashcard-controls');
    
    if (currentCard) currentCard.style.display = 'none';
    if (counterElement) counterElement.style.display = 'none';
    if (finishElement) finishElement.style.display = 'none';
    if (controlsElement) controlsElement.style.display = 'none';
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

// グローバル関数として登録（HTMLから呼び出せるように）
window.performSearch = performSearch;