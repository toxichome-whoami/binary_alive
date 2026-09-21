import crypto from 'crypto';
export class CaptchaService {
  private static captchaStore = new Map<string, { answer: string; expiresAt: number }>();

  public static generate(sessionId: string): { text: string; svg: string } {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars (0, O, 1, I)
    let text = '';
    for (let i = 0; i < 5; i++) {
      text += chars.charAt(crypto.randomInt(chars.length));
    }

    // Store expected answer for 5 minutes
    this.captchaStore.set(sessionId, {
      answer: text.toUpperCase(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Advanced anti-OCR SVG generation (Readable for humans, hard for bots)
    const width = 160;
    const height = 48;
    
    // Background noise patterns (circles)
    let dots = '';
    for (let i = 0; i < 40; i++) {
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const r = Math.random() * 2 + 0.5;
      const color = `rgba(${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, 0.3)`;
      dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;
    }

    // Background curves
    let lines = '';
    for (let i = 0; i < 8; i++) {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const strokeW = Math.random() * 1.5 + 0.5;
      const color = `rgba(${Math.floor(Math.random() * 120)}, ${Math.floor(Math.random() * 120)}, ${Math.floor(Math.random() * 120)}, 0.5)`;
      lines += `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" stroke="${color}" stroke-width="${strokeW}" fill="none" />`;
    }

    // Character distortion
    let textChars = '';
    const fonts = ['Arial', 'Courier New', 'Georgia', 'Verdana'];
    const weights = ['normal', 'bold', '900'];
    
    // Better spacing so they don't become a black blob
    const charSpacing = width / 6.2; 
    for (let i = 0; i < text.length; i++) {
      const x = 16 + i * charSpacing + (Math.random() * 4 - 2);
      const y = 32 + (Math.random() * 8 - 4);
      
      const rot = Math.floor(Math.random() * 30 - 15); // -15 to +15 deg
      const skewX = Math.floor(Math.random() * 20 - 10); // -10 to +10 deg
      const scaleY = 0.85 + Math.random() * 0.3; 
      const scaleX = 0.9 + Math.random() * 0.2;
      
      const r = Math.floor(Math.random() * 60);
      const g = Math.floor(Math.random() * 60);
      const b = Math.floor(Math.random() * 60);
      
      const font = fonts[Math.floor(Math.random() * fonts.length)];
      const weight = weights[Math.floor(Math.random() * weights.length)];
      
      textChars += `<text x="0" y="0" font-family="${font}, sans-serif" font-size="${26 + Math.random() * 4 - 2}" font-weight="${weight}" fill="rgb(${r},${g},${b})" transform="translate(${x}, ${y}) rotate(${rot}) skewX(${skewX}) scale(${scaleX}, ${scaleY})">${text[i]}</text>`;
    }

    // Foreground strike-through lines (fewer and slightly more transparent)
    let strikes = '';
    for (let i = 0; i < 3; i++) {
      const y = 18 + Math.random() * 12;
      const r = Math.floor(Math.random() * 80);
      const strokeW = Math.random() * 1.5 + 0.5;
      strikes += `<line x1="0" y1="${y + Math.random()*6 - 3}" x2="${width}" y2="${y + Math.random()*6 - 3}" stroke="rgb(${r},${r},${r})" stroke-width="${strokeW}" opacity="0.6" />`;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#d1d5db" rx="6" />
        ${dots}
        ${lines}
        ${textChars}
        ${strikes}
      </svg>
    `.trim();

    return { text, svg };
  }

  public static sweep() { const now = Date.now(); for (const [k, v] of this.captchaStore.entries()) { if (now > v.expiresAt) this.captchaStore.delete(k); } }

  public static verify(sessionId: string, answer: string, consume = true): boolean {
    const item = this.captchaStore.get(sessionId);
    if (!item) return false;

    // Check expiry
    if (Date.now() > item.expiresAt) {
      this.captchaStore.delete(sessionId);
      return false;
    }

    const isValid = item.answer === answer.trim().toUpperCase();
    if (isValid && consume) {
      // Consume the captcha on actual submit to prevent replay attacks
      this.captchaStore.delete(sessionId);
    }
    return isValid;
  }
}
