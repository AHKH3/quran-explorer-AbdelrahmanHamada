document.addEventListener('DOMContentLoaded', () => {
    // --- Global State & DOM Elements ---
    const surahDataCache = {};
    let allVerses = [];
    let currentPage = 1;
    
    const loadingOverlay = document.getElementById('loading-overlay');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    // View Switcher Elements
    const viewSwitcherBtns = document.querySelectorAll('.view-btn');
    const mainViews = document.querySelectorAll('.main-view');
    const sidebarViews = document.querySelectorAll('.sidebar-view');

    // Mushaf Elements
    const mushafRightPage = document.getElementById('mushaf-page-right');
    const mushafLeftPage = document.getElementById('mushaf-page-left');
    const pageInput = document.getElementById('page-input');
    const surahIndexMushaf = document.getElementById('surah-index-mushaf');
    const pageInfoDisplay = document.getElementById('page-info-display');
    const nextPageBtn = document.getElementById('next-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    
    // Surah View Elements
    const surahSelect = document.getElementById('surah-select');
    const verseStartInput = document.getElementById('verse-start');
    const verseEndInput = document.getElementById('verse-end');
    const viewSurahBtn = document.getElementById('view-surah-btn');
    const surahViewTitle = document.getElementById('surah-view-title');
    const surahViewContainer = document.getElementById('surah-view-container');
    
    // Games View Elements
    const gamesView = document.getElementById('games-view');
    const gameSelectorContainer = document.getElementById('game-selector');
    const gameContentArea = document.getElementById('game-content-area');


    // --- Core Functions ---
    async function initializeApp() {
        showLoading(true, 'جاري تحميل بيانات السور...');
        try {
            if (typeof surahIndex === 'undefined' || typeof pageMap === 'undefined') {
                throw new Error("ملفات الفهرس أو الصفحات الأساسية غير موجودة.");
            }
            await loadAllSurahData();
            setupEventListeners();
            populateSurahIndex();
            populateSurahSelect();
            
            const savedPage = parseInt(localStorage.getItem('currentPage')) || 1;
            navigateToPage(savedPage);
            
            document.getElementById('theme-dropdown').value = localStorage.getItem('selectedTheme') || 'theme-classic';

        } catch (error) {
            console.error("فشل التهيئة:", error);
            showLoading(true, `فشل تحميل البيانات: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    async function getSurahData(surahId) {
        if (surahDataCache[surahId]) return Promise.resolve(surahDataCache[surahId]);
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `./quran_data/${surahId}.js`;
            script.onload = () => {
                const surahVarName = `surah_${surahId}`;
                if (window[surahVarName]) {
                    // Add surah info to the data object
                    const info = surahIndex.find(s => s.id === surahId) || {};
                    window[surahVarName].revelation_place = info.revelation_place;
                    window[surahVarName].revelation_order = info.revelation_order;
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

    async function loadAllSurahData() {
        const promises = [];
        for (let i = 1; i <= 114; i++) {
            promises.push(getSurahData(i));
        }
        await Promise.all(promises);
        
        // Build the `allVerses` array from the cached data
        for (let i = 1; i <= 114; i++) {
            const surah = surahDataCache[i];
            if (surah && surah.verses) {
                 surah.verses.forEach(v => {
                    allVerses.push({ surah: i, ayah: v.id, text: v.text });
                 });
            }
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        viewSwitcherBtns.forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.id.replace('-view-btn', '')));
        });

        pageInput.addEventListener('change', () => navigateToPage(parseInt(pageInput.value)));
        nextPageBtn.addEventListener('click', () => navigateToPage(currentPage - (isSinglePageMode() ? 1 : 2)));
        prevPageBtn.addEventListener('click', () => navigateToPage(currentPage + (isSinglePageMode() ? 1 : 2)));

        viewSurahBtn.addEventListener('click', displaySelectedSurah);
        surahSelect.addEventListener('change', updateVerseRangeInputs);

        sidebarToggleBtn.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', toggleSidebar);
        
        document.getElementById('theme-dropdown').addEventListener('change', (e) => setTheme(e.target.value));

        window.addEventListener('resize', handleResize);
    }
    
    // --- UI & View Management ---
    function switchView(viewName) {
        mainViews.forEach(v => v.classList.toggle('active', v.id === `${viewName}-view`));
        sidebarViews.forEach(v => v.classList.toggle('active', v.id === `${viewName}-controls-sidebar`));
        viewSwitcherBtns.forEach(b => b.classList.toggle('active', b.id === `${viewName}-view-btn`));
        
        if (viewName === 'games') {
            setupGamesView();
        }

        if (isSinglePageMode()) toggleSidebar();
    }
    
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('open');
    }

    function handleResize() {
        navigateToPage(currentPage);
    }
    
    function isSinglePageMode() {
        return window.innerWidth <= 1024;
    }

    // --- Mushaf View Logic ---
    function navigateToPage(page) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) return;
        
        let targetPage = pageNum;
        if (!isSinglePageMode() && targetPage % 2 === 0) {
            targetPage = pageNum - 1; // Always start with the right-hand page
        }
        currentPage = targetPage;
        pageInput.value = currentPage;

        if (isSinglePageMode()) {
            mushafLeftPage.style.display = 'none';
            renderMushafPage(mushafRightPage, currentPage);
        } else {
            mushafLeftPage.style.display = 'block';
            renderMushafPage(mushafRightPage, currentPage);
            renderMushafPage(mushafLeftPage, currentPage + 1);
        }
        
        localStorage.setItem('currentPage', currentPage);
        updatePageInfoDisplay();
    }

    function renderMushafPage(pageElement, pageNumber) {
        pageElement.innerHTML = '';
        if (pageNumber < 1 || pageNumber > 604) return;

        const pageData = pageMap.find(p => p.page === pageNumber);
        if (!pageData) return;

        const startIndex = allVerses.findIndex(v => v.surah === pageData.start.surah && v.ayah === pageData.start.ayah);
        const endIndex = allVerses.findIndex(v => v.surah === pageData.end.surah && v.ayah === pageData.end.ayah);

        if (startIndex === -1 || endIndex === -1) return;
        
        const versesToDisplay = allVerses.slice(startIndex, endIndex + 1);
        let currentSurahId = -1;

        versesToDisplay.forEach(verse => {
            if (verse.surah !== currentSurahId) {
                currentSurahId = verse.surah;
                const surahInfo = surahIndex.find(s => s.id === currentSurahId);
                
                const surahHeader = document.createElement('div');
                surahHeader.className = 'surah-header-page';
                surahHeader.innerHTML = `
                    <div>${surahInfo.revelation_place === 'Meccan' ? 'مكية' : 'مدنية'}</div>
                    <div>${surahInfo.name}</div>
                    <div>آياتها ${surahInfo.ayahs}</div>
                `;
                pageElement.appendChild(surahHeader);

                if (currentSurahId !== 1 && currentSurahId !== 9) {
                     const bismillah = document.createElement('div');
                     bismillah.className = 'bismillah-page';
                     bismillah.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
                     pageElement.appendChild(bismillah);
                }
            }
            const ayahSpan = document.createElement('span');
            ayahSpan.className = 'ayah';
            ayahSpan.textContent = verse.text;
            
            const ayahNumberSpan = document.createElement('span');
            ayahNumberSpan.className = 'ayah-number';
            ayahNumberSpan.textContent = ` ﴿${verse.ayah}﴾ `;

            pageElement.appendChild(ayahSpan);
            pageElement.appendChild(ayahNumberSpan);
        });
    }
    
    function updatePageInfoDisplay() {
        const surahOnRight = getSurahNameFromPage(currentPage);
        let infoText = `صفحة ${currentPage} - ${surahOnRight}`;
        
        if (!isSinglePageMode() && currentPage < 604) {
             const surahOnLeft = getSurahNameFromPage(currentPage + 1);
             infoText = `ص ${currentPage + 1} - ${surahOnLeft} | ${surahOnRight} - ص ${currentPage}`;
        }
        pageInfoDisplay.textContent = infoText;
    }

    function getSurahNameFromPage(pageNumber) {
        if(pageNumber > 604) return '';
        const pageInfo = pageMap.find(p => p.page === pageNumber);
        if (!pageInfo) return '';
        const surahInfo = surahIndex.find(s => s.id === pageInfo.start.surah);
        return surahInfo ? surahInfo.name : '';
    }

    function populateSurahIndex() {
        surahIndexMushaf.innerHTML = '';
        surahIndex.forEach(surah => {
            const link = document.createElement('a');
            link.href = '#';
            const pageInfo = pageMap.find(p => p.start.surah === surah.id);
            const pageNum = pageInfo ? pageInfo.page : 1;
            link.innerHTML = `<span>${surah.id}. ${surah.name}</span> <span>(ص ${pageNum})</span>`;
            link.onclick = (e) => {
                e.preventDefault();
                if(pageInfo) navigateToPage(pageInfo.page);
            };
            surahIndexMushaf.appendChild(link);
        });
    }
    
    // --- Surah View Logic ---
    function populateSurahSelect() {
        if (!surahSelect) return;
        surahSelect.innerHTML = '';
        surahIndex.forEach(surah => {
            const option = document.createElement('option');
            option.value = surah.id;
            option.textContent = `${surah.id}. ${surah.name}`;
            surahSelect.appendChild(option);
        });
        updateVerseRangeInputs();
    }
    
    function updateVerseRangeInputs() {
        const surahId = parseInt(surahSelect.value);
        const surah = surahDataCache[surahId];
        if (surah) {
            verseStartInput.value = 1;
            verseStartInput.max = surah.verses.length;
            verseStartInput.min = 1;
            verseEndInput.value = surah.verses.length;
            verseEndInput.max = surah.verses.length;
            verseEndInput.min = 1;
        }
    }

    function displaySelectedSurah() {
        const surahId = parseInt(surahSelect.value);
        const startVerse = parseInt(verseStartInput.value);
        const endVerse = parseInt(verseEndInput.value);
        const surah = surahDataCache[surahId];
        
        if (!surah || isNaN(startVerse) || isNaN(endVerse) || startVerse > endVerse) {
            surahViewContainer.innerHTML = `<p style="color: red;">الرجاء إدخال نطاق آيات صحيح.</p>`;
            return;
        }
        switchView('surah');
        surahViewTitle.textContent = `سورة ${surah.name} (الآيات ${startVerse}-${endVerse})`;
        surahViewContainer.innerHTML = '';
        
        const versesToDisplay = surah.verses.filter(v => v.id >= startVerse && v.id <= endVerse);
        versesToDisplay.forEach(verse => {
            surahViewContainer.innerHTML += `<span class="verse-block">${verse.text} <span class="verse-number">﴿${verse.id}﴾</span></span>`;
        });
    }

    // --- Games Logic ---
    function setupGamesView() {
        gameSelectorContainer.innerHTML = `
            <button class="game-select-btn" data-game="meaning-match">توصيل المعاني</button>
            <button class="game-select-btn" data-game="verse-order">ترتيب الآيات</button>
        `;
        gameContentArea.innerHTML = '<p>اختر لعبة للبدء.</p>';
        
        document.querySelectorAll('.game-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.game-select-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                launchGame(e.currentTarget.dataset.game);
            });
        });
    }

    function launchGame(gameType) {
        gameContentArea.innerHTML = '';
        const surahId = parseInt(surahSelect.value);
        const surah = surahDataCache[surahId];
        if (!surah) {
            gameContentArea.innerHTML = '<p>الرجاء اختيار سورة أولاً من "العرض المخصص".</p>';
            return;
        }
        
        if (gameType === 'meaning-match') {
            setupMeaningMatchGame(surah);
        } else if (gameType === 'verse-order') {
            setupVerseOrderGame(surah);
        }
    }
    
    function setupMeaningMatchGame(surah) {
        gameContentArea.innerHTML = '<h3>لعبة توصيل المعاني</h3>';
        // ... (Add game logic from your previous 'app.js')
    }
    
    function setupVerseOrderGame(surah) {
        gameContentArea.innerHTML = '<h3>لعبة ترتيب الآيات</h3>';
        // ... (Add game logic from your previous 'app.js')
    }

    // --- Helper Functions ---
    function showLoading(show, message = 'جاري التحميل...') {
        loadingOverlay.classList.toggle('hidden', !show);
        loadingOverlay.querySelector('p').textContent = message;
    }

    // --- Initial call ---
    initializeApp();
});