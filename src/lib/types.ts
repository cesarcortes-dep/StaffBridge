export type Channel = "Airbnb" | "VRBO" | "Booking.com" | "Direct";
export type Language = "en" | "es" | "pt";

export type Review = {
  review_id: string;
  property_id: string;
  property_name: string;
  city: string;
  country: string;
  property_type: string;
  bedrooms: number;
  channel: Channel;
  guest_first_name: string;
  guest_country: string;
  stay_start_date: string;
  stay_end_date: string;
  nights: number;
  review_date: string;
  rating_overall: number;
  rating_cleanliness: number | null;
  rating_communication: number | null;
  rating_checkin: number | null;
  rating_accuracy: number | null;
  rating_location: number | null;
  rating_value: number | null;
  language: Language;
  review_text: string;
  host_response: string | null;
  host_response_date: string | null;
};

export type Filters = {
  from?: string;
  to?: string;
  channel?: Channel;
  language?: Language;
  ratingMin?: number;
  ratingMax?: number;
  propertyId?: string;
};

export type PortfolioKpis = {
  totalReviews: number;
  avgOverall: number;
  responseRate: number;
  medianResponseLatencyDays: number | null;
  unansweredCount: number;
};

export type PropertyRow = {
  property_id: string;
  property_name: string;
  city: string;
  country: string;
  reviewCount: number;
  avgOverall: number;
  responseRate: number;
  lastReviewDate: string;
  lowStarLast90: number;
  subAverages: Partial<Record<
    | "cleanliness"
    | "communication"
    | "checkin"
    | "accuracy"
    | "location"
    | "value",
    number | null
  >>;
};

export type MonthlyPoint = {
  ym: string;
  avgRating: number;
  reviewCount: number;
};

export type PropertyMeta = {
  property_id: string;
  property_name: string;
  city: string;
  country: string;
  property_type: string;
  bedrooms: number;
};

export type QueueItem = Review & { priority: number; ageDays: number };

export type Theme = {
  cluster_id: number;
  size: number;
  label: string | null;
  description: string | null;
  representative_review_ids: string[];
  labeled_at: string | null;
};

