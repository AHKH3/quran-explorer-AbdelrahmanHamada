document.addEventListener('DOMContentLoaded', async () => {
    // --- Global State & DOM Elements ---
    let surahDataCache = {};
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
            contentArea.innerHTML = "<p>عذراً، حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.</p>";
        } finally {
            showLoading(false);
        }
    }

    function populateSurahIndex() {
        if (!surahIndex) return;
        surahIndex.forEach(surah => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'surah-link';
            link.textContent = `${surah.id}. ${surah.name}`;
            link.dataset.surahId = surah.id;
            link.onclick = async (e) => {
                e.preventDefault();
                const surahInfo = pages.find(p => p.surah_number === surah.id);
                if (surahInfo) {
                    await navigateToPage(surahInfo.page_number);
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
                playSound('navigate');
            });
        });
        
        document.getElementById('search-btn').addEventListener('click', handleSearch);
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        document.getElementById('sidebar-toggle-btn').addEventListener('click', showSidebar);
        document.getElementById('sidebar-overlay').addEventListener('click', hideSidebar);

        if (scrollTopBtn) {
            scrollTopBtn.addEventListener('click', () => contentArea.scrollTo({ top: 0, behavior: 'smooth' }));
            contentArea.addEventListener('scroll', () => {
                scrollTopBtn.style.display = (contentArea.scrollTop > 300) ? 'flex' : 'none';
            });
        }

        document.getElementById('theme-dropdown').addEventListener('change', (e) => setTheme(e.target.value));
        document.getElementById('mute-btn').addEventListener('click', toggleMute);
    }
    
    // --- Section & Page Management ---
    async function setActiveSection(section) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
        document.querySelectorAll('#content-nav .nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.section === section);
        });
        
        showLoading(true);
        try {
            if (section === 'surah-list') {
                await loadAndDisplaySelectedSurah();
            } else if (section === 'tafsir') {
                await loadAndDisplayTafsirForCurrentPage();
            }
        } catch (e) {
            console.error(`Error loading section ${section}:`, e);
        } finally {
            showLoading(false);
        }
    }

    async function navigateToPage(page, initialLoad = false) {
        if (page < 1 || page > 604) return;
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
        if (pageNumber < 1 || pageNumber > 604) return [];
        return verses.filter(v => v.page === pageNumber);
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

                if (currentSurahId !== 1 && currentSurahId !== 9) {
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
        const surahOnRight = getSurahNameFromPage(currentPage);
        const surahOnLeft = getSurahNameFromPage(currentPage + 1);
        
        pageDisplay.textContent = `صفحة ${currentPage} - ${currentPage + 1}`;
        
        if (surahOnRight && surahOnLeft && surahOnRight.id === surahOnLeft.id) {
             surahNameDisplay.textContent = surahOnRight ? `سورة ${surahOnRight.name_arabic}` : '';
        } else {
             surahNameDisplay.textContent = `${surahOnRight ? 'سورة ' + surahOnRight.name_arabic : ''} - ${surahOnLeft ? 'سورة ' + surahOnLeft.name_arabic : ''}`;
        }
    }
    
    function getSurahNameFromPage(pageNumber) {
        if (!pages || pageNumber < 1 || pageNumber > 604) return null;
        const pageInfo = pages.find(p => p.page_number === pageNumber);
        if (!pageInfo) return null;
        return surahIndex.find(s => s.id === pageInfo.surah_number);
    }
    
    function updateActiveSurahLink() {
        const activeSurah = getSurahNameFromPage(currentPage);
        if(!activeSurah) return;
        currentActiveSurah = activeSurah.id;
        document.querySelectorAll('.surah-link').forEach(link => {
            link.classList.toggle('active', parseInt(link.dataset.surahId) === currentActiveSurah);
        });
    }

    // --- Other Sections Logic ---
    async function loadAndDisplaySelectedSurah() {
        showLoading(true);
        try {
            const surahData = await getSurahData(currentActiveSurah);
            const container = document.getElementById('surah-list-container');
            const title = document.getElementById('surah-list-title');
            title.textContent = `سورة ${surahData.name}`;
            container.innerHTML = surahData.verses.map(verse => `<span class="verse-block">${verse.text} <span class="verse-number">﴿${verse.id}﴾</span></span>`).join('');
        } catch(e) { console.error("Error loading surah for list view", e); }
        finally { showLoading(false); }
    }
    
    async function loadAndDisplayTafsirForCurrentPage() {
        showLoading(true);
        try {
            const surahData = await getSurahData(currentActiveSurah);
            const container = document.getElementById('tafsir-container');
            const title = document.getElementById('tafsir-title');
            title.textContent = `تفسير سورة ${surahData.name}`;
            if (!surahData.tafsir || surahData.tafsir.length === 0) {
                 container.innerHTML = '<p>لا يتوفر تفسير لهذه السورة حاليًا.</p>';
                 return;
            }
            container.innerHTML = surahData.tafsir.map(item => `
                <div class="tafsir-item">
                    <h4>الآيات (${item.verses})</h4>
                    <p>${item.explanation}</p>
                </div>
            `).join('');
        } catch(e) { console.error("Error loading tafsir", e); }
        finally { showLoading(false); }
    }
    
    async function handleSearch() {
        const query = document.getElementById('search-input').value;
        if (query.trim().length < 2) return;
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
            
            resultsContainer.innerHTML = data.search.results.map(result => {
                const [surahId, ayahId] = result.verse_key.split(':');
                const surahName = surahIndex.find(s => s.id == surahId).name;
                // The API provides HTML with <mark> tags for highlighting
                return `<div class="result-item"><p>${result.text}</p><strong>(سورة ${surahName} - آية ${ayahId})</strong></div>`;
            }).join('');

        } catch (error) {
            console.error("Search failed:", error);
            resultsContainer.innerHTML = '<p>حدث خطأ أثناء البحث.</p>';
        } finally {
            showLoading(false);
        }
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
        
        // This is a public API for audio recitation
        const audioUrl = `https://cdn.islamic.network/quran/audio/128/${currentReciter}/${parseInt(surahId) * 1000 + parseInt(ayahId)}.mp3`;
        
        audioPlayer.src = audioUrl;
        audioPlayer.play().catch(e => console.error("Audio playback error:", e));

        const surahName = surahIndex.find(s => s.id == surahId).name;
        currentVerseDisplay.textContent = `القارئ: ${reciterSelect.options[reciterSelect.selectedIndex].text} | يتلو: سورة ${surahName} - آية ${ayahId}`;

        document.querySelectorAll('.ayah.playing').forEach(el => el.classList.remove('playing'));
        const currentAyahEl = document.querySelector(`.ayah[data-verse-key="${verseKey}"]`);
        if (currentAyahEl) currentAyahEl.classList.add('playing');
        
        audioPlayer.onended = playNextInQueue;
    }


    // --- Utility & Helper Functions ---
    function showLoading(isLoading) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    function applySavedSettings() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'theme-classic';
        setTheme(savedTheme);
        currentReciter = localStorage.getItem('currentReciter') || 'ar.alafasy';
        reciterSelect.value = currentReciter;
        updateMuteButtonIcon();
    }

    function setTheme(theme) {
        document.body.className = '';
        document.body.classList.add(theme);
        document.getElementById('theme-dropdown').value = theme;
        localStorage.setItem('selectedTheme', theme);
        playSound('navigate');
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
            script.onerror = () => reject(new Error(`Failed to load data script for surah ${surahId}`));
            document.head.appendChild(script);
        });
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
        // Simple sound generation logic
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        let freq = 440, duration = 0.1, wave = 'sine';
        switch(type) {
            case 'navigate': freq = 600; duration = 0.1; wave = 'triangle'; break;
            case 'swoosh': freq = 800; duration = 0.15; oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1); break;
            case 'click': freq=900; duration=0.05; break;
        }
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + duration);
    }

    function toggleMute() {
        isMuted = !isMuted;
        localStorage.setItem('isMuted', isMuted);
        updateMuteButtonIcon();
    }

    function updateMuteButtonIcon() {
        document.getElementById('mute-btn').innerHTML = `<span class="material-icons">${isMuted ? 'volume_off' : 'volume_up'}</span>`;
    }

    function showSidebar() {
        document.getElementById('sidebar').classList.add('sidebar-open');
        document.getElementById('sidebar-overlay').classList.add('active');
    }
    function hideSidebar() {
        document.getElementById('sidebar').classList.remove('sidebar-open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }
    
    // Initial call
    initializeApp();
});