document.addEventListener('DOMContentLoaded', () => {
    // --- Global State & DOM Elements ---
    let surahDataCache = {};
    let allVerses = [];
    let currentPage = 1;
    
    // DOM Elements
    const loadingOverlay = document.getElementById('loading-overlay');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    // View Switcher
    const mushafViewBtn = document.getElementById('mushaf-view-btn');
    const surahViewBtn = document.getElementById('surah-view-btn');
    const mushafView = document.getElementById('mushaf-view');
    const surahView = document.getElementById('surah-view');
    const mushafControls = document.getElementById('mushaf-controls-sidebar');
    const surahControls = document.getElementById('surah-controls-sidebar');

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

    // --- Core Functions ---
    async function initializeApp() {
        showLoading(true);
        try {
            await loadAllSurahData();
            setupEventListeners();
            populateSurahIndex();
            populateSurahSelect();
            
            const savedPage = parseInt(localStorage.getItem('currentPage')) || 1;
            navigateToPage(savedPage);
        } catch (error) {
            console.error("Initialization failed:", error);
            loadingOverlay.innerHTML = "<p>فشل تحميل البيانات. يرجى تحديث الصفحة.</p>";
        } finally {
            showLoading(false);
        }
    }

    async function loadAllSurahData() {
        const promises = [];
        for (let i = 1; i <= 114; i++) {
            promises.push(getSurahData(i));
        }
        await Promise.all(promises);
        
        // Build the `allVerses` array for pagination and search
        let verseCounter = 1;
        for (let i = 1; i <= 114; i++) {
            const surah = surahDataCache[i];
            if (surah && surah.verses) {
                 surah.verses.forEach(v => {
                    allVerses.push({ 
                        id: verseCounter++,
                        surahId: i, 
                        ayahId: v.id, 
                        text: v.text 
                    });
                 });
            }
        }
    }

    function getSurahData(surahId) {
        if (surahDataCache[surahId]) return Promise.resolve(surahDataCache[surahId]);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `./quran_data/${surahId}.js`;
            script.onload = () => {
                const surahVarName = `surah_${surahId}`;
                if (window[surahVarName]) {
                    surahDataCache[surahId] = window[surahVarName];
                    resolve(window[surahVarName]);
                } else {
                    reject(new Error(`Data not found for surah ${surahId}`));
                }
                document.head.removeChild(script);
            };
            script.onerror = () => reject(new Error(`Failed to load script for surah ${surahId}`));
            document.head.appendChild(script);
        });
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        mushafViewBtn.addEventListener('click', () => switchView('mushaf'));
        surahViewBtn.addEventListener('click', () => switchView('surah'));

        pageInput.addEventListener('change', () => navigateToPage(parseInt(pageInput.value)));
        nextPageBtn.addEventListener('click', () => navigateToPage(currentPage + (isSinglePageMode() ? 1 : 2)));
        prevPageBtn.addEventListener('click', () => navigateToPage(currentPage - (isSinglePageMode() ? 1 : 2)));

        viewSurahBtn.addEventListener('click', displaySelectedSurah);

        sidebarToggleBtn.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', toggleSidebar);
        
        window.addEventListener('resize', handleResize);
    }
    
    // --- View Management ---
    function switchView(viewName) {
        mushafView.classList.toggle('active', viewName === 'mushaf');
        mushafControls.classList.toggle('active', viewName === 'mushaf');
        mushafViewBtn.classList.toggle('active', viewName === 'mushaf');

        surahView.classList.toggle('active', viewName === 'surah');
        surahControls.classList.toggle('active', viewName === 'surah');
        surahViewBtn.classList.toggle('active', viewName === 'surah');
        
        if (window.innerWidth <= 1024) toggleSidebar();
    }
    
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('open');
    }

    function handleResize() {
        navigateToPage(currentPage); // Re-render to adjust for single/double page view
    }
    
    function isSinglePageMode() {
        return window.innerWidth <= 1024;
    }

    // --- Mushaf View Logic ---
    function navigateToPage(page) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) return;
        
        currentPage = pageNum;
        pageInput.value = currentPage;

        if (isSinglePageMode()) {
            mushafRightPage.classList.add('single-page-mode');
            mushafLeftPage.style.display = 'none';
            renderMushafPage(mushafRightPage, currentPage);
        } else {
            mushafRightPage.classList.remove('single-page-mode');
            mushafLeftPage.style.display = 'block';
            let startPage = (currentPage % 2 === 0) ? currentPage - 1 : currentPage;
            renderMushafPage(mushafRightPage, startPage);
            renderMushafPage(mushafLeftPage, startPage + 1);
            currentPage = startPage; // Standardize to the right page
        }
        
        updatePageInfoDisplay();
        localStorage.setItem('currentPage', currentPage);
    }

    function renderMushafPage(pageElement, pageNumber) {
        pageElement.innerHTML = '';
        if (pageNumber > 604) return;

        const pageData = pageMap.find(p => p.page === pageNumber);
        if (!pageData) return;

        const startVerseInfo = pageData.start;
        const endVerseInfo = pageData.end;

        // Find global start and end indices in allVerses
        const startIndex = allVerses.findIndex(v => v.surahId === startVerseInfo.surah && v.ayahId === startVerseInfo.ayah);
        const endIndex = allVerses.findIndex(v => v.surahId === endVerseInfo.surah && v.ayahId === endVerseInfo.ayah);

        if (startIndex === -1 || endIndex === -1) return;
        
        const versesToDisplay = allVerses.slice(startIndex, endIndex + 1);

        let currentSurahId = -1;
        versesToDisplay.forEach(verse => {
            if (verse.surahId !== currentSurahId) {
                currentSurahId = verse.surahId;
                const surahInfo = surahIndex.find(s => s.id === currentSurahId);
                
                const surahHeader = document.createElement('div');
                surahHeader.className = 'surah-header-page';
                surahHeader.textContent = `سورة ${surahInfo.name}`;
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
            ayahNumberSpan.textContent = ` ﴿${verse.ayahId}﴾ `;

            pageElement.appendChild(ayahSpan);
            pageElement.appendChild(ayahNumberSpan);
        });
    }
    
    function updatePageInfoDisplay() {
        const surahOnRight = getSurahNameFromPage(currentPage);
        let infoText = `صفحة ${currentPage} - ${surahOnRight}`;
        
        if (!isSinglePageMode() && currentPage < 604) {
             const surahOnLeft = getSurahNameFromPage(currentPage + 1);
             infoText = `صفحة ${currentPage} - ${surahOnRight} | صفحة ${currentPage + 1} - ${surahOnLeft}`;
        }
        pageInfoDisplay.textContent = infoText;
    }

    function getSurahNameFromPage(pageNumber) {
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
            link.textContent = `${surah.id}. ${surah.name}`;
            link.onclick = (e) => {
                e.preventDefault();
                const pageInfo = pageMap.find(p => p.start.surah === surah.id);
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
        surahSelect.addEventListener('change', updateVerseRangeInputs);
        updateVerseRangeInputs(); // Initial population
    }
    
    function updateVerseRangeInputs() {
        const surahId = parseInt(surahSelect.value);
        const surah = surahDataCache[surahId];
        if (surah) {
            verseStartInput.value = 1;
            verseStartInput.max = surah.verses.length;
            verseEndInput.value = surah.verses.length;
            verseEndInput.max = surah.verses.length;
        }
    }

    function displaySelectedSurah() {
        const surahId = parseInt(surahSelect.value);
        const startVerse = parseInt(verseStartInput.value);
        const endVerse = parseInt(verseEndInput.value);
        const surah = surahDataCache[surahId];
        
        if (!surah) return;

        surahViewTitle.textContent = `سورة ${surah.name} (الآيات ${startVerse}-${endVerse})`;
        surahViewContainer.innerHTML = '';
        
        const versesToDisplay = surah.verses.filter(v => v.id >= startVerse && v.id <= endVerse);
        versesToDisplay.forEach(verse => {
            surahViewContainer.innerHTML += `<span class="verse-block">${verse.text} <span class="verse-number">﴿${verse.id}﴾</span></span>`;
        });
    }

    // --- Helper Functions ---
    function showLoading(isLoading) {
        loadingOverlay.style.display = isLoading ? 'flex' : 'none';
    }

    // Initial call
    initializeApp();
});