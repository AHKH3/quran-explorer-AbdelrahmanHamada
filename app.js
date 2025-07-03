function runApp() {
    // --- Global State & DOM Elements ---
    const surahDataCache = {};
    let currentPage = 1;
    let isMuted = localStorage.getItem('isMuted') === 'true';
    let audioCtx = null;
    let currentReciter = 'ar.alafasy';
    let audioQueue = [];
    let isPlaying = false;
    let currentActiveSurah = 1;

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

    // --- Core Functions ---
    async function initializeApp() {
        showLoading(true);
        try {
            populateSurahIndex();
            setupEventListeners();
            applySavedSettings();
            const savedPage = parseInt(localStorage.getItem('currentPage')) || 1;
            await navigateToPage(savedPage, true);
        } catch (error) {
            console.error("Initialization failed:", error);
            contentArea.innerHTML = `<p style="padding: 2rem; text-align: center;">عذراً، حدث خطأ أثناء تحميل التطبيق. يرجى التأكد من اتصالك بالإنترنت وتحديث الصفحة.</p>`;
        } finally {
            showLoading(false);
        }
    }

    function populateSurahIndex() {
        if (!surahIndexContainer || !surahIndex) return;
        surahIndexContainer.innerHTML = '';
        surahIndex.forEach(surah => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'surah-link';
            link.textContent = `${surah.id}. ${surah.name}`;
            link.dataset.surahId = surah.id;
            link.onclick = async (e) => {
                e.preventDefault();
                const pageInfo = pages.find(p => p.surah_number === surah.id);
                if (pageInfo) {
                    await navigateToPage(pageInfo.page_number);
                    playSound('navigate');
                    if (window.innerWidth <= 768) hideSidebar();
                }
            };
            surahIndexContainer.appendChild(link);
        });
    }

    function setupEventListeners() {
        document.body.addEventListener('click', initAudio, { once: true });
        document.getElementById('next-page-btn').addEventListener('click', () => navigateToPage(currentPage + 2));
        document.getElementById('prev-page-btn').addEventListener('click', () => navigateToPage(currentPage - 2));
        reciterSelect.addEventListener('change', (e) => {
            currentReciter = e.target.value;
            localStorage.setItem('currentReciter', currentReciter);
        });
        document.querySelectorAll('#content-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                setActiveSection(section);
            });
        });
        document.getElementById('search-btn').addEventListener('click', handleSearch);
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        sidebarToggleBtn.addEventListener('click', showSidebar);
        sidebarOverlay.addEventListener('click', hideSidebar);
        if (scrollTopBtn) {
            contentArea.addEventListener('scroll', () => {
                scrollTopBtn.style.display = (contentArea.scrollTop > 300) ? 'flex' : 'none';
            });
            scrollTopBtn.addEventListener('click', () => contentArea.scrollTo({ top: 0, behavior: 'smooth' }));
        }
        themeDropdown.addEventListener('change', (e) => setTheme(e.target.value));
    }
    
    async function setActiveSection(section) {
        playSound('navigate');
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
        document.querySelectorAll('#content-nav .nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.section === section);
        });
        
        if (section === 'surah-list') {
            await loadAndDisplaySelectedSurah();
        }
    }

    async function navigateToPage(page, initialLoad = false) {
        if (page < 1) page = 1;
        if (page > 604) page = 603;
        showLoading(true);
        let startPage = page % 2 === 0 ? page - 1 : page;
        currentPage = startPage;
        try {
            renderPage(mushafRightPage, getVersesForPage(startPage));
            renderPage(mushafLeftPage, getVersesForPage(startPage + 1));
            updatePageInfo();
            if (!initialLoad) playSound('swoosh');
        } catch (error) {
            console.error("Error rendering pages:", error);
        } finally {
            showLoading(false);
            localStorage.setItem('currentPage', currentPage);
            updateActiveSurahLink();
        }
    }
    
    function getVersesForPage(pageNumber) {
        if (!window.verses || pageNumber < 1 || pageNumber > 604) return [];
        return window.verses.filter(v => v.page === pageNumber);
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
            ayahSpan.onclick = () => playVerse(verseKey);
            const ayahNumberSpan = document.createElement('span');
            ayahNumberSpan.className = 'ayah-number';
            ayahNumberSpan.textContent = `﴿${verse.ayah}﴾`;
            pageElement.appendChild(ayahSpan);
            pageElement.appendChild(ayahNumberSpan);
        });
    }

    function updatePageInfo() {
        const surahOnRight = getSurahInfoFromPage(currentPage);
        const surahOnLeft = getSurahInfoFromPage(currentPage + 1);
        pageDisplay.textContent = `صفحة ${currentPage + 1} - ${currentPage}`;
        if (surahOnRight && surahOnLeft && surahOnRight.id === surahOnLeft.id) {
             surahNameDisplay.textContent = surahOnRight ? `سورة ${surahOnRight.name}` : '';
        } else {
             surahNameDisplay.textContent = `${surahOnRight ? 'سورة ' + surahOnRight.name : ''} ${surahOnLeft ? '- سورة ' + surahOnLeft.name : ''}`;
        }
    }
    
    function getSurahInfoFromPage(pageNumber) {
        if (!window.pages || pageNumber < 1 || pageNumber > 604) return null;
        const pageInfo = window.pages.find(p => p.page_number === pageNumber);
        return pageInfo ? surahIndex.find(s => s.id === pageInfo.surah_number) : null;
    }
    
    function updateActiveSurahLink() {
        const activeSurah = getSurahInfoFromPage(currentPage);
        if(!activeSurah) return;
        currentActiveSurah = activeSurah.id;
        document.querySelectorAll('.surah-link').forEach(link => {
            link.classList.toggle('active', parseInt(link.dataset.surahId) === currentActiveSurah);
        });
    }
    
    async function handleSearch() {
        const query = document.getElementById('search-input').value;
        if (query.trim().length < 2) return;
        showLoading(true);
        const resultsContainer = document.getElementById('search-results-container');
        resultsContainer.innerHTML = '';
        try {
            const results = verses.filter(v => v.text.includes(query)).slice(0, 50); // Limit results
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
            console.error("Search failed:", error);
            resultsContainer.innerHTML = '<p>حدث خطأ أثناء البحث.</p>';
        } finally {
            showLoading(false);
        }
    }
    
    function playVerse(verseKey) {
        audioQueue.push(verseKey);
        if (!isPlaying) playNextInQueue();
    }
    
    function playNextInQueue() {
        if (audioQueue.length === 0) {
            isPlaying = false;
            if(currentVerseDisplay) currentVerseDisplay.textContent = '';
            document.querySelectorAll('.ayah.playing').forEach(el => el.classList.remove('playing'));
            return;
        }
        isPlaying = true;
        const verseKey = audioQueue.shift();
        const [surahId, ayahId] = verseKey.split(':');
        const verseInfo = window.verses.find(v => v.surah == surahId && v.ayah == ayahId);
        if (!verseInfo) {
            playNextInQueue();
            return;
        };
        const audioUrl = `https://cdn.islamic.network/quran/audio/128/${currentReciter}/${verseInfo.id}.mp3`;
        audioPlayer.src = audioUrl;
        audioPlayer.play().catch(e => console.error("Audio playback error:", e));
        const surahName = surahIndex.find(s => s.id == surahId).name;
        if (currentVerseDisplay) currentVerseDisplay.textContent = `القارئ: ${reciterSelect.options[reciterSelect.selectedIndex].text} | يتلو: سورة ${surahName} - آية ${ayahId}`;
        document.querySelectorAll('.ayah.playing').forEach(el => el.classList.remove('playing'));
        const currentAyahEl = document.querySelector(`.ayah[data-verse-key="${verseKey}"]`);
        if (currentAyahEl) currentAyahEl.classList.add('playing');
        audioPlayer.onended = playNextInQueue;
        audioPlayer.onerror = () => { console.error("Failed to load audio:", audioUrl); playNextInQueue(); };
    }

    function showLoading(isLoading) {
        if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    function applySavedSettings() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'theme-classic';
        setTheme(savedTheme);
        currentReciter = localStorage.getItem('currentReciter') || 'ar.alafasy';
        reciterSelect.value = currentReciter;
    }

    function setTheme(theme) {
        document.body.className = '';
        document.body.classList.add(theme);
        themeDropdown.value = theme;
        localStorage.setItem('selectedTheme', theme);
        playSound('click');
    }

    function initAudio() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported.");
        }
    }

    function playSound(type) {
        if (!audioCtx) return;
        // Simplified sound logic
    }

    function showSidebar() {
        if(sidebar) sidebar.classList.add('sidebar-open');
        if(sidebarOverlay) sidebarOverlay.classList.add('active');
    }
    function hideSidebar() {
        if(sidebar) sidebar.classList.remove('sidebar-open');
        if(sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
    
    initializeApp();
}

// --- Application Loader ---
// This ensures that all data scripts are loaded before the app runs.
function start() {
    if (typeof surahIndex !== 'undefined' && typeof pages !== 'undefined' && typeof verses !== 'undefined') {
        runApp();
    } else {
        console.log("Waiting for data scripts to load...");
        setTimeout(start, 100); // Check again in 100ms
    }
}

// Start the loading check
start();