import { TextNormalizer } from './text-normalizer.js';

export class TextProcessor {
    constructor(phraseReader, wordReader) {
        console.log('TextProcessor sukurtas');
        this.phraseReader = phraseReader;
        this.wordReader = wordReader;
        this.normalizer = new TextNormalizer();
    }

    async handleFileUpload(file) {
		console.log('1. handleFileUpload pradžia');
		const normalizedText = await this.normalizer.normalizeFile(file);
		console.log('2. Po normalizavimo:', normalizedText.substring(0,200));
		const result = await this.processText(normalizedText);
		console.log('3. Po processText:', result.substring(0,200));
		return result;
	}

    async init() {
        console.log('TextProcessor inicializuojamas');
        try {
            await this.loadMarked();
            if (this.phraseReader) await this.phraseReader.init();
            if (this.wordReader) await this.wordReader.init();
            console.log('TextProcessor sėkmingai inicializuotas');
            return true;
        } catch (error) {
            console.error('Klaida inicializuojant TextProcessor:', error);
            throw error;
        }
    }

    async loadMarked() {
		if (typeof marked === 'undefined') {
			const script = document.createElement('script');
			script.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
			document.head.appendChild(script);
			
			await new Promise((resolve, reject) => {
				script.onload = resolve;
				script.onerror = () => reject(new Error('Nepavyko įkelti marked bibliotekos'));
			});
        }

        // Nustatome marked parinktis ir renderer
        marked.setOptions({
            gfm: true,
            breaks: true,
            pedantic: false,
            headerIds: false,
            smartypants: true
        });

        const renderer = new marked.Renderer();
        renderer.strong = text => `<strong>${text}</strong>`;
        renderer.em = text => `<em>${text}</em>`;
        marked.use({ renderer });
    }

    async processText(text) {
		console.log('4. processText pradžia:', text.substring(0,200));
		let processedContent = text;
	
		if (this.phraseReader) {
			console.log('5. Prieš frazių apdorojimą:', processedContent.substring(0,200));
			processedContent = this.phraseReader.processPhrases(processedContent);
			console.log('6. Po frazių apdorojimo:', processedContent.substring(0,200));
		}
	
		if (this.wordReader) {
			console.log('7. Prieš žodžių apdorojimą:', processedContent.substring(0,200));
			processedContent = this.wordReader.processWords(processedContent);
			console.log('8. Po žodžių apdorojimo:', processedContent.substring(0,200));
		}
	
		// Apsaugome skandinaviškas raides
		processedContent = processedContent.replace(/([åäöÅÄÖ])/g, '<!--$1-->');
		let htmlContent = marked.parse(processedContent);
		console.log('9. Po marked:', htmlContent.substring(0, 200));
		
		htmlContent = htmlContent.replace(/<!--([åäöÅÄÖ])-->/g, '$1');
		
		console.log('10. Po skandinaviškų raidžių:', htmlContent.substring(0, 200));
	
		return htmlContent;
	}
}
