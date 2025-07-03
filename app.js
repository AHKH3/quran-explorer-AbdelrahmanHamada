document.addEventListener('DOMContentLoaded', () => {
    // --- State and Cache ---
    let surahDataCache = {};
    let activeSurahId = 1;

    // --- DOM Element Selection ---
    const surahSelect = document.getElementById('surah-select');
    const verseStartInput = document.getElementById('verse-start');
    const verseEndInput = document.getElementById('verse-end');
    const themeDropdowns = document.querySelectorAll('#theme-dropdown, #theme-dropdown-mobile');
    const contentNavButtons = document.querySelectorAll('#content-nav .nav-btn');
    const contentSections = document.querySelectorAll('.content-section');
    const loadingIndicator = document.getElementById('loading-indicator');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    // Check for element existence before adding listeners
    function safeAddEventListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    // --- Core Functions ---
    async function initializeApp() {
        showLoading(true);
        try {
            if (typeof surahIndex === 'undefined') {
                throw new Error("ملف فهرس السور (surah_index.js) غير موجود.");
            }
            populateSurahSelect();
            setupEventListeners();
            applySavedSettings();
            await loadAndDisplaySurah(surahSelect.value || 1);
        } catch(e) {
            console.error("Initialization Failed:", e);
            document.getElementById('content-area').innerHTML = `<p style='color:red; text-align:center;'>فشل تشغيل التطبيق. تأكد من وجود جميع الملفات المطلوبة.</p>`;
        } finally {
            showLoading(false);
        }
    }

    async function getSurahData(surahId) {
        if (surahDataCache[surahId]) return surahDataCache[surahId];
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `./quran_data/${surahId}.js`;
            script.onload = () => {
                const surahVarName = `surah_${surahId}`;
                if (window[surahVarName]) {
                    surahDataCache[surahId] = window[surahVarName];
                    resolve(window[surahVarName]);
                } else {
                    reject(new Error(`لم يتم العثور على بيانات للسورة ${surahId}`));
                }
                document.head.removeChild(script);
            };
            script.onerror = () => reject(new Error(`فشل تحميل ملف بيانات السورة ${surahId}`));
            document.head.appendChild(script);
        });
    }

    async function loadAndDisplaySurah(surahId) {
        showLoading(true);
        try {
            const surahData = await getSurahData(surahId);
            activeSurahId = surahId;
            displayFullSurah(surahData);
            // Activate the first tab by default
            switchTab('read'); 
        } catch (error) {
            console.error('Error loading surah data:', error);
        } finally {
            showLoading(false);
        }
    }

    // --- UI and Display Functions ---
    function showLoading(show) {
        if(loadingIndicator) loadingIndicator.style.display = show ? 'block' : 'none';
    }
    
    function populateSurahSelect() {
        if (!surahSelect) return;
        surahIndex.forEach(surah => {
            const option = document.createElement('option');
            option.value = surah.id;
            option.textContent = `${surah.id}. ${surah.name}`;
            surahSelect.appendChild(option);
        });
    }
    
    function displayFullSurah(surah) {
        if (!surah) return;
        const startVerse = 1;
        const endVerse = surah.verses.length;

        if(verseStartInput) {
            verseStartInput.value = startVerse;
            verseStartInput.max = endVerse;
        }
        if(verseEndInput) {
            verseEndInput.value = endVerse;
            verseEndInput.max = endVerse;
        }
        displaySurah(surah, startVerse, endVerse);
        displayTafsir(surah, startVerse, endVerse);
        displayGames(surah, startVerse, endVerse);
    }
    
    function displaySurah(surah, start, end) {
        const container = document.getElementById('surah-container');
        const title = document.getElementById('read-title');
        if(!container || !title) return;
        
        title.textContent = `سورة ${surah.name} (الآيات ${start}-${end})`;
        container.innerHTML = '';
        const versesToShow = surah.verses.filter(v => v.id >= start && v.id <= end);
        versesToShow.forEach(verse => {
            container.innerHTML += `<span class="verse-block">${verse.text} <span class="verse-number">﴿${verse.id}﴾</span></span>`;
        });
    }

    function displayTafsir(surah, start, end) {
        const container = document.getElementById('tafsir-container');
        const title = document.getElementById('tafsir-title');
        if(!container || !title) return;
        
        title.textContent = `تفسير سورة ${surah.name} (الآيات ${start}-${end})`;
        container.innerHTML = '';
        if (!surah.tafsir || surah.tafsir.length === 0) {
            container.innerHTML = '<p>لا يتوفر تفسير لهذه السورة حاليًا.</p>';
            return;
        }
        surah.tafsir.forEach(item => {
            container.innerHTML += `<div class="tafsir-item"><h4>الآيات (${item.verses})</h4><p>${item.explanation}</p></div>`;
        });
    }

    function switchTab(sectionId) {
        contentNavButtons.forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
        if(activeBtn) activeBtn.classList.add('active');

        contentSections.forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(`${sectionId}-section`);
        if(targetSection) targetSection.classList.add('active');
    }

    function setTheme(theme) {
        document.body.className = '';
        document.body.classList.add(theme);
        localStorage.setItem('selectedTheme', theme);
        themeDropdowns.forEach(dd => dd.value = theme);
    }

    function applySavedSettings() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'theme-classic';
        setTheme(savedTheme);
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        safeAddEventListener(surahSelect, 'change', () => loadAndDisplaySurah(surahSelect.value));
        safeAddEventListener(verseStartInput, 'change', loadSurahRange);
        safeAddEventListener(verseEndInput, 'change', loadSurahRange);
        
        themeDropdowns.forEach(dd => safeAddEventListener(dd, 'change', (e) => setTheme(e.target.value)));

        contentNavButtons.forEach(btn => {
            safeAddEventListener(btn, 'click', () => switchTab(btn.dataset.section));
        });

        safeAddEventListener(sidebarToggleBtn, 'click', () => {
            sidebar.classList.toggle('sidebar-open');
            sidebarOverlay.classList.toggle('active');
        });
        safeAddEventListener(sidebarOverlay, 'click', () => {
            sidebar.classList.remove('sidebar-open');
            sidebarOverlay.classList.remove('active');
        });
    }
    
    async function loadSurahRange() {
        const surahData = await getSurahData(activeSurahId);
        if (!surahData) return;
        const startVerse = parseInt(verseStartInput.value) || 1;
        const endVerse = parseInt(verseEndInput.value) || surahData.verses.length;
        displaySurah(surahData, startVerse, endVerse);
        displayTafsir(surahData, startVerse, endVerse);
        displayGames(surahData, startVerse, endVerse);
    }
    
    // --- Games Logic ---
    function displayGames(surah, start, end) {
        const gameSelector = document.getElementById('game-selector');
        const gameContentArea = document.getElementById('game-content-area');
        if (!gameSelector || !gameContentArea) return;
        
        gameSelector.innerHTML = `
            <button class="game-select-btn" data-game="meaning-match">توصيل المعاني</button>
            <button class="game-select-btn" data-game="verse-order">ترتيب الآيات</button>
        `;
        
        gameContentArea.innerHTML = '<p>اختر لعبة لتناسب الآيات المحددة.</p>';
        
        document.querySelectorAll('.game-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                 document.querySelectorAll('.game-select-btn').forEach(b => b.classList.remove('active'));
                 e.currentTarget.classList.add('active');
                 launchGame(e.currentTarget.dataset.game, surah, start, end);
            });
        });
    }

    function launchGame(gameType, surah, start, end) {
        if(gameType === 'meaning-match') setupMeaningMatchGame(surah);
        if(gameType === 'verse-order') setupVerseOrderGame(surah, start, end);
    }

    function setupMeaningMatchGame(surah) {
        const container = document.getElementById('game-content-area');
        if (!container) return;
        container.innerHTML = `
            <h3>لعبة توصيل المعاني</h3>
            <p>اسحب الكلمة من اليمين وضعها على معناها الصحيح في اليسار.</p>
            <div id="meaning-game-area">
                <div id="words-container"></div><div id="meanings-container"></div>
            </div>
            <div id="meaning-game-feedback"></div>`;

        const wordsContainer = document.getElementById('words-container');
        const meaningsContainer = document.getElementById('meanings-container');
        
        if (!surah.vocabulary || surah.vocabulary.length < 2) {
            wordsContainer.innerHTML = '<p>لا توجد مفردات كافية لهذه اللعبة في السورة المختارة.</p>';
            return;
        }

        // ... (Game logic for meaning-match can be added here)
    }

    function setupVerseOrderGame(surah, start, end) {
        const container = document.getElementById('game-content-area');
        if (!container) return;
        container.innerHTML = `
            <h3>لعبة ترتيب الآيات</h3>
            <p>قم بسحب وإفلات الآيات لترتيبها بالترتيب الصحيح.</p>
            <div id="verse-order-area"></div>
            <button id="check-order-btn" class="action-btn">تحقق من الترتيب</button>
            <div id="verse-order-feedback"></div>`;
        
        const verseArea = document.getElementById('verse-order-area');
        const versesToShow = surah.verses.filter(v => v.id >= start && v.id <= end).slice(0, 5); // Limit to 5 verses
        const correctOrder = versesToShow.map(v => v.text);
        const shuffledOrder = [...correctOrder].sort(() => Math.random() - 0.5);

        shuffledOrder.forEach(verseText => {
            const verseDiv = document.createElement('div');
            verseDiv.className = 'verse-order-item';
            verseDiv.textContent = verseText;
            verseDiv.draggable = true;
            verseArea.appendChild(verseDiv);
            
            verseDiv.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', verseText));
        });
        
        verseArea.addEventListener('dragover', (e) => e.preventDefault());
        
        verseArea.addEventListener('drop', (e) => {
            e.preventDefault();
            // Drop logic can be complex, this is a placeholder
        });

         document.getElementById('check-order-btn').addEventListener('click', () => {
             const userOrder = Array.from(verseArea.children).map(child => child.textContent);
             const feedback = document.getElementById('verse-order-feedback');
             if(JSON.stringify(userOrder) === JSON.stringify(correctOrder)){
                 feedback.textContent = 'أحسنت! ترتيب صحيح.';
                 feedback.style.color = 'green';
             } else {
                 feedback.textContent = 'حاول مرة أخرى.';
                 feedback.style.color = 'red';
             }
         });
    }


    // --- Start Application ---
    initializeApp();
});