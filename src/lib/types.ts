import type { ThemeKey } from './themes';

export type Gift = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl?: string;
};

export type SelectedGift = Pick<Gift, 'id' | 'title' | 'linkUrl' | 'imageUrl'>;

export type SubmissionPayload = {
  name: string;
  gifts: SelectedGift[];
  createdAt: string;
};

export type ValentinePublicConfig = {
  toName: string;
  message: string;
  gifts: Gift[];
  createdAt: string;
  theme: ThemeKey;
};

export type ValentineCreatePayload = {
  toName: string;
  message: string;
  gifts: Gift[];
  creatorDiscordWebhookUrl?: string;
  theme: ThemeKey;
};

export type ValentineCreateResult = {
  slug: string;
  shareUrl: string;
  resultsUrl: string;
};

export type ValentineSubmission = {
  id: string;
  pickedGifts: SelectedGift[];
  pickedAt: string;
};
