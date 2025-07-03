document.addEventListener('DOMContentLoaded', () => {
    // --- Global State & DOM Elements ---
    const surahDataCache = {};
    let currentPage = 1;
    let isMuted = localStorage.getItem('isMuted') === 'true';
    let audioCtx = null;
    let currentReciter = 'ar.alafasy';
    let audioQueue = [];
    let isPlaying = false;
    let currentActiveSurah = 1;
    let allVerses = []; // To store verses from all surahs for search

    const surahIndexContainer = document.getElementById('quran-index');
    const mushafRightPage = document.getElementById('mushaf-page-right');
    const mushafLeftPage = document.getElementById('mushaf-page-left');
    const pageDisplay = document.getElementById('page-number-display');
    const surahNameDisplay = document.getElementById('surah-name-display');
    const audioPlayer = document.getElementById('audio-player');
    const currentVerseDisplay = document.getElementById('current-verse-display');
    const reciterSelect = document.getElementById('reciter-select');
    const loadingIndicator = document.getElementById('loading-indicator');
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    const contentArea = document.getElementById('content-area');
    const themeDropdown = document.getElementById('theme-dropdown');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');

    // --- Data Loading & Initialization ---
    
    // Asynchronous function to load a script
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });
    }

    async function initializeApp() {
        showLoading(true);
        try {
            // Load necessary data sequentially
            await loadAllSurahData();
            
            populateSurahIndex();
            setupEventListeners();
            applySavedSettings();
            const savedPage = parseInt(localStorage.getItem('currentPage')) || 1;
            navigateToPage(savedPage, true);

        } catch (error) {
            console.error("Initialization failed:", error);
            contentArea.innerHTML = `<p style="padding: 2rem; text-align: center;">عذراً، حدث خطأ أثناء تحميل البيانات. يرجى التأكد من اتصالك بالإنترنت وتحديث الصفحة.</p>`;
        } finally {
            showLoading(false);
        }
    }
    
    // New function to load all surah data and build the verses array
    async function loadAllSurahData() {
        const promises = [];
        for (let i = 1; i <= 114; i++) {
            promises.push(getSurahData(i));
        }
        await Promise.all(promises);
        
        // Build the `allVerses` array for pagination and search
        for (let i = 1; i <= 114; i++) {
            const surah = surahDataCache[i];
            if (surah && surah.verses) {
                 surah.verses.forEach(v => {
                    allVerses.push({ surah: i, ayah: v.id, text: v.text });
                 });
            }
        }
    }
    
    function populateSurahIndex() {
        if (!surahIndexContainer || typeof surahIndex === 'undefined') return;
        surahIndexContainer.innerHTML = ''; // Clear existing
        surahIndex.forEach(surah => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'surah-link';
            link.textContent = `${surah.id}. ${surah.name}`;
            link.dataset.surahId = surah.id;
            link.onclick = (e) => {
                e.preventDefault();
                currentActiveSurah = surah.id;
                setActiveSection('surah-list');
                if (window.innerWidth <= 768) hideSidebar();
            };
            surahIndexContainer.appendChild(link);
        });
    }

    function setupEventListeners() {
        document.body.addEventListener('click', initAudio, { once: true });
        document.getElementById('next-page-btn').addEventListener('click', () => navigateToPage(currentPage + 2));
        document.getElementById('prev-page-btn').addEventListener('click', () => navigateToPage(currentPage - 1)); // Corrected to move one page back
        reciterSelect.addEventListener('change', (e) => {
            currentReciter = e.target.value;
            localStorage.setItem('currentReciter', currentReciter);
        });
        document.querySelectorAll('#content-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                setActiveSection(e.currentTarget.dataset.section);
            });
        });
        document.getElementById('search-btn').addEventListener('click', handleSearch);
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        sidebarToggleBtn.addEventListener('click', showSidebar);
        sidebarOverlay.addEventListener('click', hideSidebar);
        if (scrollTopBtn && contentArea) {
            contentArea.addEventListener('scroll', () => {
                scrollTopBtn.style.display = (contentArea.scrollTop > 300) ? 'flex' : 'none';
            });
            scrollTopBtn.addEventListener('click', () => contentArea.scrollTo({ top: 0, behavior: 'smooth' }));
        }
        themeDropdown.addEventListener('change', (e) => setTheme(e.target.value));
    }
    
    // --- Section & Page Management ---
    async function setActiveSection(section) {
        playSound('navigate');
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
        document.querySelectorAll('#content-nav .nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.section === section);
        });
        
        if (section === 'surah-list' || section === 'tafsir') {
            await loadAndDisplaySelectedSurah();
        }
    }
    
    // This is a simplified pagination logic since we don't have the page data.
    // We'll paginate based on a fixed number of verses per page.
    const VERSES_PER_PAGE = 15;
    let totalPages = Math.ceil(6236 / VERSES_PER_PAGE);

    function navigateToPage(page, initialLoad = false) {
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        
        currentPage = page;

        renderPage(mushafRightPage, getVersesForPage(page));
        // For simplicity, we'll show one page at a time.
        mushafLeftPage.innerHTML = '';
        
        updatePageInfo();
        if (!initialLoad) playSound('swoosh');
        
        localStorage.setItem('currentPage', currentPage);
        updateActiveSurahLink();
    }
    
    function getVersesForPage(pageNumber) {
        const start = (pageNumber - 1) * VERSES_PER_PAGE;
        const end = start + VERSES_PER_PAGE;
        return allVerses.slice(start, end);
    }
    
    function renderPage(pageElement, versesData) {
        pageElement.innerHTML = '';
        if (!versesData || versesData.length === 0) {
             pageElement.innerHTML = '<div class="mushaf-end"><p>صدق الله العظيم</p></div>';
            return;
        }

        let currentSurahId = -1;
        versesData.forEach(verse => {
            if (verse.surah !== currentSurahId) {
                currentSurahId = verse.surah;
                const surahInfo = surahIndex.find(s => s.id === currentSurahId);
                const surahHeader = document.createElement('div');
                surahHeader.className = 'surah-header';
                surahHeader.textContent = `سورة ${surahInfo.name}`;
                pageElement.appendChild(surahHeader);
                if (currentSurahId !== 1 && currentSurahId !== 9 && verse.ayah === 1) {
                     const bismillah = document.createElement('div');
                     bismillah.className = 'bismillah';
                     bismillah.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
                     pageElement.appendChild(bismillah);
                }
            }
            const verseKey = `${verse.surah}:${verse.ayah}`;
            const ayahSpan = document.createElement('span');
            ayahSpan.className = 'ayah';
            ayahSpan.textContent = verse.text;
            ayahSpan.dataset.verseKey = verseKey;
            
            const ayahNumberSpan = document.createElement('span');
            ayahNumberSpan.className = 'ayah-number';
            ayahNumberSpan.textContent = `﴿${verse.ayah}﴾`;
            pageElement.appendChild(ayahSpan);
            pageElement.appendChild(ayahNumberSpan);
        });
    }

    function updatePageInfo() {
        pageDisplay.textContent = `صفحة ${currentPage}`;
        const firstVerseOnPage = getVersesForPage(currentPage)[0];
        if (firstVerseOnPage) {
            const surahInfo = surahIndex.find(s => s.id === firstVerseOnPage.surah);
            surahNameDisplay.textContent = surahInfo ? `سورة ${surahInfo.name}` : '';
        }
    }
    
    function updateActiveSurahLink() {
        const firstVerseOnPage = getVersesForPage(currentPage)[0];
        if (!firstVerseOnPage) return;
        currentActiveSurah = firstVerseOnPage.surah;
        document.querySelectorAll('.surah-link').forEach(link => {
            link.classList.toggle('active', parseInt(link.dataset.surahId) === currentActiveSurah);
        });
    }
    
    async function loadAndDisplaySelectedSurah() {
        showLoading(true);
        try {
            const surahData = await getSurahData(currentActiveSurah);
            document.getElementById('surah-list-title').textContent = `سورة ${surahData.name}`;
            document.getElementById('surah-list-container').innerHTML = surahData.verses.map(v => 
                `<span class="verse-block">${v.text} <span class="verse-number">﴿${v.id}﴾</span></span>`
            ).join('');
        } catch(e) { console.error("Error loading surah for list view", e); }
        finally { showLoading(false); }
    }
    
     async function handleSearch() {
        const query = document.getElementById('search-input').value;
        if (query.trim().length < 2) return;
        showLoading(true);
        const resultsContainer = document.getElementById('search-results-container');
        resultsContainer.innerHTML = '<p>جاري البحث...</p>';
        try {
            const results = allVerses.filter(v => v.text.includes(query)).slice(0, 50);
            
            if (results.length === 0) {
                resultsContainer.innerHTML = '<p>لا توجد نتائج.</p>';
            } else {
                 resultsContainer.innerHTML = results.map(result => {
                    const surahName = surahIndex.find(s => s.id == result.surah).name;
                    const highlightedText = result.text.replace(new RegExp(query, 'g'), `<mark>${query}</mark>`);
                    return `<div class="result-item"><p>${highlightedText}</p><strong>(سورة ${surahName} - آية ${result.ayah})</strong></div>`;
                }).join('');
            }
        } catch (error) {
            resultsContainer.innerHTML = '<p>حدث خطأ أثناء البحث.</p>';
        } finally {
            showLoading(false);
        }
    }
    
    function initAudio() {
        // Dummy function, no audio context needed for this approach.
    }
    function playSound() {
        // Dummy function
    }
    
    function showLoading(isLoading) {
        if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    function applySavedSettings() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'theme-classic';
        setTheme(savedTheme);
    }

    function setTheme(theme) {
        document.body.className = '';
        document.body.classList.add(theme);
        themeDropdown.value = theme;
        localStorage.setItem('selectedTheme', theme);
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
                    reject(new Error(`Data not found for surah ${surahId}`));
                }
            };
            script.onerror = () => reject(new Error(`Failed to load script for surah ${surahId}`));
            document.head.appendChild(script);
        });
    }

    function showSidebar() {
        if(sidebar) sidebar.classList.add('sidebar-open');
        if(sidebarOverlay) sidebarOverlay.classList.add('active');
    }
    function hideSidebar() {
        if(sidebar) sidebar.classList.remove('sidebar-open');
        if(sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
    
    // Initial call
    initializeApp();
});