/**
 * @fileOverview Service for sending messages to a Telegram bot.
 */

export async function sendTelegramAlert(message: string): Promise<{ ok: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'true') {
    return { ok: true }; // Notifications are disabled, do nothing.
  }

  if (!botToken || !chatId) {
    const errorMsg = 'Telegram bot token or chat ID is not configured in environment variables.';
    console.error(errorMsg);
    return { ok: false, error: errorMsg };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
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
      console.error(errorMsg, errorData);
      return { ok: false, error: errorMsg };
    }
    
    console.log(`Successfully sent Telegram alert for chat ID ${chatId}.`);
    return { ok: true };

  } catch (error: any) {
    console.error('Failed to send Telegram message:', error);
    return { ok: false, error: error.message };
  }
}
