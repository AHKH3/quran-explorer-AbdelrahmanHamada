document.addEventListener('DOMContentLoaded', () => {
    // --- Global State & DOM Elements ---
    let currentSurahData = null;
    let mushafData = null;
    let currentPage = 1;
    let isMuted = localStorage.getItem('isMuted') === 'true';
    let audioCtx = null;
    let currentReciter = 'ar.alafasy';
    let audioQueue = [];
    let isPlaying = false;

    const surahIndexContainer = document.getElementById('quran-index');
    const mushafRightPage = document.getElementById('mushaf-page-right');
    const mushafLeftPage = document.getElementById('mushaf-page-left');
    const pageDisplay = document.getElementById('page-number-display');
    const surahNameDisplay = document.getElementById('surah-name-display');
    const audioPlayer = document.getElementById('audio-player');
    const currentVerseDisplay = document.getElementById('current-verse-display');
    const reciterSelect = document.getElementById('reciter-select');

    // --- Core Functions ---
    async function initializeApp() {
        showLoading(true);
        try {
            const response = await fetch('https://api.quran.com/api/v4/quran/verses/uthmani?page_number=1');
            if (response.ok) {
                // Pre-warm the API connection
            }
            await loadMushafData();
            populateSurahIndex();
            setupEventListeners();
            applySavedSettings();
            
            // Load the last viewed page or the first page
            const savedPage = parseInt(localStorage.getItem('currentPage')) || 1;
            navigateToPage(savedPage, true);

        } catch (error) {
            console.error("Initialization failed:", error);
            // Handle initialization error (e.g., show a message to the user)
        } finally {
            showLoading(false);
        }
    }

    async function loadMushafData() {
        // This data helps map pages to surahs and ayahs
        const response = await fetch('https://api.quran.com/api/v4/chapters');
        const data = await response.json();
        mushafData = data.chapters;
    }

    function populateSurahIndex() {
        surahIndex.forEach(surah => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = `${surah.id}. ${surah.name}`;
            link.dataset.surahId = surah.id;
            link.onclick = (e) => {
                e.preventDefault();
                const firstPage = mushafData.find(s => s.id === surah.id).pages[0];
                navigateToPage(firstPage);
                playSound('navigate');
            };
            surahIndexContainer.appendChild(link);
        });
    }

    function setupEventListeners() {
        document.body.addEventListener('click', initAudio, { once: true });
        document.getElementById('next-page-btn').addEventListener('click', () => navigateToPage(currentPage + 2));
        document.getElementById('prev-page-btn').addEventListener('click', () => navigateToPage(currentPage - 2));
        reciterSelect.addEventListener('change', (e) => currentReciter = e.target.value);
        
        // Main navigation
        document.querySelectorAll('#content-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                setActiveSection(section);
                playSound('navigate');
            });
        });
        
         // Search
        document.getElementById('search-btn').addEventListener('click', handleSearch);
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }
    
    function setActiveSection(section) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
        document.querySelectorAll('#content-nav .nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.section === section);
        });
        
        // Load data if needed for the new section
        if (section === 'surah-list') {
            loadAndDisplaySelectedSurah();
        } else if (section === 'tafsir') {
             loadAndDisplayTafsirForCurrentPage();
        }
    }

    // --- Mushaf Display Logic ---
    async function navigateToPage(page, initialLoad = false) {
        if (page < 1 || page > 604) return;
        showLoading(true);
        
        // For odd pages, we start from the page itself. For even, we start from the previous one.
        let startPage = page % 2 === 0 ? page - 1 : page;
        currentPage = startPage;

        try {
            const [rightPageData, leftPageData] = await Promise.all([
                fetchPage(startPage),
                fetchPage(startPage + 1)
            ]);

            renderPage(mushafRightPage, rightPageData);
            renderPage(mushafLeftPage, leftPageData);
            updatePageInfo();
            if (!initialLoad) playSound('swoosh');

        } catch (error) {
            console.error("Error fetching pages:", error);
        } finally {
            showLoading(false);
            localStorage.setItem('currentPage', currentPage);
        }
    }

    async function fetchPage(pageNumber) {
        if (pageNumber > 604) return [];
        const response = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${pageNumber}`);
        if (!response.ok) throw new Error(`Failed to fetch page ${pageNumber}`);
        const data = await response.json();
        return data.verses;
    }
    
    function renderPage(pageElement, verses) {
        pageElement.innerHTML = '';
        if (!verses || verses.length === 0) {
            pageElement.innerHTML = '<p>نهاية المصحف</p>';
            return;
        }

        let surahName = '';
        let currentSurahId = -1;

        verses.forEach(verse => {
            const [surahId, ayahId] = verse.verse_key.split(':');

            if (currentSurahId !== parseInt(surahId)) {
                currentSurahId = parseInt(surahId);
                surahName = surahIndex.find(s => s.id === currentSurahId).name;
                
                const surahHeader = document.createElement('div');
                surahHeader.className = 'surah-header';
                surahHeader.textContent = `سورة ${surahName}`;
                pageElement.appendChild(surahHeader);
                if (currentSurahId !== 1 && currentSurahId !== 9) { // No bismillah for Fatiha or Tawbah
                     const bismillah = document.createElement('div');
                     bismillah.className = 'bismillah';
                     bismillah.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
                     pageElement.appendChild(bismillah);
                }
            }

            const ayahSpan = document.createElement('span');
            ayahSpan.className = 'ayah';
            ayahSpan.textContent = verse.text_uthmani;
            ayahSpan.dataset.verseKey = verse.verse_key;
            ayahSpan.onclick = () => playVerse(verse.verse_key);

            const ayahNumberSpan = document.createElement('span');
            ayahNumberSpan.className = 'ayah-number';
            ayahNumberSpan.textContent = ` ﴿${ayahId}﴾ `;

            pageElement.appendChild(ayahSpan);
            pageElement.appendChild(ayahNumberSpan);
        });
    }

    function updatePageInfo() {
        const surahOnRight = getSurahNameFromPage(currentPage);
        const surahOnLeft = getSurahNameFromPage(currentPage + 1);
        
        pageDisplay.textContent = `صفحة ${currentPage + 1} - ${currentPage}`;
        
        if (surahOnRight === surahOnLeft) {
             surahNameDisplay.textContent = surahOnRight ? `سورة ${surahOnRight}` : '';
        } else {
             surahNameDisplay.textContent = `${surahOnRight ? `سورة ${surahOnRight}` : ''} - ${surahOnLeft ? `سورة ${surahOnLeft}` : ''}`;
        }
    }
    
    function getSurahNameFromPage(pageNumber) {
        if (!mushafData || pageNumber > 604) return null;
        const surah = mushafData.find(s => pageNumber >= s.pages[0] && pageNumber <= s.pages[1]);
        return surah ? surah.name_arabic : null;
    }


    // --- Audio Logic ---
    function playVerse(verseKey) {
        audioQueue.push(verseKey);
        if (!isPlaying) {
            playNextInQueue();
        }
    }

    function playNextInQueue() {
        if (audioQueue.length === 0) {
            isPlaying = false;
            currentVerseDisplay.textContent = '';
             document.querySelectorAll('.ayah.playing').forEach(el => el.classList.remove('playing'));
            return;
        }

        isPlaying = true;
        const verseKey = audioQueue.shift();
        const [surahId, ayahId] = verseKey.split(':');
        const paddedSurah = surahId.padStart(3, '0');
        const paddedAyah = ayahId.padStart(3, '0');
        
        const audioUrl = `https://verses.quran.com/Alafasy/mp3/${paddedSurah}${paddedAyah}.mp3`;
        
        audioPlayer.src = audioUrl;
        audioPlayer.play();

        const surahName = surahIndex.find(s => s.id == surahId).name;
        currentVerseDisplay.textContent = `يتلو: سورة ${surahName} - آية ${ayahId}`;

        document.querySelectorAll('.ayah.playing').forEach(el => el.classList.remove('playing'));
        const currentAyahEl = document.querySelector(`.ayah[data-verse-key="${verseKey}"]`);
        if (currentAyahEl) {
            currentAyahEl.classList.add('playing');
        }
        
        audioPlayer.onended = playNextInQueue;
    }
    

    // --- Other Sections Logic ---
    async function loadAndDisplaySelectedSurah() {
        const surahId = getSurahFromPage(currentPage)?.id;
        if (!surahId) return;

        showLoading(true);
        try {
            const surahData = await getSurahData(surahId);
            const container = document.getElementById('surah-list-container');
            const title = document.getElementById('surah-list-title');
            title.textContent = `سورة ${surahData.name}`;
            container.innerHTML = '';
             surahData.verses.forEach(verse => {
                container.innerHTML += `<span class="verse-block">${verse.text} <span class="verse-number">﴿${verse.id}﴾</span></span>`;
            });

        } catch(e) {
            console.error("Error loading surah for list view", e);
        } finally {
            showLoading(false);
        }
    }
    
    async function loadAndDisplayTafsirForCurrentPage() {
        const surahId = getSurahFromPage(currentPage)?.id;
        if (!surahId) return;

        showLoading(true);
        try {
            const surahData = await getSurahData(surahId);
            const container = document.getElementById('tafsir-container');
            const title = document.getElementById('tafsir-title');
            title.textContent = `تفسير سورة ${surahData.name}`;
            container.innerHTML = '';
            if (!surahData.tafsir || surahData.tafsir.length === 0) {
                 container.innerHTML = '<p>لا يتوفر تفسير لهذه السورة حاليًا.</p>';
                 return;
            }
             surahData.tafsir.forEach(item => {
                const tafsirItem = document.createElement('div');
                tafsirItem.className = 'tafsir-item';
                tafsirItem.innerHTML = `<h4>الآيات (${item.verses})</h4><p>${item.explanation}</p>`;
                container.appendChild(tafsirItem);
            });
        } catch(e) {
            console.error("Error loading tafsir", e);
        } finally {
            showLoading(false);
        }
    }
    
     async function handleSearch() {
        const query = document.getElementById('search-input').value;
        if (query.trim().length < 3) return;
        showLoading(true);
        const resultsContainer = document.getElementById('search-results-container');
        resultsContainer.innerHTML = '';
        try {
            const response = await fetch(`https://api.quran.com/api/v4/search?q=${encodeURIComponent(query)}&language=ar`);
            const data = await response.json();
            
            if (data.search.results.length === 0) {
                resultsContainer.innerHTML = '<p>لا توجد نتائج.</p>';
                return;
            }
            
            data.search.results.forEach(result => {
                const [surahId, ayahId] = result.verse_key.split(':');
                const surahName = surahIndex.find(s => s.id == surahId).name;
                const item = document.createElement('div');
                item.className = 'result-item';
                // Using innerHTML to correctly render the highlighted text
                item.innerHTML = `<p>${result.text}</p><strong>(سورة ${surahName} - آية ${ayahId})</strong>`;
                resultsContainer.appendChild(item);
            });

        } catch (error) {
            console.error("Search failed:", error);
            resultsContainer.innerHTML = '<p>حدث خطأ أثناء البحث.</p>';
        } finally {
            showLoading(false);
        }
    }


    // --- Utility & Helper Functions ---
    function showLoading(isLoading) {
        document.getElementById('loading-indicator').style.display = isLoading ? 'block' : 'none';
    }

    function applySavedSettings() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'theme-classic';
        document.body.className = '';
        document.body.classList.add(savedTheme);
        document.getElementById('theme-dropdown').value = savedTheme;
        // Apply other settings...
    }
    
    // Cache for surah data
    const surahDataCache = {};
    async function getSurahData(surahId) {
        if (surahDataCache[surahId]) {
            return surahDataCache[surahId];
        }
        
        return new Promise((resolve, reject) => {
             const script = document.createElement('script');
             script.src = `./quran_data/${surahId}.js`;
             script.onload = () => {
                 const surahVarName = `surah_${surahId}`;
                 if (window[surahVarName]) {
                     surahDataCache[surahId] = window[surahVarName];
                     resolve(window[surahVarName]);
                 } else {
                     reject(new Error(`Surah data variable not found for surah ${surahId}`));
                 }
             };
             script.onerror = () => reject(new Error(`Failed to load data for surah ${surahId}`));
             document.head.appendChild(script);
        });
    }
    
    function getSurahFromPage(pageNumber) {
        if (!mushafData || pageNumber < 1 || pageNumber > 604) return null;
        return mushafData.find(s => pageNumber >= s.pages[0] && pageNumber <= s.pages[1]);
    }
    
    function initAudio() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error("Web Audio API is not supported in this browser");
            }
        }
    }

    function playSound(type) {
        if (isMuted || !audioCtx) return;
        // Sound generation logic...
    }
    
    // Initial call
    initializeApp();
});