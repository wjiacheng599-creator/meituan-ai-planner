import { Request, Response } from 'express';
import { searchHotels, searchPOI, keywordSearch } from '../services/fliggyService.js';

export function createFliggyController() {
  return {
    async searchHotels(req: Request, res: Response) {
      try {
        const { city, keyword, poiName, checkInDate, checkOutDate, maxPrice, stars, sort } = req.query;
        if (!city) { res.status(400).json({ error: 'MISSING_CITY' }); return; }

        const result = await searchHotels({
          city: city as string,
          keyword: keyword as string,
          poiName: poiName as string,
          checkInDate: checkInDate as string,
          checkOutDate: checkOutDate as string,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          stars: stars as string,
          sort: sort as string,
        });

        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'FLIGGY_HOTEL_SEARCH_FAILED' });
      }
    },

    async searchPOI(req: Request, res: Response) {
      try {
        const { city, keyword, category, level } = req.query;
        if (!city) { res.status(400).json({ error: 'MISSING_CITY' }); return; }

        const result = await searchPOI({
          city: city as string,
          keyword: keyword as string,
          category: category as string,
          level: level ? Number(level) : undefined,
        });

        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'FLIGGY_POI_SEARCH_FAILED' });
      }
    },

    async keywordSearch(req: Request, res: Response) {
      try {
        const { query } = req.query;
        if (!query) { res.status(400).json({ error: 'MISSING_QUERY' }); return; }

        const result = await keywordSearch(query as string);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'FLIGGY_KEYWORD_SEARCH_FAILED' });
      }
    },
  };
}
