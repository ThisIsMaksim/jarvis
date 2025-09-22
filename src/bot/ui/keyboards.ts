import { InlineKeyboard } from 'grammy';

export function createStartKeyboard(botUsername: string) {
  return new InlineKeyboard()
    .url('➕ Добавить в групповой чат', `https://t.me/${botUsername}?startgroup=true`);
}

export function createModelSelectionKeyboard() {
  return new InlineKeyboard()
    .text('🟢 OpenAI GPT-4o-mini', 'model_openai_gpt-4o-mini')
    .text('🔵 Google Gemini 1.5', 'model_gemini_1.5-flash')
    .row();
}

export function createSummaryKeyboard() {
  return new InlineKeyboard()
    .text('📅 За день', 'summary_day')
    .text('📆 За неделю', 'summary_week')
    .row()
    .text('🗓 За месяц', 'summary_month')
    .text('📋 За год', 'summary_year');
}

export function createReminderActionsKeyboard(reminderId: string) {
  return new InlineKeyboard()
    .text('❌ Отменить', `cancel_reminder_${reminderId}`)
    .text('✏️ Изменить', `edit_reminder_${reminderId}`);
}

export function createTopicSettingsKeyboard(topicId: string) {
  return new InlineKeyboard()
    .text('🤖 Сменить модель', `topic_model_${topicId}`)
    .text('⚙️ Настройки', `topic_settings_${topicId}`)
    .row()
    .text('📊 Саммари', `topic_summary_${topicId}`)
    .text('⏰ Напоминания', `topic_reminders_${topicId}`);
}

export function createConfirmationKeyboard(action: string, id: string) {
  return new InlineKeyboard()
    .text('✅ Да', `confirm_${action}_${id}`)
    .text('❌ Нет', `cancel_${action}_${id}`);
}

export function createBackKeyboard(backTo: string) {
  return new InlineKeyboard()
    .text('⬅️ Назад', `back_${backTo}`);
}

export function createPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  prefix: string
) {
  const keyboard = new InlineKeyboard();
  
  if (currentPage > 1) {
    keyboard.text('⬅️', `${prefix}_page_${currentPage - 1}`);
  }
  
  keyboard.text(`${currentPage}/${totalPages}`, 'noop');
  
  if (currentPage < totalPages) {
    keyboard.text('➡️', `${prefix}_page_${currentPage + 1}`);
  }
  
  return keyboard;
}

export function createMainMenuKeyboard() {
  return new InlineKeyboard()
    .text('📝 Создать заметку', 'create_note')
    .text('⏰ Напоминания', 'show_reminders')
    .row()
    .text('📊 Саммари', 'show_summary')
    .text('⚙️ Настройки', 'show_settings');
}