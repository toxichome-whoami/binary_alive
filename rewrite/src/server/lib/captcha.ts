export class CaptchaService {
  private static captchaStore = new Map<string, { answer: string; expiresAt: number }>();

  public static generate(sessionId: string): { text: string; svg: string } {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars (0, O, 1, I)
    let text = '';
    for (let i = 0; i < 5; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Store expected answer for 5 minutes
    this.captchaStore.set(sessionId, {
      answer: text.toUpperCase(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Generate lightweight SVG with noise lines and skewed text
    const width = 160;
    const height = 48;
    let lines = '';
    for (let i = 0; i < 5; i++) {
      const x1 = Math.floor(Math.random() * width);
      const y1 = Math.floor(Math.random() * height);
      const x2 = Math.floor(Math.random() * width);
      const y2 = Math.floor(Math.random() * height);
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#cbd5e1" stroke-width="1.5" />`;
    }

    let textChars = '';
    const charSpacing = width / 6;
    for (let i = 0; i < text.length; i++) {
      const x = 18 + i * charSpacing;
      const y = 32 + (Math.random() * 6 - 3);
      const rot = Math.floor(Math.random() * 24 - 12);
      textChars += `<text x="${x}" y="${y}" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="bold" fill="#1e293b" transform="rotate(${rot}, ${x}, ${y})">${text[i]}</text>`;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#f8fafc" rx="6" />
        ${lines}
        ${textChars}
      </svg>
    `.trim();

    return { text, svg };
  }

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
