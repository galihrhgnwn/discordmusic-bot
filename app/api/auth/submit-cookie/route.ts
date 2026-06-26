import { NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';
import { consumePendingAuth, saveUserCookie } from '../../../../discordbot/core/userSessionManager.js';

function parseCookieString(input: string): string {
  if (!input) return '';
  
  // If it is already a standard cookie string, just return it (checking for `=` and `;`, but avoiding tabs which indicate Netscape)
  if (input.includes('=') && !input.includes('\t') && !input.startsWith('#')) {
     return input.trim();
  }
  
  // Try parsing as JSON (if copied from some other cookie extensions)
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.map(c => `${c.name}=${c.value}`).join('; ');
    }
  } catch (e) {
    // Not JSON
  }

  // Fallback: Parse Netscape HTTP Cookie File format (tab-separated or space-separated)
  const lines = input.split('\n');
  const cookies = [];
  for (const line of lines) {
    // Skip entirely empty lines or comments
    if (line.trim().startsWith('#') || line.trim() === '') continue;
    
    const parts = line.split('\t');
    if (parts.length >= 7) {
      const name = parts[5].trim();
      const value = parts[6].trim();
      cookies.push(`${name}=${value}`);
    } else {
      // Sometimes copy-paste converts tabs to multiple spaces
      const spaceParts = line.split(/\s+/);
      if (spaceParts.length >= 7) {
        const name = spaceParts[5].trim();
        // The value might have spaces in it, so we rejoin the rest
        const value = spaceParts.slice(6).join(' ').trim();
        cookies.push(`${name}=${value}`);
      }
    }
  }
  
  if (cookies.length > 0) {
    return cookies.join('; ');
  }

  return input.trim();
}

export async function POST(req: Request) {
  try {
    const { token, cookie: rawCookie } = await req.json();

    if (!token || !rawCookie) {
      return NextResponse.json({ error: 'Missing token or cookie' }, { status: 400 });
    }

    const userId = consumePendingAuth(token);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const cookie = parseCookieString(rawCookie);

    // Cookie dari music.youtube.com harus mengandung salah satu ini
    const REQUIRED_COOKIES = [
      'SID', 'SSID', 'HSID',
      '__Secure-1PSID', '__Secure-3PSID',
      'SAPISID', '__Secure-1PAPISID'
    ]

    const cookieLower = cookie.toLowerCase()
    const hasRequired = REQUIRED_COOKIES.some(name =>
      cookie.includes(name + '=')
    )

    if (!hasRequired) {
      return NextResponse.json({
        error: 'Cookie tidak valid. Pastikan kamu export dari music.youtube.com, bukan website lain.'
      }, { status: 400 })
    }

    // Tambahkan log untuk debug
    console.log(`[Auth] User ${userId} submitted cookie, length: ${cookie.length}`)

    try {
      // Validate the cookie by attempting to create an Innertube instance
      const yt = await Innertube.create({ cookie });
      const info = await yt.account.getInfo();
      
      let accountName = 'YouTube User';
      let accountEmail = 'YouTube User';
      
      // Try to get account name from AccountInfo structure
      try {
        if (info.contents && info.contents.contents) {
            const accountItems = info.contents.contents.filter(i => i.type === 'AccountItem');
            const selectedItem = accountItems.find(i => (i as any).is_selected) || accountItems[0];
            if (selectedItem) {
              accountName = (selectedItem as any).account_name?.toString() || (selectedItem as any).channel_handle?.toString() || accountName;
              accountEmail = (selectedItem as any).account_byline?.toString() || accountEmail;
            }
        } else if (Array.isArray(info)) { // If getInfo() returns an array
            const selectedItem = info.find(i => (i as any).is_selected) || info[0];
            if (selectedItem) {
              accountName = (selectedItem as any).account_name?.toString() || (selectedItem as any).channel_handle?.toString() || accountName;
              accountEmail = (selectedItem as any).account_byline?.toString() || accountEmail;
            }
        } else if ((info as any).name || (info as any).account_name) { // Fallbacks
             accountName = (info as any).name || (info as any).account_name;
             accountEmail = (info as any).email || accountName;
        }
      } catch (e) {
        console.error("Error parsing account info:", e);
      }
      
      saveUserCookie(userId, cookie, {
        accountName: accountName,
        accountEmail: accountEmail,
        userId: userId,
        loginTime: new Date().toISOString()
      });

      return NextResponse.json({ success: true, accountName });
    } catch (e: any) {
      console.error("Failed to authenticate with cookie:", e);
      return NextResponse.json({ error: 'Invalid cookie. Please ensure you copied it correctly.' }, { status: 400 });
    }

  } catch (e: any) {
    console.error("Cookie submission error:", e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
