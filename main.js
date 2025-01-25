// main.js
import { TextProcessor } from './text-processor.js';
import { WordReader } from './word-reader.js';
import { PhraseReader } from './phrase-reader.js';
import { TextNormalizer } from './text-normalizer.js';

const app = {
    textProcessor: null,
    wordReader: null,
    phraseReader: null,
    textNormalizer: null,

    async init() {
        console.log('Inicializuojama programėlė');
        try {
            this.textNormalizer = new TextNormalizer();
            this.wordReader = new WordReader();
            this.phraseReader = new PhraseReader();
            this.textProcessor = new TextProcessor(
                this.phraseReader, 
                this.wordReader, 
                this.textNormalizer
            );

            await Promise.all([
                this.textProcessor.init(),
                this.wordReader.init(),
                this.phraseReader.init()
            ]);
	
			await this.setupFileUpload();
			await this.restoreContent();
			this.restoreBookmarks();
	
			if ('serviceWorker' in navigator) {
				try {
					const registration = await navigator.serviceWorker.register('/MPD/sw.js');
					console.log('Service Worker sėkmingai registruotas:', registration.scope);
				} catch (error) {
					console.error('Service Worker registracijos klaida:', error);
				}
			}
	
			console.log('Programėlė sėkmingai inicializuota');
		} catch (error) {
			console.error('Klaida inicializuojant:', error);
			this.showError(error);
		}
	},

    async restoreContent() {
        const savedContent = localStorage.getItem('savedContent');
        if (savedContent) {
            await this.displayContent(savedContent);
            console.log('Tekstas atkurtas iš atminties');
        }
    },

    restoreBookmarks() {
        const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
        const bookmarksContainer = document.getElementById('bookmarks');
        if (bookmarksContainer) {
            bookmarksContainer.innerHTML = ''; // Išvalome senus skirtukus
            bookmarks.forEach(bookmark => {
                const button = document.createElement('button');
                button.textContent = bookmark.name;
                button.addEventListener('click', () => {
                    const targetElement = document.getElementById(bookmark.id);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                });

                // Pridedame mygtuką skirtuko pašalinimui
                const deleteButton = document.createElement('button');
                deleteButton.textContent = '✖';
                deleteButton.style.marginLeft = '10px';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Sustabdome įvykio plitimą
                    this.deleteBookmark(bookmark.id);
                });

                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.alignItems = 'center';
                buttonContainer.appendChild(button);
                buttonContainer.appendChild(deleteButton);

                bookmarksContainer.appendChild(buttonContainer);
            });
        }
    },

    deleteBookmark(bookmarkId) {
        const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
        const updatedBookmarks = bookmarks.filter(bookmark => bookmark.id !== bookmarkId);
        localStorage.setItem('bookmarks', JSON.stringify(updatedBookmarks));

        // Pašaliname žymę iš turinio
        const contentDiv = document.getElementById('bookContent');
        if (contentDiv) {
            const bookmarkElement = document.getElementById(bookmarkId);
            if (bookmarkElement) {
                bookmarkElement.remove();
            }
        }

        // Atnaujiname skirtukų sąrašą
        this.restoreBookmarks();
    },

    setupFileUpload() {
        const fileInput = document.getElementById('fileInput');
        const fileNameSpan = document.getElementById('fileName');
        const statusText = document.getElementById('statusText');
        
        if (!fileInput) {
            console.error('Nerasta failo įkėlimo elemento');
            return;
        }

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            console.log('Įkeliamas failas:', file.name);
            if (fileNameSpan) fileNameSpan.textContent = file.name;
            if (statusText) statusText.textContent = 'Įkeliama...';
            
            try {
				const finalContent = await this.textProcessor.handleFileUpload(file);
				await this.displayContent(finalContent);
				console.log('Turinys atvaizduotas');
				if (statusText) statusText.textContent = 'Tekstas sėkmingai įkeltas';
			} catch (error) {
				console.error('Klaida įkeliant failą:', error);
				if (statusText) statusText.textContent = 'Klaida įkeliant failą: ' + error.message;
				this.showError(error);
			}
        });
    },

    async displayContent(content) {
        const contentDiv = document.getElementById('bookContent');
        if (!contentDiv) {
            throw new Error('Nerastas turinio elementas');
        }

        // Atkuriame skirtukų žymes
        const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
        bookmarks.forEach(bookmark => {
            const placeholder = `<!-- BOOKMARK:${bookmark.id} -->`;
            content = content.replace(placeholder, `<span id="${bookmark.id}"></span>`);
        });

        contentDiv.innerHTML = `<div class="page-content">${content}</div>`;

        // Pridedame skirtukų funkcionalumą
        this.setupBookmarks(contentDiv);

        // Atvaizduojame turinį
        contentDiv.innerHTML = `<div class="page-content">${content}</div>`;

        // Skaičiuojame žodžius
        const wordCount = this.countWords(content);
        console.log(`Žodžių skaičius: ${wordCount}`);

        // Atvaizduojame žodžių skaičių vartotojui
        const wordCountDisplay = document.createElement('div');
        wordCountDisplay.className = 'word-count';
        wordCountDisplay.textContent = `Žodžių skaičius: ${wordCount}`;
        contentDiv.prepend(wordCountDisplay); // Pridedame virš turinio

        // Nustatome listenerius
        await this.wordReader.setupWordListeners(contentDiv);
        await this.phraseReader.setupPhraseListeners(contentDiv);

        // Pridedame stilius
        const style = document.createElement('style');
        style.textContent = `
            .page-content {
                font-size: 18px;
                line-height: 1.8;
                padding: 20px;
                color: #333;
            }
            
            .page-content p {
                margin: 1em 0;
                text-align: justify;
            }
            
            @media (max-width: 600px) {
                .page-content {
                    font-size: 16px;
                    line-height: 1.6;
                    padding: 15px;
                }
                
                .page-content p {
                    text-align: left;
                    margin: 0.8em 0;
                    letter-spacing: 0.3px;
                }
            }
        `;
        document.head.appendChild(style);
    },

    // Funkcija, kuri skaičiuoja žodžius tekste
    countWords(text) {
        // 1. Pašalinti HTML žymes
        let cleanText = text.replace(/<[^>]*>/g, '');

        // 2. Pašalinti specialiuosius simbolius (išskyrus tarpus)
        cleanText = cleanText.replace(/[^\w\s]/g, '');

        // 3. Pašalinti perteklinius tarpus ir sutvarkyti tekstą
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        // 4. Skaidyti tekstą į žodžius
        let words = cleanText.split(/\s+/);

        // 5. Grąžinti žodžių skaičių
        return words.length;
    },


    setupBookmarks(contentDiv) {
        const bookmarksContainer = document.createElement('div');
        bookmarksContainer.id = 'bookmarks';
        bookmarksContainer.style.position = 'fixed';
        bookmarksContainer.style.top = '10px';
        bookmarksContainer.style.right = '10px';
        bookmarksContainer.style.zIndex = '1000';
        bookmarksContainer.style.display = 'flex';
        bookmarksContainer.style.flexDirection = 'column';
        bookmarksContainer.style.gap = '10px';
        document.body.appendChild(bookmarksContainer);

        const addBookmarkButton = document.createElement('button');
        addBookmarkButton.textContent = 'Pridėti skirtuką';
        addBookmarkButton.style.position = 'fixed';
        addBookmarkButton.style.bottom = '20px';
        addBookmarkButton.style.right = '20px';
        addBookmarkButton.style.zIndex = '1000';
        document.body.appendChild(addBookmarkButton);

        const clearTextButton = document.createElement('button');
        clearTextButton.textContent = 'Pašalinti tekstą';
        clearTextButton.style.position = 'fixed';
        clearTextButton.style.bottom = '60px';
        clearTextButton.style.right = '20px';
        clearTextButton.style.zIndex = '1000';
        document.body.appendChild(clearTextButton);

        addBookmarkButton.addEventListener('click', () => {
            const bookmarkName = prompt('Įveskite skirtuko pavadinimą:');
            if (bookmarkName) {
                // Sukuriame unikalų ID skirtukui
                const bookmarkId = `bookmark-${Date.now()}`;

                // Pridedame žymę (anchor) į turinį
                const scrollTop = contentDiv.scrollTop;
                const paragraphs = contentDiv.querySelectorAll('.page-content p');
                let targetParagraph = null;

                // Randame paragrafą, kuris yra artimiausias skrolinimo pozicijai
                paragraphs.forEach(p => {
                    const rect = p.getBoundingClientRect();
                    if (rect.top <= scrollTop && rect.bottom >= scrollTop) {
                        targetParagraph = p;
                    }
                });

                if (targetParagraph) {
                    // Pridedame žymę prie paragrafo
                    targetParagraph.insertAdjacentHTML('beforebegin', `<!-- BOOKMARK:${bookmarkId} -->`);

                    // Išsaugome skirtuką
                    const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
                    bookmarks.push({ id: bookmarkId, name: bookmarkName });
                    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));

                    // Atnaujiname skirtukų sąrašą
                    this.restoreBookmarks();

                    // Išsaugome atnaujintą turinį su žymėmis
                    const updatedContent = contentDiv.innerHTML;
                    localStorage.setItem('savedContent', updatedContent);
                }
            }
        });

        clearTextButton.addEventListener('click', () => {
            localStorage.removeItem('savedContent');
            localStorage.removeItem('bookmarks');
            const contentDiv = document.getElementById('bookContent');
            if (contentDiv) {
                contentDiv.innerHTML = '<div class="upload-instruction"><h2>Tekstų skaitymas</h2><p>Norėdami pradėti skaityti:</p><ol><li>Pasirinkite tekstinį failą (.txt arba .md)</li><li>Spustelėkite "Įkelti tekstą" mygtuką</li></ol></div>';
            }
            this.restoreBookmarks();
            alert('Tekstas ir skirtukai pašalinti!');
        });
    },

    showError(error) {
        console.error('Klaida:', error);
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">Klaida</div>
                <div class="notification-message">${error.message}</div>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => notification.remove());
        }
        
        setTimeout(() => notification.remove(), 5000);
    }
};

// Inicializuojame kai DOM užkraunamas
document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(error => {
        console.error('Klaida paleidžiant programą:', error);
    });
});
