export class WordReader {
    constructor() {
        this.dictionary = {};
        this.currentTooltip = null;
        this.tooltipCloseHandler = null;
        this.tooltipOutsideClickHandler = null;
    }

    async init() {
        try {
            await this.loadDictionary();
            this.setupTooltipStyles();
            return true;
        } catch (error) {
            console.error('Klaida inicializuojant WordReader:', error);
            throw new Error(`WordReader inicializavimo klaida: ${error.message}`);
        }
    }

    async loadDictionary() {
        try {
            const response = await fetch('dictionary.json', {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json;charset=UTF-8'
                }
            });

            if (!response.ok) {
                throw new Error(`Nepavyko įkelti žodyno (${response.status})`);
            }

            const data = await response.json();

            if (!data || typeof data !== 'object') {
                throw new Error('Netinkamas žodyno duomenų formatas');
            }

            this.dictionary = {};

            // Išsaugome žodyno duomenis
            Object.entries(data).forEach(([key, info]) => {
                if (!info || !info.base_word) {
                    console.warn(`Praleistas netinkamas žodyno įrašas: ${key}`);
                    return;
                }

                // Saugome ir pagal originalų raktą, ir pagal base_word
                const baseWord = info.base_word.toLowerCase();
                const baseEntry = {
                    ...info,
                    originalKey: key
                };

                // Saugome pagal base_word
                if (!this.dictionary[baseWord]) {
                    this.dictionary[baseWord] = [];
                }
                this.dictionary[baseWord].push(baseEntry);

                // Saugome pagal originalų raktą
                const keyLower = key.toLowerCase().split('_')[0]; // Pašaliname _pron, _verb, etc.
                if (keyLower !== baseWord) {
                    if (!this.dictionary[keyLower]) {
                        this.dictionary[keyLower] = [];
                    }
                    this.dictionary[keyLower].push(baseEntry);
                }
            });

            // Patikrinkime, ar įkelti skandinaviški žodžiai
            const scandinavianWords = Object.keys(this.dictionary)
                .filter(word => /[åäöÅÄÖ]/.test(word));

            console.log('Skandinaviški žodžiai žodyne:', scandinavianWords);
            console.log('Bendras žodyno dydis:', Object.keys(this.dictionary).length);

            return true;
        } catch (error) {
            console.error('Klaida įkeliant žodyną:', error);
            throw new Error(`Žodyno įkėlimo klaida: ${error.message}`);
        }
    }

    getKnownWords() {
		return Object.keys(this.dictionary).filter(word => 
			/^[a-zåäö]+$/.test(word) // Filtruojame tik mažąsias raides be specialių simbolių
		);
	}

	processWords(content) {
		if (!content || typeof content !== 'string') {
			throw new Error('Netinkamas turinys žodžių apdorojimui');
		}
	
		try {
			// 0. Išsaugome frazes
			const phrasePlaceholders = [];
			let tempContent = content.replace(/<span class="known-phrase"[^>]*>.*?<\/span>/g, (match) => {
				const id = `###PHRASE${phrasePlaceholders.length}###`;
				phrasePlaceholders.push({id, content: match});
				return id;
			});
	
			// 1. Pašaliname HTML tag'us
			const htmlTags = new Map();
			let counter = 0;
			tempContent = tempContent.replace(/<[^>]+>/g, match => {
				const placeholder = `###HTML${counter}###`;
				htmlTags.set(placeholder, match);
				counter++;
				return placeholder;
			});
	
			// 2. Apdorojame žodžius
			const sortedWords = Object.keys(this.dictionary).sort((a, b) => b.length - a.length);
			sortedWords.forEach(word => {
				const regex = new RegExp(`\\b${word}\\b`, 'gi');
				tempContent = tempContent.replace(regex, (match) => {
					return `<span class="known-word" data-word="${match}">${match}</span>`;
				});
			});
	
			// 3. Atstatome HTML tag'us
			htmlTags.forEach((tag, placeholder) => {
				tempContent = tempContent.replace(placeholder, tag);
			});
	
			// 4. Atstatome frazes
			phrasePlaceholders.forEach(placeholder => {
				tempContent = tempContent.replace(placeholder.id, placeholder.content);
			});
	
			return tempContent;
		} catch (error) {
			console.error('Klaida apdorojant žodžius:', error);
			return content;
		}
	}
	
	showWordInfo(word, event) {
		try {
			const wordLower = word.toLowerCase();
			console.log(`Ieškomas žodis žodyne: "${wordLower}"`);

            // Pirma bandome rasti per base_word (prioritetinė paieška)
            let meanings = Object.values(this.dictionary)
                .find(entries => entries.some(entry =>
                    entry.base_word.toLowerCase() === wordLower
                ));

            // Jei neradome per base_word, ieškome tiesiogiai
            if (!meanings) {
                meanings = this.dictionary[wordLower];
            }

            // Jei vis dar neradome, ieškome per originalKey
            if (!meanings) {
                const foundEntry = Object.entries(this.dictionary)
                    .find(([key, entries]) =>
                        entries.some(entry =>
                            entry.originalKey.toLowerCase().includes(wordLower)
                        )
                    );
                if (foundEntry) {
                    meanings = foundEntry[1];
                }
            }

            if (!meanings || !Array.isArray(meanings) || meanings.length === 0) {
                console.warn(`Nerasta reikšmių žodžiui: ${word}`);
                return;
            }

            console.log(`Rastos reikšmės žodžiui "${word}":`, meanings);
            this.removeCurrentTooltip();

            const tooltip = this.createTooltip(word, meanings);
            document.body.appendChild(tooltip);
            this.currentTooltip = tooltip;

            this.positionTooltip(tooltip, event.target);
            this.setupTooltipListeners(tooltip, event.target);

        } catch (error) {
            console.error('Klaida rodant žodžio informaciją:', error);
            this.removeCurrentTooltip();
        }
    }

    createTooltip(word, meanings) {
        const tooltip = document.createElement('div');
        tooltip.id = 'word-tooltip';

        try {
            console.log(`Kuriamas tooltip žodžiui "${word}" su reikšmėmis:`, meanings);
            tooltip.innerHTML = `
                <div class="tooltip-content">
                    <div class="tooltip-header">
                        <span class="word">${this.escapeHtml(word)}</span>
                        <button class="close-tooltip" aria-label="Uždaryti">&times;</button>
                    </div>
                    <div class="tooltip-body">
                        ${meanings.map((info, index) => `
                            <div class="meaning ${index > 0 ? 'meaning-separator' : ''}">
                                <div class="meaning-header">
                                    <span class="part-of-speech">${this.escapeHtml(info['kalbos dalis'] || '')}</span>
                                </div>
                                <p class="translation">${this.escapeHtml(info.translation || '')}</p>
                                ${info.additional ?
                    `<p class="additional">${this.escapeHtml(info.additional)}</p>` :
                    ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="tooltip-arrow"></div>
            `;
        } catch (error) {
            console.error('Klaida kuriant tooltip:', error);
            throw new Error(`Tooltip kūrimo klaida: ${error.message}`);
        }

        return tooltip;
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    positionTooltip(tooltip, wordElement) {
        if (!tooltip || !wordElement) {
            throw new Error('Trūksta elementų tooltip pozicionavimui');
        }

        try {
            console.log('Pozicionuojamas tooltip žodžiui:', wordElement.textContent);
            const rect = wordElement.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            tooltip.style.visibility = 'hidden';
            tooltip.style.position = 'absolute';
            tooltip.style.top = '0';
            tooltip.style.left = '0';

            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

            let top = rect.top + scrollTop - tooltipRect.height - 10;
            let left = rect.left + scrollLeft - (tooltipRect.width - rect.width) / 2;

            const isMobile = window.matchMedia('(hover: none)').matches;
            if (isMobile) {
                tooltip.style.position = 'fixed';
                tooltip.style.bottom = '0';
                tooltip.style.left = '0';
                tooltip.style.right = '0';
                tooltip.style.top = 'auto';
                tooltip.classList.add('mobile-tooltip');
                tooltip.style.visibility = 'visible';
                return;
            }

            if (top < scrollTop) {
                top = rect.bottom + scrollTop + 10;
                tooltip.classList.add('tooltip-bottom');
            } else {
                tooltip.classList.remove('tooltip-bottom');
            }

            if (left < scrollLeft) {
                left = scrollLeft + 10;
            } else if (left + tooltipRect.width > scrollLeft + viewportWidth) {
                left = scrollLeft + viewportWidth - tooltipRect.width - 10;
            }

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.style.visibility = 'visible';

        } catch (error) {
            console.error('Klaida pozicionuojant tooltip:', error);
            throw new Error(`Tooltip pozicionavimo klaida: ${error.message}`);
        }
    }

    setupTooltipListeners(tooltip, wordElement) {
        try {
            const closeButton = tooltip.querySelector('.close-tooltip');
            if (!closeButton) {
                throw new Error('Nerastas uždarymo mygtukas');
            }

            this.tooltipCloseHandler = () => this.removeCurrentTooltip();
            closeButton.addEventListener('click', this.tooltipCloseHandler);

            this.tooltipOutsideClickHandler = (e) => {
                if (!tooltip.contains(e.target) && e.target !== wordElement) {
                    this.removeCurrentTooltip();
                }
            };
            document.addEventListener('click', this.tooltipOutsideClickHandler);

            this.escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.removeCurrentTooltip();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);

        } catch (error) {
            console.error('Klaida nustatant tooltip klausytojus:', error);
            this.removeCurrentTooltip();
        }
    }

    removeCurrentTooltip() {
        try {
            if (this.currentTooltip) {
                this.currentTooltip.remove();
                this.currentTooltip = null;

                if (this.tooltipOutsideClickHandler) {
                    document.removeEventListener('click', this.tooltipOutsideClickHandler);
                    this.tooltipOutsideClickHandler = null;
                }

                if (this.escapeHandler) {
                    document.removeEventListener('keydown', this.escapeHandler);
                    this.escapeHandler = null;
                }
            }
        } catch (error) {
            console.error('Klaida šalinant tooltip:', error);
        }
    }

    setupTooltipStyles() {
        try {
            const style = document.createElement('style');
            style.textContent = `
                #word-tooltip {
                    background: white;
                    border-radius: 6px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
                    position: absolute;
                    z-index: 1000;
                    max-width: 250px;
                    animation: tooltipFadeIn 0.2s ease-out;
                }

                .tooltip-content {
                    padding: 8px;
                }
				
				strong {
					font-weight: bold;
					background: none;
				}
				em {
					font-style: italic;
					background: none;
				}
				
                .tooltip-header {
                    margin-bottom: 4px;
                    position: relative;
                    border-bottom: 2px solid #2196f3;
                    padding-bottom: 4px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .tooltip-header .word {
                    color: #2196f3;
                    font-weight: 500;
                    font-size: 16px;
                    flex: 1;
                }

                .tooltip-header .close-tooltip {
                    background: none;
                    border: none;
                    font-size: 16px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    margin: 0;
                    margin-left: 10px;
                }

                .tooltip-header .close-tooltip:hover {
                    color: #000;
                }

                .tooltip-body {
                    font-size: 14px;
                    line-height: 1.2;
                }

                .tooltip-body .meaning {
                    padding: 4px 0;
                }

                .tooltip-body .translation {
                    font-size: 14px;
                    color: #2196f3;
                    margin: 2px 0;
                    display: block;
                }

                .tooltip-body .part-of-speech {
                    color: #666;
                    font-size: 10px;
                    font-style: italic;
                    margin-bottom: 2px;
                    display: block;
                }

                .meaning-separator {
                    border-top: 1px solid #eee;
                    margin: 4px 0;
                }

                @keyframes tooltipFadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (hover: none) {
                    #word-tooltip {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        max-width: 100%;
                        border-radius: 12px 12px 0 0;
                    }

                    .tooltip-content {
                        padding: 12px;
                        max-height: 50vh;
                        overflow-y: auto;
                    }
                }
            `;
            document.head.appendChild(style);
        } catch (error) {
            console.error('Klaida nustatant tooltip stilius:', error);
            throw new Error(`Tooltip stilių nustatymo klaida: ${error.message}`);
        }
    }

    setupWordListeners(contentDiv) {
        if (!contentDiv || !(contentDiv instanceof HTMLElement)) {
            console.error('Netinkamas DOM elementas:', contentDiv);
            throw new Error('Netinkamas DOM elementas žodžių klausytojams');
        }

        try {
            // Pašaliname senus klausytojus, jei tokių yra
            const oldWords = contentDiv.querySelectorAll('.known-word');
            oldWords.forEach(word => {
                const clone = word.cloneNode(true);
                word.parentNode.replaceChild(clone, word);
            });

            // Pridedame naujus klausytojus
            const knownWords = contentDiv.querySelectorAll('.known-word');
            console.log(`Rasti ${knownWords.length} žinomi žodžiai`);

            knownWords.forEach(wordElement => {
				const handleWordClick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					const word = e.target.dataset.word;
					if (!word) return;
					this.showWordInfo(word, e);
				};
			
				if (!wordElement.closest('.known-phrase')) {
					wordElement.addEventListener('click', handleWordClick);
					wordElement.addEventListener('touchstart', handleWordClick, { passive: false });
				}
			});

            console.log(`Sėkmingai pridėti klausytojai ${knownWords.length} žodžiams`);
            return true;
        } catch (error) {
            console.error('Klaida nustatant žodžių klausytojus:', error);
            throw new Error(`Žodžių klausytojų nustatymo klaida: ${error.message}`);
        }
    }
}
