// phrase-reader.js
export class PhraseReader {
    constructor() {
        this.phrases = {};
        this.currentTooltip = null;
        this.tooltipCloseHandler = null;
        this.tooltipOutsideClickHandler = null;
    }

    async init() {
        try {
            await this.loadPhrases();
            this.setupTooltipStyles();
            return true;
        } catch (error) {
            console.error('Klaida inicializuojant PhraseReader:', error);
            throw new Error(`PhraseReader inicializavimo klaida: ${error.message}`);
        }
    }

    async loadPhrases() {
		try {
			console.log('1. Pradedamas frazių įkėlimas');
			const response = await fetch('phrases.json');
			
			const data = await response.json();
			console.log('2. Gautas JSON:', data);
			
			this.phrases = {};
			console.log('3. Pradedamas frazių apdorojimas');
			
			Object.entries(data).forEach(([key, info]) => {
				console.log('4. Apdorojama frazė:', key, info);
				
				const normalizedPhrase = info.phrase.toLowerCase();
			console.log('5. Normalizuota frazė:', normalizedPhrase);
				
				if (!this.phrases[normalizedPhrase]) {
					this.phrases[normalizedPhrase] = [];
			}
				this.phrases[normalizedPhrase].push({
					...info,
					originalPhrase: info.phrase // Čia išsaugome originalų formatą
				});
			});
			
			console.log('6. Galutinis frazių objektas:', this.phrases);
			console.log('7. Frazių kiekis:', Object.keys(this.phrases).length);
			
		} catch (error) {
			console.error('Klaida įkeliant frazes:', error);
			throw error;
		}
	}

    processPhrases(content) {
		try {
			console.log('1. Pradinis turinys:', content.substring(0,200));

			const htmlTags = new Map();
			let counter = 0;
			
			// 1. HTML žymių pakeitimas placeholder'iais
			let processedContent = content.replace(/<[^>]+>/g, match => {
				const placeholder = `###HTML${counter}###`;
				htmlTags.set(placeholder, match);
				counter++;
				return placeholder;
			});
			
			// 2. Frazių paieška ir žymėjimas
			const sortedPhrases = Object.keys(this.phrases).sort((a, b) => {
				// 1. Ilgesnės frazės pirmiau
				if (b.length !== a.length) return b.length - a.length;
				
				// 2. Frazės su kitų frazių dalimis pirmiau
				if (b.includes(a)) return 1;
				if (a.includes(b)) return -1;
				
				return 0;
			});
			const processedRanges = [];
			
			for (const phrase of sortedPhrases) {
				console.log('3. Ieškoma frazė:', phrase);
				const safePhrase = this.escapeRegExp(phrase);
				const regex = new RegExp(`(\\b|^)${safePhrase}(\\b|$)`, 'gi');
            
				let match;
				while ((match = regex.exec(processedContent)) !== null) {
					const start = match.index;
					const end = start + match[0].length;
                
					// Tikriname ar ši sritis dar neapdorota
					const isOverlapping = processedRanges.some(range => 
						(start <= range.end && end >= range.start)
					);
					
					if (!isOverlapping) {
						processedRanges.push({ start, end });
						const replacement = `<span class="known-phrase" data-phrase="${phrase}">${match[0]}</span>`;
						processedContent = processedContent.slice(0, start) + replacement + processedContent.slice(end);
						regex.lastIndex = start + replacement.length; // Koreguojame poziciją
					}
				}
			}

			// 4. Grąžiname HTML žymes
			htmlTags.forEach((tag, placeholder) => {
				processedContent = processedContent.replace(placeholder, tag);
			});
			
			console.log('8. Galutinis rezultatas:', processedContent.substring(0,200));
			return processedContent;
		} catch (error) {
			console.error('Klaida apdorojant frazes:', error);
			return content;
		}
	}

    setupPhraseListeners(contentDiv) {
        if (!contentDiv || !(contentDiv instanceof HTMLElement)) {
            throw new Error('Netinkamas DOM elementas frazių klausytojams');
        }

        try {
            const knownPhrases = contentDiv.querySelectorAll('.known-phrase');
            knownPhrases.forEach(phraseElement => {
                ['click', 'touchend'].forEach(eventName => { //
                    phraseElement.addEventListener(eventName, (e) => {
                        e.preventDefault();
                        const phrase = e.target.dataset.phrase;
                        if (!phrase) {
                            console.warn('Nerasta frazės reikšmė elemente');
                            return;
                        }
                        this.showPhraseInfo(phrase, e);
                    });
                });
            });
        } catch (error) {
            console.error('Klaida nustatant frazių klausytojus:', error);
            throw new Error(`Frazių klausytojų nustatymo klaida: ${error.message}`);
        }
    }

    showPhraseInfo(phrase, event) {
        try {
            const phraseData = this.phrases[phrase.toLowerCase()];
            if (!phraseData || phraseData.length === 0) {
                console.warn(`Nerasta informacijos frazei: ${phrase}`);
                return;
            }

            this.removeCurrentTooltip();

            const tooltip = this.createTooltip(phrase, phraseData);
            document.body.appendChild(tooltip);
            this.currentTooltip = tooltip;

            this.positionTooltip(tooltip, event.target);
            this.setupTooltipListeners(tooltip, event.target);

        } catch (error) {
            console.error('Klaida rodant frazės informaciją:', error);
            this.removeCurrentTooltip();
        }
    }

    createTooltip(phrase, phraseData) {
        const tooltip = document.createElement('div');
        tooltip.id = 'phrase-tooltip';
        
		// Naudojame pirmojo įrašo originalų frazės formatą
		const originalPhrase = phraseData[0]?.originalPhrase || phrase; //
		
        try {
            tooltip.innerHTML = `
                <div class="tooltip-content">
                    <div class="tooltip-header">
                        <span class="phrase">${this.escapeHtml(originalPhrase)}</span>
                        <button class="close-tooltip" aria-label="Uždaryti">&times;</button>
                    </div>
                    <div class="tooltip-body">
                        ${phraseData.map((info, index) => `
                            <div class="meaning ${index > 0 ? 'meaning-separator' : ''}">
                                <div class="meaning-header">
                                    <span class="phrase-type">${this.escapeHtml(info.type || 'Frazė')}</span>
                                </div>
                                <p class="translation">${this.escapeHtml(info.translation || '')}</p>
                                ${info.example ? 
                                    `<p class="example">${this.escapeHtml(info.example)}</p>` : 
                                    ''}
                                ${info.notes ? 
                                    `<p class="notes">${this.escapeHtml(info.notes)}</p>` : 
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

     escapeRegExp(string) {
		const escaped = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const withScandinavian = escaped
			.replace(/å/gi, '(å|a)')
			.replace(/ä/gi, '(ä|a)')
			.replace(/ö/gi, '(ö|o)');
		return withScandinavian;
	}

    setupTooltipStyles() {
		if (document.getElementById('phrase-reader-styles')) return;
		
        try {
            const style = document.createElement('style');
            style.id = 'phrase-reader-styles';
			style.textContent = `
                .known-phrase {
                    color: #4CAF50;
                    cursor: pointer;
                    border-bottom: 1px dotted #4CAF50;
                    padding: 2px 0;
                }

                #phrase-tooltip {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    position: absolute;
                    z-index: 1000;
                    max-width: min(350px, 80vw);
                    animation: tooltipFadeIn 0.2s ease-out;
                }

                @keyframes tooltipFadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .phrase-type {
                    font-size: 0.85em;
                    color: #4CAF50;
                    font-style: italic;
                    background: #E8F5E9;
                    padding: 2px 6px;
                    border-radius: 3px;
                }

                .example {
                    font-style: italic;
                    color: #666;
                    margin-top: 8px;
                }

                .notes {
                    font-size: 0.9em;
                    color: #666;
                    margin-top: 8px;
                }

				@media (max-width: 768px) {
					#phrase-tooltip {
					width: 90% !important;
					left: 50% !important;
					right: auto !important;
					transform: translateX(-50%) !important;
				}
			}
			`;
            document.head.appendChild(style);
        } catch (error) {
            console.error('Klaida nustatant tooltip stilius:', error);
        }
    }

    // Paveldime tas pačias tooltip pozicionavimo ir valdymo funkcijas kaip WordReader
    positionTooltip(tooltip, element) {
        if (!tooltip || !element) {
            throw new Error('Trūksta elementų tooltip pozicionavimui');
        }

        try {
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            tooltip.style.visibility = 'hidden';
            tooltip.style.position = 'absolute';
            tooltip.style.top = '0';
            tooltip.style.left = '0';

            const tooltipRect = tooltip.getBoundingClientRect();

            let top = rect.top + scrollTop - tooltipRect.height - 10;
            let left = rect.left + scrollLeft - (tooltipRect.width - rect.width) / 2;

            // Mobilių įrenginių patikrinimas
            if (window.matchMedia('(hover: none)').matches) {
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

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.style.visibility = 'visible';

        } catch (error) {
            console.error('Klaida pozicionuojant tooltip:', error);
            throw new Error(`Tooltip pozicionavimo klaida: ${error.message}`);
        }
    }

    setupTooltipListeners(tooltip, element) {
        try {
            const closeButton = tooltip.querySelector('.close-tooltip');
            if (!closeButton) {
                throw new Error('Nerastas uždarymo mygtukas');
            }

            this.tooltipCloseHandler = () => this.removeCurrentTooltip();
            closeButton.addEventListener('click', this.tooltipCloseHandler);

            this.tooltipOutsideClickHandler = (e) => {
                if (!tooltip.contains(e.target) && e.target !== element) {
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
}
