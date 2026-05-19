import { logAction } from '@/lib/firebase/audit-service';

const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Asosiy funksiya
export async function sendTelegramMessage(text: string, chatId?: string): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) {
    console.warn('Telegram bot token mavjud emas');
    return { ok: false, error: 'Token topilmadi' };
  }
  
  const targetChatId = chatId || ADMIN_CHAT_ID;
  
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error('Telegram xato:', result);
      return { ok: false, error: result.description };
    }
    
    return { ok: true };
  } catch (error) {
    console.error('Telegram xabar yuborishda xato:', error);
    return { ok: false, error: String(error) };
  }
}

// Tugmalar bilan xabar yuborish (callback button)
export async function sendTelegramMessageWithButtons(
  text: string,
  buttons: Array<{ text: string; callback_data: string }>,
  chatId?: string
) {
  const targetChatId = chatId || ADMIN_CHAT_ID;
  
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [buttons],
        },
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Telegram xato:', error);
    return null;
  }
}

// Maxsus xabar turlari

export async function notifyDeviceLocked(deviceId: string, code: string, ip?: string) {
  const message = `🚨 <b>QURILMA BLOKLANDI</b>\n\n` +
    `🔒 Qurilma: <code>${deviceId.substring(0, 16)}...</code>\n` +
    `🔢 Oxirgi kod: <code>${code}</code>\n` +
    (ip ? `🌐 IP: <code>${ip}</code>\n` : '') +
    `⏰ Vaqt: ${new Date().toLocaleString('uz-UZ')}\n\n` +
    `💡 Ochish uchun: Dasturchi panel → Bloklangan qurilmalar`;
  
  return sendTelegramMessage(message);
}

export async function notifyLimitRequest(
  type: 'lokomotiv' | 'korxona',
  details: string,
  staffName: string,
  station: string,
  messageId?: string
) {
  const emoji = type === 'lokomotiv' ? '🚂' : '🏭';
  const typeName = type === 'lokomotiv' ? 'LOKOMOTIV' : 'KORXONA';
  
  const message = `${emoji} <b>YANGI LIMIT SO'ROVI</b>\n\n` +
    `📋 Bo'lim: ${typeName}\n` +
    `🏭 Stansiya: ${station}\n` +
    `👤 Ishchi: ${staffName}\n\n` +
    `📝 Tafsilot:\n${details}\n\n` +
    `⚡ Sayt orqali HA/YO'Q javob bering`;
  
  return sendTelegramMessage(message);
}

export async function notifyOverLimitEntry(
  category: string,
  staffName: string,
  station: string,
  amount: number,
  limit: number
) {
  const message = `⚠️ <b>LIMITDAN OSHGAN YOZUV</b>\n\n` +
    `📋 Bo'lim: ${category.toUpperCase()}\n` +
    `🏭 Stansiya: ${station}\n` +
    `👤 Ishchi: ${staffName}\n` +
    `📊 Miqdor: <b>${amount} kg</b>\n` +
    `🎯 Limit: ${limit} kg\n` +
    `📈 Oshiq: <b>+${amount - limit} kg</b>\n` +
    `⏰ ${new Date().toLocaleString('uz-UZ')}`;
  
  return sendTelegramMessage(message);
}

export async function sendDailyReport(reportData: any) {
  const message = `📊 <b>KUNLIK HISOBOT</b>\n` +
    `📅 ${new Date().toLocaleDateString('uz-UZ')}\n\n` +
    `🇺🇿 RESPUBLIKA JAMI:\n` +
    `• Sutkalik sarf: <b>${reportData.republicTotals?.sutkaTotal || 0} kg</b>\n` +
    `• Teplovozlarga: ${reportData.republicTotals?.teplovozTotal || 0} kg\n` +
    `• Korxonalarga: ${reportData.republicTotals?.korxonaTotal || 0} kg\n` +
    `• Qurulishga: ${reportData.republicTotals?.qurulishTotal || 0} kg\n` +
    `• Diz masla: ${reportData.republicTotals?.dizMasla || 0} kg\n\n` +
    `💡 Saytda batafsil ko'ring`;
  
  return sendTelegramMessage(message);
}
