export type KidId = 'mason' | 'caden' | 'felix';
export type Occasion = 'birthday' | 'christmas' | 'any';
export type Priority = 'high' | 'medium' | 'low';

export interface WishItem {
  id: string;
  name: string;
  photo?: string;      // base64 compressed JPEG
  link?: string;       // direct product URL
  price?: number;      // estimated price in dollars
  priority: Priority;
  occasion: Occasion;
  notes: string;
  bought: boolean;
  claimedBy?: string;  // who is buying this
  addedAt: string;     // ISO date string
}

export interface Kid {
  id: KidId;
  name: string;
  color: string;
  lightColor: string;
  emoji: string;
}

export interface AppSettings {
  birthdays: Record<KidId, string>; // 'MM-DD' or ''
}

export type NewWishItem = Omit<WishItem, 'id' | 'bought' | 'addedAt'>;
