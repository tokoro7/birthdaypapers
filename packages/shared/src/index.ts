export type Article = {
  id: string;
  date: string;
  headline: string;
  url: string;
  source: string;
};

export type Summary = {
  articleId: string;
  text: string;
};
