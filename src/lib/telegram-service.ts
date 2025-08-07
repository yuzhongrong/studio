/**
 * @fileOverview Service for sending messages to a Telegram bot.
 */

export async function sendTelegramAlert(message: string): Promise<{ ok: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'true') {
    console.log('[Telegram Service] Notifications are disabled via environment variable. Skipping.');
    return { ok: true }; 
  }

  if (!botToken || !chatId) {
    const errorMsg = 'Telegram bot token or chat ID is not configured in environment variables.';
    console.error(`[Telegram Service] Error: ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    console.log(`[Telegram Service] Sending message to chat ID ${chatId}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = `Telegram API error: ${errorData.description || response.statusText}`;
      console.error(`[Telegram Service] Error: ${errorMsg}`, errorData);
      return { ok: false, error: errorMsg };
    }
    
    console.log(`[Telegram Service] Successfully sent alert to chat ID ${chatId}.`);
    return { ok: true };

  } catch (error: any) {
    console.error('[Telegram Service] Failed to send message due to a network or other error:', error);
    return { ok: false, error: error.message };
  }
}
