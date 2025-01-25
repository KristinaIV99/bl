
export class TextNormalizer {
    constructor() {
        this.patterns = {
            emphasis: [/_([^_]+)_/g, /\*([^*]+)\*/g],
            strong: [/__([^_]+)__/g, /\*\*([^*]+)\*\*/g],
            headers: /^(#{1,6})\s*(.+)$/gm,
            lists: /^[\s-]*[-+*]\s+/gm,
            blockquotes: /^>\s*(.+)$/gm,
            horizontalRules: /^(?:[-*_]\s*){3,}$/gm,
            codeBlocks: /```([^`]+)```/g,
            inlineCode: /`([^`]+)`/g
        };
    }

    async normalizeFile(file) {
        const text = await this.readFile(file);
        return this.normalize(text); // Pakeista iš normalizeText į normalize
    }

    normalize(text) { // Pakeista iš normalizeText į normalize
        let normalized = text
            .replace(/\uFEFF/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        normalized = this.normalizeFormatting(normalized);
        normalized = this.normalizeParagraphs(normalized);

        return normalized;
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                let text = e.target.result;
                if (text.includes('�')) {
                    reader.readAsText(file, 'windows-1257');
                    return;
                }
                resolve(text);
            };
            reader.onerror = () => reject(new Error('Failo skaitymo klaida'));
            reader.readAsText(file, 'UTF-8');
        });
    }

	convertEmphasis(text) {
        return text.replace(/\*([^*]+)\*/g, '<mark>$1</mark>');
    }

    normalize(text) {
		console.log('1. Pradinis tekstas:', text.substring(0, 200));
		
        let normalized = text
            .replace(/\uFEFF/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        normalized = this.normalizeFormatting(normalized);
		console.log('2. Po formatavimo:', normalized.substring(0, 200));
		
		normalized = this.normalizeParagraphs(normalized);
		console.log('3. Po paragrafų:', normalized.substring(0, 200));
		
		normalized = this.convertEmphasis(normalized);
		console.log('4. Po emphasis:', normalized.substring(0, 200));
	
        return normalized;
    }

    normalizeFormatting(text) {
		let result = text;
		
		// Konvertuojame paryškintą tekstą
		result = result
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/__([^_]+)__/g, '<strong>$1</strong>');
		
		// Pasvirą tekstą keičiame į _
		result = result
			.replace(/\*([^*]+)\*/g, '_$1_')
			.replace(/_([^_]+)_/g, '_$1_');
		
		// Pakeičiame trumpą brūkšnį sąrašo pradžioje į em dash
		result = result.replace(/^-\s+/gm, '— ');
		
		// Antraštės
		result = result.replace(this.patterns.headers, '$1 $2');
		
		// Sąrašai
		result = result.replace(this.patterns.lists, '* ');
		
		// Citatos
		result = result.replace(this.patterns.blockquotes, '> $1');
		
		// Horizontalios linijos
		result = result.replace(this.patterns.horizontalRules, '---');
		
		return result;
	}

    normalizeParagraphs(text) {
        return text
            // Pašaliname perteklinius tarpus eilutės pradžioje/pabaigoje
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            // Suvienodiname tarpus tarp paragrafų
            .replace(/\n{3,}/g, '\n\n')
            // Užtikriname, kad yra tuščia eilutė prieš ir po specifinių elementų
            .replace(/(\n[#>*-])/g, '\n\n$1')
            .replace(/(```.*```)/gs, '\n\n$1\n\n');
    }

	// Čia įdėkite naują metodą
    protectScandinavianLetters(text) {
        const scandChars = {
            'å': '<!--å-->',
            'ä': '<!--ä-->',
            'ö': '<!--ö-->',
            'Å': '<!--Å-->',
            'Ä': '<!--Ä-->',
            'Ö': '<!--Ö-->'
        };
        console.log('Prieš skandinaviškų raidžių apsaugą:', text.substring(0,200));
        const result = text.replace(/[åäöÅÄÖ]/g, char => scandChars[char]);
        console.log('Po skandinaviškų raidžių apsaugos:', result.substring(0,200));
        return result;
    }

    restoreScandinavianLetters(text) {
        console.log('Prieš raidžių atstatymą:', text.substring(0,200));
        const result = text.replace(/<!--([åäöÅÄÖ])-->/g, '$1');
        console.log('Po raidžių atstatymo:', result.substring(0,200));
        return result;
    }
}
