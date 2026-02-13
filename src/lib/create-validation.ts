import type { Gift } from './types';

export type GiftFormInput = Gift & { formId: string };

export type FieldErrors = {
  toName?: string;
  message?: string;
  gifts?: string;
  creatorDiscordWebhookUrl?: string;
  giftErrors: Record<string, Partial<Record<'title' | 'description' | 'imageUrl' | 'linkUrl', string>>>;
};

export const MAX_GIFTS = 12;
export const MIN_GIFTS = 3;
export const MAX_NAME = 60;
export const MAX_MESSAGE = 180;
export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 140;

export function isPublicHttpsUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    ) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

export function validateCreateForm(input: {
  toName: string;
  message: string;
  gifts: GiftFormInput[];
  discordWebhook: string;
}): FieldErrors {
  const { toName, message, gifts, discordWebhook } = input;
  const nextErrors: FieldErrors = { giftErrors: {} };
  if (!toName.trim()) nextErrors.toName = 'Please enter a name.';
  if (toName.trim().length > MAX_NAME) nextErrors.toName = `Keep it under ${MAX_NAME} characters.`;
  if (!message.trim()) nextErrors.message = 'Please add a short message.';
  if (message.trim().length > MAX_MESSAGE) nextErrors.message = `Keep it under ${MAX_MESSAGE} characters.`;
  if (gifts.length < MIN_GIFTS) nextErrors.gifts = `Add at least ${MIN_GIFTS} gifts.`;
  if (gifts.length > MAX_GIFTS) nextErrors.gifts = `Limit gifts to ${MAX_GIFTS}.`;

  if (discordWebhook.trim()) {
    const trimmed = discordWebhook.trim();
    const allowed =
      trimmed.startsWith('https://discord.com/api/webhooks/') ||
      trimmed.startsWith('https://discordapp.com/api/webhooks/');
    if (!allowed) {
      nextErrors.creatorDiscordWebhookUrl = 'Webhook must start with https://discord.com/api/webhooks/.';
    }
  }

  gifts.forEach((gift) => {
    const giftErrors: FieldErrors['giftErrors'][string] = {};
    const trimmedImageUrl = gift.imageUrl.trim();
    const trimmedLinkUrl = gift.linkUrl?.trim() ?? '';
    if (!gift.title.trim()) giftErrors.title = 'Title is required.';
    if (gift.title.length > MAX_TITLE) giftErrors.title = `Max ${MAX_TITLE} characters.`;
    if (!gift.description.trim()) giftErrors.description = 'Description is required.';
    if (gift.description.length > MAX_DESCRIPTION)
      giftErrors.description = `Max ${MAX_DESCRIPTION} characters.`;
    if (!trimmedImageUrl) giftErrors.imageUrl = 'Image URL is required.';
    if (trimmedImageUrl && !isPublicHttpsUrl(trimmedImageUrl))
      giftErrors.imageUrl = 'Use a valid public https URL.';
    if (trimmedLinkUrl && !isPublicHttpsUrl(trimmedLinkUrl))
      giftErrors.linkUrl = 'Use a valid public https URL.';
    if (Object.keys(giftErrors).length > 0) {
      nextErrors.giftErrors[gift.formId] = giftErrors;
    }
  });

  return nextErrors;
}
