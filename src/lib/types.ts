import type { Gift } from '../data/gifts';

export type SelectedGift = Pick<Gift, 'id' | 'title' | 'linkUrl'>;

export type SubmissionPayload = {
  name: string;
  gifts: SelectedGift[];
  createdAt: string;
};
